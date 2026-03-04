"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSessionUser, touchSessionActivity } from "../components/auth";
import { pullSharedStorageSnapshot } from "../components/sharedStorage";

function MenuCardIcon({ type }: { type: "editor" | "csv" | "tracking" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "editor") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 4h10l6 6v10H4z" />
        <path {...common} d="M14 4v6h6M8 14h8M8 18h5" />
      </svg>
    );
  }
  if (type === "csv") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
        <path {...common} d="M4 10h16M10 4v16M16 4v16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle {...common} cx="8" cy="8" r="3" />
      <circle {...common} cx="16.5" cy="7.5" r="2.5" />
      <path {...common} d="M3.5 19a4.5 4.5 0 0 1 9 0M13 19a3.5 3.5 0 0 1 7 0" />
    </svg>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkSession = async (): Promise<void> => {
      await pullSharedStorageSnapshot();
      const user = getSessionUser();
      if (!user) {
        setUserName("");
        router.replace("/");
        return;
      }
      setUserName(user.name);
    };
    void checkSession();
    const timer = window.setInterval(() => {
      void checkSession();
    }, 15 * 1000);
    const onActivity = (): void => {
      touchSessionActivity();
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key && !event.key.startsWith("sekou-tool-session")) {
        return;
      }
      void checkSession();
    };
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("wheel", onActivity, { passive: true });
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("storage", onStorage);
    };
  }, [router]);

  return (
    <main className="auth-shell">
      <section className="menu-card">
        <div className="menu-head">
          <p className="status-chip ok menu-user-chip">ログイン中: {userName || "ユーザー"}</p>
          <div className="menu-title-row">
            <h1>作業メニュー</h1>
            <button
              type="button"
              className="btn top-logout-btn menu-logout-btn"
              onClick={() => {
                clearSession();
                router.push("/");
              }}
            >
              <span className="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5h4v10h-4m-4-7-3 2 3 2m-3-2h8" />
                </svg>
              </span>
              ログアウト
            </button>
          </div>
          <p className="auth-note menu-note">目的の作業ページを選択してください。</p>
        </div>

        <div className="menu-grid">
          <Link href="/editor" className="menu-link-card">
            <div className="menu-link-head">
              <span className="menu-link-icon" aria-hidden="true"><MenuCardIcon type="editor" /></span>
              <span className="menu-link-tag">案件作成</span>
            </div>
            <h2>施工計画書編集画面</h2>
            <p>案件情報・工程表・写真・PDF出力を編集します。</p>
          </Link>
          <Link href="/csv" className="menu-link-card">
            <div className="menu-link-head">
              <span className="menu-link-icon" aria-hidden="true"><MenuCardIcon type="csv" /></span>
              <span className="menu-link-tag">データ編集</span>
            </div>
            <h2>CSV編集スペース</h2>
            <p>Salesforce取込CSVの確認・修正・案件反映を行います。</p>
          </Link>
          <Link href="/tracking" className="menu-link-card">
            <div className="menu-link-head">
              <span className="menu-link-icon" aria-hidden="true"><MenuCardIcon type="tracking" /></span>
              <span className="menu-link-tag">ユーザー管理</span>
            </div>
            <h2 className="menu-track-title">ログイン管理</h2>
            <p>承認、履歴、バックアップ、ユーザー管理を行います。</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
