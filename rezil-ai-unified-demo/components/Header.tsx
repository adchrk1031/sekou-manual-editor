import { Navigation } from "@/components/Navigation";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              社長説明用ローカルデモ
            </p>
            <p className="text-lg font-semibold text-slate-900">
              レジル業務改善デモ
            </p>
          </div>
          <Navigation />
        </div>
      </div>
    </header>
  );
}
