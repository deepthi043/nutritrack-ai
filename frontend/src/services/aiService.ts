import { api } from "./api";
import type { DailyInsight, WeeklyInsight, AIChatResponse, AIInsightHistoryItem } from "../types";

export async function generateDailyInsight(): Promise<DailyInsight> {
  const { data } = await api.post<DailyInsight>("/api/ai/daily-insight");
  return data;
}

export async function generateWeeklyInsight(): Promise<WeeklyInsight> {
  const { data } = await api.post<WeeklyInsight>("/api/ai/weekly-insight");
  return data;
}

export async function askAI(question: string): Promise<AIChatResponse> {
  const { data } = await api.post<AIChatResponse>("/api/ai/chat", { question });
  return data;
}

export async function getInsightHistory(): Promise<AIInsightHistoryItem[]> {
  const { data } = await api.get<AIInsightHistoryItem[]>("/api/ai/insights/history");
  return data;
}
