import { useCallback, useEffect, useState } from "react";
import { Footprints, MapPin, Clock3 } from "lucide-react";
import { AppLayout } from "../layouts/AppLayout";
import { Card } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ProgressBar } from "../components/ProgressBar";
import { ActivityStatCard } from "../components/activity/ActivityStatCard";
import { WeeklyActivityChart } from "../components/activity/WeeklyActivityChart";
import { WaterProgress } from "../components/water/WaterProgress";
import { WaterChart } from "../components/water/WaterChart";
import { GoalSummary } from "../components/goals/GoalSummary";
import { GoalEditModal } from "../components/goals/GoalEditModal";
import { InsightCard } from "../components/ai/InsightCard";
import { useAuth } from "../context/AuthContext";
import { getTodayActivity, getWeeklyActivity } from "../services/activityService";
import { getTodayWater, getWeeklyWater } from "../services/waterService";
import { getGoals, updateGoal } from "../services/goalService";
import { generateDailyInsight } from "../services/aiService";
import { getStreaks } from "../services/streakService";
import { getApiErrorMessage } from "../services/api";
import type {
  TodayActivity,
  DailyStepsPoint,
  TodayWater,
  DailyWaterPoint,
  GoalProgress,
  DailyInsight,
  Streaks,
} from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] || "there";

  const [today, setToday] = useState<TodayActivity | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<DailyStepsPoint[]>([]);
  const [water, setWater] = useState<TodayWater | null>(null);
  const [weeklyWater, setWeeklyWater] = useState<DailyWaterPoint[]>([]);
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [editingGoal, setEditingGoal] = useState<GoalProgress | null>(null);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [todayData, weeklyActivityData, waterData, weeklyWaterData, goalsData, streaksData] = await Promise.all([
        getTodayActivity(),
        getWeeklyActivity(),
        getTodayWater(),
        getWeeklyWater(),
        getGoals(),
        getStreaks(),
      ]);
      setToday(todayData);
      setWeeklyActivity(weeklyActivityData);
      setWater(waterData);
      setWeeklyWater(weeklyWaterData);
      setGoals(goalsData);
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

  async function handleSaveGoal(target: number) {
    if (!editingGoal) return;
    await updateGoal(editingGoal.key, target);
    await loadData();
  }

  async function handleGenerateInsight() {
    setIsGeneratingInsight(true);
    setInsightError(null);
    try {
      const insight = await generateDailyInsight();
      setDailyInsight(insight);
    } catch (err) {
      setInsightError(getApiErrorMessage(err));
    } finally {
      setIsGeneratingInsight(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-slate-900">Good to see you, {firstName} 👋</h1>
          <p className="text-sm text-slate-500">Here's your wellness summary for today.</p>
        </div>
        {streaks && streaks.overall.current > 0 && (
          <div className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800">
            🔥 {streaks.overall.current} Day Streak
          </div>
        )}
      </div>

      {isLoading && <LoadingState message="Loading your dashboard..." />}

      {!isLoading && error && <ErrorState message="Unable to load dashboard data." onRetry={loadData} />}

      {!isLoading && !error && today && water && (
        <div className="space-y-8">
          <Card>
            <p className="text-sm text-slate-600">
              {today.has_activity ? (
                <>
                  Today you recorded <span className="font-medium text-slate-900">{today.steps.toLocaleString()} steps</span>{" "}
                  and <span className="font-medium text-slate-900">{today.active_minutes} active minutes</span>, covering{" "}
                  <span className="font-medium text-slate-900">{today.distance_km.toFixed(2)} km</span>.{" "}
                </>
              ) : (
                <>No activity recorded yet today. </>
              )}
              You've had <span className="font-medium text-slate-900">{(water.total_ml / 1000).toFixed(1)} L</span> of water so
              far.
            </p>
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Today's Activity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ActivityStatCard
                icon={Footprints}
                label="Steps"
                value={today.steps.toLocaleString()}
                subtext={`Goal: ${today.step_goal.toLocaleString()}`}
              />
              <ActivityStatCard
                icon={MapPin}
                label="Distance"
                value={`${today.distance_km.toFixed(2)} km`}
                iconClassName="bg-sky-50 text-sky-600"
              />
              <ActivityStatCard
                icon={Clock3}
                label="Active Minutes"
                value={`${today.active_minutes} min`}
                iconClassName="bg-amber-50 text-amber-600"
              />
            </div>
            <Card className="mt-4">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">Step Goal Progress</span>
                <span className="text-slate-500">{today.goal_progress_percent}%</span>
              </div>
              <ProgressBar percent={today.goal_progress_percent} />
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Today's Water</h2>
            <WaterProgress
              totalMl={water.total_ml}
              goalMl={water.goal_ml}
              progressPercent={water.progress_percent}
              isUsingRecommendedGoal={water.is_using_recommended_goal}
              remainingMl={Math.max(water.goal_ml - water.total_ml, 0)}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Weekly Trends</h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <WeeklyActivityChart data={weeklyActivity} />
              <WaterChart data={weeklyWater} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Goal Progress</h2>
            <GoalSummary goals={goals} onEditGoal={setEditingGoal} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">AI Insight</h2>
            <InsightCard
              title="Today's Insight"
              content={dailyInsight?.content ?? null}
              disclaimer={dailyInsight?.disclaimer}
              source={dailyInsight?.source}
              generatedAt={dailyInsight?.generated_at}
              isLoading={isGeneratingInsight}
              onGenerate={handleGenerateInsight}
              generateLabel="Generate Insight"
            />
            {insightError && <p className="mt-2 text-sm text-red-600">{insightError}</p>}
          </section>
        </div>
      )}

      <GoalEditModal goal={editingGoal} onClose={() => setEditingGoal(null)} onSave={handleSaveGoal} />
    </AppLayout>
  );
}
