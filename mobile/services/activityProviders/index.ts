import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { ActivityProvider } from "./types";
import { MockActivityProvider } from "./MockActivityProvider";
import { AndroidNativeActivityProvider } from "./AndroidNativeActivityProvider";
import { IOSHealthProvider } from "./IOSHealthProvider";

export type { ActivityProvider, PermissionResult, RawActivityReading } from "./types";
export { MockActivityProvider } from "./MockActivityProvider";
export { AndroidNativeActivityProvider } from "./AndroidNativeActivityProvider";
export { AndroidHealthProvider } from "./AndroidHealthProvider";

/**
 * Returns the correct real-data provider for the running platform, or the
 * mock provider when real health/sensor APIs cannot possibly be present
 * (Expo Go, web) — never silently returns fake data on a platform capable
 * of the real thing. See mobile/README.md for the Expo Go vs. dev-build
 * distinction.
 *
 * Section 22 architectural rule: on a real Android device/dev-build, the
 * PRIMARY source is the phone's own hardware step sensor
 * (AndroidNativeActivityProvider, via the local nutritrack-step-sensor
 * Expo Module) — NOT Health Connect, Google Fit, or Samsung Health.
 * AndroidHealthProvider (Health Connect) remains available in the
 * codebase as an optional/legacy provider (Section 11) but is no longer
 * selected by this factory; a caller that specifically wants Health
 * Connect can still construct `new AndroidHealthProvider()` directly.
 */
export function getPlatformActivityProvider(): ActivityProvider {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (isExpoGo) {
    // Native modules (the step-sensor module, Health Connect, HealthKit)
    // are not present in Expo Go — this is an Expo/App Store sandboxing
    // constraint, not a bug. Falling back to Mock here is the ONE
    // legitimate silent-mock case, and it's visible in the UI via
    // ActivityScreen's "Source: Demo data" label either way.
    return new MockActivityProvider();
  }

  if (Platform.OS === "android") return new AndroidNativeActivityProvider();
  if (Platform.OS === "ios") return new IOSHealthProvider();
  return new MockActivityProvider(); // web or unsupported platform
}
