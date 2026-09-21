import { api } from "./api";
import { localDateString } from "./localDate";
import type { Streaks, StreakHistoryDay } from "../types";

/** Backed by GET /api/streaks — see backend/app/services/streak_service.py
 * for the exact rules. Mobile and web call this identical endpoint so
 * streak numbers can never diverge between them (no client-side streak
 * math exists anywhere in this app). */
export async function getStreaks(): Promise<Streaks> {
  const { data } = await api.get<Streaks>("/api/streaks", {
    params: { local_date: localDateString() },
  });
  return data;
}

export async function getStreakHistory(days = 7): Promise<StreakHistoryDay[]> {
  const { data } = await api.get<StreakHistoryDay[]>("/api/streaks/history", {
    params: { days, local_date: localDateString() },
  });
  return data;
}
