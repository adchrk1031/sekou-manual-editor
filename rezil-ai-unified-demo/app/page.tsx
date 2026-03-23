import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="mx-auto max-w-4xl rounded-2xl border border-[#D9E1EB] bg-white p-8 md:p-12">
        <p className="heading-en text-xs font-semibold uppercase tracking-[0.14em] text-[#1FADC3]">
          Executive Demo
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-[#333333] md:text-5xl">
          AI業務改善資料
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#556070] md:text-lg">
          ツール乱立による業務分断を、AI＋自社開発ツールで改善する構想を
          11枚のプレゼン形式で説明します。
        </p>
        <p className="mt-4 rounded-md bg-[#F5F7FA] px-4 py-3 text-sm leading-6 text-[#556070]">
          操作方法: 右下の「次へ / 戻る」ボタン、またはキーボード左右キー
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/presentation"
            className="focus-ring rounded-md border border-[#1FADC3] bg-[#1FADC3] px-5 py-3 text-sm font-semibold text-white"
          >
            プレゼンを開始する
          </Link>
        </div>
      </section>
    </main>
  );
}
