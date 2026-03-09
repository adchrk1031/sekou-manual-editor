import { SectionTitle } from "@/components/SectionTitle";
import { ProgressCard } from "@/components/cards/ProgressCard";
import { projects } from "@/data/demoData";

export default function ProgressPage() {
  return (
    <main className="page-shell space-y-8">
      <SectionTitle
        eyebrow="Progress Overview"
        title="案件進捗管理"
        description="複数ツールに分散していると進捗が見えないが、統合後は一画面で把握できることを示すデモ画面です。"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {projects.map((project) => (
          <ProgressCard key={project.id} project={project} />
        ))}
      </section>
    </main>
  );
}
