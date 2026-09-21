# NutriTrack AI — Mobile

React Native (Expo) application for real device step/activity tracking, synced
with the same FastAPI backend the web app uses. **No separate backend** and
**no separate authentication system** — this app is a thin client over the
existing API.

## Status

**AUTOMATED TESTED vs. PHYSICAL DEVICE VERIFIED — these are different claims
and this README does not conflate them.**

- Phase 6 (Health Connect-based tracking) was installed and exercised on a
  real Android phone via an EAS development build: sign-up/login, Health
  Connect permission grant, a real step reading synced to the backend, and
  the manual-entry fallback were all observed working end-to-end on that
  device.
- **Phase 6.1** (this native step-sensor engine — see
  [Native Android Activity Tracking Engine](#native-android-activity-tracking-engine-phase-61)
  below) is **AUTOMATED TESTED ONLY as of this change**: the Kotlin native
  module, foreground service, and JS provider compile, pass `tsc`/`eslint`,
  and are covered by Jest tests against mocked/pure-logic equivalents of
  the native code. **It has NOT yet been run on a physical Android device.**
  Do not read "compiles and passes unit tests" as "real-time accurate step
  tracking confirmed" — Section 20/21 of the Phase 6.1 spec require an
  actual device walkthrough (17 numbered tests) and controlled accuracy
  trials (walk 100/500 steps, stand still, shake test, vehicle test) before
  this can be called device-verified. See
  [Physical-device test procedure](#physical-device-test-procedure) for the
  exact steps to run that verification, and
  [Known limitations](#known-limitations) for what remains explicitly
  unconfirmed.
- iOS has **not** been tested on physical hardware at all — HealthKit and
  the iOS-specific active-minutes gap remain unverified.

## Tech Stack

- **Expo SDK 57.0.22**, **React Native 0.86.3**, **React 19.2.3**, **TypeScript ~6.0.3**
  (versions pulled directly from the official `expo-template-blank-typescript@57.0.24`
  package — not guessed — then resolved for every added dependency via `npx expo install`,
  which checks each package against this SDK's compatibility matrix)
- `@react-navigation` (native-stack + bottom-tabs) for navigation
- `expo-secure-store` for the auth token (OS keychain/keystore — **never** AsyncStorage)
- `@react-native-async-storage/async-storage` for non-sensitive local state (offline sync queue, last-synced timestamp)
- `@react-native-community/netinfo` for connectivity detection
- `react-native-health-connect` (Android) and `@kingstinct/react-native-healthkit` (iOS) for real activity data
- Jest + `jest-expo` + `@testing-library/react-native` for tests

## Project Structure

```
mobile/
├── app/                    Screens + navigation (LoginScreen, HomeScreen, ActivityScreen, navigation.tsx)
├── components/              Reusable UI (Button, Card, ProgressBar, activity/*)
├── services/                 API clients + the ActivityProvider abstraction
│   └── activityProviders/    MockActivityProvider, AndroidHealthProvider, IOSHealthProvider
├── hooks/                    useActivityPermission, useActivitySync
├── providers/                AuthProvider (React context, mirrors the web app's)
├── types/                    Shared TypeScript types (mirrors backend response shapes)
├── storage/                  secureStorage.ts (token), syncQueueStorage.ts (offline queue)
└── __tests__/                Jest tests
```

## Running Locally

```bash
cd mobile
npm install
npx expo start
```

Then either:
- Press `a` / `i` to open in an Android/iOS emulator, or
- Scan the QR code with **Expo Go** on a physical device — but see the
  [Expo Go limitation](#expo-go-vs-a-development-build) below: real
  Health Connect / HealthKit data is **not** available in Expo Go.

### Pointing the app at your backend

The API base URL is set in `app.json` under `expo.extra.apiBaseUrl` (defaults
to `http://localhost:8010`).

- **Emulator/simulator**: `localhost` usually works as-is (Android emulator
  may need `http://10.0.2.2:8010` instead — Android's emulator loopback alias).
- **Physical device**: `localhost` on the phone is the phone itself, not your
  computer. Change `apiBaseUrl` to your computer's LAN IP, e.g.
  `http://192.168.1.23:8010`, and make sure the backend is started with
  `--host 0.0.0.0` (not `127.0.0.1`) so it accepts connections from other
  devices on the network, and that your firewall allows the port.

## Authentication (Section 3)

Reuses the exact same FastAPI endpoints as the web app —
`/api/auth/register`, `/api/auth/login`, `/api/auth/me` — via
`services/authService.ts`. No mobile-specific auth system.

- The JWT is stored with `expo-secure-store` (`storage/secureStorage.ts`),
  which uses the iOS Keychain / Android Keystore — never plain AsyncStorage
  or React state alone.
- `providers/AuthProvider.tsx` rehydrates the session on launch by verifying
  the stored token against `/api/auth/me` (not just trusting a cached user),
  matching the web app's `AuthContext` pattern exactly.
- A 401 response from any API call (expired/invalid token) clears the stored
  token and logs the user out immediately (`services/api.ts`'s
  `setUnauthorizedHandler`).
- `app/navigation.tsx`'s `RootNavigator` only mounts the main tab
  navigator when `isAuthenticated` is true — the entire authenticated
  screen tree is simply unreachable while logged out, which is how "protected
  routes" work in this app (there's no separate route-guard component to bypass).

## Activity Provider Architecture (Section 6)

Mirrors the backend's own `ActivityProvider` abstraction
(`backend/app/services/activity_provider.py`) on the client side:

```
ActivityProvider (interface: isAvailable, getPermissionState, requestPermission, readTodayActivity)
      │
      ├── MockActivityProvider     — always available, zeroed reading, source="mock"
      ├── AndroidHealthProvider    — react-native-health-connect, source="android_health"
      └── IOSHealthProvider        — @kingstinct/react-native-healthkit, source="ios_health"
```

`services/activityProviders/index.ts`'s `getPlatformActivityProvider()` picks
the right one automatically:
- **Expo Go** (any platform) → `MockActivityProvider`, because no native
  module (step-sensor, Health Connect, HealthKit) is present in Expo Go's
  sandboxed runtime — this is an Expo/App Store constraint, not a bug to
  work around.
- **Android dev build** → `AndroidNativeActivityProvider` (as of Phase 6.1
  — see [Native Android Activity Tracking Engine](#native-android-activity-tracking-engine-phase-61)).
  `AndroidHealthProvider` (Health Connect) still exists and is exported for
  any caller that specifically wants it, but the factory no longer selects
  it by default.
- **iOS dev build** → `IOSHealthProvider`
- **Web / unsupported** → `MockActivityProvider`

No screen or hook ever imports a concrete provider directly — only this
factory — so adding a fourth provider (a wearable SDK, say) later needs no
changes to `ActivityScreen.tsx` or the sync hooks.

### Verifying the real provider is active (Section 7)

`ActivityScreen.tsx` displays **"Source: Health Connect"** / **"Source:
Apple Health"** / **"Source: Demo data (not a real sensor)"** directly under
the screen title, driven by `getPlatformActivityProvider().source` — the
exact same call the sync path uses. This is a deliberate visibility
mechanism: if the app ever silently fell back to `MockActivityProvider` on
a real device build (e.g. because `Constants.executionEnvironment`
misidentified the runtime, or a native module failed to link), the screen
would visibly say "Demo data," not present a plausible-looking real number.
On the Android dev build this has been run on, it correctly reads "Source:
Health Connect."

### What's actually read

| Field | Android (Health Connect) | iOS (HealthKit) |
|---|---|---|
| Steps | `aggregateRecord("Steps")` → `COUNT_TOTAL` | `queryStatisticsForQuantity(StepCount, cumulativeSum)` |
| Distance | `aggregateRecord("Distance")` → `DISTANCE.inMeters` | `queryStatisticsForQuantity(DistanceWalkingRunning, cumulativeSum)` |
| Active minutes | Total `ExerciseSession` duration for today (Health Connect has no direct "active minutes" aggregate) | **Not populated (`0`)** — HealthKit has no first-class "active minutes" quantity type; approximating it from active-energy-burned would present a rough guess as a real measurement, which this app avoids |

Only read permissions are requested — Steps, Distance, and
ExerciseSession/ActiveEnergyBurned — never write access, per the
minimum-permissions principle (section 13). Nothing is written back to
Health Connect or HealthKit.

## Native Android Activity Tracking Engine (Phase 6.1)

**As of Phase 6.1, the PRIMARY Android activity source is the phone's own
hardware step sensor — not Health Connect, Google Fit, or Samsung Health.**
`AndroidHealthProvider` (Health Connect) remains in the codebase as an
optional/legacy provider per the spec's Section 11 ("do not delete working
Health Connect code"), but `getPlatformActivityProvider()` no longer
selects it automatically on Android.

### Why a local native module, not a JS library

No existing JS/Expo library reads `Sensor.TYPE_STEP_COUNTER` directly with
a foreground service attached, so this required writing one: a **local
Expo Module** at `modules/nutritrack-step-sensor/` (Expo's supported
mechanism for adding Kotlin/Swift native code with automatic autolinking —
the same mechanism `expo-secure-store` etc. use internally, just
project-local instead of published to npm). It is wired into the app via a
normal `"file:./modules/nutritrack-step-sensor"` dependency in
`package.json`; no config plugin entry was needed because
`expo-modules-autolinking` discovers it automatically (confirmed via `npx
expo-modules-autolinking resolve --platform android`), and its
`AndroidManifest.xml` (declaring the foreground service) merges into the
app's manifest through standard Android Gradle library-manifest merging —
the same mechanism `react-native-health-connect` itself relies on.

**This requires a development build, exactly like the Health Connect
provider did — Expo Go cannot load it.** See
[Expo Go vs. a development build](#expo-go-vs-a-development-build).

### Architecture

```
Android phone hardware
        ↓
SensorManager: TYPE_STEP_COUNTER (primary) + TYPE_STEP_DETECTOR (real-time signal)
        ↓
StepTrackingService (Kotlin foreground service)
   — owns the ONE sensor registration for the app's lifetime it can manage
   — baseline subtraction, daily rollover, active-time state machine
   — persists all state to SharedPreferences (survives process death)
        ↓
NutritrackStepSensorModule (Expo Module — JS bridge)
   — isStepCounterAvailable() / hasActivityRecognitionPermission()
   — startTracking() / stopTracking() / getCurrentState()
   — forwards SharedPreferences changes as "todayStepsChanged" /
     "activityStateChanged" events
        ↓
modules/nutritrack-step-sensor/index.ts (typed JS wrapper)
        ↓
services/activityProviders/AndroidNativeActivityProvider.ts
   (implements the existing ActivityProvider interface — source="android_native")
        ↓
Existing sync pipeline, unchanged:
activitySyncService → POST /api/activity/sync → FastAPI → PostgreSQL → web dashboard
```

Files:
- `modules/nutritrack-step-sensor/android/src/main/java/ai/nutritrack/stepsensor/StepTrackingService.kt` —
  the foreground service; owns the sensor listener, baseline math, daily
  rollover, and active-time state machine.
- `modules/nutritrack-step-sensor/android/src/main/java/ai/nutritrack/stepsensor/NutritrackStepSensorModule.kt` —
  the Expo Module JS bridge.
- `modules/nutritrack-step-sensor/android/src/main/AndroidManifest.xml` —
  declares the foreground service (`foregroundServiceType="health"`) and
  its required permissions.
- `modules/nutritrack-step-sensor/index.ts` — typed JS wrapper.
- `services/activityProviders/AndroidNativeActivityProvider.ts` — implements
  the existing `ActivityProvider` interface on top of the module above.
- `services/activityProviders/estimateDistance.ts` — stride-length/distance
  estimation (see below).
- `services/activityProviders/stepBaseline.ts` — a pure TypeScript mirror
  of the Kotlin baseline algorithm, used only for unit-testing the
  algorithm's logic in Jest (see [Tests](#testing) — **this file is not
  called by the running app**; the real implementation must run natively
  to survive the JS engine being suspended).
- `services/profileService.ts` — fetches the user's `height_cm` from the
  existing `GET /api/profile` endpoint for stride estimation.

### Sensor used (Section 4/2)

`Sensor.TYPE_STEP_COUNTER` is the primary source, exactly as required.
`Sensor.TYPE_STEP_DETECTOR` is read alongside it, but only to drive the
active-time state machine's "a step just happened" signal — **it is never
used as the step-count source**. No accelerometer-based fallback step
counter is implemented: per Section 9, if `TYPE_STEP_COUNTER` is
unavailable, the app reports "Step counter sensor unavailable on this
device" (see `ActivityScreen.tsx`'s warning card) rather than estimating
steps from raw accelerometer data, which the spec explicitly discourages
unless implemented with the full noise-filtering/periodicity-detection
rigor Section 9 describes — that fallback was judged out of scope for this
phase given it cannot be verified without hardware and risks presenting
unreliable numbers as real steps.

### Step calculation algorithm — baseline subtraction (Section 3)

```
todaySteps = currentSensorValue - baseline
```

`baseline` is the sensor's cumulative-since-boot value captured at the
first reading of the current local day — **not** the raw sensor value
itself, which is cumulative since the device's last reboot and would
otherwise show an ever-growing, meaningless number. Exact worked example
from the spec, verified by `__tests__/stepBaseline.test.ts`:

| Event | Sensor value | Baseline | today's steps |
|---|---|---|---|
| First reading of the day | 8000 | 8000 (just established) | 0 |
| Later | 10000 | 8000 | **2000** |
| Later still | 11500 | 8000 | **3500** (not 2000+3500=5500) |

**Reboot/reset handling**: `TYPE_STEP_COUNTER` only increases within one
boot cycle — a reading lower than the last one seen means the device
rebooted or the sensor otherwise reset. `StepTrackingService` detects this
(`sensorValue < lastSensorValue`), **preserves** today's already-earned
step count (the user's steps before the reboot genuinely happened today),
and establishes a fresh baseline at the new post-reset reading so future
deltas stay correct — it does not reset today's total to 0 on reboot.

**Corrupted/missing baseline**: if `KEY_BASELINE` is absent (first run, or
any unexpected state), the very next sensor reading re-establishes it from
scratch with today's steps starting at 0 — there is no code path that
invents a nonzero starting count from an unknown state.

### Daily baseline strategy / local-timezone reset (Section 4)

`StepTrackingService.rolloverBaselineIfNewLocalDay()` compares the
device's **current default timezone's** `yyyy-MM-dd` (via
`SimpleDateFormat` with `TimeZone.getDefault()`, evaluated fresh on every
check — not cached at service start) against the last stored baseline
date. On a new local day, the baseline is cleared (not recomputed from
UTC), so the very next sensor reading establishes a fresh baseline and
today's steps start at 0 — while yesterday's synced total remains
untouched in the backend (the same idempotent-upsert-per-day pattern from
Phase 6). The hardware sensor itself is never reset — it cannot be, by an
app — only NutriTrack's own local baseline/state is. Re-evaluating the
timezone on every check (rather than caching it once) means a timezone
change (e.g. flying to a new zone) is picked up on the next event without
a dedicated handler.

### Real-time updates (Section 5)

`StepTrackingService` writes every step-count change directly to
SharedPreferences; `NutritrackStepSensorModule` registers a
`SharedPreferences.OnSharedPreferenceChangeListener` on that same file and
forwards each change to JS as a `todayStepsChanged` event — no polling on
either side. `AndroidNativeActivityProvider.readTodayActivity()` reads the
current state on each call (used by the existing focus/foreground/60s-timer
auto-sync triggers from Phase 6 — see
[Automatic synchronization](#automatic-synchronization-section-5)), so the
UI reflects new steps within that same cadence without any additional
"Sync Now" taps required for a normal walk.

### Background tracking (Section 6) — what is and is not supported

`StepTrackingService` is a genuine Android **foreground service**
(`startForegroundService` + `startForeground()` + a persistent, low-priority
notification — "NutriTrack AI is tracking your steps"). This is required
by Android for any long-running sensor collection and is **not hidden**:
the notification is always visible while tracking is active, per the
spec's explicit instruction not to hide it.

**Supported** (by Android's foreground-service contract):
- Continues running with the screen locked.
- Continues running while the Activity screen (or the whole app UI) is
  closed/backgrounded, as long as the process itself hasn't been killed.
- Recovers correctly after the app process is killed and reopened — state
  lives in SharedPreferences, not in-memory, so `getCurrentState()` returns
  the correct accumulated total immediately on next launch.

**Not supported / explicitly not guaranteed**:
- **Surviving a device reboot without reopening the app.** This
  implementation does not use a `RECEIVE_BOOT_COMPLETED` broadcast receiver
  to auto-restart the service after reboot — deliberately, to avoid
  requesting that permission for a wellness app. The service (and
  therefore step counting) resumes the next time the user opens NutriTrack
  AI after a reboot. Steps taken between a reboot and reopening the app are
  not counted (the sensor's own cumulative value is preserved by the OS
  across reboot in principle, but this app does not currently read a
  "pre-open" catch-up window).
- **Surviving the user force-stopping the app** from Android Settings —
  Android intentionally kills all of an app's components, including
  foreground services, on force-stop, and nothing an app does can prevent
  that.
- **Surviving aggressive OEM battery-optimization killers** beyond stock
  Android's Doze/App Standby (e.g. some Xiaomi/Oppo/Vivo "battery saver"
  modes that kill foreground services more eagerly than AOSP). This is a
  known, widely-documented Android fragmentation issue, not something this
  codebase can fully work around; users on such devices may need to
  disable battery optimization for NutriTrack AI manually.

None of this is a "background execution is guaranteed" claim — it is not,
and the spec explicitly forbids claiming that.

### Distance formula (Section 7)

Distance is always an **estimate** derived from step count — there is no
distance sensor, and this app does not use GPS for step/distance tracking.

```
strideLengthMeters = heightCm * 0.414 / 100
distanceMeters      = steps * strideLengthMeters
```

`0.414` is a commonly cited ratio of walking stride length to height, used
as a single unisex ratio because the backend `Profile` model has no
sex/gender field to refine it further (`backend/app/models/profile.py` has
`height_cm` only). When height is unavailable (profile not filled in), a
documented population-average fallback stride length of **0.762m** is used
instead — see `services/activityProviders/estimateDistance.ts` for the
exact implementation and `__tests__/estimateDistance.test.ts` for its
tests. The UI labels this value **"Distance (Estimated)"**
(`ActivityScreen.tsx`), never presented as GPS-measured.

### Active-time algorithm — state machine (Section 8)

```
IDLE --(TYPE_STEP_DETECTOR event)--> ACTIVE
ACTIVE --(TYPE_STEP_DETECTOR event)--> ACTIVE (accumulates elapsed seconds since the last event)
ACTIVE --(no step-detector event for INACTIVITY_TIMEOUT_MS)--> IDLE
```

Constants (in `StepTrackingService.kt`, not magic numbers):
- `INACTIVITY_TIMEOUT_MS = 90_000` (90 seconds) — how long with no new
  step-detector events before transitioning ACTIVE → IDLE. Checked every
  15 seconds by a lightweight in-service timer
  (`inactivityCheckRunnable`) — this is a clock check, not a sensor poll,
  so it does not add meaningful battery cost beyond the sensor listener
  already running for step counting.

This is deliberately **not** "1 step = 1 second active" (explicitly
forbidden by the spec) and does not fabricate exercise sessions — active
seconds only accumulate for the actual elapsed wall-clock time between
consecutive real step-detector events while the state machine considers
the user ACTIVE, capped at `INACTIVITY_TIMEOUT_MS` per gap so a long pause
immediately followed by one step can't retroactively count the pause as
active time.

### Battery strategy (Section 18)

- `TYPE_STEP_COUNTER`/`TYPE_STEP_DETECTOR` are registered at
  `SENSOR_DELAY_NORMAL` (the OS's normal/default batching rate) — this app
  never requests a faster sampling rate than that, since step counting has
  no need for it.
- No GPS/location APIs are used anywhere in this provider.
- No raw accelerometer stream is read, stored, or uploaded — only the
  OS-provided step-counter/step-detector event values.
- The inactivity-timeout check is a 15-second `Handler` timer, not a busy
  loop or a sensor poll.
- Sync to the backend remains on the existing Phase 6 cadence (tab
  focus/foreground/60s-while-open, plus manual "Sync Now") — this change
  does not add any new network activity beyond what Phase 6 already did.

### Permissions actually requested (Section 17)

- `android.permission.ACTIVITY_RECOGNITION` — required by Android to read
  `TYPE_STEP_COUNTER`/`TYPE_STEP_DETECTOR` at all (API 29+); requested via
  the standard `PermissionsAndroid` API, only after the user taps "Connect
  Activity Data" in `PermissionGate`, never on app launch.
- `android.permission.FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_HEALTH` —
  required to run `StepTrackingService` as a foreground service with
  `foregroundServiceType="health"`.
- `android.permission.POST_NOTIFICATIONS` — required (API 33+) to show the
  persistent tracking notification the foreground service must display.

No location, camera, or contacts permission is requested by this provider.
The Health Connect permissions already in `app.json` remain for the
optional/legacy `AndroidHealthProvider` only.

### Source / debugging visibility (Section 10, 16)

`AndroidNativeActivityProvider.source` is `"android_native"`, shown in the
UI as **"Source: Phone Step Sensor"** (`ActivityScreen.tsx`'s `SOURCE_LABEL`
map) — see
[Verifying the real provider is active](#verifying-the-real-provider-is-active-section-7),
which now also covers this provider. If `isStepCounterAvailable()` returns
`false` on a real Android device, `ActivityScreen.tsx` shows a warning
card: *"Step counter sensor unavailable on this device. You can still add
activity manually below."* — never a silently wrong/zeroed number
presented as if it were a real reading.

### Health Connect: explicitly optional (Section 11)

`AndroidHealthProvider.ts` is untouched and still fully functional; it is
simply no longer what `getPlatformActivityProvider()` returns on Android.
Nothing about Health Connect, Google Fit, or Samsung Health is required for
core Android tracking to work — a phone with none of those installed still
gets real step/distance/active-time tracking via
`AndroidNativeActivityProvider`.

## Permissions (Section 7)

`components/activity/PermissionGate.tsx` + `hooks/useActivityPermission.ts`
implement the required flow exactly:

1. On first visit to the Activity tab, the OS permission dialog is **never**
   shown automatically. Instead, an in-app card explains what's being
   requested and why, with a **"Connect Activity Data"** button.
2. Tapping it calls `requestPermission()` on the active provider, which
   triggers the real OS dialog.
3. If denied, the app remembers this in AsyncStorage
   (`nutritrack_activity_permission_denied`) and **stops re-prompting** the
   OS dialog on subsequent visits — since iOS in particular will silently
   no-op a repeated `requestAuthorization` call after a first denial anyway.
   Instead it shows an "Open device settings" button (`Linking.openSettings()`).
4. The rest of the Activity screen (manual entry, viewing already-synced
   data) remains fully usable even with permission denied or unavailable.

## Sync Architecture (Sections 8–11, 15)

```
Device health API
   ↓ (ActivityProvider.readTodayActivity — today's cumulative total, not raw events)
services/activitySyncService.ts: captureAndQueueTodayActivity()
   ↓ (always queues locally first — never assumes network is available)
storage/syncQueueStorage.ts (AsyncStorage — non-sensitive, aggregated totals only)
   ↓
flushQueue() — only runs when NetInfo reports connectivity
   ↓
POST /api/activity/sync  (idempotent — see below)
   ↓ on success: dequeue, record last-synced-at
   ↓ on failure: leave queued for the next flush (never dropped)
```

`useActivitySync` drives the 🟢/🟡/🔴 status indicator and "Sync Now" button;
pull-to-refresh on the Activity screen also triggers a capture + flush cycle.

### Automatic synchronization (Section 5)

The Activity and Home screens sync/reload automatically in three
situations, so the displayed steps/distance/minutes update without the user
having to tap "Sync Now" every time:

1. **Tab focus** (`useFocusEffect` in `ActivityScreen.tsx`/`HomeScreen.tsx`)
   — switching to the tab triggers a sync (Activity) or reload (Home).
2. **App returns to the foreground** (`AppState.addEventListener("change", ...)`)
   — e.g. the user walks with the phone locked, then unlocks it; the app
   syncs as soon as it becomes active again.
3. **A 60-second interval while the Activity tab is open and the app is
   foregrounded** (`setInterval` guarded by `AppState.currentState === "active"`,
   cleared on unmount) — a lightweight "keep it fresh while you're looking
   at it" refresh.

"Sync Now" in `SyncStatusBar` remains as an explicit manual trigger for all
three of the above, and is what pull-to-refresh calls too.

**This is foreground-only automatic sync — it is not a background sync.**
None of the three mechanisms above run while the app is not open/foregrounded.
Do not read this as "the app tracks your steps in the background": Health
Connect itself keeps counting in the background (that's the OS's job, via
whatever fitness app is granted write access — see
[Source handling](#source--deduplication-strategy-section-9) below); this
app only *reads* that accumulated total the next time it's opened or
brought to the foreground.

#### Why there is no true background sync, and what "a reasonable mechanism" means here

Expo SDK 57's supported background-execution primitive is
[`expo-background-task`](https://docs.expo.dev/versions/latest/sdk/background-task/),
which schedules periodic work via Android's `WorkManager` / iOS's
`BGTaskScheduler`. Both of those platform schedulers are explicitly
**best-effort and OS-governed**, not a guarantee:

- Android can defer, batch, or skip scheduled background work under Doze
  mode, battery optimization, or app-hibernation policies — more
  aggressively on some OEM skins (Xiaomi/MIUI, Samsung's battery manager,
  etc.) than stock Android.
- iOS's `BGTaskScheduler` similarly gives no fixed interval guarantee; the
  OS decides when (or whether) to run a background task based on usage
  patterns, battery, and system load.

Given that, adding `expo-background-task` here would not make sync
"guaranteed to run every N minutes in the background" — it would only add
an *additional*, unreliable opportunistic sync on top of the three
foreground triggers above, which are deterministic and already cover the
realistic usage pattern (open the app → see current steps). Rather than
ship a background task and risk it being read as a reliability promise the
OS cannot actually keep, this phase keeps sync foreground-only and states
that limitation plainly. `expo-background-task` remains a valid follow-up
if best-effort background refresh is wanted later — it should be pitched to
the user explicitly as "may run every so often, not guaranteed," never as
guaranteed live tracking.

### Source / deduplication strategy (Section 9)

`AndroidHealthProvider.readTodayActivity()` calls Health Connect's
`aggregateRecord({ recordType: "Steps", ... })` — the **platform's own
aggregate API**, not a manual sum of individual `readRecords` results. This
matters for multi-source correctness: per the Health Connect platform
contract, when more than one app (e.g. Google Fit *and* Samsung Health) has
write access and both log steps, the OS-level aggregate is what
deduplicates/merges overlapping contributions before returning `COUNT_TOTAL`
— this app does not read raw per-source records and sum them itself, which
would risk double-counting the same physical steps reported twice by two
different apps.

This app also does **not** hardcode a preferred source (e.g. "always trust
Google Fit over Samsung Health"). `COUNT_TOTAL` already reflects whatever
the OS considers the correct combined total across every app the user has
granted permission to; there is no source-priority logic to get wrong,
because there is no source-priority logic at all — Health Connect owns that
decision. If you need to know exactly which app(s) actually wrote today's
data, check Health Connect's own **Data and access** screen (Android
Settings → Health Connect → App permissions), which lists write access per
app — this project does not currently surface Health Connect's per-record
origin/`dataOrigin` metadata in-app, since the aggregate total is what's
displayed, not individual records.

### Why aggregated, not raw events (Section 8)

The app never streams individual step events — it reads *today's current
cumulative total* from the platform API once per sync and sends that single
number. This matches how both Health Connect and HealthKit actually expose
step data (aggregate queries over a time range) and avoids the battery/
bandwidth cost and privacy exposure of raw sensor streaming (also explicitly
out of scope per section 22).

### Idempotency / duplicate prevention (Sections 9, 10, 15)

This required a backend change, made carefully to avoid touching Phase 2's
existing behavior:

- **`POST /api/activity`** (existing, used by the web app's manual/mock entry
  form) is **unchanged** and stays additive — multiple manual entries in one
  day still sum, exactly as Phase 2 specified and its tests verify.
- **`POST /api/activity/sync`** (new) is idempotent: the backend upserts one
  row per `(user_id, date, source)` rather than inserting a new row every
  call. Sending the same total twice, or an updated/increasing total across
  the day, always converges on that one row holding the latest number — never
  summed with its own history. Enforced with a real database
  `UniqueConstraint` on `(user_id, sync_day, data_source)`, not just
  application-level care, and covered by 12 backend tests including the
  exact "7,000 → 7,500 → 7,842 must end at 7,842, not their sum" scenario
  from the spec (`backend/tests/test_activity_sync.py`).
- A manual entry and a synced entry for the same day are independent and
  both count toward the daily total shown on `/api/activity/today` — e.g. a
  demo/manual 500 steps plus a synced 7,842 steps correctly shows 8,342, and
  re-syncing the 7,842 again afterward does not change that total.

### Calendar-day boundaries / timezones (Section 8)

"Today" is always computed from the **device's local wall-clock time**, not
UTC, at three points that all had to agree:

1. `AndroidHealthProvider.readTodayActivity()` builds its Health Connect
   query window from local midnight (`new Date(); setHours(0,0,0,0)`) to now
   — not a UTC-day truncation, which would roll the boundary over at the
   wrong wall-clock moment for any non-UTC timezone.
2. `activitySyncService.todayDateString()` labels the synced reading with
   the device's local `YYYY-MM-DD` (via `getFullYear()/getMonth()/getDate()`),
   not `Date#toISOString().slice(0, 10)` — the latter converts to UTC first
   and silently mislabels the day near midnight (e.g. 11pm in UTC+5:30 is
   already 6pm UTC the *same* day, but 11:30pm in UTC-8 is 7:30am UTC the
   *next* day).
3. `activityService.getTodayActivity()` / `getWeeklyActivity()` send that
   same local date to the backend as a `local_date` query parameter. The
   backend (`GET /api/activity/today`, `GET /api/activity/weekly`) uses it
   to anchor its "today"/"last 7 days" window instead of its own UTC clock
   (`activity_service.get_today_summary`/`get_weekly_summary` — the
   `local_date` parameter is optional and falls back to server UTC when
   absent, which is what the web app still relies on, since it has no
   client-local-day concept of its own).

Without step 3, a device whose local calendar day has already advanced past
the server's UTC day (or vice versa) could sync a reading that never shows
up in "today's" totals — not because the sync failed, but because the
server's query window was anchored to the wrong day. This is covered by
`backend/tests/test_activity_sync.py::test_today_uses_client_local_date_when_provided`
and the equivalent weekly test, plus
`mobile/__tests__/AndroidHealthProvider.test.ts` (local-midnight boundary)
and `mobile/__tests__/activityService.test.ts` /
`activitySyncService.test.ts` (local-date derivation, not UTC-shifted).

### Offline mode (Section 11)

`captureAndQueueTodayActivity()` never touches the network — it only reads
the device and writes to the local AsyncStorage queue, so it always
succeeds even with the device in airplane mode. `flushQueue()` checks
`NetInfo` first; if offline, it leaves everything queued and returns
immediately. A failed delivery (server error, timeout) also leaves its
entry queued rather than discarding it. Nothing is lost to a temporary
connectivity gap — the next successful flush (triggered by "Sync Now",
pull-to-refresh, or the next app open) delivers it.

## Mobile Screens

- **HomeScreen** (`app/HomeScreen.tsx`) — today's steps/distance/active
  minutes, step-goal progress bar, hydration summary, and a "Log out"
  button. All values come from the existing backend endpoints
  (`/api/activity/today`, `/api/water/today`) — no business logic (goal
  math, totals) is re-implemented on the client. Reloads on tab focus and
  whenever the app returns to the foreground.
- **ActivityScreen** (`app/ActivityScreen.tsx`) — gated behind
  `PermissionGate`; shows which data source is active ("Source: Health
  Connect" / "Source: Demo data (not a real sensor)" — see
  [Verifying the real provider is active](#verifying-the-real-provider-is-active-section-7)),
  the sync status bar, today's stats, goal progress, a simple weekly bar
  chart (from `/api/activity/weekly`), an empty state when there's no
  activity yet. Manual entry (clearly labelled **"Development / Demo
  Activity Data"**) is offered as an explicit fallback, never presented as
  real sensor tracking.

## Platform Requirements

**Do not assume real step tracking works on every platform without testing
it on an actual device of that platform first.** This build has been
verified with `tsc`, `eslint`, and Jest unit tests against mocked platform
APIs — it has **not** been exercised against real Health Connect or
HealthKit data on physical hardware.

### Expo Go vs. a development build

`react-native-health-connect` and `@kingstinct/react-native-healthkit` both
ship native (Kotlin/Swift) code. **Expo Go cannot run them** — Expo Go is a
pre-built sandbox app that only supports the JS/native modules bundled into
it, and third-party native modules aren't among them. To use real activity
data you must build a **custom development client**:

```bash
npx expo install expo-dev-client   # already included in package.json
npx expo run:android               # or: eas build --profile development --platform android
npx expo run:ios                   # or: eas build --profile development --platform ios
```

`expo run:android` / `expo run:ios` generate native `android/`/`ios/`
projects locally and require Android Studio / Xcode respectively to be
installed; `eas build` builds in the cloud instead. Both are one-time setup
per machine. Until one of these is done, the app runs fine in Expo Go — it
just automatically falls back to `MockActivityProvider` for activity data
(see `getPlatformActivityProvider()`), so all other screens (auth,
dashboard, manual entry) remain fully testable in Expo Go.

### Android

- **Requires**: Android with the **Health Connect** app installed (built
  into the OS on Android 14+; installable from Play Store on Android 9–13).
  If Health Connect itself is unavailable, `AndroidHealthProvider.isAvailable()`
  returns `false` and the UI falls back gracefully.
- **Permissions**: `android.permission.ACTIVITY_RECOGNITION` plus Health
  Connect's own `READ_STEPS` / `READ_DISTANCE` / `READ_EXERCISE` grants
  (configured in `app.json`'s `android.permissions` and the
  `react-native-health-connect` plugin config).
- **Native config**: requires a development build (see above) — the Health
  Connect plugin injects manifest entries during the native build step.
- **Tested on a real Android device** (EAS development build): permission
  grant, real Health Connect step reading, sync to backend, and manual
  entry fallback have all been observed working. Not yet exhaustively
  tested: permission revoked mid-session, multiple fitness apps
  contributing steps simultaneously, Health Connect completely uninstalled
  mid-use.

### iOS

- **Requires**: a **physical iPhone** — HealthKit is unavailable on the iOS
  Simulator entirely (Apple's own limitation, not this app's).
- **Permissions**: `NSHealthShareUsageDescription` (configured in `app.json`'s
  `ios.infoPlist`) — read-only; `NSHealthUpdateUsageDescription` is present
  but this app never writes to Health.
- **Native config**: requires a development build (see above).
- **Not yet tested on a real iPhone.**

### Known limitations

**Two different "background" claims — do not conflate them:**
1. **Sensor tracking** (Android only, Phase 6.1): DOES continue in the
   background via `StepTrackingService`'s foreground service — see
   [Background tracking](#background-tracking-section-6--what-is-and-is-not-supported)
   above for exactly what is and isn't guaranteed (survives screen lock and
   app-closed; does not survive force-stop, a device reboot without
   reopening the app, or aggressive OEM battery killers).
2. **Network sync to the backend** (both platforms): does NOT run in the
   background — see
   [Automatic synchronization](#automatic-synchronization-section-5). Sync
   runs on tab focus, on returning to the foreground, and every 60s while
   the Activity tab is open and foregrounded, plus manual "Sync Now," but
   never while the app is closed. The native sensor keeps counting while
   backgrounded regardless — that count is simply not pushed to the server
   until the app is next foregrounded or "Sync Now" is tapped.

Other limitations:

- **Phase 6.1 is not yet physical-device-verified** — see
  [Status](#status) and
  [Physical-device test procedure](#physical-device-test-procedure). Do
  not treat the automated test suite passing as equivalent to a real
  device confirming accurate tracking.
- `stepBaseline.test.ts` tests a **TypeScript mirror** of the Kotlin
  baseline algorithm, not the Kotlin code itself — Jest cannot execute
  Kotlin. A future change to `StepTrackingService.kt`'s
  `handleStepCounterEvent` could in principle drift from this mirror
  without either test suite catching it; the mirror is a specification
  aid, not a substitute for running the real thing on a device.
- No accelerometer-based fallback step counter for devices without
  `TYPE_STEP_COUNTER` — Section 9 permits one but requires substantial
  noise-filtering/periodicity-detection rigor to avoid false steps from
  vehicle vibration or phone shaking; given no physical device is available
  to validate such an algorithm's accuracy in this session, the app instead
  reports "Step counter sensor unavailable on this device" and directs the
  user to manual entry, which is honest but less capable than a validated
  fallback would be.
- No `RECEIVE_BOOT_COMPLETED` auto-restart — the foreground service
  resumes on next app open after a reboot, not automatically at boot, by
  deliberate choice (avoids requesting that permission for a wellness app).
- iOS active-minutes is not populated (see the table above) — `0` is
  reported honestly rather than estimating it from a proxy metric.
- iOS has no equivalent native-sensor primary provider in this phase —
  Section 22's scope is explicitly Android; iOS continues to use
  `IOSHealthProvider` (HealthKit) unchanged.
- No smartwatch, Apple Watch, or Wear OS integration (explicitly deferred
  per section 22 of the original Phase 6 spec).

## Testing

```bash
cd mobile
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . (eslint-config-expo)
npm test            # jest
```

All three are clean as of this phase. Test coverage (`__tests__/`, 78 tests):

- **`stepBaseline.test.ts`** (Phase 6.1) — a pure TypeScript mirror of the
  Kotlin baseline algorithm (see
  [Native Android Activity Tracking Engine](#native-android-activity-tracking-engine-phase-61)):
  first-reading baseline establishment, the spec's exact 8,000→10,000→11,500
  worked example (2,000 then 3,500, never 5,500), repeated-identical-reading
  idempotency, reboot/reset detection and baseline recovery, zero/no-negative
  deltas, and new-local-day rollover. **This tests the algorithm's logic,
  not the actual Kotlin file** — see the caveat in
  [Known limitations](#known-limitations).
- **`estimateDistance.test.ts`** (Phase 6.1) — height-based stride-length
  formula, the documented fallback stride length when height is
  unavailable/invalid, zero steps → zero distance (never fabricated), and
  negative-step rejection.
- **`AndroidNativeActivityProvider.test.ts`** (Phase 6.1) — source
  identification, sensor-availability detection (including the
  "unavailable on this device" case), permission request/grant/deny flow
  and that `startTracking()` is only called after a real grant, real
  step/active-minutes readings from native state, a genuine zero (not
  fabricated) when the native module throws, and distance estimation with
  and without a profile height.
- **`MockActivityProvider.test.ts`** — availability, permission, zeroed
  (never-fabricated) reading.
- **`AndroidHealthProvider.test.ts`** — real Health Connect aggregate
  reading (steps/distance/active-minutes), a genuine zero when no data
  exists (not fabricated), the local-midnight (not UTC) query-window
  boundary, permission-denied and native-throw handling, unavailable
  platform/SDK, and a partial-failure case (one metric's aggregate call
  rejects but the others still return). Kept and still passing —
  Health Connect remains available as an optional/legacy provider.
- **`syncQueueStorage.test.ts`** — enqueue/dequeue, same-day-and-source
  entries replace rather than stack, different days/sources stay separate,
  corrupted stored JSON degrades to an empty queue rather than throwing.
- **`activitySyncService.test.ts`** — offline queueing, flush only when
  online, failed syncs stay queued and succeed on retry, the exact
  increasing-step-count scenario (7,000 → 7,500 → 7,842), the
  repeated-identical-sync scenario from the spec, and local (not
  UTC-shifted) date derivation for the synced payload.
- **`activityService.test.ts`** — `GET /api/activity/today` and `/weekly`
  send the device's local calendar date as `local_date`, not a UTC-derived one.
- **`validateSignupForm.test.ts`** — full name required, email required,
  password length, confirm-password mismatch, and the fully-valid case.
- **`secureStorage.test.ts`** — token stored/read/cleared via the mocked
  `expo-secure-store` API (not AsyncStorage).
- **`api.test.ts`** — bearer token attached to requests when present, a 401
  clears the token and fires the unauthorized handler (expired/invalid
  token security case), a non-401 error does *not* clear the token,
  `getApiErrorMessage` extracts backend `detail` messages / falls back
  sensibly.

Screen-level render tests (`@testing-library/react-native`) are not used in
this suite — validation logic that would otherwise only be reachable by
rendering `SignupScreen` was extracted into the pure, directly-testable
`app/validateSignupForm.ts` instead, consistent with how the rest of this
suite tests logic rather than rendered output.

A true end-to-end device walkthrough (login → grant permission → read real
steps → sync → see it on the web dashboard → walk further → sync again →
confirm no duplication → go offline → sync → restore network → log out) has
been partially performed manually on the Android device described in
[Status](#status); it is not automated and is not re-run by `npm test`. See
[Physical-device test procedure](#physical-device-test-procedure) below for
the exact steps to redo it.

## Physical-device test procedure

**This procedure has not been executed yet for Phase 6.1 (the native
step-sensor engine) — see [Status](#status). It must be completed, and
every step confirmed, before Phase 6.1 can be called device-verified.**
Steps 1–17 below are Section 20 of the Phase 6.1 spec; Accuracy A–E are
Section 21.

1. Build/install a development client on the phone (`eas build --profile
   development --platform android`, or `expo run:android` with a cable) —
   see [Expo Go vs. a development build](#expo-go-vs-a-development-build).
   The local `nutritrack-step-sensor` module requires this build to be
   regenerated (a previously-installed APK built before this change will
   not contain the new native module).
2. Ensure the phone and the machine running the backend are on the same
   Wi-Fi network, and `mobile/app.json`'s `expo.extra.apiBaseUrl` /
   `backend/.env`'s `CORS_ORIGINS` both point at the machine's current LAN
   IP (this changes if your router reassigns DHCP leases — recheck it if
   the app suddenly can't reach the backend).
3. Start the backend (`--host 0.0.0.0`) and, if not using a standalone
   build, `npx expo start --dev-client`.
4. **Test 1/2**: On the phone, sign up or log in, then on the Activity tab
   tap **"Connect Activity Data"** and grant the ACTIVITY_RECOGNITION
   permission dialog, plus the notification permission prompt (Android
   13+) for the foreground-service notification.
5. **Test 3**: Confirm the Activity screen shows **"Source: Phone Step
   Sensor"** — NOT "Source: Demo data" — which confirms
   `AndroidNativeActivityProvider` is actually active, not
   `MockActivityProvider` (see
   [Verifying the real provider is active](#verifying-the-real-provider-is-active-section-7)).
   Also confirm the persistent "NutriTrack AI is tracking your steps"
   notification appears.
6. **Test 4**: Note the starting step count shown.
7. **Test 5**: Put the phone in a pocket and walk 500+ steps. Confirm the
   displayed step count increases (should update live via the
   `todayStepsChanged` event, or at worst on the next auto-sync trigger).
8. **Test 6**: Lock the phone's screen and continue walking. Unlock and
   confirm tracking continued (step count reflects the additional
   walking) — this is the foreground service's core purpose.
9. **Test 7**: Close the Activity screen (navigate to Home, or background
   the whole app) and continue walking. Reopen and confirm the count
   increased while the screen was closed.
10. **Test 8**: Fully close the app (swipe away from recent apps) and
    reopen it. Confirm today's step count is preserved (read from
    SharedPreferences via `getCurrentState()`, not lost).
11. **Test 9**: Check the displayed distance — confirm it's labeled
    "Distance (Estimated)", not presented as GPS-measured.
12. **Test 10**: Walk continuously for several minutes. Confirm "Active
    Time" increases.
13. **Test 11**: Stand still for at least `INACTIVITY_TIMEOUT_MS` (90
    seconds) plus one inactivity-check cycle (~15s). Confirm Active Time
    stops increasing (state machine transitions ACTIVE → IDLE).
14. **Test 12**: Tap **"Sync Now"** (or wait for auto-sync). Confirm the
    backend received today's cumulative total — check via the web
    dashboard or `GET /api/activity/today`.
15. **Test 13**: Sync again with no further walking. Confirm the step
    count in the database is unchanged (no duplicate counting) — same
    idempotency guarantee Phase 6 already established, now exercised with
    `source="android_native"`.
16. **Test 14**: Walk more, then sync again. Confirm `previous total <
    new total` and that the database still stores only the latest
    cumulative daily total (one row, updated in place — see
    `backend/tests/test_activity_sync.py`).
17. **Test 15**: Enable airplane mode, continue walking. Confirm the
    Activity screen still shows increasing step counts locally (tracking
    does not depend on connectivity) and sync status shows "Sync pending."
18. **Test 16**: Disable airplane mode. Confirm the queued reading syncs
    automatically on the next foreground/interval trigger, or via "Sync
    Now".
19. **Test 17**: Open the web app (`http://localhost:5190` or your LAN
    IP) with the same account and confirm the Dashboard/Activity page
    shows the identical step count synced from the phone.
20. Tap **"Log out"** on the Home screen and confirm it returns to the
    Login screen and a subsequent API call is rejected without the token.

### Accuracy validation (Section 21)

Compare against the phone's own hardware sensor (e.g. via a stock "Digital
Wellbeing" step count or another app reading the *same* `TYPE_STEP_COUNTER`
sensor) — not against a third-party fitness app's own algorithm, which may
disagree even when both are reading real hardware.

- **A**: Walk exactly 100 steps. Expect NutriTrack's count to increase by
  approximately 100 (`TYPE_STEP_COUNTER` accuracy is a hardware/OS
  guarantee this app inherits, not something this app's code affects).
- **B**: Walk exactly 500 steps. Expect approximately 500.
- **C**: Stand still for 5 minutes. Expect no significant step increase.
- **D**: Shake the phone vigorously without walking. Expect this to NOT
  generate a large number of steps — `TYPE_STEP_COUNTER` is a hardware/OS
  step-detection algorithm, not a raw accelerometer pass-through, so it
  should already reject non-gait motion; this test confirms that holds on
  the actual test device.
- **E**: Ride in a car/bus for several minutes. Expect no significant
  walking-step increase.

**Record actual results here once run — do not claim accuracy without
having actually performed A–E.** Phone placement, hardware sensor quality,
and OEM sensor-fusion firmware all affect real-world accuracy; this app
cannot and does not promise 100% accuracy.
