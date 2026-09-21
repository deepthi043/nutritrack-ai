import { requireNativeModule, type EventSubscription } from "expo-modules-core";

/**
 * Thin typed wrapper around the native `NutritrackStepSensor` Expo Module
 * (android/src/main/java/ai/nutritrack/stepsensor/). Android-only — on any
 * other platform `requireNativeModule` throws at call time, which is why
 * every call site in `AndroidNativeActivityProvider` is guarded by a
 * `Platform.OS === "android"` check before ever touching this module.
 */

export interface StepSensorState {
  todaySteps: number;
  activeSeconds: number;
  activityState: "IDLE" | "ACTIVE";
  hasBaseline: boolean;
  baselineDate: string | null;
}

export interface SensorDescription {
  available: boolean;
  name?: string;
  vendor?: string;
  version?: number;
  type?: number;
}

export interface StepSensorDiagnostics {
  nativeModuleLoaded: boolean;
  sensorManagerAvailable: boolean;
  stepCounter: SensorDescription;
  stepDetector: SensorDescription;
  hasActivityRecognitionPermission: boolean;
}

interface NutritrackStepSensorNativeModule {
  isStepCounterAvailable(): boolean;
  isStepDetectorAvailable(): boolean;
  hasActivityRecognitionPermission(): boolean;
  startTracking(): void;
  stopTracking(): void;
  getCurrentState(): StepSensorState;
  getDiagnostics(): StepSensorDiagnostics;
  // Every Expo native module returned by requireNativeModule() extends
  // the native EventEmitter/NativeModule base class, which provides
  // addListener/removeAllListeners at runtime even though the module
  // author only declares Events(...) + sendEvent(...) in Kotlin — this
  // interface declares that runtime shape explicitly rather than
  // wrapping the module in a second EventEmitter instance.
  addListener<T extends Record<string, unknown>>(eventName: string, listener: (event: T) => void): EventSubscription;
}

let cachedModule: NutritrackStepSensorNativeModule | null = null;

function nativeModule(): NutritrackStepSensorNativeModule {
  if (!cachedModule) {
    cachedModule = requireNativeModule<NutritrackStepSensorNativeModule>("NutritrackStepSensor");
  }
  return cachedModule;
}

export function isStepCounterAvailable(): boolean {
  return nativeModule().isStepCounterAvailable();
}

export function isStepDetectorAvailable(): boolean {
  return nativeModule().isStepDetectorAvailable();
}

export function hasActivityRecognitionPermission(): boolean {
  return nativeModule().hasActivityRecognitionPermission();
}

/** Starts the foreground service that owns the sensor registration.
 * Throws if ACTIVITY_RECOGNITION has not been granted — request it first
 * via the standard Expo/React Native permissions API. */
export function startTracking(): void {
  nativeModule().startTracking();
}

export function stopTracking(): void {
  nativeModule().stopTracking();
}

export function getCurrentState(): StepSensorState {
  return nativeModule().getCurrentState();
}

/** Development diagnostics (Section 2): exact sensor name/vendor/version
 * the OS reports, whether the native module actually loaded, and current
 * permission state — for verifying "sensor unavailable" claims against
 * real hardware info instead of guessing. See
 * AndroidNativeActivityProvider.getDiagnostics() for the safe wrapper that
 * degrades cleanly when the module isn't linked at all. */
export function getDiagnostics(): StepSensorDiagnostics {
  return nativeModule().getDiagnostics();
}

export function addTodayStepsListener(listener: (event: { todaySteps: number }) => void): EventSubscription {
  return nativeModule().addListener("todayStepsChanged", listener);
}

export function addActivityStateListener(
  listener: (event: { activityState: "IDLE" | "ACTIVE" }) => void
): EventSubscription {
  return nativeModule().addListener("activityStateChanged", listener);
}
