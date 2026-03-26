"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ensureUsers,
  getLoginFailureMessage,
  getSessionUser,
  loginWithCredentials,
  registerInitialAdmin,
  registerSelfUser,
} from "./components/auth";
import { pullSharedStorageSnapshot, pushSharedStorageSnapshot } from "./components/sharedStorage";

type AuthTab = "register" | "login";

async function notifyAdminPendingApproval(user: { name: string; email: string }): Promise<boolean> {
  try {
    const response = await fetch("/api/manual-editor/notify/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "user_signup_pending_approval",
        userName: user.name,
        userEmail: user.email,
        requestedAt: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      return false;
    }
    const result = (await response.json()) as { ok?: unknown };
    return result.ok === true;
  } catch {
    return false;
  }
}

function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" />
      <path d="M9.88 4.24A10.75 10.75 0 0 1 12 4c5.5 0 9 6 9 6a16.8 16.8 0 0 1-2.4 3.19" />
      <path d="M6.61 6.61C4.26 8.21 3 10 3 10s3.5 6 9 6a9.6 9.6 0 0 0 3.39-.61" />
    </svg>
  );
}

const AUTH_PRIMARY_BUTTON_STYLE = {
  width: "100%",
  minHeight: "72px",
  height: "72px",
  padding: "0 16px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.125rem",
  fontWeight: 800,
  lineHeight: 1,
} as const;

