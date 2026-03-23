"use client";

import { FormEvent, useEffect, useState } from "react";

interface SettingsResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string | null;
    settings: {
      ocrConfidenceThreshold: number;
      maxDeltaThreshold: number;
      dryRun: boolean;
      productionWriteEnabled: boolean;
    } | null;
  };
}

export default function SettingsPage() {
  const [runId, setRunId] = useState("");
  const [settings, setSettings] = useState({
    ocrConfidenceThreshold: 0.82,
    maxDeltaThreshold: 1500,
    dryRun: true,
    productionWriteEnabled: false
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = (await res.json()) as SettingsResponse;
      if (!json.ok || !json.data) {
        setMessage(`取得失敗: ${json.message ?? "不明"}`);
        return;
      }
      setRunId(json.data.runId ?? "");
      if (json.data.settings) {
        setSettings(json.data.settings);
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings)
    });

    const json = (await res.json()) as SettingsResponse;
    if (!json.ok || !json.data) {
      setMessage(`更新失敗: ${json.message ?? "不明"}`);
      return;
    }
    setMessage("設定を更新しました");
  }

  return (
    <main className="card">
      <h2 style={{ marginTop: 0 }}>8. 設定</h2>
      <p style={{ color: "var(--muted)" }}>安全運用のため、初期値は dry-run=true / 本番書込=false です。</p>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        runId: <strong>{runId || "未作成"}</strong>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div className="grid-2">
          <div>
            <label className="label">OCR信頼度閾値 (0-1)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={settings.ocrConfidenceThreshold}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  ocrConfidenceThreshold: Number(e.target.value)
                }))
              }
            />
          </div>

          <div>
            <label className="label">差分閾値</label>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={settings.maxDeltaThreshold}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maxDeltaThreshold: Number(e.target.value)
                }))
              }
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.dryRun}
            onChange={(e) => setSettings((prev) => ({ ...prev, dryRun: e.target.checked }))}
          />
          dry-run モード（実書込しない）
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.productionWriteEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, productionWriteEnabled: e.target.checked }))}
          />
          本番書込許可フラグ
        </label>

        <button className="btn btn-primary" type="submit">
          設定を保存
        </button>
      </form>

      {message && <p style={{ marginTop: 16, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
