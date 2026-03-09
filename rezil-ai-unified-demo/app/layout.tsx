import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "レジル業務改善デモ",
  description:
    "ツール乱立による業務分断を、AI＋自社ツールで改善するための社長説明用ローカルデモ"
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
