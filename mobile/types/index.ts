// Mirrors backend/app/schemas/*.py response shapes actually used by the
// mobile app. Kept intentionally minimal — the mobile app is a thin client
// over the existing FastAPI backend, not a second implementation of its
// business logic.

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TodayActivity {
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
  step_goal: number;
  goal_progress_percent: number;
  has_activity: boolean;
}

export interface DailyStepsPoint {
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
}

export type ActivitySyncSource = "mock" | "android_native" | "android_health" | "ios_health" | "wearable";

export interface ActivitySyncRequest {
  date: string; // YYYY-MM-DD
  steps: number;
  distance_km: number;
  active_minutes: number;
  source: ActivitySyncSource;
}

export interface ActivitySyncResponse {
  id: number;
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
  source: string;
  synced_at: string;
  was_updated: boolean;
}

export interface TodayWater {
  date: string;
  total_ml: number;
  goal_ml: number;
  progress_percent: number;
  recommended_goal_ml: number | null;
  is_using_recommended_goal: boolean;
}

export interface WaterRecord {
  id: number;
  user_id: number;
  consumed_at: string;
  amount_ml: number;
  created_at: string;
  updated_at: string;
}

export interface DailyWaterPoint {
  date: string;
  amount_ml: number;
}

export interface StreakCounts {
  current: number;
  best: number;
}

/** Mirrors backend/app/schemas/streak.py StreaksResponse — see
 * backend/app/services/streak_service.py for the exact rule each of these
 * three streaks uses (steps: daily step goal met; hydration: daily water
 * goal met; overall: both met the same day). Mobile and web both read
 * this same endpoint so streak numbers can never diverge between them. */
export interface Streaks {
  overall: StreakCounts;
  steps: StreakCounts;
  hydration: StreakCounts;
}

export interface StreakHistoryDay {
  date: string;
  steps: number;
  water_ml: number;
  step_goal_met: boolean;
  hydration_goal_met: boolean;
  overall_goal_met: boolean;
}

// --- Mobile-only local state ---

export type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

export type SyncStatus = "idle" | "syncing" | "synced" | "pending" | "failed";

/** One day's activity reading captured from the device's health API,
 * queued locally until it's successfully synced to the backend. */
export interface PendingActivitySync {
  id: string; // local queue id (uuid-ish), not a server id
  payload: ActivitySyncRequest;
  queuedAt: string;
  attempts: number;
}
