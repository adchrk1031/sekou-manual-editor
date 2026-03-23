"use client";

import { FormEvent, useEffect, useState } from "react";

interface ResultResponse {
  ok: boolean;
  data?: {
    runId: string | null;
    photos: number;
    ledgerRows: number;
  };
}

interface UploadResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string;
    uploaded: number;
    added: number;
    totalPhotos: number;
  };
}

export default function UploadPhotosPage() {
  const [runId, setRunId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ photos: number; ledgerRows: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/results", { cache: "no-store" });
      const json = (await res.json()) as ResultResponse;
      if (json.ok && json.data) {
        if (json.data.runId) {
          setRunId(json.data.runId);
        }
        setSummary({ photos: json.data.photos, ledgerRows: json.data.ledgerRows });
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      if (runId.trim()) {
        formData.set("runId", runId.trim());
      }

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData
      });
      const json = (await res.json()) as UploadResponse;
      if (!json.ok || !json.data) {
        setMessage(`失敗: ${json.message ?? "不明なエラー"}`);
        return;
      }

      const data = json.data;
      setRunId(data.runId);
      setMessage(`写真取込完了: 追加 ${data.added} 件 / 合計 ${data.totalPhotos} 件`);
      setSummary((prev) => ({ photos: data.totalPhotos, ledgerRows: prev?.ledgerRows ?? 0 }));
      form.reset();
    } catch (error) {
      setMessage(`失敗: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="card">
      <h2 style={{ marginTop: 0 }}>2. 写真アップロード</h2>
      <p style={{ color: "var(--muted)" }}>
        部屋番号はファイル名から抽出します。推奨: <code>101_old.jpg</code>（取り外し） / <code>101_new.jpg</code>（取付後）
      </p>

      <div style={{ marginBottom: 12, fontSize: 13 }}>
        現在 runId: <strong>{runId || "未作成"}</strong>
        {summary && (
          <span>
            {" "}
            | 台帳行: <strong>{summary.ledgerRows}</strong> | 写真: <strong>{summary.photos}</strong>
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label className="label">runId</label>
          <input className="input" name="runId" value={runId} onChange={(e) => setRunId(e.target.value)} required />
        </div>

        <div>
          <label className="label">写真ファイル（複数可）</label>
          <input className="input" type="file" name="photos" multiple accept="image/*" required />
        </div>

        <div>
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "アップロード中..." : "写真を取り込む"}
          </button>
        </div>
      </form>

      {message && (
        <p style={{ marginTop: 16, fontWeight: 700, color: message.startsWith("失敗") ? "var(--ng)" : "var(--ok)" }}>
          {message}
        </p>
      )}
    </main>
  );
}
