import { api } from "./api";
import type { TodayActivity, ActivityRecord, DailyStepsPoint, AddActivityInput, ProfileUpdateInput, Profile } from "../types";
import { updateProfile } from "./profileService";

export async function getTodayActivity(): Promise<TodayActivity> {
  const { data } = await api.get<TodayActivity>("/api/activity/today");
  return data;
}

export async function getActivityHistory(params?: {
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<ActivityRecord[]> {
  const { data } = await api.get<ActivityRecord[]>("/api/activity/history", { params });
  return data;
}

export async function getWeeklyActivity(): Promise<DailyStepsPoint[]> {
  const { data } = await api.get<DailyStepsPoint[]>("/api/activity/weekly");
  return data;
}

export async function addActivity(input: AddActivityInput): Promise<ActivityRecord> {
  const { data } = await api.post<ActivityRecord>("/api/activity", input);
  return data;
}

/** Step goal lives on the user's profile (Phase 1), so we reuse the
 * existing profile update endpoint rather than building a parallel
 * goal-storage mechanism for this one value. */
export async function updateStepGoal(daily_step_goal: number): Promise<Profile> {
  const payload: ProfileUpdateInput = { daily_step_goal };
  return updateProfile(payload);
}
