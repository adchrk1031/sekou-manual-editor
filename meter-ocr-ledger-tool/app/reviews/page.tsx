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

export default function ReviewsPage() {
  const [runId, setRunId] = useState("");
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/results?status=NEED_REVIEW", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok || !json.data) {
        setMessage(`取得失敗: ${json.message ?? "不明"}`);
        return;
      }
      setRunId(json.data.runId ?? "");
      setRecords(json.data.records);
    })();
  }, []);

  return (
    <main className="card">
      <h2 style={{ marginTop: 0 }}>6. 要確認一覧</h2>
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        runId: <strong>{runId || "未作成"}</strong>
      </div>

      <table>
        <thead>
          <tr>
            <th>部屋</th>
            <th>状態</th>
            <th>理由</th>
            <th>候補値</th>
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
              <td>{record.reasons.join(" / ")}</td>
              <td>
                取外し:{record.candidate.removalReading ?? "-"}
                <br />
                取付No:{record.candidate.installMeterNo ?? "-"}
                <br />
                取付値:{record.candidate.installReading ?? "-"}
              </td>
              <td>
                <Link href={`/reviews/${record.recordId}`}>確認</Link>
              </td>
            </tr>
          ))}
          {!records.length && (
            <tr>
              <td colSpan={5}>要確認データはありません</td>
            </tr>
          )}
        </tbody>
      </table>

      {message && <p style={{ marginTop: 12, color: "var(--ng)" }}>{message}</p>}
    </main>
  );
}
