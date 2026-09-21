import { api } from "./api";
import type { GoalProgress, GoalKey } from "../types";

export async function getGoals(): Promise<GoalProgress[]> {
  const { data } = await api.get<GoalProgress[]>("/api/goals");
  return data;
}

export async function updateGoal(key: GoalKey, target: number): Promise<void> {
  await api.put("/api/goals", { key, target });
}
