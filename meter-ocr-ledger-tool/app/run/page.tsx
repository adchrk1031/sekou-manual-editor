"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/SummaryCards";
import { RunSummary } from "@/types/domain";

interface ResultResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string | null;
    summary: RunSummary;
    photos: number;
    ledgerRows: number;
    settings: {
      dryRun: boolean;
      productionWriteEnabled: boolean;
    };
  };
}

export default function RunPage() {
  const [runId, setRunId] = useState<string>("");
  const [summary, setSummary] = useState<RunSummary>({ total: 0, okAuto: 0, needReview: 0, ng: 0, error: 0 });
  const [meta, setMeta] = useState<{ photos: number; ledgerRows: number; dryRun: boolean; productionWriteEnabled: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [gss, setGss] = useState({
    spreadsheetId: "",
    sheetName: "",
    roomColumn: "A",
    removalReadingColumn: "B",
    installMeterNoColumn: "C",
    installReadingColumn: "D"
  });

  async function reload() {
    const res = await fetch("/api/results", { cache: "no-store" });
    const json = (await res.json()) as ResultResponse;
    if (json.ok && json.data) {
      setRunId(json.data.runId ?? "");
      setSummary(json.data.summary);
      setMeta({
        photos: json.data.photos,
        ledgerRows: json.data.ledgerRows,
        dryRun: json.data.settings?.dryRun ?? true,
        productionWriteEnabled: json.data.settings?.productionWriteEnabled ?? false
      });
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function execute() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/run/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId })
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage(`失敗: ${json.message ?? "不明なエラー"}`);
      } else {
        setMessage("処理実行が完了しました");
        await reload();
      }
    } catch (error) {
      setMessage(`失敗: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    const res = await fetch("/api/export/csv", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId })
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(`CSV出力失敗: ${json.message ?? "不明"}`);
      return;
    }
    setMessage(`CSV出力完了: ${json.data.allPath} / ${json.data.updatePath}`);
  }

  async function exportExcel() {
    const res = await fetch("/api/export/excel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId })
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(`Excel出力失敗: ${json.message ?? "不明"}`);
      return;
    }
    setMessage(`Excel出力完了: ${json.data.outputPath}`);
  }

  async function exportGoogleSheets() {
    const res = await fetch("/api/export/google-sheets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...gss, runId })
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(`Google Sheets出力失敗: ${json.message ?? "不明"}`);
      return;
    }
    if (json.data.dryRun) {
      setMessage(`Google Sheets dry-run: 対象 ${json.data.updates.length ?? json.data.attemptedUpdates} 件`);
    } else {
      setMessage(`Google Sheets書込完了: セル更新 ${json.data.batchCells} 件`);
    }
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>3. 処理実行</h2>
        <p style={{ color: "var(--muted)" }}>OCR実行と照合判定を実施します。曖昧なデータは自動確定しません。</p>

        <div style={{ marginBottom: 12, fontSize: 13 }}>
          runId: <strong>{runId || "未作成"}</strong>
          {meta && (
            <span>
              {" "}
              | 台帳行: <strong>{meta.ledgerRows}</strong> | 写真: <strong>{meta.photos}</strong> | dry-run:
              <strong> {String(meta.dryRun)}</strong> | 本番書込: <strong>{String(meta.productionWriteEnabled)}</strong>
            </span>
          )}
        </div>

        <SummaryCards summary={summary} />

        <button className="btn btn-primary" onClick={execute} disabled={loading || !runId}>
          {loading ? "実行中..." : "処理を実行"}
        </button>
      </section>

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>4. 出力</h2>
        <p style={{ color: "var(--muted)", margin: 0 }}>優先度: CSV → Google Sheets → 更新済みExcel</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={!runId}>
            CSV出力
          </button>
          <button className="btn btn-secondary" onClick={exportExcel} disabled={!runId}>
            更新済みExcel出力
          </button>
        </div>

        <div className="grid-2">
          <div>
            <label className="label">Spreadsheet ID</label>
            <input
              className="input"
              value={gss.spreadsheetId}
              onChange={(e) => setGss((prev) => ({ ...prev, spreadsheetId: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">シート名</label>
            <input className="input" value={gss.sheetName} onChange={(e) => setGss((prev) => ({ ...prev, sheetName: e.target.value }))} />
          </div>
          <div>
            <label className="label">部屋番号列</label>
            <input className="input" value={gss.roomColumn} onChange={(e) => setGss((prev) => ({ ...prev, roomColumn: e.target.value }))} />
          </div>
          <div>
            <label className="label">取り外し検針値列</label>
            <input
              className="input"
              value={gss.removalReadingColumn}
              onChange={(e) => setGss((prev) => ({ ...prev, removalReadingColumn: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">取付メーターNo列</label>
            <input
              className="input"
              value={gss.installMeterNoColumn}
              onChange={(e) => setGss((prev) => ({ ...prev, installMeterNoColumn: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">取り付け検針値列</label>
            <input
              className="input"
              value={gss.installReadingColumn}
              onChange={(e) => setGss((prev) => ({ ...prev, installReadingColumn: e.target.value }))}
            />
          </div>
        </div>

        <button className="btn btn-secondary" onClick={exportGoogleSheets} disabled={!runId || !gss.spreadsheetId || !gss.sheetName}>
          Google Sheets出力
        </button>
      </section>

      {message && <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
