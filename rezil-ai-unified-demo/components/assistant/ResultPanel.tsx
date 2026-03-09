import { AIAction } from "@/types/demo";

type ResultPanelProps = {
  action: AIAction;
};

export function ResultPanel({ action }: ResultPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{action.resultTitle}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {action.resultBody.map((line) => (
          <li key={line} className="rounded-lg bg-slate-50 px-3 py-2">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
