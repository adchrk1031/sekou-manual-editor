import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

export const metadata = {
  title: "検針写真OCR照合ツール",
  description: "初心者向け3ステップ運用"
};

const simpleLinks = [
  ["1. 開始", "/start"],
  ["2. 確認", "/review"],
  ["3. 出力", "/export"]
] as const;

const adminLinks = [
  ["詳細結果", "/results"],
  ["要確認詳細", "/reviews"],
  ["設定", "/settings"],
  ["ログ", "/logs"]
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="container">
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>検針写真OCR照合ツール</h1>
            <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
              使い方: 開始 → 確認 → 出力 の3ステップ
            </p>
            <nav className="nav-grid" style={{ marginBottom: 8 }}>
              {simpleLinks.map(([label, href]) => (
                <Link key={href} className="nav-link" href={href}>
                  {label}
                </Link>
              ))}
            </nav>
            <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {adminLinks.map(([label, href]) => (
                <Link key={href} className="nav-link" href={href} style={{ flex: "0 0 auto" }}>
                  {label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
