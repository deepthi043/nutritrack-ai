import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ActivityAnalytics } from "../components/analytics/ActivityAnalytics";
import { WaterAnalytics } from "../components/analytics/WaterAnalytics";
import { ConsistencyScore } from "../components/analytics/ConsistencyScore";
import { WeeklyActivityChart } from "../components/activity/WeeklyActivityChart";
import { WaterChart } from "../components/water/WaterChart";
import { getAnalyticsSummary } from "../services/analyticsService";
import { getWeeklyActivity } from "../services/activityService";
import { getWeeklyWater } from "../services/waterService";
import { getApiErrorMessage } from "../services/api";
import type { AnalyticsSummary, DailyStepsPoint, DailyWaterPoint } from "../types";

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<DailyStepsPoint[]>([]);
  const [weeklyWater, setWeeklyWater] = useState<DailyWaterPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, activityData, waterData] = await Promise.all([
        getAnalyticsSummary(),
        getWeeklyActivity(),
        getWeeklyWater(),
      ]);
      setSummary(summaryData);
      setWeeklyActivity(activityData);
      setWeeklyWater(waterData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Your activity and hydration trends for the last 7 days.</p>
      </div>

      {isLoading && <LoadingState message="Loading analytics..." />}

      {!isLoading && error && <ErrorState message="Unable to load analytics." onRetry={loadData} />}

      {!isLoading && !error && summary && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
            <ActivityAnalytics data={summary.activity} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Hydration</h2>
            <WaterAnalytics data={summary.water} />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <WeeklyActivityChart data={weeklyActivity} />
            <WaterChart data={weeklyWater} />
          </div>

          <ConsistencyScore data={summary.consistency} />
        </div>
      )}
    </AppLayout>
  );
}
