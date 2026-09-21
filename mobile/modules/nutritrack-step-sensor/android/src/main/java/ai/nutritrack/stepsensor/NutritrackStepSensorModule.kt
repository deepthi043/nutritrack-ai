package ai.nutritrack.stepsensor

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS-facing surface for the native step-sensor engine (Section 2). Thin by
 * design: all baseline/state-machine logic lives in StepTrackingService so
 * it keeps running independent of whether this module (and the JS engine
 * hosting it) is currently alive — this module only starts/stops the
 * service, answers permission/availability queries, reads current state
 * from the SharedPreferences file the service writes to, and forwards
 * state changes to JS as events.
 */
class NutritrackStepSensorModule : Module() {

    private var prefsListener: SharedPreferences.OnSharedPreferenceChangeListener? = null

    override fun definition() = ModuleDefinition {
        Name("NutritrackStepSensor")

        Events("todayStepsChanged", "activityStateChanged")

        // Section 2: hardware capability check — used by the JS provider
        // factory to decide whether AndroidNativeActivityProvider can be
        // offered at all on this device (Section 9's "sensor unavailable"
        // path) before ever registering anything.
        Function("isStepCounterAvailable") {
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
        }

        Function("isStepDetectorAvailable") {
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null
        }

        // Section 2's explicit diagnostic requirement: surface exactly what
        // the OS reports for each sensor (or null if genuinely absent) so a
        // "sensor unavailable" claim can be verified against real hardware
        // info instead of taken on faith, and so it's possible to tell
        // apart "this phone really has no step counter" from "the native
        // module failed to load" from the returned shape alone.
        Function("getDiagnostics") {
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            val stepCounter = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            val stepDetector = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

            fun describe(sensor: Sensor?): Map<String, Any?> {
                if (sensor == null) return mapOf("available" to false)
                return mapOf(
                    "available" to true,
                    "name" to sensor.name,
                    "vendor" to sensor.vendor,
                    "version" to sensor.version,
                    "type" to sensor.type
                )
            }

            mapOf(
                "nativeModuleLoaded" to true, // reaching this line at all proves it
                "sensorManagerAvailable" to (sensorManager != null),
                "stepCounter" to describe(stepCounter),
                "stepDetector" to describe(stepDetector),
                "hasActivityRecognitionPermission" to hasPermission()
            )
        }

        Function("hasActivityRecognitionPermission") {
            hasPermission()
        }

        // The actual OS permission prompt is triggered from the JS/React
        // layer via expo's standard permissions flow (PermissionsAndroid /
        // an Expo permissions hook) — this module only reports current
        // state and starts the service once permission is confirmed
        // granted, per the existing PermissionGate UX pattern (never
        // auto-prompt on mount).
        Function("startTracking") {
            if (!hasPermission()) {
                throw PermissionMissingException()
            }
            val intent = Intent(context, StepTrackingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, intent)
            } else {
                context.startService(intent)
            }
        }

        Function("stopTracking") {
            context.stopService(Intent(context, StepTrackingService::class.java))
        }

        // Section 3/12: read current state directly from the same
        // SharedPreferences the service persists to, so this works
        // whether or not the service happens to be running right now
        // (e.g. right after app launch, before startTracking() has been
        // called this session) — state survives app restart because
        // SharedPreferences does, independent of the service's lifecycle.
        Function("getCurrentState") {
            val prefs = prefs()
            mapOf(
                "todaySteps" to prefs.getInt(StepTrackingService.KEY_TODAY_STEPS, 0),
                "activeSeconds" to prefs.getInt(StepTrackingService.KEY_ACTIVE_SECONDS, 0),
                "activityState" to (prefs.getString(StepTrackingService.KEY_ACTIVITY_STATE, "IDLE") ?: "IDLE"),
                "hasBaseline" to (prefs.getInt(StepTrackingService.KEY_BASELINE, -1) != -1),
                "baselineDate" to prefs.getString(StepTrackingService.KEY_BASELINE_DATE, null)
            )
        }

        OnCreate {
            // Forwards every state write the service makes into a JS
            // event (Section 5's "real-time UI update" requirement).
            // Listening on SharedPreferences rather than a broadcast
            // means a change is never missed even if this listener is
            // (re)attached slightly after the service wrote it — the
            // very next getCurrentState() call would also see it.
            val listener = SharedPreferences.OnSharedPreferenceChangeListener { sp, key ->
                when (key) {
                    StepTrackingService.KEY_TODAY_STEPS -> {
                        sendEvent("todayStepsChanged", mapOf("todaySteps" to sp.getInt(key, 0)))
                    }
                    StepTrackingService.KEY_ACTIVITY_STATE -> {
                        sendEvent("activityStateChanged", mapOf("activityState" to (sp.getString(key, "IDLE") ?: "IDLE")))
                    }
                }
            }
            prefsListener = listener
            prefs().registerOnSharedPreferenceChangeListener(listener)
        }

        OnDestroy {
            prefsListener?.let { prefs().unregisterOnSharedPreferenceChangeListener(it) }
            prefsListener = null
        }
    }

    private fun prefs(): SharedPreferences =
        context.getSharedPreferences(StepTrackingService.PREFS_NAME, Context.MODE_PRIVATE)

    private fun hasPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            // ACTIVITY_RECOGNITION was introduced as a runtime permission
            // in API 29; TYPE_STEP_COUNTER/TYPE_STEP_DETECTOR are usable
            // without it on older OS versions.
            return true
        }
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private val context get() = appContext.reactContext ?: throw MissingContextException()
}

internal class PermissionMissingException :
    expo.modules.kotlin.exception.CodedException("ACTIVITY_RECOGNITION permission not granted")

internal class MissingContextException :
    expo.modules.kotlin.exception.CodedException("React context is not available")
