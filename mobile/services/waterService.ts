import { api } from "./api";
import type { TodayWater, WaterRecord, DailyWaterPoint } from "../types";

export async function getTodayWater(): Promise<TodayWater> {
  const { data } = await api.get<TodayWater>("/api/water/today");
  return data;
}

export async function getTodayWaterEntries(): Promise<WaterRecord[]> {
  const { data } = await api.get<WaterRecord[]>("/api/water/today/entries");
  return data;
}

export async function getWeeklyWater(): Promise<DailyWaterPoint[]> {
  const { data } = await api.get<DailyWaterPoint[]>("/api/water/weekly");
  return data;
}

/** Part 14: every tap creates a real backend water record — the server
 * remains authoritative for the daily total (see get_today_summary), this
 * never computes totals client-side. */
export async function addWater(amountMl: number): Promise<WaterRecord> {
  const { data } = await api.post<WaterRecord>("/api/water", { amount_ml: amountMl });
  return data;
}

export async function deleteWater(id: number): Promise<void> {
  await api.delete(`/api/water/${id}`);
}
