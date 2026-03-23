"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessRecord, RunSummary } from "@/types/domain";

interface PairCandidate {
  fileId: string;
  fileName: string;
  photoType: "REMOVAL" | "INSTALL" | "UNKNOWN";
  uploadedAt: string;
}

interface PhotoPairRow {
  roomNormalized: string;
  removalPhotoIds: string[];
  installPhotoIds: string[];
  selectedRemovalPhotoId: string | null;
  selectedInstallPhotoId: string | null;
  status: "READY" | "MISSING" | "DUPLICATE";
  reasons: string[];
  removalCandidates: PairCandidate[];
  installCandidates: PairCandidate[];
}

interface ResultsApi {
  ok: boolean;
  message?: string;
  data?: {
    runId: string | null;
    summary: RunSummary;
    photos: number;
    ledgerRows: number;
    records: ProcessRecord[];
    photoPairs: PhotoPairRow[];
    pairSummary: {
      totalRooms: number;
      ready: number;
      missing: number;
      duplicate: number;
    };
  };
}

export default function StartPage() {
  const [runId, setRunId] = useState("");
  const [summary, setSummary] = useState<RunSummary>({ total: 0, okAuto: 0, needReview: 0, ng: 0, error: 0 });
  const [meta, setMeta] = useState({ photos: 0, ledgerRows: 0 });
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [photoPairs, setPhotoPairs] = useState<PhotoPairRow[]>([]);
  const [pairSummary, setPairSummary] = useState({ totalRooms: 0, ready: 0, missing: 0, duplicate: 0 });
  const [savingPairRoom, setSavingPairRoom] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveImport, setDriveImport] = useState({
    removalFolderId: "",
    installFolderId: "",
    maxFilesPerFolder: 500
  });

  const previewRows = useMemo(() => records.slice(0, 200), [records]);
  const hasUnresolvedPairs =
    pairSummary.totalRooms > 0 && pairSummary.ready < pairSummary.totalRooms;

  async function reload() {
    const res = await fetch("/api/results", { cache: "no-store" });
    const json = (await res.json()) as ResultsApi;
    if (json.ok && json.data) {
      setRunId(json.data.runId ?? "");
      setSummary(json.data.summary);
      setMeta({ photos: json.data.photos, ledgerRows: json.data.ledgerRows });
      setRecords(json.data.records ?? []);
      setPhotoPairs(json.data.photoPairs ?? []);
      setPairSummary(json.data.pairSummary ?? { totalRooms: 0, ready: 0, missing: 0, duplicate: 0 });
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadExcel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    if (runId) {
      formData.set("runId", runId);
    }

    const res = await fetch("/api/excel/upload", {
      method: "POST",
      body: formData
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(`Excel取込失敗: ${json.message ?? "不明"}`);
      return;
    }

    setRunId(json.data.runId);
    setMessage(`Excel取込完了（台帳 ${json.data.ledgerRows} 行）`);
    await reload();
  }

  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const hasRemoval = formData.getAll("removalPhotos").some((item) => item instanceof File && item.size > 0);
    const hasInstall = formData.getAll("installPhotos").some((item) => item instanceof File && item.size > 0);
    if (!hasRemoval && !hasInstall) {
      setMessage("取り外し前または取り付け後の写真を選択してください");
      return;
    }

    if (runId) {
      formData.set("runId", runId);
    }

    setUploading(true);
    const res = await fetch("/api/photos/upload", {
      method: "POST",
      body: formData
    });
    const json = await res.json();
    setUploading(false);

    if (!json.ok) {
      setMessage(`写真取込失敗: ${json.message ?? "不明"}`);
      return;
    }

    setRunId(json.data.runId);
    const pairInfo = json.data?.pairSummary
      ? ` / ペア準備OK ${json.data.pairSummary.ready}/${json.data.pairSummary.totalRooms}`
      : "";
    setMessage(`写真取込完了（追加 ${json.data.added} 件 / 取り外し ${json.data.addedRemoval} 件 / 取り付け ${json.data.addedInstall} 件）${pairInfo}`);
    event.currentTarget.reset();
    await reload();
  }

  async function importFromDrive() {
    setMessage("");
    if (!driveImport.removalFolderId.trim() && !driveImport.installFolderId.trim()) {
      setMessage("取り外し前または取り付け後のフォルダIDを入力してください");
      return;
    }

    setDriveLoading(true);
    const res = await fetch("/api/photos/import-drive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: runId || undefined,
        removalFolderId: driveImport.removalFolderId || undefined,
        installFolderId: driveImport.installFolderId || undefined,
        maxFilesPerFolder: driveImport.maxFilesPerFolder
      })
    });
    const json = await res.json();
    setDriveLoading(false);

    if (!json.ok) {
      setMessage(`Drive取込失敗: ${json.message ?? "不明"}`);
      return;
    }

    setRunId(json.data.runId);
    const pairInfo = json.data?.pairSummary
      ? ` / ペア準備OK ${json.data.pairSummary.ready}/${json.data.pairSummary.totalRooms}`
      : "";
    setMessage(`Drive取込完了（追加 ${json.data.added} 件 / 取り外し ${json.data.addedRemoval} 件 / 取り付け ${json.data.addedInstall} 件）${pairInfo}`);
    await reload();
  }

  async function resolvePair(
    roomNormalized: string,
    selectedRemovalPhotoId: string | null,
    selectedInstallPhotoId: string | null
  ) {
    if (!runId) {
      return;
    }
    setSavingPairRoom(roomNormalized);
    const res = await fetch("/api/pairs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId,
        roomNormalized,
        selectedRemovalPhotoId,
        selectedInstallPhotoId
      })
    });
    const json = await res.json();
    setSavingPairRoom(null);
    if (!json.ok) {
      setMessage(`写真ペア確定失敗: ${json.message ?? "不明"}`);
      return;
    }
    setMessage(`部屋 ${roomNormalized} の写真ペアを確定しました`);
    await reload();
  }

  async function executePhotoScanOnly() {
    if (!runId) {
      setMessage("先に写真を取り込んでください");
      return;
    }

    setRunning(true);
    setMessage("");

    const res = await fetch("/api/run/scan-photos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId })
    });
    const json = await res.json();

    if (!json.ok) {
      setMessage(`写真OCR一覧の作成失敗: ${json.message ?? "不明"}`);
      setRunning(false);
      return;
    }

    setMessage("写真のみOCRの一覧を作成しました（下のリストを確認してください）");
    setRunning(false);
    await reload();
  }

  async function executeFull() {
    if (!runId) {
      setMessage("先に写真を取り込んでください");
      return;
    }

    setRunning(true);
    setMessage("");

    const res = await fetch("/api/run/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId })
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(`台帳照合実行失敗: ${json.message ?? "不明"}`);
      setRunning(false);
      return;
    }

    setMessage("台帳照合まで実行しました。次は「2. 確認」へ進んでください。");
    setRunning(false);
    await reload();
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>開始画面</h2>
        <p style={{ color: "var(--muted)" }}>大量運用向け: 取り外し前と取り付け後を分けて一括投入できます。</p>
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          runId: <strong>{runId || "未作成"}</strong> | 台帳: <strong>{meta.ledgerRows}</strong> | 写真: <strong>{meta.photos}</strong>
        </div>
        <SummaryCards summary={summary} />
      </section>

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Step 1: Excel台帳を取り込む（任意）</h3>
        <form onSubmit={uploadExcel} style={{ display: "grid", gap: 8 }}>
          <input type="file" name="excel" className="input" accept=".xlsx,.xlsm,.xls" required />

          <details>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>詳細設定（通常はそのままでOK）</summary>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <input className="input" name="sheetName" defaultValue="★用データ" placeholder="シート名" required />
              <input className="input" name="headerRow" type="number" defaultValue={10} placeholder="ヘッダー行" required />
              <input className="input" name="roomColumn" defaultValue="B" placeholder="部屋番号列" required />
              <input className="input" name="previousReadingColumn" defaultValue="" placeholder="前回検針値列（任意）" />
              <input className="input" name="plannedInstallMeterNoColumn" defaultValue="" placeholder="予定メーターNo列（任意）" />
              <input className="input" name="removalReadingOutputColumn" defaultValue="D" placeholder="取り外し検針値出力列" required />
              <input className="input" name="installMeterNoOutputColumn" defaultValue="E" placeholder="取付メーターNo出力列" required />
              <input className="input" name="installReadingOutputColumn" defaultValue="F" placeholder="取り付け検針値出力列" required />
            </div>
          </details>

          <button className="btn btn-primary" type="submit">
            Excel取込
          </button>
        </form>
      </section>

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Step 2A: 写真を一括取り込み（ローカル2レーン）</h3>
        <form onSubmit={uploadPhotos} style={{ display: "grid", gap: 12 }}>
          <div className="grid-2">
            <div>
              <label className="label">取り外し前写真（複数選択）</label>
              <input type="file" name="removalPhotos" className="input" accept="image/*" multiple />
            </div>
            <div>
              <label className="label">取り付け後写真（複数選択）</label>
              <input type="file" name="installPhotos" className="input" accept="image/*" multiple />
            </div>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
            可能ならファイル名に部屋番号を含めてください（例: 701_old.jpg / 701_new.jpg）。画像内シールOCRも補助利用します。
          </p>
          <button className="btn btn-primary" type="submit" disabled={uploading}>
            {uploading ? "取込中..." : "写真を一括取込"}
          </button>
        </form>
      </section>

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Step 2B: Google Driveフォルダから一括取り込み</h3>
        <div className="grid-2">
          <input
            className="input"
            placeholder="取り外し前フォルダID"
            value={driveImport.removalFolderId}
            onChange={(e) => setDriveImport((prev) => ({ ...prev, removalFolderId: e.target.value }))}
          />
          <input
            className="input"
            placeholder="取り付け後フォルダID"
            value={driveImport.installFolderId}
            onChange={(e) => setDriveImport((prev) => ({ ...prev, installFolderId: e.target.value }))}
          />
        </div>
        <div style={{ maxWidth: 280 }}>
          <label className="label">フォルダごとの最大取込件数</label>
          <input
            className="input"
            type="number"
            min={1}
            max={3000}
            value={driveImport.maxFilesPerFolder}
            onChange={(e) => setDriveImport((prev) => ({ ...prev, maxFilesPerFolder: Number(e.target.value) || 1 }))}
          />
        </div>
        <button className="btn btn-secondary" onClick={importFromDrive} disabled={driveLoading}>
          {driveLoading ? "Drive取込中..." : "Driveから写真を取込"}
        </button>
      </section>

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Step 2C: 部屋ごとに写真ペアを確定</h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
          1部屋につき「取り外し前1枚」「取り付け後1枚」を選択してください。重複がある部屋はここで確定します。
        </p>
        <div style={{ fontSize: 13 }}>
          合計部屋: <strong>{pairSummary.totalRooms}</strong> / 準備OK: <strong>{pairSummary.ready}</strong> / 欠損:{" "}
          <strong>{pairSummary.missing}</strong> / 重複未確定: <strong>{pairSummary.duplicate}</strong>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>部屋</th>
                <th>取り外し前写真</th>
                <th>取り付け後写真</th>
                <th>状態</th>
                <th>理由</th>
              </tr>
            </thead>
            <tbody>
              {photoPairs.map((pair) => (
                <tr key={pair.roomNormalized}>
                  <td>{pair.roomNormalized}</td>
                  <td>
                    <select
                      className="input"
                      value={pair.selectedRemovalPhotoId ?? ""}
                      disabled={!pair.removalCandidates.length || savingPairRoom === pair.roomNormalized}
                      onChange={(e) =>
                        void resolvePair(
                          pair.roomNormalized,
                          e.target.value ? e.target.value : null,
                          pair.selectedInstallPhotoId
                        )
                      }
                    >
                      <option value="">選択してください</option>
                      {pair.removalCandidates.map((candidate) => (
                        <option key={candidate.fileId} value={candidate.fileId}>
                          {candidate.fileName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="input"
                      value={pair.selectedInstallPhotoId ?? ""}
                      disabled={!pair.installCandidates.length || savingPairRoom === pair.roomNormalized}
                      onChange={(e) =>
                        void resolvePair(
                          pair.roomNormalized,
                          pair.selectedRemovalPhotoId,
                          e.target.value ? e.target.value : null
                        )
                      }
                    >
                      <option value="">選択してください</option>
                      {pair.installCandidates.map((candidate) => (
                        <option key={candidate.fileId} value={candidate.fileId}>
                          {candidate.fileName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {pair.status === "READY" && <span style={{ color: "var(--ok)", fontWeight: 700 }}>準備OK</span>}
                    {pair.status === "MISSING" && <span style={{ color: "var(--ng)", fontWeight: 700 }}>欠損</span>}
                    {pair.status === "DUPLICATE" && <span style={{ color: "var(--review)", fontWeight: 700 }}>重複未確定</span>}
                  </td>
                  <td>{pair.reasons.join(" / ") || "-"}</td>
                </tr>
              ))}
              {!photoPairs.length && (
                <tr>
                  <td colSpan={5}>写真を取り込むと、ここに部屋ごとの写真ペア候補が表示されます。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Step 3: OCR実行</h3>
        {hasUnresolvedPairs && (
          <p style={{ margin: 0, color: "var(--review)", fontSize: 12 }}>
            ペア未確定の部屋があります。Step 2C で全室を準備OKにしてから実行してください。
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={executePhotoScanOnly} disabled={!runId || running || hasUnresolvedPairs}>
            {running ? "実行中..." : "写真だけOCRして一覧作成"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={executeFull}
            disabled={!runId || running || meta.ledgerRows === 0 || hasUnresolvedPairs}
          >
            台帳照合まで実行
          </button>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>写真OCRリスト（部屋ごと）</h3>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 12 }}>
          まずこの一覧で整合性を確認できます。取り外し/取り付けが欠けている部屋は要確認になります。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>部屋</th>
                <th>状態</th>
                <th>取り外し値</th>
                <th>取付No</th>
                <th>取り付け値</th>
                <th>理由</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((record) => (
                <tr key={record.recordId}>
                  <td>{record.roomNormalized ?? "-"}</td>
                  <td>
                    <StatusBadge status={record.status} />
                  </td>
                  <td>{record.candidate.removalReading ?? "-"}</td>
                  <td>{record.candidate.installMeterNo ?? "-"}</td>
                  <td>{record.candidate.installReading ?? "-"}</td>
                  <td>{record.reasons.join(" / ") || "-"}</td>
                </tr>
              ))}
              {!previewRows.length && (
                <tr>
                  <td colSpan={6}>「写真だけOCRして一覧作成」を押すと、ここに部屋別リストが表示されます。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
