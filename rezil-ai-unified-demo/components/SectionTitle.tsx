type SectionTitleProps = {
  title: string;
  description?: string;
  eyebrow?: string;
};

export function SectionTitle({ title, description, eyebrow }: SectionTitleProps) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
      {description ? <p className="max-w-3xl text-slate-600">{description}</p> : null}
    </div>
  );
}