export default function Page() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [hasUsers, setHasUsers] = useState(false);
  const [sharedSyncReady, setSharedSyncReady] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const isInitialSetup = useMemo(() => sharedSyncReady && !hasUsers, [hasUsers, sharedSyncReady]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const synced = await pullSharedStorageSnapshot();
      if (cancelled) {
        return;
      }
      setSharedSyncReady(synced);
      const users = ensureUsers();
      setHasUsers(users.length > 0);
      setAuthTab(synced && users.length === 0 ? "register" : "login");
      if (getSessionUser()) {
        router.replace("/menu");
        return;
      }
      if (!synced) {
        setMessage({
          type: "error",
          text: "共有データへの接続に失敗しました。この端末の保存データでログインを継続します。新規登録は共有接続時のみ可能です。",
        });
      }
      setHydrated(true);
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function refreshUsersState(): void {
    const users = ensureUsers();
    setHasUsers(users.length > 0);
  }

  async function ensureSharedReadyOrFail(mode: "login" | "register"): Promise<boolean> {
    const synced = await pullSharedStorageSnapshot();
    setSharedSyncReady(synced);
    if (!synced) {
      if (mode === "login") {
        setMessage({
          type: "error",
          text: "共有データへの接続に失敗しました。この端末の保存データでログインを継続します。",
        });
        return true;
      }
      setMessage({
        type: "error",
        text: "共有データへ接続できません。新規登録は共有接続時のみ可能です。時間をおいて再試行してください。",
      });
      return false;
    }
    return true;
  }

  async function onLogin(): Promise<void> {
    setMessage(null);
    if (!(await ensureSharedReadyOrFail("login"))) {
      return;
    }
    refreshUsersState();
    const result = loginWithCredentials(loginEmail, loginPassword, "login_page");
    if (result.user) {
      await pushSharedStorageSnapshot();
      router.push("/menu");
      return;
    }
    setMessage({ type: "error", text: getLoginFailureMessage(result.reason) });
  }

  async function onRegister(): Promise<void> {
    setMessage(null);
    if (!(await ensureSharedReadyOrFail("register"))) {
      return;
    }
    refreshUsersState();
    const name = registerName.trim();
    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    const confirm = registerPasswordConfirm;

    if (!name || !email || !password) {
      setMessage({ type: "error", text: "名前・メールアドレス・パスワードを入力してください。" });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: "error", text: "確認用パスワードが一致しません。" });
      return;
    }

    if (isInitialSetup) {
      const admin = registerInitialAdmin(name, email, password);
      if (!admin) {
        setMessage({ type: "error", text: "初期管理者の登録に失敗しました。ページを再読み込みして再度お試しください。" });
        refreshUsersState();
        return;
      }
      await pushSharedStorageSnapshot();
      const loginResult = loginWithCredentials(admin.email, admin.password, "login_page");
      refreshUsersState();
      if (loginResult.user) {
        await pushSharedStorageSnapshot();
        router.push("/menu");
        return;
      }
      setMessage({ type: "ok", text: "初期管理者を登録しました。ログインしてください。" });
      setAuthTab("login");
      setLoginEmail(admin.email);
      setLoginPassword(admin.password);
      return;
    }

    const created = registerSelfUser(name, email, password);
    await pushSharedStorageSnapshot();
    refreshUsersState();
    if (!created.user) {
      if (created.error === "duplicate_email") {
        setMessage({ type: "error", text: "このメールアドレスはすでに登録済みです。" });
        return;
      }
      setMessage({ type: "error", text: "登録に失敗しました。入力内容を確認して再試行してください。" });
      return;
    }
    const slackNotified = await notifyAdminPendingApproval({
      name: created.user.name,
      email: created.user.email,
    });
    setMessage({
      type: "ok",
      text: slackNotified
        ? "ユーザー登録を受け付けました。管理者承認後にログインできます。"
        : "ユーザー登録を受け付けました。管理者承認後にログインできます（Slack通知は未設定または送信失敗）。",
    });
    setAuthTab("login");
    setLoginEmail(created.user.email);
    setLoginPassword("");
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
  }

  if (!hydrated) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="auth-note">読み込み中...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-head">
          <div className="auth-brand">
            <img className="auth-brand-logo" src="/header-logo.svg" alt="REZIL ロゴ" />
          </div>
          <p className="auth-kicker">施工計画書自動発行ツール</p>
          <h1>ログイン画面</h1>
          <p className="auth-note">初めて利用する方は登録、登録済みの方はログインを選択してください。</p>
        </div>

        <div className="auth-switch" role="tablist" aria-label="認証タブ">
          <button
            type="button"
            role="tab"
            aria-selected={authTab === "register"}
            className={`auth-switch-btn ${authTab === "register" ? "is-active" : ""}`}
            onClick={() => setAuthTab("register")}
          >
            初めて利用する方
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authTab === "login"}
            className={`auth-switch-btn ${authTab === "login" ? "is-active" : ""}`}
            onClick={() => setAuthTab("login")}
          >
            登録済みの方はこちら（ログイン）
          </button>
        </div>

        {authTab === "register" ? (
          <section className="auth-form" aria-label="ユーザー登録">
            <p className="auth-section-title">{isInitialSetup ? "初期管理者登録" : "初めて利用する方（ユーザー登録）"}</p>
            <label className="field">
              <span>ユーザー名（フルネーム）</span>
              <input className="control" value={registerName} placeholder="例: 山田 太郎" onChange={(event) => setRegisterName(event.target.value)} />
            </label>
            <label className="field">
              <span>メールアドレス</span>
              <input className="control" type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} />
            </label>
            <label className="field">
              <span>パスワード</span>
              <div className="password-control-wrap">
                <input
                  className="control password-control"
                  type={showRegisterPassword ? "text" : "password"}
                  value={registerPassword}
                  placeholder="8文字以上"
                  onChange={(event) => setRegisterPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-visibility-btn"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                  aria-label={showRegisterPassword ? "パスワードを非表示" : "パスワードを表示"}
                >
                  <EyeIcon open={showRegisterPassword} />
                </button>
              </div>
            </label>
            <label className="field">
              <span>パスワード確認</span>
              <input
                className="control"
                type={showRegisterPassword ? "text" : "password"}
                value={registerPasswordConfirm}
                placeholder="再入力"
                onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-accent auth-login-btn"
              style={AUTH_PRIMARY_BUTTON_STYLE}
              onClick={onRegister}
              disabled={!sharedSyncReady}
            >
              {isInitialSetup ? "初期管理者を登録する" : "登録する"}
            </button>
            {!isInitialSetup ? (
              <div className="auth-pending-box">
                <p className="auth-pending-title">承認が必要です</p>
                <p className="mini">登録後は管理者承認が完了するまでログインできません。</p>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="auth-form" aria-label="ログイン">
            <p className="auth-section-title">ログイン（登録済みユーザー）</p>
            <label className="field">
              <span>メールアドレス</span>
              <input className="control" type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
            </label>
            <label className="field">
              <span>パスワード</span>
              <div className="password-control-wrap">
                <input
                  className="control password-control"
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-visibility-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? "パスワードを非表示" : "パスワードを表示"}
                >
                  <EyeIcon open={showLoginPassword} />
                </button>
              </div>
            </label>
            <button
              type="button"
              className="btn btn-accent auth-login-btn"
              style={AUTH_PRIMARY_BUTTON_STYLE}
              onClick={onLogin}
              disabled={!loginEmail.trim() || !loginPassword.trim()}
            >
              ログインして続行
            </button>
          </section>
        )}

        {message ? <p className={`mini ${message.type === "error" ? "error-text" : "ok-text"}`}>{message.text}</p> : null}
      </section>
    </main>
  );
}
