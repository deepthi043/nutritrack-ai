import { Platform } from "react-native";
import type { ActivityProvider, PermissionResult, RawActivityReading } from "./types";

/**
 * Reads today's cumulative steps, distance, and active minutes from
 * Android Health Connect via `react-native-health-connect`.
 *
 * Requires a custom development build (expo-dev-client / EAS Build) — the
 * native Health Connect module is not present in Expo Go. See
 * mobile/README.md "Platform Requirements".
 *
 * Only READ permissions are requested (Steps, Distance, ExerciseSession)
 * per the minimum-permissions principle (Phase 6 spec section 13) — this
 * app never writes to Health Connect.
 */
export class AndroidHealthProvider implements ActivityProvider {
  readonly source = "android_health" as const;

  private hc(): typeof import("react-native-health-connect") | null {
    if (Platform.OS !== "android") return null;
    try {
      // Lazy require so this file doesn't crash-on-import on iOS/web,
      // where the native module isn't linked.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("react-native-health-connect");
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    const hc = this.hc();
    if (!hc) return false;
    try {
      const status = await hc.getSdkStatus();
      return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  }

  async getPermissionState(): Promise<PermissionResult> {
    const hc = this.hc();
    if (!hc) return "unavailable";
    try {
      const granted = await hc.getGrantedPermissions();
      const hasSteps = granted.some((p) => "recordType" in p && p.recordType === "Steps");
      const hasDistance = granted.some((p) => "recordType" in p && p.recordType === "Distance");
      return hasSteps && hasDistance ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }

  async requestPermission(): Promise<PermissionResult> {
    const hc = this.hc();
    if (!hc) return "unavailable";

    const initialized = await hc.initialize();
    if (!initialized) return "unavailable";

    try {
      const granted = await hc.requestPermission([
        { accessType: "read", recordType: "Steps" },
        { accessType: "read", recordType: "Distance" },
        { accessType: "read", recordType: "ExerciseSession" },
      ]);
      const hasSteps = granted.some((p) => "recordType" in p && p.recordType === "Steps");
      return hasSteps ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }

  /**
   * Reads the user's real cumulative step/distance/active-minutes total
   * for the LOCAL calendar day so far.
   *
   * Day boundary: `startOfDay` is built from the device's local wall-clock
   * time (`setHours(0,0,0,0)`, not a UTC truncation), so the window is
   * always "local midnight to now" — this matters because a UTC-based
   * boundary would roll over at the wrong wall-clock moment for any
   * non-UTC timezone, either truncating this morning's steps or bleeding
   * in steps from the wrong day. The backend independently receives this
   * same local calendar date as `ActivitySyncRequest.date` (see
   * activitySyncService.todayDateString) and as the `local_date` query
   * param on GET /api/activity/today, so both sides agree on which
   * calendar day "today" means.
   *
   * Source/deduplication strategy: `aggregateRecord` is Health Connect's
   * OS-level aggregate API, not a manual sum of `readRecords`. Per the
   * Health Connect platform contract, aggregation across multiple
   * contributing apps (e.g. Google Fit AND Samsung Health both writing
   * Steps) is deduplicated/merged by the OS before the total is returned —
   * we deliberately do not read raw per-source records and sum them
   * ourselves, which would risk double-counting the same physical steps
   * reported by two apps. We also do not hardcode a preferred source
   * (e.g. "always prefer Google Fit") — Health Connect's aggregate already
   * reflects whatever the OS considers the correct combined total across
   * every app the user has granted write access to.
   */
  async readTodayActivity(): Promise<RawActivityReading> {
    const hc = this.hc();
    if (!hc) return { steps: 0, distanceMeters: 0, activeMinutes: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const timeRangeFilter = {
      operator: "between" as const,
      startTime: startOfDay.toISOString(),
      endTime: new Date().toISOString(),
    };

    const [stepsResult, distanceResult, exerciseResult] = await Promise.all([
      hc.aggregateRecord({ recordType: "Steps", timeRangeFilter }).catch(() => null),
      hc.aggregateRecord({ recordType: "Distance", timeRangeFilter }).catch(() => null),
      hc.aggregateRecord({ recordType: "ExerciseSession", timeRangeFilter }).catch(() => null),
    ]);

    // COUNT_TOTAL is Health Connect's own deduplicated aggregate — not a
    // client-side sum — so overlapping/adjacent records from one or more
    // source apps are already correctly merged by the OS (see doc comment
    // above). A missing result (no permission, no data) is a real zero,
    // not an error to fabricate a number around.
    const steps = stepsResult?.COUNT_TOTAL ?? 0;
    const distanceMeters = distanceResult?.DISTANCE?.inMeters ?? 0;
    // Health Connect has no direct "active minutes" aggregate; total
    // logged exercise session duration is the closest available proxy.
    // This is 0 unless some app has logged an actual workout/exercise
    // session — background step counting alone does not populate it.
    const activeMinutes = exerciseResult?.EXERCISE_DURATION_TOTAL
      ? Math.round(exerciseResult.EXERCISE_DURATION_TOTAL.inSeconds / 60)
      : 0;

    return { steps, distanceMeters, activeMinutes };
  }
}
