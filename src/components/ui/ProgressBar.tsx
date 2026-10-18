import { cn } from "@/lib/utils/cn";

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Ekran o'qigichlar uchun nom. */
  label: string;
  showValue?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="bg-subtle h-2 flex-1 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary-500 h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue && (
        <span className="text-muted w-10 text-right text-sm tabular-nums">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}
