import { Pencil } from "lucide-react";
import { Card } from "../Card";
import { GoalProgress } from "./GoalProgress";
import type { GoalProgress as GoalProgressType } from "../../types";

const CATEGORY_COLORS: Record<string, string> = {
  activity: "bg-brand-600",
  hydration: "bg-sky-500",
};

interface GoalCardProps {
  goal: GoalProgressType;
  onEdit: (goal: GoalProgressType) => void;
}

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">{goal.label}</h4>
        <button
          onClick={() => onEdit(goal)}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <Pencil className="h-3 w-3" />
          Edit Goal
        </button>
      </div>
      <GoalProgress
        current={goal.current}
        target={goal.target}
        unit={goal.unit}
        progressPercent={goal.progress_percent}
        colorClassName={CATEGORY_COLORS[goal.category]}
      />
    </Card>
  );
}
