import { api } from "./api";
import type { Streaks, StreakHistoryDay } from "../types";

/** Backed by GET /api/streaks — see backend/app/services/streak_service.py
 * for the exact rules. No client-side streak math exists here; mobile
 * calls the identical endpoint so the numbers can never diverge. */
export async function getStreaks(): Promise<Streaks> {
  const { data } = await api.get<Streaks>("/api/streaks");
  return data;
}

export async function getStreakHistory(days = 7): Promise<StreakHistoryDay[]> {
  const { data } = await api.get<StreakHistoryDay[]>("/api/streaks/history", { params: { days } });
  return data;
}
