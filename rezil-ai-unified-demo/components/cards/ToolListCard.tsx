import { Tool } from "@/types/demo";

type ToolListCardProps = {
  tools: Tool[];
};

export function ToolListCard({ tools }: ToolListCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">現在利用中ツール</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <li
            key={tool.id}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <p className="font-medium text-slate-900">{tool.name}</p>
            <p className="text-sm text-slate-600">{tool.category}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
