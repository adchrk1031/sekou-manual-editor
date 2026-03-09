type FutureStateCardProps = {
  title: string;
  description: string;
};

export function FutureStateCard({ title, description }: FutureStateCardProps) {
  return (
    <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h4 className="text-base font-semibold text-emerald-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-emerald-800">{description}</p>
    </article>
  );
}
