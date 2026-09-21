import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { Card } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { getHistory } from "../services/historyService";
import { getApiErrorMessage } from "../services/api";
import type { HistoryDayEntry, HistoryRangePreset } from "../types";
import { History as HistoryIcon } from "lucide-react";

const RANGE_OPTIONS: { value: HistoryRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
];

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function HistoryPage() {
  const [range, setRange] = useState<HistoryRangePreset | "custom">("last_7_days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [entries, setEntries] = useState<HistoryDayEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params =
        range === "custom" && customStart && customEnd
          ? { start_date: customStart, end_date: customEnd }
          : { range: range === "custom" ? "last_7_days" : range };
      const data = await getHistory(params as Parameters<typeof getHistory>[0]);
      setEntries(data);
      setSelectedDate(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (range !== "custom" || (customStart && customEnd)) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  function handleApplyCustomRange() {
    if (customStart && customEnd) loadData();
  }

  const selectedEntry = entries.find((e) => e.date === selectedDate) ?? null;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">History</h1>
        <p className="text-sm text-slate-500">Review your combined activity and water history.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={range === opt.value ? "primary" : "outline"}
              size="sm"
              onClick={() => setRange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
          <Button variant={range === "custom" ? "primary" : "outline"} size="sm" onClick={() => setRange("custom")}>
            Custom Range
          </Button>
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" label="Start" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <Input type="date" label="End" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            <Button variant="primary" size="sm" onClick={handleApplyCustomRange} disabled={!customStart || !customEnd}>
              Apply
            </Button>
          </div>
        )}
      </div>

      {isLoading && <LoadingState message="Loading history..." />}

      {!isLoading && error && <ErrorState message="Unable to load history." onRetry={loadData} />}

      {!isLoading && !error && entries.length === 0 && (
        <EmptyState icon={HistoryIcon} title="No history to show yet." description="Start logging activity and water to see your history here." />
      )}

      {!isLoading && !error && entries.length > 0 && (
        <div className="space-y-4">
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Steps</th>
                  <th className="px-5 py-3 font-medium">Distance</th>
                  <th className="px-5 py-3 font-medium">Water</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr
                    key={entry.date}
                    onClick={() => setSelectedDate(entry.date === selectedDate ? null : entry.date)}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedDate === entry.date ? "bg-brand-50" : ""}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">{formatDate(entry.date)}</td>
                    <td className="px-5 py-3 text-slate-600">{entry.steps.toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-600">{entry.distance_km.toFixed(2)} km</td>
                    <td className="px-5 py-3 text-slate-600">{(entry.water_ml / 1000).toFixed(1)}L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {entries.map((entry) => (
              <Card
                key={entry.date}
                onClick={() => setSelectedDate(entry.date === selectedDate ? null : entry.date)}
                className={`cursor-pointer ${selectedDate === entry.date ? "border-brand-300 bg-brand-50" : ""}`}
              >
                <p className="mb-2 text-sm font-semibold text-slate-900">{formatDate(entry.date)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <span>Steps: {entry.steps.toLocaleString()}</span>
                  <span>Distance: {entry.distance_km.toFixed(2)} km</span>
                  <span>Active: {entry.active_minutes} min</span>
                  <span>Water: {(entry.water_ml / 1000).toFixed(1)}L</span>
                </div>
              </Card>
            ))}
          </div>

          {selectedEntry && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{formatDate(selectedEntry.date)} — Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700 sm:grid-cols-4">
                <span>Steps: <b>{selectedEntry.steps.toLocaleString()}</b></span>
                <span>Distance: <b>{selectedEntry.distance_km.toFixed(2)} km</b></span>
                <span>Active minutes: <b>{selectedEntry.active_minutes}</b></span>
                <span>Water: <b>{(selectedEntry.water_ml / 1000).toFixed(2)} L</b></span>
              </div>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
