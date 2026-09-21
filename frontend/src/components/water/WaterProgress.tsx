import { Droplet } from "lucide-react";
import { Card } from "../Card";
import { ProgressBar } from "../ProgressBar";

interface WaterProgressProps {
  totalMl: number;
  goalMl: number;
  progressPercent: number;
  isUsingRecommendedGoal?: boolean;
  remainingMl?: number;
}

function formatLiters(ml: number): string {
  return (ml / 1000).toFixed(1);
}

export function WaterProgress({
  totalMl,
  goalMl,
  progressPercent,
  isUsingRecommendedGoal,
  remainingMl,
}: WaterProgressProps) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Droplet className="h-5 w-5 text-sky-500" />
        <h3 className="text-sm font-medium text-slate-700">Today's Hydration</h3>
      </div>
      <p className="mb-3 text-2xl font-semibold text-slate-900">
        {formatLiters(totalMl)} L <span className="text-base font-normal text-slate-400">/ {formatLiters(goalMl)} L</span>
      </p>
      <ProgressBar percent={progressPercent} colorClassName="bg-sky-500" />
      <p className="mt-1.5 text-xs text-slate-400">
        {progressPercent}% of daily goal
        {typeof remainingMl === "number" && remainingMl > 0 ? ` · ${remainingMl} ml remaining` : ""}
      </p>
      {isUsingRecommendedGoal && (
        <p className="mt-1 text-xs text-slate-400">
          🎯 Automatically estimated from your weight — a general wellness estimate, not a medical target. Adjust it
          anytime in Goals.
        </p>
      )}
    </Card>
  );
}
