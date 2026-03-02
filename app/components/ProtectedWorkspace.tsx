"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser, touchSessionActivity } from "./auth";

export default function ProtectedWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkSession = (): void => {
      const user = getSessionUser();
      if (!user) {
        setReady(false);
        router.replace("/");
        return;
      }
      setReady(true);
    };

    checkSession();

    const timer = window.setInterval(checkSession, 15 * 1000);
    const onActivity = (): void => {
      touchSessionActivity();
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key && !event.key.startsWith("sekou-tool-session")) {
        return;
      }
      checkSession();
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

  if (!ready) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>読み込み中...</h1>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
