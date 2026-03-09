"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "トップ" },
  { href: "/progress", label: "進捗管理" },
  { href: "/assistant", label: "AIアシスタント" }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="メインナビゲーション">
      <ul className="flex flex-wrap items-center gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
