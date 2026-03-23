"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/SummaryCards";
import { RunSummary } from "@/types/domain";

interface ApiResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string | null;
    summary: RunSummary;
    settings?: {
      dryRun: boolean;
      productionWriteEnabled: boolean;
    };
  };
}

interface SheetExportResponse {
  ok: boolean;
  message?: string;
  data?: {
    dryRun: boolean;
    spreadsheetId?: string;
    createdSpreadsheet?: {
      id: string;
      name: string;
      webViewLink?: string;
    } | null;
    batchCells?: number;
    attemptedUpdates?: number;
  };
}

interface ConnectionTestResponse {
  ok: boolean;
  message?: string;
  details?: unknown;
  data?: {
    tokenConfigured: boolean;
    authOk: boolean;
    user?: {
      displayName?: string;
      emailAddress?: string;
    };
    removalFolder?: {
      ok: boolean;
      folderId: string;
      count?: number;
      error?: string;
      samples?: Array<{ id: string; name: string; mimeType: string }>;
    };
    installFolder?: {
      ok: boolean;
      folderId: string;
      count?: number;
      error?: string;
      samples?: Array<{ id: string; name: string; mimeType: string }>;
    };
    spreadsheet?: {
      ok: boolean;
      spreadsheetId: string;
      title?: string;
      sheetNames?: string[];
      error?: string;
    };
  };
}

