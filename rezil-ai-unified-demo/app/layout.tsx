import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat, Noto_Sans_JP } from "next/font/google";

import { AppChrome } from "@/components/AppChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI業務改善資料",
  description:
    "ツール乱立による業務分断を、AI＋自社ツールで改善するための非公開打ち合わせ資料"
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp"
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat"
});

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${montserrat.variable}`}
    >
      <body className="min-h-screen bg-white text-[#333333] antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
