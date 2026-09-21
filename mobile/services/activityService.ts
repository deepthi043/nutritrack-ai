import { api } from "./api";
import { localDateString } from "./localDate";
import type { TodayActivity, DailyStepsPoint, ActivitySyncRequest, ActivitySyncResponse } from "../types";

export async function getTodayActivity(): Promise<TodayActivity> {
  const { data } = await api.get<TodayActivity>("/api/activity/today", {
    params: { local_date: localDateString() },
  });
  return data;
}

export async function getWeeklyActivity(): Promise<DailyStepsPoint[]> {
  const { data } = await api.get<DailyStepsPoint[]>("/api/activity/weekly", {
    params: { local_date: localDateString() },
  });
  return data;
}

/** Idempotent daily sync — see backend/app/api/activity.py `sync_activity`.
 * Safe to call repeatedly with the same or an updated cumulative total for
 * the same day; the server upserts one row per (day, source) rather than
 * creating duplicates. */
export async function syncActivity(payload: ActivitySyncRequest): Promise<ActivitySyncResponse> {
  const { data } = await api.post<ActivitySyncResponse>("/api/activity/sync", payload);
  return data;
}
