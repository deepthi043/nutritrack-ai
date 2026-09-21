import { Droplet, Trophy, Target, CalendarCheck } from "lucide-react";
import { AnalyticsCard } from "./AnalyticsCard";
import { EmptyState } from "../EmptyState";
import type { WaterAnalytics as WaterAnalyticsType } from "../../types";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WaterAnalytics({ data }: { data: WaterAnalyticsType }) {
  if (data.average_daily_ml === 0) {
    return (
      <EmptyState
        icon={Droplet}
        title="Not enough hydration data yet."
        description="Log some water this week and your trends will appear here."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <AnalyticsCard icon={Droplet} label="Avg Daily Water" value={`${(data.average_daily_ml / 1000).toFixed(2)} L`} iconClassName="bg-sky-50 text-sky-600" />
      <AnalyticsCard
        icon={Trophy}
        label="Best Day"
        value={data.best_day_date ? `${((data.best_day_ml ?? 0) / 1000).toFixed(2)} L (${formatDate(data.best_day_date)})` : "—"}
        iconClassName="bg-emerald-50 text-emerald-600"
      />
      <AnalyticsCard icon={Target} label="Avg Goal Completion" value={`${data.average_goal_completion_percent}%`} />
      <AnalyticsCard icon={CalendarCheck} label="Days Goal Reached" value={`${data.days_goal_reached} / 7`} iconClassName="bg-amber-50 text-amber-600" />
    </div>
  );
}
