import { useCallback, useEffect, useState } from "react";
import { Footprints, MapPin, Clock3, Plus, Flame } from "lucide-react";
import { AppLayout } from "../layouts/AppLayout";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ActivityStatCard } from "../components/activity/ActivityStatCard";
import { StepProgress } from "../components/activity/StepProgress";
import { WeeklyActivityChart } from "../components/activity/WeeklyActivityChart";
import { AddActivityModal } from "../components/activity/AddActivityModal";
import { ActivityHistory } from "../components/activity/ActivityHistory";
import { ActivityEmptyState } from "../components/activity/ActivityEmptyState";
import {
  getTodayActivity,
  getActivityHistory,
  getWeeklyActivity,
  addActivity,
  updateStepGoal,
} from "../services/activityService";
import { getStreaks } from "../services/streakService";
import { getApiErrorMessage } from "../services/api";
import type { TodayActivity, ActivityRecord, DailyStepsPoint, AddActivityInput, Streaks } from "../types";

export function ActivityPage() {
  const [today, setToday] = useState<TodayActivity | null>(null);
  const [history, setHistory] = useState<ActivityRecord[]>([]);
  const [weekly, setWeekly] = useState<DailyStepsPoint[]>([]);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [todayData, historyData, weeklyData, streaksData] = await Promise.all([
        getTodayActivity(),
        getActivityHistory({ limit: 10 }),
        getWeeklyActivity(),
        getStreaks(),
      ]);
      setToday(todayData);
      setHistory(historyData);
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

  async function handleAddActivity(input: AddActivityInput) {
    await addActivity(input);
    await loadData();
  }

  async function handleUpdateGoal(newGoal: number) {
    await updateStepGoal(newGoal);
    await loadData();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Today's Activity</h1>
          <p className="text-sm text-slate-500">Track your steps, distance, and active minutes.</p>
        </div>
        {!isLoading && !error && today && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Activity
          </Button>
        )}
      </div>

      {isLoading && <LoadingState message="Loading activity data..." />}

      {!isLoading && error && <ErrorState message="Unable to load activity data." onRetry={loadData} />}

      {!isLoading && !error && today && (
        <div className="space-y-6">
          {!today.has_activity && <ActivityEmptyState onAddActivity={() => setIsModalOpen(true)} />}

          {today.has_activity && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ActivityStatCard
                icon={Footprints}
                label="Steps"
                value={today.steps.toLocaleString()}
                subtext={`of ${today.step_goal.toLocaleString()} goal`}
              />
              <ActivityStatCard
                icon={MapPin}
                label="Distance"
                value={`${today.distance_km.toFixed(2)} km`}
                iconClassName="bg-sky-50 text-sky-600"
              />
              <ActivityStatCard
                icon={Clock3}
                label="Active Time"
                value={`${today.active_minutes} min`}
                iconClassName="bg-amber-50 text-amber-600"
              />
              {streaks && (
                <ActivityStatCard
                  icon={Flame}
                  label="Step Streak"
                  value={`${streaks.steps.current} day${streaks.steps.current === 1 ? "" : "s"}`}
                  subtext={`Best: ${streaks.steps.best}`}
                  iconClassName="bg-orange-50 text-orange-600"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StepProgress
              steps={today.steps}
              goal={today.step_goal}
              progressPercent={today.goal_progress_percent}
              onUpdateGoal={handleUpdateGoal}
            />
            <WeeklyActivityChart data={weekly} />
          </div>

          {history.length > 0 && <ActivityHistory records={history} />}
        </div>
      )}

      <AddActivityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddActivity} />
    </AppLayout>
  );
}
