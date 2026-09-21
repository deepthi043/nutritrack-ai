import { Droplet, X } from "lucide-react";
import { Card } from "../Card";
import type { WaterRecord } from "../../types";

interface WaterHistoryProps {
  entries: WaterRecord[];
  onDelete: (id: number) => void;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function WaterHistory({ entries, onDelete }: WaterHistoryProps) {
  if (entries.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">No water logged today yet.</Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-medium text-slate-700">Today's Entries</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Droplet className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm text-slate-700">{formatTime(entry.consumed_at)}</span>
            <span className="text-sm font-medium text-slate-900">{entry.amount_ml} ml</span>
            <button
              onClick={() => onDelete(entry.id)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              aria-label="Delete entry"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
