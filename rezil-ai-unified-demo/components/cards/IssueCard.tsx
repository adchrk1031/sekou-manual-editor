type IssueCardProps = {
  title: string;
  description: string;
};

export function IssueCard({ title, description }: IssueCardProps) {
  return (
    <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <h4 className="text-base font-semibold text-rose-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-rose-800">{description}</p>
    </article>
  );
}
