import {
  appendAuditLog,
  getActiveRunId,
  getOrCreateActiveRun,
  getRun,
  saveRun
} from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { createAuditLog } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";
import { ingestPhotosToRun, IngestPhotoSource } from "@/server/services/photo-ingest-service";
import { PhotoType } from "@/types/domain";
import { rebuildPhotoPairs, summarizePhotoPairs } from "@/server/services/photo-pair-service";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

async function googleFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
}

async function listImageFilesInFolder(
  token: string,
  folderId: string,
  maxFiles: number
): Promise<{ files: DriveFile[]; error?: string }> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  while (files.length < maxFiles) {
    const left = maxFiles - files.length;
    const pageSize = Math.min(200, left);
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=${pageSize}${page}`;

    const res = await googleFetch(url, token);
    if (!res.ok) {
      return { files: [], error: `${res.status} ${await res.text()}` };
    }

    const json = (await res.json()) as {
      nextPageToken?: string;
      files?: Array<{ id?: string; name?: string; mimeType?: string }>;
    };

    for (const item of json.files ?? []) {
      if (!item.id || !item.name || !item.mimeType) {
        continue;
      }
      files.push({ id: item.id, name: item.name, mimeType: item.mimeType });
      if (files.length >= maxFiles) {
        break;
      }
    }

    if (!json.nextPageToken) {
      break;
    }
    pageToken = json.nextPageToken;
  }

  return { files };
}

async function downloadDriveFile(token: string, fileId: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await googleFetch(url, token);
  if (!res.ok) {
    throw new Error(`Driveファイル取得失敗(${fileId}): ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function loadSourcesFromFolder(args: {
  token: string;
  folderId: string;
  forcedType: PhotoType;
  maxFiles: number;
}): Promise<{ sources: IngestPhotoSource[]; listedCount: number; error?: string }> {
  const listed = await listImageFilesInFolder(args.token, args.folderId, args.maxFiles);
  if (listed.error) {
    return { sources: [], listedCount: 0, error: listed.error };
  }

  const sources: IngestPhotoSource[] = [];

  for (const file of listed.files) {
    const buffer = await downloadDriveFile(args.token, file.id);
    sources.push({
      fileName: file.name,
      buffer,
      forceType: args.forcedType
    });
  }

  return {
    sources,
    listedCount: listed.files.length
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      runId?: string;
      removalFolderId?: string;
      installFolderId?: string;
      maxFilesPerFolder?: number;
    };

    const removalFolderId = body.removalFolderId?.trim();
    const installFolderId = body.installFolderId?.trim();

    if (!removalFolderId && !installFolderId) {
      return fail("取り外し前または取り付け後のDriveフォルダIDを1つ以上入力してください", 400);
    }

    let run = null;
    if (body.runId?.trim()) {
      run = await getRun(body.runId.trim());
      if (!run) {
        return fail("runId が見つかりません", 404);
      }
    } else {
      const active = await getActiveRunId();
      run = active ? await getRun(active) : null;
      if (!run) {
        run = await getOrCreateActiveRun(userId);
      }
    }

    const token = process.env.GOOGLE_API_ACCESS_TOKEN ?? process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
    if (!token) {
      return fail("GOOGLE_API_ACCESS_TOKEN（または GOOGLE_SHEETS_ACCESS_TOKEN）が未設定です", 400);
    }

    const maxFiles = Math.max(1, Math.min(3000, Number(body.maxFilesPerFolder ?? 500)));

    const sources: IngestPhotoSource[] = [];
    const details: Record<string, unknown> = {
      maxFilesPerFolder: maxFiles
    };

    if (removalFolderId) {
      const removal = await loadSourcesFromFolder({
        token,
        folderId: removalFolderId,
        forcedType: "REMOVAL",
        maxFiles
      });
      if (removal.error) {
        return fail("取り外し前フォルダの取得に失敗しました", 502, removal.error);
      }
      sources.push(...removal.sources);
      details.removalFolderId = removalFolderId;
      details.removalListed = removal.listedCount;
    }

    if (installFolderId) {
      const install = await loadSourcesFromFolder({
        token,
        folderId: installFolderId,
        forcedType: "INSTALL",
        maxFiles
      });
      if (install.error) {
        return fail("取り付け後フォルダの取得に失敗しました", 502, install.error);
      }
      sources.push(...install.sources);
      details.installFolderId = installFolderId;
      details.installListed = install.listedCount;
    }

    if (!sources.length) {
      return fail("指定フォルダに画像がありません", 400, details);
    }

    const ingestResult = await ingestPhotosToRun(run, sources);
    const pairs = rebuildPhotoPairs(run);
    const pairSummary = summarizePhotoPairs(pairs);
    await saveRun(run);

    await appendAuditLog(
      createAuditLog({
        runId: run.runId,
        userId,
        action: "UPLOAD_PHOTOS",
        payload: {
          source: "google-drive",
          ...details,
          ...ingestResult,
          pairSummary,
          totalPhotos: run.photos.length
        }
      })
    );

    return ok({
      runId: run.runId,
      ...details,
      ...ingestResult,
      pairSummary,
      totalPhotos: run.photos.length
    });
  } catch (error) {
    return fail("Driveからの写真取込に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
