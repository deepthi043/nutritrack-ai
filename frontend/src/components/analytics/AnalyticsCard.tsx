import type { LucideIcon } from "lucide-react";
import { Card } from "../Card";

interface AnalyticsCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  iconClassName?: string;
}

export function AnalyticsCard({ icon: Icon, label, value, iconClassName = "bg-brand-50 text-brand-600" }: AnalyticsCardProps) {
  return (
    <Card className="flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
      </div>
    </Card>
  );
}
