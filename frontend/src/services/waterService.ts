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

export async function addWater(amount_ml: number): Promise<WaterRecord> {
  const { data } = await api.post<WaterRecord>("/api/water", { amount_ml });
  return data;
}

export async function getWaterHistory(params?: {
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<WaterRecord[]> {
  const { data } = await api.get<WaterRecord[]>("/api/water/history", { params });
  return data;
}

export async function getWeeklyWater(): Promise<DailyWaterPoint[]> {
  const { data } = await api.get<DailyWaterPoint[]>("/api/water/weekly");
  return data;
}

export async function deleteWater(id: number): Promise<void> {
  await api.delete(`/api/water/${id}`);
}
