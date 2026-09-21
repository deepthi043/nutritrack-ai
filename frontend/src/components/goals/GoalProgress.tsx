import { ProgressBar } from "../ProgressBar";

interface GoalProgressProps {
  current: number;
  target: number;
  unit: string;
  progressPercent: number;
  colorClassName?: string;
}

function formatValue(value: number): string {
  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

export function GoalProgress({ current, target, unit, progressPercent, colorClassName = "bg-brand-600" }: GoalProgressProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">
          {formatValue(current)} / {formatValue(target)} {unit}
        </span>
        <span className="text-slate-500">{progressPercent}%</span>
      </div>
      <ProgressBar percent={progressPercent} colorClassName={colorClassName} />
    </div>
  );
}
