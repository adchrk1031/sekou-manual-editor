type AIActionButtonProps = {
  title: string;
  promptLabel: string;
  isActive: boolean;
  onClick: () => void;
};

export function AIActionButton({
  title,
  promptLabel,
  isActive,
  onClick
}: AIActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition ${
        isActive
          ? "border-blue-400 bg-blue-50 text-blue-900"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
      }`}
      aria-pressed={isActive}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{promptLabel}</p>
    </button>
  );
}
