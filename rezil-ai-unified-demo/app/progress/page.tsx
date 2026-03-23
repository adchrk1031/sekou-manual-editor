import { SectionTitle } from "@/components/SectionTitle";
import { ProgressCard } from "@/components/cards/ProgressCard";
import { projects } from "@/data/demoData";

export default function ProgressPage() {
  return (
    <main className="page-shell space-y-8">
      <SectionTitle
        eyebrow="Progress Overview"
        title="案件進捗管理"
        description="1〜10の共通フローで現在位置を表示し、どこまで完了したかを一目で把握できる進捗管理イメージです。"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {projects.map((project) => (
          <ProgressCard key={project.id} project={project} />
        ))}
      </section>
    </main>
  );
}
