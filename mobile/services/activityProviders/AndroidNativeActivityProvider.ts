import { Platform, PermissionsAndroid } from "react-native";
import type { EventSubscription } from "expo-modules-core";
import type { ActivityProvider, PermissionResult, RawActivityReading } from "./types";
import { estimateDistanceMeters } from "./estimateDistance";
import { getProfileHeight } from "../profileService";

/**
 * PRIMARY Android activity source (Section 22): reads the phone's own
 * hardware step-counter sensor via the local `nutritrack-step-sensor`
 * Expo Module (modules/nutritrack-step-sensor/), never Health Connect,
 * Google Fit, or Samsung Health. Those remain available only as the
 * separate, optional `AndroidHealthProvider` (see index.ts's factory) —
 * this provider has no dependency on them and works even if none of them
 * are installed.
 *
 * Requires a custom development build — Expo Go cannot load a local
 * native module, same constraint as AndroidHealthProvider/IOSHealthProvider.
 * See mobile/README.md "Expo Go vs. a development build".
 */
export class AndroidNativeActivityProvider implements ActivityProvider {
  readonly source = "android_native" as const;

  private nativeModule(): typeof import("nutritrack-step-sensor") | null {
    if (Platform.OS !== "android") return null;
    try {
      // Lazy require, mirroring AndroidHealthProvider/IOSHealthProvider —
      // keeps this file import-safe on platforms/environments (iOS, web,
      // Expo Go) where the native module isn't linked.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("nutritrack-step-sensor");
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    const native = this.nativeModule();
    if (!native) {
      if (__DEV__) {
        console.log("[AndroidNativeActivityProvider] native module 'nutritrack-step-sensor' did not load " +
          "(require() failed or wrong platform) — this device build likely predates the native module, " +
          "or is running in Expo Go, which cannot load it at all.");
      }
      return false;
    }
    try {
      // Section 2: TYPE_STEP_COUNTER is required for this provider to be
      // offered as the primary source at all — Section 9's accelerometer
      // fallback path is a separate, explicitly-labeled provider, not
      // silently folded into this one.
      const available = native.isStepCounterAvailable();
      if (!available && __DEV__) {
        this.logDiagnostics(native);
      }
      return available;
    } catch (err) {
      if (__DEV__) {
        console.log("[AndroidNativeActivityProvider] isStepCounterAvailable() threw:", err);
      }
      return false;
    }
  }

  /** Section 2: development-only diagnostic dump — exact sensor name/
   * vendor/version the OS reports, so "unavailable" can be verified
   * instead of guessed at. Never called outside __DEV__; never included
   * in any network request. */
  private logDiagnostics(native: typeof import("nutritrack-step-sensor")) {
    try {
      const diagnostics = native.getDiagnostics();
      console.log("[AndroidNativeActivityProvider] diagnostics:", JSON.stringify(diagnostics, null, 2));
    } catch (err) {
      console.log("[AndroidNativeActivityProvider] getDiagnostics() threw:", err);
    }
  }

  async getPermissionState(): Promise<PermissionResult> {
    const native = this.nativeModule();
    if (!native) return "unavailable";
    try {
      return native.hasActivityRecognitionPermission() ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }

  async requestPermission(): Promise<PermissionResult> {
    const native = this.nativeModule();
    if (!native) return "unavailable";

    try {
      // ACTIVITY_RECOGNITION is a standard Android runtime permission —
      // requested via React Native's own PermissionsAndroid API (not a
      // custom native prompt), matching how the rest of the app already
      // handles OS permission dialogs (only after the user has seen the
      // in-app explanation in PermissionGate, never on mount).
      const androidApiLevel = Platform.OS === "android" ? Number(Platform.Version) : 0;
      if (androidApiLevel >= 29 && PermissionsAndroid?.PERMISSIONS?.ACTIVITY_RECOGNITION) {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) return "denied";
      }

      native.startTracking();
      return "granted";
    } catch {
      return "denied";
    }
  }

  async readTodayActivity(): Promise<RawActivityReading> {
    const native = this.nativeModule();
    if (!native) return { steps: 0, distanceMeters: 0, activeMinutes: 0 };

    try {
      const state = native.getCurrentState();
      const heightCm = await getProfileHeight();

      return {
        steps: state.todaySteps,
        distanceMeters: estimateDistanceMeters(state.todaySteps, heightCm),
        // Section 8: active time comes from the native activity state
        // machine's accumulated seconds, not "1 step = 1 second" or any
        // other fabricated proxy.
        activeMinutes: Math.round(state.activeSeconds / 60),
      };
    } catch {
      return { steps: 0, distanceMeters: 0, activeMinutes: 0 };
    }
  }

  /**
   * Real-time push subscription (Section 4/5 of the latest fix request).
   *
   * `readTodayActivity()` alone is a one-shot PULL — calling it only tells
   * you the step count at that instant. It does NOT make the UI update
   * live while the user is walking; something still has to call it again
   * later. Before this method existed, the only things that called it
   * again were the 60s interval / tab-focus / app-foreground triggers in
   * ActivityScreen, so a walk taken between those triggers didn't show up
   * until one of them fired — up to 60 seconds late, never instant.
   *
   * StepTrackingService.kt already pushes every step-count change to
   * NutritrackStepSensorModule via a SharedPreferences listener, which
   * re-emits it as a "todayStepsChanged" JS event — that push channel
   * already existed natively but nothing on the JS side was listening to
   * it. This method is that missing subscription: it converts the raw
   * native `{ todaySteps }` event into a full `RawActivityReading`
   * (recomputing estimated distance from the new step count, and pulling
   * the latest active-seconds/state via getCurrentState() so all three
   * values stay consistent with each other), and hands it to the caller
   * the instant the sensor reports a change — not on the next timer tick.
   *
   * Only defined here, not on the shared `ActivityProvider` interface,
   * because push capability is specific to this provider — Health Connect
   * and HealthKit are pull-only platform APIs with no equivalent live
   * event. `useLiveActivityReading` checks for this method's presence
   * before using it and falls back to pure polling for any other provider.
   */
  subscribeToLiveUpdates(onChange: (reading: RawActivityReading) => void): (() => void) | null {
    const native = this.nativeModule();
    if (!native) return null;

    let latestHeightCm: number | null = null;
    void getProfileHeight().then((height) => {
      latestHeightCm = height;
    });

    const emitCurrentState = () => {
      try {
        const state = native.getCurrentState();
        onChange({
          steps: state.todaySteps,
          distanceMeters: estimateDistanceMeters(state.todaySteps, latestHeightCm),
          activeMinutes: Math.round(state.activeSeconds / 60),
        });
      } catch {
        // A transient native-call failure here must not crash the
        // subscription — the next real event will simply try again.
      }
    };

    const subscriptions: EventSubscription[] = [
      native.addTodayStepsListener(emitCurrentState),
      native.addActivityStateListener(emitCurrentState),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }
}
