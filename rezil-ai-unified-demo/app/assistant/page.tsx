import { AssistantDemo } from "@/components/assistant/AssistantDemo";
import { SectionTitle } from "@/components/SectionTitle";

const aiRoles = ["情報検索", "文章作成", "タスク補助"];
const humanRoles = ["判断", "管理", "対人対応"];

export default function AssistantPage() {
  return (
    <main className="page-shell space-y-8">
      <SectionTitle
        eyebrow="AI Support"
        title="AI業務アシスタント"
        description="ボタンを押すだけでダミー結果を表示し、AIが現場業務をどのように補助するかを直感的に説明します。"
      />

      <AssistantDemo />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">AIの役割</h2>
          <ul className="mt-3 space-y-2 text-sm text-blue-900">
            {aiRoles.map((role) => (
              <li key={role} className="rounded-lg bg-white px-3 py-2">
                {role}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">人の役割</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {humanRoles.map((role) => (
              <li key={role} className="rounded-lg bg-white px-3 py-2">
                {role}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
