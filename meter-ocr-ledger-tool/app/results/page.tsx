"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessRecord, RunSummary } from "@/types/domain";

interface ApiResult {
  ok: boolean;
  message?: string;
  data?: {
    runId: string | null;
    summary: RunSummary;
    records: ProcessRecord[];
  };
}

export default function ResultsPage() {
  const [runId, setRunId] = useState<string>("");
  const [summary, setSummary] = useState<RunSummary>({ total: 0, okAuto: 0, needReview: 0, ng: 0, error: 0 });
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [status, setStatus] = useState<string>("");
  const [message, setMessage] = useState("");

  async function load(filter: string) {
    const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/results${query}`, { cache: "no-store" });
    const json = (await res.json()) as ApiResult;
    if (!json.ok || !json.data) {
      setMessage(`取得失敗: ${json.message ?? "不明"}`);
      return;
    }
    setMessage("");
    setRunId(json.data.runId ?? "");
    setSummary(json.data.summary);
    setRecords(json.data.records);
  }

  useEffect(() => {
    void load("");
  }, []);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>5. 処理結果一覧</h2>
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          runId: <strong>{runId || "未作成"}</strong>
        </div>
        <SummaryCards summary={summary} />

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => { setStatus(""); void load(""); }}>
            全件
          </button>
          <button className="btn btn-secondary" onClick={() => { setStatus("OK_AUTO"); void load("OK_AUTO"); }}>
            OK_AUTO
          </button>
          <button className="btn btn-secondary" onClick={() => { setStatus("NEED_REVIEW"); void load("NEED_REVIEW"); }}>
            NEED_REVIEW
          </button>
          <button className="btn btn-secondary" onClick={() => { setStatus("NG"); void load("NG"); }}>
            NG
          </button>
          <button className="btn btn-secondary" onClick={() => { setStatus("ERROR"); void load("ERROR"); }}>
            ERROR
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>フィルタ: {status || "全件"}</div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>部屋</th>
                <th>状態</th>
                <th>取り外し検針値</th>
                <th>取付メーターNo</th>
                <th>取り付け検針値</th>
                <th>理由</th>
                <th>確認</th>
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
                    <Link href={`/reviews/${record.recordId}`}>詳細</Link>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={7}>データがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && <p style={{ margin: 0, color: "var(--ng)" }}>{message}</p>}
    </main>
  );
}
