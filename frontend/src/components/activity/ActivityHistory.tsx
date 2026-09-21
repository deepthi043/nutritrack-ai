import { Footprints } from "lucide-react";
import { Card } from "../Card";
import type { ActivityRecord } from "../../types";

interface ActivityHistoryProps {
  records: ActivityRecord[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ActivityHistory({ records }: ActivityHistoryProps) {
  if (records.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">
        No activity history yet.
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-medium text-slate-700">Recent Entries</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {records.map((record) => (
          <li key={record.id} className="flex items-center gap-4 px-5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Footprints className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{record.steps.toLocaleString()} steps</p>
              <p className="text-xs text-slate-500">
                {formatDate(record.date)} · {formatTime(record.date)}
                {record.data_source === "mock" && " · Demo data"}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-500">
              <p>{record.distance_km.toFixed(2)} km</p>
              <p>{record.active_minutes} min</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