export default function ExportPage() {
  const [runId, setRunId] = useState("");
  const [summary, setSummary] = useState<RunSummary>({ total: 0, okAuto: 0, needReview: 0, ng: 0, error: 0 });
  const [message, setMessage] = useState("");
  const [sheetConfig, setSheetConfig] = useState({
    spreadsheetId: "",
    driveFolderId: "",
    removalFolderId: "",
    installFolderId: "",
    createSpreadsheetFromExcel: false,
    spreadsheetTitle: "",
    sheetName: "",
    roomColumn: "A",
    removalReadingColumn: "D",
    installMeterNoColumn: "E",
    installReadingColumn: "F"
  });
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResponse["data"] | null>(null);

  const canSubmitSheets =
    !!runId &&
    !!sheetConfig.sheetName &&
    (!!sheetConfig.spreadsheetId || (sheetConfig.createSpreadsheetFromExcel && !!sheetConfig.driveFolderId));

  async function reload() {
    const res = await fetch("/api/results", { cache: "no-store" });
    const json = (await res.json()) as ApiResponse;
    if (json.ok && json.data) {
      setRunId(json.data.runId ?? "");
      setSummary(json.data.summary);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

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
    setMessage("CSV出力が完了しました");
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
    setMessage("更新済みExcelコピーの作成が完了しました");
  }

  async function exportSheets() {
    const res = await fetch("/api/export/google-sheets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, ...sheetConfig })
    });
    const json = (await res.json()) as SheetExportResponse;
    if (!json.ok || !json.data) {
      setMessage(`Sheets出力失敗: ${json.message ?? "不明"}`);
      return;
    }
    const data = json.data;

    if (data.spreadsheetId) {
      setSheetConfig((prev) => ({ ...prev, spreadsheetId: data.spreadsheetId ?? prev.spreadsheetId }));
    }

    if (data.dryRun) {
      setMessage("Google Sheets dry-run完了（書込は実行していません）");
      return;
    }

    if (data.createdSpreadsheet) {
      const link = data.createdSpreadsheet.webViewLink || "";
      setMessage(
        `Google Sheets書込完了: 新規作成 ${data.createdSpreadsheet.name} (${data.createdSpreadsheet.id}) ${link}`
      );
      return;
    }

    setMessage(`Google Sheets書込完了: 更新セル ${data.batchCells ?? 0} 件`);
  }

  async function testGoogleConnection() {
    setMessage("");
    setConnectionTest(null);

    const res = await fetch("/api/google/connection-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        removalFolderId: sheetConfig.removalFolderId,
        installFolderId: sheetConfig.installFolderId,
        spreadsheetId: sheetConfig.spreadsheetId
      })
    });
    const json = (await res.json()) as ConnectionTestResponse;
    if (!json.ok || !json.data) {
      setMessage(`接続テスト失敗: ${json.message ?? "不明"} `);
      return;
    }
    setConnectionTest(json.data);
    setMessage("接続テストが完了しました");
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>出力画面</h2>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>承認済みデータのみ出力されます。</p>
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          runId: <strong>{runId || "未作成"}</strong>
        </div>
        <SummaryCards summary={summary} />
      </section>

      <section className="card" style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>ワンクリック出力</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={!runId}>
            CSV出力
          </button>
          <button className="btn btn-secondary" onClick={exportExcel} disabled={!runId}>
            Excelコピー出力
          </button>
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Google Sheets出力（毎回入力対応）</h3>
        <input
          className="input"
          placeholder="Spreadsheet ID（既存へ書込する場合）"
          value={sheetConfig.spreadsheetId}
          onChange={(e) => setSheetConfig((prev) => ({ ...prev, spreadsheetId: e.target.value }))}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={sheetConfig.createSpreadsheetFromExcel}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, createSpreadsheetFromExcel: e.target.checked }))}
          />
          Spreadsheet IDが空なら、Excelから新規スプレッドシートを作成して出力する
        </label>

        {sheetConfig.createSpreadsheetFromExcel && (
          <>
            <input
              className="input"
              placeholder="Google Drive フォルダID（変換先）"
              value={sheetConfig.driveFolderId}
              onChange={(e) => setSheetConfig((prev) => ({ ...prev, driveFolderId: e.target.value }))}
            />
            <input
              className="input"
              placeholder="作成するスプレッドシート名（任意）"
              value={sheetConfig.spreadsheetTitle}
              onChange={(e) => setSheetConfig((prev) => ({ ...prev, spreadsheetTitle: e.target.value }))}
            />
          </>
        )}

        <input
          className="input"
          placeholder="書込対象シート名"
          value={sheetConfig.sheetName}
          onChange={(e) => setSheetConfig((prev) => ({ ...prev, sheetName: e.target.value }))}
        />

        <div className="grid-2">
          <input
            className="input"
            placeholder="取り外し前写真フォルダID（接続テスト用）"
            value={sheetConfig.removalFolderId}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, removalFolderId: e.target.value }))}
          />
          <input
            className="input"
            placeholder="取り付け後写真フォルダID（接続テスト用）"
            value={sheetConfig.installFolderId}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, installFolderId: e.target.value }))}
          />
        </div>

        <div className="grid-2">
          <input
            className="input"
            placeholder="部屋番号列 (例: A)"
            value={sheetConfig.roomColumn}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, roomColumn: e.target.value }))}
          />
          <input
            className="input"
            placeholder="取り外し検針値列 (例: D)"
            value={sheetConfig.removalReadingColumn}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, removalReadingColumn: e.target.value }))}
          />
          <input
            className="input"
            placeholder="取付メーターNo列 (例: E)"
            value={sheetConfig.installMeterNoColumn}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, installMeterNoColumn: e.target.value }))}
          />
          <input
            className="input"
            placeholder="取り付け検針値列 (例: F)"
            value={sheetConfig.installReadingColumn}
            onChange={(e) => setSheetConfig((prev) => ({ ...prev, installReadingColumn: e.target.value }))}
          />
        </div>

        <button className="btn btn-secondary" onClick={exportSheets} disabled={!canSubmitSheets}>
          Google Sheetsへ出力
        </button>
        <button className="btn btn-secondary" onClick={testGoogleConnection}>
          Google接続テスト
        </button>
      </section>

      {connectionTest && (
        <section className="card" style={{ display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Google接続テスト結果</h3>
          <div style={{ fontSize: 13 }}>
            トークン: <strong>{connectionTest.tokenConfigured ? "設定あり" : "未設定"}</strong> / 認証:{" "}
            <strong>{connectionTest.authOk ? "OK" : "NG"}</strong>
          </div>
          {connectionTest.user && (
            <div style={{ fontSize: 13 }}>
              ユーザー: {connectionTest.user.displayName ?? "-"} ({connectionTest.user.emailAddress ?? "-"})
            </div>
          )}
          {connectionTest.removalFolder && (
            <div style={{ fontSize: 13 }}>
              取り外し前フォルダ確認: <strong>{connectionTest.removalFolder.ok ? "OK" : "NG"}</strong> / 件数:{" "}
              {connectionTest.removalFolder.count ?? 0}
              {connectionTest.removalFolder.error ? ` / ${connectionTest.removalFolder.error}` : ""}
            </div>
          )}
          {connectionTest.installFolder && (
            <div style={{ fontSize: 13 }}>
              取り付け後フォルダ確認: <strong>{connectionTest.installFolder.ok ? "OK" : "NG"}</strong> / 件数:{" "}
              {connectionTest.installFolder.count ?? 0}
              {connectionTest.installFolder.error ? ` / ${connectionTest.installFolder.error}` : ""}
            </div>
          )}
          {connectionTest.spreadsheet && (
            <div style={{ fontSize: 13 }}>
              スプレッドシート確認: <strong>{connectionTest.spreadsheet.ok ? "OK" : "NG"}</strong>
              {connectionTest.spreadsheet.title ? ` / ${connectionTest.spreadsheet.title}` : ""}
              {connectionTest.spreadsheet.error ? ` / ${connectionTest.spreadsheet.error}` : ""}
            </div>
          )}
        </section>
      )}

      {message && <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
