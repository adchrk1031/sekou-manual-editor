"use client";

import { FormEvent, useState } from "react";

interface ApiResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string;
    ledgerRows: number;
    mapping: unknown;
  };
}

export default function UploadExcelPage() {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState("");

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

      const res = await fetch("/api/excel/upload", {
        method: "POST",
        body: formData
      });
      const json = (await res.json()) as ApiResponse;

      if (!json.ok || !json.data) {
        setMessage(`失敗: ${json.message ?? "不明なエラー"}`);
        return;
      }

      setRunId(json.data.runId);
      setMessage(`Excel取込完了: runId=${json.data.runId} / 台帳行数=${json.data.ledgerRows}`);
    } catch (error) {
      setMessage(`失敗: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="card">
      <h2 style={{ marginTop: 0 }}>1. Excelアップロード</h2>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        既存台帳を読み込み、部屋番号キーと出力列をマッピングします。原本は上書きしません。
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div className="grid-2">
          <div>
            <label className="label">runId（空なら新規作成）</label>
            <input className="input" name="runId" value={runId} onChange={(e) => setRunId(e.target.value)} />
          </div>
          <div>
            <label className="label">参照対象シート名</label>
            <input className="input" name="sheetName" defaultValue="★用データ" required />
          </div>
          <div>
            <label className="label">ヘッダー行</label>
            <input className="input" name="headerRow" type="number" defaultValue={10} min={1} required />
          </div>
          <div>
            <label className="label">部屋番号列</label>
            <input className="input" name="roomColumn" defaultValue="B" required />
          </div>
          <div>
            <label className="label">前回検針値列（任意）</label>
            <input className="input" name="previousReadingColumn" defaultValue="" />
          </div>
          <div>
            <label className="label">予定取付メーターNo列（任意）</label>
            <input className="input" name="plannedInstallMeterNoColumn" defaultValue="" />
          </div>
          <div>
            <label className="label">取り外し検針値 出力列</label>
            <input className="input" name="removalReadingOutputColumn" defaultValue="D" required />
          </div>
          <div>
            <label className="label">取付メーターNo 出力列</label>
            <input className="input" name="installMeterNoOutputColumn" defaultValue="E" required />
          </div>
          <div>
            <label className="label">取り付け検針値 出力列</label>
            <input className="input" name="installReadingOutputColumn" defaultValue="F" required />
          </div>
        </div>

        <div>
          <label className="label">Excelファイル (.xlsx)</label>
          <input className="input" type="file" name="excel" accept=".xlsx,.xlsm,.xls" required />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "取込中..." : "Excelを取り込む"}
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
