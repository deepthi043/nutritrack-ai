import { GoalCard } from "./GoalCard";
import type { GoalProgress } from "../../types";

const CATEGORY_LABELS: Record<string, string> = {
  activity: "Activity",
  hydration: "Hydration",
};

const CATEGORY_ORDER = ["activity", "hydration"];

interface GoalSummaryProps {
  goals: GoalProgress[];
  onEditGoal: (goal: GoalProgress) => void;
}

export function GoalSummary({ goals, onEditGoal }: GoalSummaryProps) {
  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const categoryGoals = goals.filter((g) => g.category === category);
        if (categoryGoals.length === 0) return null;

        return (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {categoryGoals.map((goal) => (
                <GoalCard key={goal.key} goal={goal} onEdit={onEditGoal} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
