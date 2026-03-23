"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  logId: string;
  runId: string;
  recordId?: string;
  userId: string;
  action: string;
  payload: unknown;
  createdAt: string;
}

interface LogResponse {
  ok: boolean;
  data?: {
    logs: AuditLog[];
  };
  message?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/logs?limit=300", { cache: "no-store" });
      const json = (await res.json()) as LogResponse;
      if (!json.ok || !json.data) {
        setMessage(`取得失敗: ${json.message ?? "不明"}`);
        return;
      }
      setLogs(json.data.logs);
    })();
  }, []);

  return (
    <main className="card">
      <h2 style={{ marginTop: 0 }}>9. ログ閲覧</h2>
      <p style={{ color: "var(--muted)" }}>監査ログは時系列で保存されます。1件ごとの更新理由を追跡できます。</p>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>日時</th>
              <th>runId</th>
              <th>recordId</th>
              <th>ユーザー</th>
              <th>操作</th>
              <th>payload</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.logId}>
                <td>{new Date(log.createdAt).toLocaleString("ja-JP")}</td>
                <td>{log.runId}</td>
                <td>{log.recordId ?? "-"}</td>
                <td>{log.userId}</td>
                <td>{log.action}</td>
                <td>
                  <code style={{ fontSize: 11 }}>{JSON.stringify(log.payload)}</code>
                </td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td colSpan={6}>ログがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && <p style={{ marginTop: 12, color: "var(--ng)" }}>{message}</p>}
    </main>
  );
}
