import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "../Card";
import type { DailyWaterPoint } from "../../types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayLabel(dateStr: string): string {
  return DAY_LABELS[new Date(`${dateStr}T00:00:00`).getDay()];
}

export function WaterChart({ data }: { data: DailyWaterPoint[] }) {
  const chartData = data.map((point) => ({ day: formatDayLabel(point.date), liters: point.amount_ml / 1000 }));

  return (
    <Card>
      <h3 className="mb-4 text-sm font-medium text-slate-700">Weekly Hydration</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              formatter={(value) => [`${Number(value).toFixed(2)} L`, "Water"]}
            />
            <Bar dataKey="liters" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
