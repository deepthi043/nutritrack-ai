import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "../Card";
import type { DailyStepsPoint } from "../../types";

interface WeeklyActivityChartProps {
  data: DailyStepsPoint[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return DAY_LABELS[date.getDay()];
}

export function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  const chartData = data.map((point) => ({
    day: formatDayLabel(point.date),
    steps: point.steps,
  }));

  return (
    <Card>
      <h3 className="mb-4 text-sm font-medium text-slate-700">Weekly Activity</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              formatter={(value) => [`${Number(value).toLocaleString()} steps`, "Steps"]}
            />
            <Bar dataKey="steps" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
