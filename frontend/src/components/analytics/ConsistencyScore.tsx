import { Card } from "../Card";
import { ProgressBar } from "../ProgressBar";
import type { ConsistencyScore as ConsistencyScoreType } from "../../types";

const COMPONENT_LABELS: Record<string, string> = {
  activity: "Activity Goal",
  water: "Water Goal",
};

export function ConsistencyScore({ data }: { data: ConsistencyScoreType }) {
  return (
    <Card>
      <h3 className="mb-1 text-sm font-medium text-slate-700">Weekly Consistency</h3>
      <p className="mb-3 text-3xl font-semibold text-slate-900">{data.score_percent}%</p>
      <ProgressBar percent={data.score_percent} heightClassName="h-3" />

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        {Object.entries(data.components).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs text-slate-500">
            <span>{COMPONENT_LABELS[key] ?? key}</span>
            <span className="font-medium text-slate-700">{value}%</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">{data.formula}</p>
    </Card>
  );
}
