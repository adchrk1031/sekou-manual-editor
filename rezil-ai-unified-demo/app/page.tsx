import { SectionTitle } from "@/components/SectionTitle";
import { FutureStateCard } from "@/components/cards/FutureStateCard";
import { IssueCard } from "@/components/cards/IssueCard";
import { ToolListCard } from "@/components/cards/ToolListCard";
import { currentIssues, futureStateItems, tools } from "@/data/demoData";

export default function HomePage() {
  return (
    <main className="page-shell space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Top Message
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          レジル業務改善デモ
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
          ツール乱立による業務分断を、AI＋自社ツールで改善する構想
        </p>
        <p className="mt-4 max-w-4xl rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          現状の課題は個人の能力ではなく、仕組みが分断されていることが原因です。社内データと業務フローを一元管理し、
          AIで検索・作成・次タスク提案を行うことで、将来的な社内基盤整備とAI事業部の価値創出につなげます。
        </p>
      </section>

      <ToolListCard tools={tools} />

      <section className="space-y-5">
        <SectionTitle
          eyebrow="Current vs Future"
          title="現状と改善後の対比"
          description="複数ツール分断の状態と、AI＋自社開発ツールによる統合後の状態を同じ画面で比較します。"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-bold text-rose-900">現状（分断）</h3>
            <p className="mt-2 text-sm text-rose-800">
              情報が散在し、確認工数と意思決定の遅れが発生しやすい状態。
            </p>
            <div className="mt-4 grid gap-3">
              {currentIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  title={issue.title}
                  description={issue.description}
                />
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-bold text-emerald-900">改善後（統合）</h3>
            <p className="mt-2 text-sm text-emerald-800">
              データとタスクを統合し、AI支援で業務速度と品質を同時に向上。
            </p>
            <div className="mt-4 grid gap-3">
              {futureStateItems.map((item) => (
                <FutureStateCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
