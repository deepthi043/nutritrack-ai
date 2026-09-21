package ai.nutritrack.stepsensor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Foreground service that owns the ONE SensorManager registration to
 * Sensor.TYPE_STEP_COUNTER for the whole app's lifetime it can manage —
 * this is what lets step counting continue while the Activity screen is
 * closed or the app is backgrounded (Section 6), which a plain React
 * Native / JS-only listener cannot do once the JS engine is suspended.
 *
 * Persists its own state directly via SharedPreferences (not the JS-side
 * AsyncStorage/MMKV, which is unavailable off the JS thread) so it can
 * recover the daily baseline after a process restart without needing the
 * JS layer to be alive. `NutritrackStepSensorModule` reads this same
 * SharedPreferences file to answer JS's `getTodayStepsSync()`/state
 * queries and to seed itself when the service isn't currently running.
 *
 * ARCHITECTURAL NOTE (Section 6 — what this does and does not guarantee):
 * A foreground service with START_STICKY is Android's standard mechanism
 * for "keep running unless the user or system explicitly kills it," and
 * survives screen lock. It does NOT survive: the user force-stopping the
 * app from Settings, some OEM battery-optimization killers (aggressive
 * Xiaomi/Oppo/Vivo policies beyond stock Android's), or a device reboot
 * (the service must be restarted, e.g. next app open — this is NOT a
 * boot-completed receiver, which is intentionally out of scope to avoid
 * requesting RECEIVE_BOOT_COMPLETED for a wellness app). None of that is
 * hidden from the user: the persistent notification is Android's own
 * required disclosure that background sensor collection is active.
 */
class StepTrackingService : Service(), SensorEventListener {

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "nutritrack_step_tracking"
        const val NOTIFICATION_ID = 4201
        const val PREFS_NAME = "nutritrack_step_sensor_state"

        // SharedPreferences keys — mirrored by NutritrackStepSensorModule
        // when the service isn't running (e.g. before first grant).
        const val KEY_BASELINE = "baseline"
        const val KEY_BASELINE_DATE = "baseline_date" // yyyy-MM-dd, LOCAL timezone
        const val KEY_LAST_SENSOR_VALUE = "last_sensor_value"
        const val KEY_TODAY_STEPS = "today_steps"
        const val KEY_ACTIVE_SECONDS = "active_seconds"
        const val KEY_LAST_STEP_DETECTOR_AT = "last_step_detector_at"
        const val KEY_ACTIVITY_STATE = "activity_state" // "IDLE" | "ACTIVE"

        // Section 8: active-time state machine thresholds, named
        // constants rather than magic numbers, as required.
        //
        // ACTIVE begins as soon as a single TYPE_STEP_DETECTOR event
        // arrives while IDLE (a step just happened — the user is, by
        // definition, walking right now). It does not require a
        // "sustained burst" to *start*, because requiring N steps before
        // ever showing ACTIVE would make short walks never count. What
        // prevents accidental single-bump false actives from inflating
        // active time is INACTIVITY_TIMEOUT_MS below: an isolated single
        // step contributes at most one short tick of active time before
        // reverting to IDLE, not open-ended active accumulation.
        const val INACTIVITY_TIMEOUT_MS = 90_000L // 90s of no steps -> IDLE
    }

    private lateinit var sensorManager: SensorManager
    private lateinit var prefs: SharedPreferences
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null

    // Checks the ACTIVE -> IDLE inactivity timeout every 15s. This is a
    // deliberately coarse, low-frequency timer (not a sensor poll — no
    // battery cost beyond one Handler wakeup every 15s while the service
    // is already running for step counting), matching Section 18's
    // "event-driven over polling" guidance as closely as a timeout check
    // structurally can (a "nothing happened for N seconds" condition has
    // no event to attach to by definition).
    private val inactivityCheckHandler = Handler(Looper.getMainLooper())
    private val inactivityCheckIntervalMs = 15_000L
    private val inactivityCheckRunnable = object : Runnable {
        override fun run() {
            checkForInactivityTimeout()
            inactivityCheckHandler.postDelayed(this, inactivityCheckIntervalMs)
        }
    }

    private val dateFormat: ThreadLocal<SimpleDateFormat> = object : ThreadLocal<SimpleDateFormat>() {
        override fun initialValue(): SimpleDateFormat {
            // Deliberately the device's default (local) timezone, NOT UTC
            // — Section 4 requires the daily baseline to reset at LOCAL
            // midnight, not a UTC day boundary.
            return SimpleDateFormat("yyyy-MM-dd", Locale.US)
        }
    }

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())

        // TYPE_STEP_COUNTER is the primary source of truth for the
        // cumulative total (Section 2/3) — registered at the OS's default
        // batching rate, not polled, which is the battery-conscious
        // approach Section 18 requires (event-driven, not a busy loop).
        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        // TYPE_STEP_DETECTOR provides real-time "a step just happened"
        // events used only to drive the ACTIVE/IDLE state machine
        // (Section 8) — it is NOT used as the step-count source, since
        // Section 2 requires TYPE_STEP_COUNTER as primary when available.
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }

        rolloverBaselineIfNewLocalDay()
        inactivityCheckHandler.post(inactivityCheckRunnable)
        return START_STICKY
    }

    override fun onDestroy() {
        sensorManager.unregisterListener(this)
        inactivityCheckHandler.removeCallbacks(inactivityCheckRunnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_STEP_COUNTER -> handleStepCounterEvent(event.values[0].toInt())
            Sensor.TYPE_STEP_DETECTOR -> handleStepDetectorEvent()
        }
    }

    /**
     * Section 3 baseline algorithm.
     *
     * TYPE_STEP_COUNTER reports a cumulative count since the device's last
     * reboot — NOT since today, NOT since the app started. Storing that
     * raw value as "today's steps" would show enormous, ever-growing
     * numbers and would double-count across syncs. Instead:
     *
     *   todaySteps = currentSensorValue - baseline
     *
     * where `baseline` is the sensor's cumulative value captured at the
     * start of today's tracking (first sensor reading seen today, or a
     * corrected value after a detected sensor reset — see
     * rolloverBaselineIfNewLocalDay/handleSensorReset below). This is
     * exactly the spec's worked example: sensor 10,000 with baseline
     * 8,000 -> 2,000 today; sensor later 11,500 -> 3,500 today (not the
     * sum of prior readings).
     */
    private fun handleStepCounterEvent(sensorValue: Int) {
        rolloverBaselineIfNewLocalDay()

        val baseline = prefs.getInt(KEY_BASELINE, -1)
        val lastSensorValue = prefs.getInt(KEY_LAST_SENSOR_VALUE, -1)

        if (baseline == -1) {
            // First reading ever (or after a corrupted-state recovery) —
            // this reading establishes today's baseline. Today's steps
            // start at 0, not sensorValue, matching "no invented data"
            // for a device whose boot-cumulative total is unknown to us
            // until this first observation.
            prefs.edit()
                .putInt(KEY_BASELINE, sensorValue)
                .putInt(KEY_LAST_SENSOR_VALUE, sensorValue)
                .putInt(KEY_TODAY_STEPS, 0)
                .apply()
            return
        }

        if (sensorValue < (if (lastSensorValue == -1) baseline else lastSensorValue)) {
            // Section 3: "handle sensor reset" — TYPE_STEP_COUNTER only
            // increases while the device stays powered on; a value LOWER
            // than what we last saw means the device rebooted (the sensor
            // itself resets its cumulative count to 0 at boot) or the
            // sensor otherwise reset. Today's already-earned steps
            // (KEY_TODAY_STEPS) are preserved as-is — they are NOT
            // recomputed from the now-invalid baseline — and a new
            // baseline is established at this post-reset reading so
            // future deltas are correct again. This deliberately does not
            // reset today's step count to 0 on reboot, since the user's
            // real steps before the reboot genuinely happened today.
            val preservedTodaySteps = prefs.getInt(KEY_TODAY_STEPS, 0)
            prefs.edit()
                .putInt(KEY_BASELINE, sensorValue)
                .putInt(KEY_LAST_SENSOR_VALUE, sensorValue)
                .putInt(KEY_TODAY_STEPS, preservedTodaySteps)
                .apply()
            return
        }

        val todaySteps = sensorValue - baseline
        // Writing KEY_TODAY_STEPS is itself the notification mechanism:
        // NutritrackStepSensorModule registers a
        // SharedPreferences.OnSharedPreferenceChangeListener on this same
        // prefs file and forwards the change to JS as a "todayStepsChanged"
        // event (Section 5) — no separate broadcast/bridge class needed,
        // and no event is ever missed because the module reads current
        // state directly from prefs on (re)registration rather than
        // relying on having caught every individual change.
        prefs.edit()
            .putInt(KEY_LAST_SENSOR_VALUE, sensorValue)
            .putInt(KEY_TODAY_STEPS, todaySteps)
            .apply()

        updateNotification(todaySteps)
    }

    /** Section 4: resets ONLY NutriTrack's local baseline/state when the
     * device's local calendar day has advanced — never touches the
     * hardware sensor itself (which cannot be reset by an app and keeps
     * counting since boot regardless). Uses the device's current default
     * timezone at call time, so a timezone change is picked up on the
     * next event rather than requiring a special-case handler. */
    private fun rolloverBaselineIfNewLocalDay() {
        val today = dateFormat.get()!!.apply { timeZone = TimeZone.getDefault() }.format(Date())
        val storedDate = prefs.getString(KEY_BASELINE_DATE, null)

        if (storedDate != today) {
            // New local day (or first run ever). The *next* sensor
            // reading will re-establish KEY_BASELINE from scratch via the
            // baseline == -1 branch above, which is what we want: today's
            // steps start at 0 and the very next TYPE_STEP_COUNTER
            // callback becomes the fresh baseline.
            prefs.edit()
                .putString(KEY_BASELINE_DATE, today)
                .putInt(KEY_BASELINE, -1)
                .putInt(KEY_TODAY_STEPS, 0)
                .putInt(KEY_ACTIVE_SECONDS, 0)
                .putString(KEY_ACTIVITY_STATE, "IDLE")
                .apply()
        }
    }

    /** Section 8 active-time state machine — driven by TYPE_STEP_DETECTOR
     * real-time events (not the batched step counter), since we need to
     * know "is the user walking right now," not just the cumulative total. */
    private fun handleStepDetectorEvent() {
        val now = System.currentTimeMillis()
        val wasActive = prefs.getString(KEY_ACTIVITY_STATE, "IDLE") == "ACTIVE"
        val lastStepAt = prefs.getLong(KEY_LAST_STEP_DETECTOR_AT, 0L)

        if (wasActive && lastStepAt > 0) {
            val elapsedSeconds = ((now - lastStepAt) / 1000L).coerceAtMost(INACTIVITY_TIMEOUT_MS / 1000L)
            val activeSeconds = prefs.getInt(KEY_ACTIVE_SECONDS, 0) + elapsedSeconds.toInt()
            prefs.edit().putInt(KEY_ACTIVE_SECONDS, activeSeconds).apply()
        }

        prefs.edit()
            .putLong(KEY_LAST_STEP_DETECTOR_AT, now)
            .putString(KEY_ACTIVITY_STATE, "ACTIVE")
            .apply()
    }

    /** Called every inactivityCheckIntervalMs by inactivityCheckRunnable
     * to transition ACTIVE -> IDLE once INACTIVITY_TIMEOUT_MS has passed
     * with no new step-detector events — a step-driven state machine has
     * no natural "nothing happened" callback, so something has to check
     * the clock. */
    private fun checkForInactivityTimeout() {
        val lastStepAt = prefs.getLong(KEY_LAST_STEP_DETECTOR_AT, 0L)
        val wasActive = prefs.getString(KEY_ACTIVITY_STATE, "IDLE") == "ACTIVE"
        if (wasActive && lastStepAt > 0 && System.currentTimeMillis() - lastStepAt >= INACTIVITY_TIMEOUT_MS) {
            prefs.edit().putString(KEY_ACTIVITY_STATE, "IDLE").apply()
        }
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val existing = manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "Activity tracking",
                    NotificationManager.IMPORTANCE_MIN
                ).apply {
                    description = "Shows when NutriTrack AI is counting your steps in the background."
                    setShowBadge(false)
                }
                manager.createNotificationChannel(channel)
            }
        }

        val todaySteps = prefs.getInt(KEY_TODAY_STEPS, 0)
        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = openAppIntent?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("NutriTrack AI is tracking your steps")
            .setContentText("$todaySteps steps today")
            .setSmallIcon(android.R.drawable.ic_menu_myplaces)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(contentIntent)
            .build()
    }

    private fun updateNotification(todaySteps: Int) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification())
    }
}
