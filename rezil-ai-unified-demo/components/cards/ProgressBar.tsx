type ProgressBarProps = {
  current: number;
  total: number;
};

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 1;
  const rate = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
        <span>
          {current}/{total}
        </span>
        <span>{rate}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${rate}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
