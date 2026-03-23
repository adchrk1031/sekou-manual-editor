import { fail, ok } from "@/lib/http";

interface TestPayload {
  removalFolderId?: string;
  installFolderId?: string;
  spreadsheetId?: string;
}

async function googleFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
}

async function testFolder(token: string, folderId: string): Promise<{
  ok: boolean;
  folderId: string;
  count?: number;
  samples?: Array<{ id: string; name: string; mimeType: string }>;
  error?: string;
}> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=5`;

  const res = await googleFetch(url, token);
  if (!res.ok) {
    return {
      ok: false,
      folderId,
      error: `${res.status} ${await res.text()}`
    };
  }

  const json = (await res.json()) as {
    files?: Array<{ id?: string; name?: string; mimeType?: string }>;
  };

  const samples = (json.files ?? []).map((item) => ({
    id: item.id ?? "",
    name: item.name ?? "",
    mimeType: item.mimeType ?? ""
  }));

  return {
    ok: true,
    folderId,
    count: samples.length,
    samples
  };
}

async function testSpreadsheet(token: string, spreadsheetId: string): Promise<{
  ok: boolean;
  spreadsheetId: string;
  title?: string;
  sheetNames?: string[];
  error?: string;
}> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties.title`;
  const res = await googleFetch(url, token);
  if (!res.ok) {
    return {
      ok: false,
      spreadsheetId,
      error: `${res.status} ${await res.text()}`
    };
  }

  const json = (await res.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  return {
    ok: true,
    spreadsheetId,
    title: json.properties?.title ?? "",
    sheetNames: (json.sheets ?? []).map((sheet) => sheet.properties?.title ?? "")
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as TestPayload;
    const token = process.env.GOOGLE_API_ACCESS_TOKEN ?? process.env.GOOGLE_SHEETS_ACCESS_TOKEN;

    if (!token) {
      return fail(
        "トークン未設定です。.env.local に GOOGLE_API_ACCESS_TOKEN（推奨）または GOOGLE_SHEETS_ACCESS_TOKEN を設定してください",
        400,
        {
          tokenConfigured: false
        }
      );
    }

    const aboutRes = await googleFetch("https://www.googleapis.com/drive/v3/about?fields=user", token);
    if (!aboutRes.ok) {
      return fail("Google認証の確認に失敗しました", 401, {
        tokenConfigured: true,
        authOk: false,
        error: `${aboutRes.status} ${await aboutRes.text()}`
      });
    }

    const aboutJson = (await aboutRes.json()) as {
      user?: { displayName?: string; emailAddress?: string };
    };

    const result: {
      tokenConfigured: boolean;
      authOk: boolean;
      user?: { displayName?: string; emailAddress?: string };
      removalFolder?: Awaited<ReturnType<typeof testFolder>>;
      installFolder?: Awaited<ReturnType<typeof testFolder>>;
      spreadsheet?: Awaited<ReturnType<typeof testSpreadsheet>>;
    } = {
      tokenConfigured: true,
      authOk: true,
      user: aboutJson.user
    };

    if (body.removalFolderId?.trim()) {
      result.removalFolder = await testFolder(token, body.removalFolderId.trim());
    }

    if (body.installFolderId?.trim()) {
      result.installFolder = await testFolder(token, body.installFolderId.trim());
    }

    if (body.spreadsheetId?.trim()) {
      result.spreadsheet = await testSpreadsheet(token, body.spreadsheetId.trim());
    }

    return ok(result);
  } catch (error) {
    return fail("接続テストに失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
