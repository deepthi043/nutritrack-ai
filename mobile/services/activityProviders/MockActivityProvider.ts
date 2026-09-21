import type { ActivityProvider, PermissionResult, RawActivityReading } from "./types";

/**
 * Development-only provider that returns a fixed, clearly-labelled demo
 * reading instead of real sensor data. Used automatically in Expo Go
 * (where native Health Connect / HealthKit modules are unavailable) and
 * as an explicit manual-entry fallback if the real provider's permission
 * is denied — matching the backend's own MockActivityProvider pattern
 * (backend/app/services/activity_provider.py) and never presented to the
 * user as real tracked activity (see ActivityScreen's "Demo data" label).
 */
export class MockActivityProvider implements ActivityProvider {
  readonly source = "mock" as const;

  async isAvailable(): Promise<boolean> {
    return true; // always available — it's the guaranteed fallback
  }

  async getPermissionState(): Promise<PermissionResult> {
    return "granted"; // no real permission needed for manual/demo entry
  }

  async requestPermission(): Promise<PermissionResult> {
    return "granted";
  }

  async readTodayActivity(): Promise<RawActivityReading> {
    // No real data to read — callers should route to manual entry instead
    // of calling this in production. Returned only so the interface is
    // total; the Activity screen never displays this as if it were sensed.
    return { steps: 0, distanceMeters: 0, activeMinutes: 0 };
  }
}
