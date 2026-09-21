import { api } from "./api";
import type { AnalyticsSummary, ActivityAnalytics, WaterAnalytics } from "../types";

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const { data } = await api.get<AnalyticsSummary>("/api/analytics/summary");
  return data;
}

export async function getActivityAnalytics(): Promise<ActivityAnalytics> {
  const { data } = await api.get<ActivityAnalytics>("/api/analytics/activity");
  return data;
}

export async function getWaterAnalytics(): Promise<WaterAnalytics> {
  const { data } = await api.get<WaterAnalytics>("/api/analytics/water");
  return data;
}
