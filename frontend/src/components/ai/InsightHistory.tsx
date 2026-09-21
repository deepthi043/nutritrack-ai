import { History } from "lucide-react";
import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import type { AIInsightHistoryItem } from "../../types";

const TYPE_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly" };

export function InsightHistory({ items }: { items: AIInsightHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No insights generated yet."
        description="Generate a daily or weekly insight above to see it saved here."
      />
    );
  }

  return (
    <Card className="p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-medium text-slate-700">Insight History</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="px-5 py-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {TYPE_LABELS[item.insight_type] ?? item.insight_type}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(item.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700">{item.content}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
