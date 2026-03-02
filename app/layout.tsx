import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "施工計画書自動発行ツール",
  description: "施工計画書の作成・編集・CSV管理・ログイン管理に対応した業務ツール",
  icons: {
    icon: "/header-logo.svg",
    shortcut: "/header-logo.svg",
    apple: "/header-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
