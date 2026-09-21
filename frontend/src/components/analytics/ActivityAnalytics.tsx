import { Footprints, TrendingUp, Clock3, Trophy, Target } from "lucide-react";
import { AnalyticsCard } from "./AnalyticsCard";
import { EmptyState } from "../EmptyState";
import type { ActivityAnalytics as ActivityAnalyticsType } from "../../types";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ActivityAnalytics({ data }: { data: ActivityAnalyticsType }) {
  if (data.total_weekly_steps === 0) {
    return (
      <EmptyState
        icon={Footprints}
        title="Not enough activity data yet."
        description="Log some activity this week and your trends will appear here."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <AnalyticsCard icon={Footprints} label="Avg Daily Steps" value={data.average_daily_steps.toLocaleString()} />
      <AnalyticsCard icon={TrendingUp} label="Total Weekly Steps" value={data.total_weekly_steps.toLocaleString()} />
      <AnalyticsCard icon={Clock3} label="Avg Active Minutes" value={`${data.average_active_minutes} min`} iconClassName="bg-amber-50 text-amber-600" />
      <AnalyticsCard
        icon={Trophy}
        label="Best Day"
        value={data.best_day_date ? `${data.best_day_steps?.toLocaleString()} (${formatDate(data.best_day_date)})` : "—"}
        iconClassName="bg-emerald-50 text-emerald-600"
      />
      <AnalyticsCard icon={Target} label="Goal Completion" value={`${data.goal_completion_percent}%`} iconClassName="bg-sky-50 text-sky-600" />
    </div>
  );
}
