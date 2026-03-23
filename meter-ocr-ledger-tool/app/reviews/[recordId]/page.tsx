"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessRecord } from "@/types/domain";

interface ApiResponse {
  ok: boolean;
  message?: string;
  data?: {
    runId: string;
    record: ProcessRecord;
  };
}

export default function ReviewDetailPage() {
  const params = useParams<{ recordId: string }>();
  const router = useRouter();
  const [runId, setRunId] = useState("");
  const [record, setRecord] = useState<ProcessRecord | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    approvedForOutput: false,
    reviewedBy: "operator",
    removalReading: "",
    installMeterNo: "",
    installReading: ""
  });

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/reviews/${params.recordId}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok || !json.data) {
        setMessage(`取得失敗: ${json.message ?? "不明"}`);
        return;
      }
      setRunId(json.data.runId);
      setRecord(json.data.record);
      setForm({
        approvedForOutput: json.data.record.approvedForOutput,
        reviewedBy: json.data.record.reviewedBy ?? "operator",
        removalReading: String(json.data.record.manualOverride?.removalReading ?? json.data.record.candidate.removalReading ?? ""),
        installMeterNo: json.data.record.manualOverride?.installMeterNo ?? json.data.record.candidate.installMeterNo ?? "",
        installReading: String(json.data.record.manualOverride?.installReading ?? json.data.record.candidate.installReading ?? "")
      });
    })();
  }, [params.recordId]);

  const canApprove = useMemo(() => {
    return form.removalReading.trim() && form.installMeterNo.trim() && form.installReading.trim();
  }, [form]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        runId,
        approvedForOutput: form.approvedForOutput,
        reviewedBy: form.reviewedBy,
        removalReading: form.removalReading ? Number(form.removalReading) : null,
        installMeterNo: form.installMeterNo || null,
        installReading: form.installReading ? Number(form.installReading) : null
      };

      const res = await fetch(`/api/reviews/${params.recordId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok || !json.data) {
        setMessage(`保存失敗: ${json.message ?? "不明"}`);
        return;
      }
      setRecord(json.data.record);
      setMessage("保存しました");
    } catch (error) {
      setMessage(`保存失敗: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  if (!record) {
    return <main className="card">読み込み中...</main>;
  }

  return (
    <main className="card" style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>7. 個別確認</h2>
        <div style={{ fontSize: 13, marginTop: 8 }}>
          runId: <strong>{runId}</strong> / recordId: <strong>{record.recordId}</strong>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>状態:</span>
        <StatusBadge status={record.status} />
      </div>

      <div className="grid-2">
        <div>
          <label className="label">部屋番号</label>
          <input className="input" value={record.roomNormalized ?? ""} readOnly />
        </div>
        <div>
          <label className="label">レビュー担当</label>
          <input
            className="input"
            value={form.reviewedBy}
            onChange={(e) => setForm((prev) => ({ ...prev, reviewedBy: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">取り外し検針値</label>
          <input
            className="input"
            type="number"
            step="0.1"
            value={form.removalReading}
            onChange={(e) => setForm((prev) => ({ ...prev, removalReading: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">取付メーターNo</label>
          <input
            className="input"
            value={form.installMeterNo}
            onChange={(e) => setForm((prev) => ({ ...prev, installMeterNo: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">取り付け検針値</label>
          <input
            className="input"
            type="number"
            step="0.1"
            value={form.installReading}
            onChange={(e) => setForm((prev) => ({ ...prev, installReading: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.approvedForOutput}
            onChange={(e) => setForm((prev) => ({ ...prev, approvedForOutput: e.target.checked }))}
            disabled={!canApprove}
          />
          出力対象として承認
        </label>
      </div>

      <div>
        <strong>判定理由</strong>
        <ul style={{ marginTop: 8, marginBottom: 0 }}>
          {record.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
        <button className="btn btn-secondary" onClick={() => router.push("/reviews")}>一覧へ戻る</button>
      </div>

      {message && <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
