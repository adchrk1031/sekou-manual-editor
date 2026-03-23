import { Project } from "@/types/demo";

type ProgressCardProps = {
  project: Project;
};

const statusStyle: Record<Project["status"], string> = {
  未着手: "bg-slate-100 text-slate-700",
  進行中: "bg-blue-100 text-blue-700",
  確認待ち: "bg-amber-100 text-amber-700",
  完了: "bg-emerald-100 text-emerald-700"
};

export function ProgressCard({ project }: ProgressCardProps) {
  const steps = Array.from({ length: project.progressTotal }, (_, index) => index + 1);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{project.projectName}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[project.status]}`}
        >
          {project.status}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-[#0F7F93]">
          現在位置: {project.progressCurrent} / {project.progressTotal}
        </p>
        <div
          className="mt-3 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${project.progressTotal}, minmax(0, 1fr))` }}
          aria-label={`${project.projectName} 進捗フロー`}
        >
          {steps.map((step) => {
            const isDone = step <= project.progressCurrent;
            const isCurrent = step === project.progressCurrent;
            return (
              <div
                key={step}
                className={`grid h-8 place-items-center rounded-md border text-xs font-semibold ${
                  isCurrent
                    ? "border-[#1FADC3] bg-[#1FADC3] text-white"
                    : isDone
                      ? "border-[#9ADAE4] bg-[#EAF8FB] text-[#0F7F93]"
                      : "border-[#D9E1EB] bg-white text-[#7A8698]"
                }`}
              >
                {step}
              </div>
            );
          })}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">現在工程</dt>
          <dd className="mt-1">{project.currentStep}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">次工程</dt>
          <dd className="mt-1">{project.nextStep}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">担当者</dt>
          <dd className="mt-1">{project.owner}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">期限</dt>
          <dd className="mt-1">{project.dueDate}</dd>
        </div>
      </dl>
    </article>
  );
}
