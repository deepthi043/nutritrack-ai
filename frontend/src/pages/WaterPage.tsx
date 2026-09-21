import { useCallback, useEffect, useState } from "react";
import { Droplet, Flame } from "lucide-react";
import { AppLayout } from "../layouts/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { WaterProgress } from "../components/water/WaterProgress";
import { QuickWaterButtons } from "../components/water/QuickWaterButtons";
import { WaterEntryForm } from "../components/water/WaterEntryForm";
import { WaterHistory } from "../components/water/WaterHistory";
import { WaterChart } from "../components/water/WaterChart";
import { getTodayWater, getTodayWaterEntries, getWeeklyWater, addWater, deleteWater } from "../services/waterService";
import { getStreaks } from "../services/streakService";
import { getApiErrorMessage } from "../services/api";
import type { TodayWater, WaterRecord, DailyWaterPoint, Streaks } from "../types";

export function WaterPage() {
  const [today, setToday] = useState<TodayWater | null>(null);
  const [entries, setEntries] = useState<WaterRecord[]>([]);
  const [weekly, setWeekly] = useState<DailyWaterPoint[]>([]);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [todayData, entriesData, weeklyData, streaksData] = await Promise.all([
        getTodayWater(),
        getTodayWaterEntries(),
        getWeeklyWater(),
        getStreaks(),
      ]);
      setToday(todayData);
      setEntries(entriesData);
      setWeekly(weeklyData);
      setStreaks(streaksData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddWater(amountMl: number) {
    setIsAdding(true);
    try {
      await addWater(amountMl);
      await loadData();
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteWater(id);
    await loadData();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Hydration</h1>
        <p className="text-sm text-slate-500">Track your daily water intake.</p>
      </div>

      {isLoading && <LoadingState message="Loading hydration data..." />}

      {!isLoading && error && <ErrorState message="Unable to load water data." onRetry={loadData} />}

      {!isLoading && !error && today && (
        <div className="space-y-6">
          {streaks && streaks.hydration.current > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
              <Flame className="h-4 w-4" />
              Hydration Streak: {streaks.hydration.current} day{streaks.hydration.current === 1 ? "" : "s"} · Best:{" "}
              {streaks.hydration.best}
            </div>
          )}

          <WaterProgress
            totalMl={today.total_ml}
            goalMl={today.goal_ml}
            progressPercent={today.progress_percent}
            isUsingRecommendedGoal={today.is_using_recommended_goal}
            remainingMl={Math.max(today.goal_ml - today.total_ml, 0)}
          />

          <QuickWaterButtons onAdd={handleAddWater} isAdding={isAdding} />

          <WaterEntryForm onAdd={handleAddWater} />

          {entries.length === 0 ? (
            <EmptyState
              icon={Droplet}
              title="No water recorded today."
              description="Start tracking your hydration using the quick-add buttons or a custom amount above."
            />
          ) : (
            <WaterHistory entries={entries} onDelete={handleDelete} />
          )}

          <WaterChart data={weekly} />
        </div>
      )}
    </AppLayout>
  );
}
