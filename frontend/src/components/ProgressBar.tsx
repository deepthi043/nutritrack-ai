interface ProgressBarProps {
  percent: number;
  colorClassName?: string;
  trackClassName?: string;
  heightClassName?: string;
}

export function ProgressBar({
  percent,
  colorClassName = "bg-brand-600",
  trackClassName = "bg-slate-100",
  heightClassName = "h-2",
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);

  return (
    <div
      className={`w-full overflow-hidden rounded-full ${heightClassName} ${trackClassName}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClassName}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
