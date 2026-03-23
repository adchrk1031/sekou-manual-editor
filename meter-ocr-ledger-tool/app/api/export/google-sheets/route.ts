import fs from "node:fs/promises";
import path from "node:path";
import { appendAuditLog, getActiveRunId, getRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { googleSheetsSchema } from "@/lib/validation/schemas";
import { createAuditLog } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";
import { RunData } from "@/types/domain";

function normalizeSheetName(name: string): string {
  if (/^[A-Za-z0-9_]+$/.test(name)) {
    return name;
  }
  return `'${name.replace(/'/g, "''")}'`;
}

async function googleFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
}

async function convertExcelToSpreadsheet(args: {
  run: RunData;
  token: string;
  driveFolderId: string;
  spreadsheetTitle?: string;
}): Promise<{ id: string; name: string; webViewLink?: string }> {
  if (!args.run.excelFile) {
    throw new Error("変換元のExcelファイルがありません");
  }

  const excelPath = args.run.excelFile.filePath;
  const excelBuffer = await fs.readFile(excelPath);
  const ext = path.extname(args.run.excelFile.fileName).toLowerCase();
  const mediaType =
    ext === ".xls"
      ? "application/vnd.ms-excel"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const baseName = args.run.excelFile.fileName.replace(/\.[^.]+$/, "");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const targetName = args.spreadsheetTitle?.trim() || `${baseName}-${timestamp}`;

  const metadata = {
    name: targetName,
    mimeType: "application/vnd.google-apps.spreadsheet",
    parents: [args.driveFolderId]
  };

  const boundary = `----meter-ocr-${Date.now().toString(36)}`;
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mediaType}\r\n\r\n`,
    "utf-8"
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`, "utf-8");
  const body = Buffer.concat([prefix, excelBuffer, suffix]);

  const response = await googleFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
    args.token,
    {
      method: "POST",
      headers: {
        "content-type": `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!response.ok) {
    throw new Error(`Excel変換に失敗しました: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { id?: string; name?: string; webViewLink?: string };
  if (!json.id || !json.name) {
    throw new Error("Excel変換後のスプレッドシートID取得に失敗しました");
  }

  return {
    id: json.id,
    name: json.name,
    webViewLink: json.webViewLink
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const body = (await request.json()) as Record<string, unknown>;
    const runId = (body.runId as string | undefined) ?? (await getActiveRunId());

    if (!runId) {
      return fail("runId が見つかりません", 400);
    }

    const run = await getRun(runId);
    if (!run) {
      return fail("run が見つかりません", 404);
    }

    const parsed = googleSheetsSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Google Sheets出力設定が不正です", 400, parsed.error.flatten());
    }

    const approved = run.processRecords.filter((record) => record.approvedForOutput && record.roomNormalized);

    const updates = approved.map((record) => ({
      roomNo: record.roomNormalized ?? "",
      removalReading: record.manualOverride?.removalReading ?? record.candidate.removalReading,
      installMeterNo: record.manualOverride?.installMeterNo ?? record.candidate.installMeterNo,
      installReading: record.manualOverride?.installReading ?? record.candidate.installReading,
      recordId: record.recordId
    }));

    if (run.settings.dryRun || !run.settings.productionWriteEnabled) {
      await appendAuditLog(
        createAuditLog({
          runId,
          userId,
          action: "EXPORT_GOOGLE_SHEETS",
          payload: {
            mode: "dry-run",
            updates: updates.length,
            requestedSpreadsheetId: parsed.data.spreadsheetId || null,
            requestedDriveFolderId: parsed.data.driveFolderId || null,
            createSpreadsheetFromExcel: parsed.data.createSpreadsheetFromExcel
          }
        })
      );
      return ok({
        runId,
        dryRun: true,
        productionWriteEnabled: run.settings.productionWriteEnabled,
        updates
      });
    }

    const token = process.env.GOOGLE_API_ACCESS_TOKEN ?? process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
    if (!token) {
      return fail("GOOGLE_API_ACCESS_TOKEN（または GOOGLE_SHEETS_ACCESS_TOKEN）が未設定です", 400);
    }

    const {
      sheetName,
      roomColumn,
      removalReadingColumn,
      installMeterNoColumn,
      installReadingColumn,
      driveFolderId,
      createSpreadsheetFromExcel: createFromExcel,
      spreadsheetTitle
    } = parsed.data;

    let spreadsheetId = parsed.data.spreadsheetId?.trim() || "";
    let createdSpreadsheet: { id: string; name: string; webViewLink?: string } | null = null;

    if (!spreadsheetId && createFromExcel) {
      createdSpreadsheet = await convertExcelToSpreadsheet({
        run,
        token,
        driveFolderId: (driveFolderId || "").trim(),
        spreadsheetTitle: spreadsheetTitle || undefined
      });
      spreadsheetId = createdSpreadsheet.id;
    }

    if (!spreadsheetId) {
      return fail("Spreadsheet ID がありません。IDを入力するか、Excel変換を有効にしてください", 400);
    }

    const safeSheetName = normalizeSheetName(sheetName);

    const getRoomRange = `${safeSheetName}!${roomColumn}:${roomColumn}`;
    const roomRes = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(getRoomRange)}`,
      token,
      {
        headers: {
          "content-type": "application/json"
        }
      }
    );

    if (!roomRes.ok) {
      return fail("Google Sheetsの既存部屋番号取得に失敗しました", 502, await roomRes.text());
    }

    const roomJson = (await roomRes.json()) as { values?: string[][] };
    const rows = roomJson.values ?? [];
    const roomRowMap = new Map<string, number>();

    rows.forEach((row, index) => {
      const room = row[0]?.trim();
      if (!room) {
        return;
      }
      roomRowMap.set(room, index + 1);
    });

    const data: Array<{ range: string; values: string[][] }> = [];

    for (const item of updates) {
      const row = roomRowMap.get(item.roomNo);
      if (!row) {
        continue;
      }
      data.push({
        range: `${safeSheetName}!${removalReadingColumn}${row}`,
        values: [[item.removalReading !== null ? String(item.removalReading) : ""]]
      });
      data.push({
        range: `${safeSheetName}!${installMeterNoColumn}${row}`,
        values: [[item.installMeterNo ?? ""]]
      });
      data.push({
        range: `${safeSheetName}!${installReadingColumn}${row}`,
        values: [[item.installReading !== null ? String(item.installReading) : ""]]
      });
    }

    const batchBody = {
      valueInputOption: "USER_ENTERED",
      data
    };

    const updateRes = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      token,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(batchBody)
      }
    );

    if (!updateRes.ok) {
      return fail("Google Sheets更新に失敗しました", 502, await updateRes.text());
    }

    await appendAuditLog(
      createAuditLog({
        runId,
        userId,
        action: "EXPORT_GOOGLE_SHEETS",
        payload: {
          mode: "write",
          spreadsheetId,
          createdSpreadsheet,
          updates: data.length
        }
      })
    );

    return ok({
      runId,
      dryRun: false,
      productionWriteEnabled: true,
      spreadsheetId,
      createdSpreadsheet,
      attemptedUpdates: updates.length,
      batchCells: data.length
    });
  } catch (error) {
    return fail("Google Sheets出力に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
