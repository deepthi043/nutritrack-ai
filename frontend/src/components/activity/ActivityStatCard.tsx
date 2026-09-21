import type { LucideIcon } from "lucide-react";
import { Card } from "../Card";

interface ActivityStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext?: string;
  iconClassName?: string;
}

export function ActivityStatCard({ icon: Icon, label, value, subtext, iconClassName = "bg-brand-50 text-brand-600" }: ActivityStatCardProps) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {subtext && <p className="mt-0.5 text-xs text-slate-400">{subtext}</p>}
      </div>
    </Card>
  );
}
