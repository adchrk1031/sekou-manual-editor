"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessRecord } from "@/types/domain";

interface ApiResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string | null;
    records: ProcessRecord[];
  };
}

export default function ReviewPage() {
  const [runId, setRunId] = useState("");
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/results", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok || !json.data) {
        setMessage(`取得失敗: ${json.message ?? "不明"}`);
        return;
      }

      const needCheck = json.data.records.filter((record) => record.status !== "OK_AUTO" || !record.approvedForOutput);
      setRunId(json.data.runId ?? "");
      setRecords(needCheck);
    })();
  }, []);

  return (
    <main className="card">
      <h2 style={{ marginTop: 0 }}>確認画面</h2>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>表示された行を確認し、承認して次へ進んでください。</p>
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        runId: <strong>{runId || "未作成"}</strong> | 要確認件数: <strong>{records.length}</strong>
      </div>

      <table>
        <thead>
          <tr>
            <th>部屋</th>
            <th>状態</th>
            <th>取り外し値</th>
            <th>取付No</th>
            <th>取り付け値</th>
            <th>理由</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.recordId}>
              <td>{record.roomNormalized ?? "-"}</td>
              <td>
                <StatusBadge status={record.status} />
              </td>
              <td>{record.candidate.removalReading ?? "-"}</td>
              <td>{record.candidate.installMeterNo ?? "-"}</td>
              <td>{record.candidate.installReading ?? "-"}</td>
              <td>{record.reasons.join(" / ") || "-"}</td>
              <td>
                <Link href={`/reviews/${record.recordId}`}>確認して承認</Link>
              </td>
            </tr>
          ))}
          {!records.length && (
            <tr>
              <td colSpan={7}>確認が必要なデータはありません。次は「3. 出力」へ進んでください。</td>
            </tr>
          )}
        </tbody>
      </table>

      {message && <p style={{ marginTop: 12, color: "var(--ng)" }}>{message}</p>}
    </main>
  );
}
