import { cn } from "@/lib/utils";

export interface ProgressProps {
  /** Completed count. */
  value: number;
  /** Total count. `0` renders an empty bar. */
  max: number;
  className?: string;
  /** Accessible label for the progress bar. */
  label?: string;
}

/** Determinate progress bar with an accessible role. */
export function Progress({ value, max, className, label }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? "Progress"}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-gray-200",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-indigo-600 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
