import { Platform } from "react-native";
import type { ActivityProvider, PermissionResult, RawActivityReading } from "./types";

/**
 * Reads today's cumulative steps, distance, and active minutes from Apple
 * HealthKit via @kingstinct/react-native-healthkit.
 *
 * Requires a custom development build (expo-dev-client / EAS Build) — the
 * native HealthKit module is not present in Expo Go, and HealthKit is
 * unavailable on the iOS Simulator (it must run on a physical device). See
 * mobile/README.md "Platform Requirements".
 *
 * Only read access is requested for step count, walking/running distance,
 * and active energy burned (used as a stand-in for "active minutes", since
 * HealthKit has no first-class "active minutes" quantity type) — never
 * write access, per the minimum-permissions principle (Phase 6 section 13).
 */
export class IOSHealthProvider implements ActivityProvider {
  readonly source = "ios_health" as const;

  private hk(): typeof import("@kingstinct/react-native-healthkit") | null {
    if (Platform.OS !== "ios") return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("@kingstinct/react-native-healthkit");
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    const hk = this.hk();
    if (!hk) return false;
    try {
      return await hk.isHealthDataAvailableAsync();
    } catch {
      return false;
    }
  }

  async getPermissionState(): Promise<PermissionResult> {
    const hk = this.hk();
    if (!hk) return "unavailable";
    try {
      const status = hk.authorizationStatusFor("HKQuantityTypeIdentifierStepCount");
      if (status === hk.AuthorizationStatus.sharingAuthorized) return "granted";
      if (status === hk.AuthorizationStatus.sharingDenied) return "denied";
      return "denied"; // notDetermined — treat as not-yet-granted, never auto-request
    } catch {
      return "denied";
    }
  }

  async requestPermission(): Promise<PermissionResult> {
    const hk = this.hk();
    if (!hk) return "unavailable";

    try {
      const granted = await hk.requestAuthorization({
        toRead: [
          "HKQuantityTypeIdentifierStepCount",
          "HKQuantityTypeIdentifierDistanceWalkingRunning",
          "HKQuantityTypeIdentifierActiveEnergyBurned",
        ],
      });
      return granted ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }

  async readTodayActivity(): Promise<RawActivityReading> {
    const hk = this.hk();
    if (!hk) return { steps: 0, distanceMeters: 0, activeMinutes: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const options = { filter: { date: { startDate: startOfDay, endDate: new Date() } } };

    const [stepsResult, distanceResult] = await Promise.all([
      hk
        .queryStatisticsForQuantity("HKQuantityTypeIdentifierStepCount", ["cumulativeSum"], { ...options, unit: "count" })
        .catch(() => null),
      hk
        .queryStatisticsForQuantity("HKQuantityTypeIdentifierDistanceWalkingRunning", ["cumulativeSum"], {
          ...options,
          unit: "m",
        })
        .catch(() => null),
    ]);

    const steps = stepsResult?.sumQuantity?.quantity ?? 0;
    const distanceMeters = distanceResult?.sumQuantity?.quantity ?? 0; // explicit "m" unit requested above

    // HealthKit has no direct "active minutes" quantity; without a more
    // complex workout-session query this is left at 0 rather than
    // approximated from energy burned, which would be a rough guess
    // presented as a real measurement.
    return { steps, distanceMeters, activeMinutes: 0 };
  }
}
