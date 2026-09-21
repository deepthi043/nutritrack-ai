import { api } from "./api";
import type { HistoryDayEntry, HistoryRangePreset } from "../types";

export async function getHistory(params: { range: HistoryRangePreset } | { start_date: string; end_date: string }): Promise<HistoryDayEntry[]> {
  const { data } = await api.get<HistoryDayEntry[]>("/api/history", { params });
  return data;
}
