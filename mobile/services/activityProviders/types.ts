import type { ActivitySyncSource } from "../../types";

/** One day's aggregated activity reading from a platform health API,
 * ready to be normalized into an ActivitySyncRequest. */
export interface RawActivityReading {
  steps: number;
  distanceMeters: number;
  activeMinutes: number;
}

export type PermissionResult = "granted" | "denied" | "unavailable";

/**
 * Platform-independent interface every activity data source must
 * implement — the mobile counterpart to the backend's ActivityProvider
 * (backend/app/services/activity_provider.py). The rest of the app (the
 * Activity screen, the sync hook) only ever talks to this interface, never
 * to HealthKit/Health Connect APIs directly, so swapping/adding a provider
 * never touches UI or sync logic.
 */
export interface ActivityProvider {
  readonly source: ActivitySyncSource;

  /** Whether this provider can run at all on the current device/platform
   * (e.g. HealthKit is iOS-only; Health Connect requires the Health
   * Connect app on Android). Checked before ever prompting for permission. */
  isAvailable(): Promise<boolean>;

  /** Current permission state without prompting the user. */
  getPermissionState(): Promise<PermissionResult | "unknown">;

  /** Prompts the OS permission dialog. Must only be called after the user
   * has seen the in-app explanation screen (see components/activity/PermissionGate.tsx) —
   * never on app launch, and never repeatedly after a denial (section 7). */
  requestPermission(): Promise<PermissionResult>;

  /** Today's cumulative activity so far, read from the platform API. */
  readTodayActivity(): Promise<RawActivityReading>;
}
