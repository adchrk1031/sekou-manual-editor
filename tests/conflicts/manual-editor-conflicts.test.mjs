import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import test, { after, before } from "node:test";

const repoRoot = process.cwd();
const port = 3211;
const baseUrl = `http://127.0.0.1:${port}`;
const dbDir = path.join(repoRoot, ".tmp-tests");
const dbPath = path.join(dbDir, "manual-editor-conflicts-runtime.db");

fs.mkdirSync(dbDir, { recursive: true });
fs.rmSync(dbPath, { force: true });

let serverProcess = null;
let sessionCookie = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 200 || response.status === 401) {
        return;
      }
    } catch {
      // keep polling
    }
    await sleep(750);
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms`);
}

async function startServer() {
  serverProcess = spawn(
    "node",
    ["./node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`,
        NODE_ENV: "test",
        BLOB_READ_WRITE_TOKEN: "",
      },
      stdio: "pipe",
    },
  );
  serverProcess.stderr.on("data", () => {});
  serverProcess.stdout.on("data", () => {});
  await waitForServer(`${baseUrl}/`);
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }
  serverProcess.kill("SIGTERM");
  await new Promise((resolve) => {
    serverProcess.once("exit", () => resolve(undefined));
    setTimeout(() => resolve(undefined), 5_000);
  });
}

async function apiFetch(route, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (cookie) {
    headers.cookie = cookie;
  }
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function createInitialAdminSession() {
  const response = await apiFetch("/api/manual-editor/session/register", {
    method: "POST",
    body: {
      mode: "initial",
      name: "Conflict Tester",
      email: "conflict.tester@example.com",
      password: "testpass123",
    },
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie.split(";")[0];
}

before(async () => {
  await startServer();
  sessionCookie = await createInitialAdminSession();
});

after(async () => {
  await stopServer();
});

test("project item conflicts are auto-merged", async () => {
  const first = await apiFetch("/api/manual-editor/projects/PJ-CONFLICT-1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-CONFLICT-1",
          propertyName: "初期物件名",
          scheduleRows: [
            {
              id: "schedule_row_1",
              label: "既存工程",
              startDate: "2026-05-20",
              start: "09:00",
              endDate: "2026-05-20",
              end: "10:00",
              outage: true,
              text: "",
              note: "既存メモ",
            },
          ],
          relatedParties: {
            management: {
              company: "管理会社A",
            },
          },
        }),
      },
    },
  });
  assert.equal(first.status, 200);

  const second = await apiFetch("/api/manual-editor/projects/PJ-CONFLICT-1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-CONFLICT-1",
          noteSpecial: "後勝ちメモ",
          scheduleRows: [
            {
              id: "schedule_row_1",
              label: "既存工程更新",
              startDate: "2026-05-20",
              start: "09:30",
              endDate: "2026-05-20",
              end: "10:30",
              outage: true,
              text: "",
              note: "更新メモ",
            },
            {
              id: "schedule_row_2",
              label: "追加工程",
              startDate: "2026-05-20",
              start: "11:00",
              endDate: "2026-05-20",
              end: "12:00",
              outage: false,
              text: "",
              note: "",
            },
          ],
          relatedParties: {
            management: {
              person: "担当者B",
            },
          },
        }),
      },
    },
  });
  assert.equal(second.status, 200);
  const result = await second.json();
  assert.equal(result.resolvedConflict, true);
  const merged = JSON.parse(result.payload.rawProject);
  assert.equal(merged.propertyName, "初期物件名");
  assert.equal(merged.noteSpecial, "後勝ちメモ");
  assert.equal(merged.relatedParties.management.company, "管理会社A");
  assert.equal(merged.relatedParties.management.person, "担当者B");
  assert.equal(merged.scheduleRows.length, 2);
  assert.equal(merged.scheduleRows[0].id, "schedule_row_1");
  assert.equal(merged.scheduleRows[0].label, "既存工程更新");
  assert.equal(merged.scheduleRows[0].note, "更新メモ");
  assert.equal(merged.scheduleRows[1].id, "schedule_row_2");
});

test("project schedule delete tombstones prevent deleted rows from reappearing", async () => {
  const first = await apiFetch("/api/manual-editor/projects/PJ-CONFLICT-DELETE-1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-CONFLICT-DELETE-1",
          propertyName: "削除競合テスト",
          deletedScheduleRowIds: [],
          scheduleRows: [
            {
              id: "schedule_keep",
              label: "残す工程",
              startDate: "2026-05-20",
              start: "09:00",
              endDate: "2026-05-20",
              end: "10:00",
              outage: true,
              text: "",
              note: "",
            },
            {
              id: "schedule_deleted",
              label: "削除される工程",
              startDate: "2026-05-20",
              start: "11:00",
              endDate: "2026-05-20",
              end: "12:00",
              outage: false,
              text: "",
              note: "",
            },
          ],
        }),
      },
    },
  });
  assert.equal(first.status, 200);

  const second = await apiFetch("/api/manual-editor/projects/PJ-CONFLICT-DELETE-1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-CONFLICT-DELETE-1",
          propertyName: "削除競合テスト",
          deletedScheduleRowIds: ["schedule_deleted"],
          scheduleRows: [
            {
              id: "schedule_keep",
              label: "残す工程を更新",
              startDate: "2026-05-20",
              start: "09:30",
              endDate: "2026-05-20",
              end: "10:30",
              outage: true,
              text: "",
              note: "削除競合後も残す",
            },
          ],
        }),
      },
    },
  });
  assert.equal(second.status, 200);
  const result = await second.json();
  assert.equal(result.resolvedConflict, true);
  const merged = JSON.parse(result.payload.rawProject);
  assert.deepEqual(merged.scheduleRows.map((row) => row.id), ["schedule_keep"]);
  assert.deepEqual(merged.deletedScheduleRowIds, ["schedule_deleted"]);
  assert.equal(merged.scheduleRows[0].label, "残す工程を更新");
});

test("related party conflicts preserve existing non-empty fields and allow disabling", async () => {
  const first = await apiFetch("/api/manual-editor/projects/PJ-CONFLICT-PARTY-1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-CONFLICT-PARTY-1",
          propertyName: "体制表競合テスト",
          relatedParties: {
            management: {
              enabled: true,
              title: "管理会社",
              company: "管理会社A",
              person: "既存担当",
              office: "既存支店",
              tel: "03-0000-0000",
            },
          },
        }),
      },
    },
  });
  assert.equal(first.status, 200);

  const second = await apiFetch("/api/manual-editor/projects/PJ-CONFLICT-PARTY-1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-CONFLICT-PARTY-1",
          propertyName: "体制表競合テスト",
          relatedParties: {
            management: {
              enabled: false,
              title: "管理会社",
              company: "",
              person: "新担当",
              office: "",
              tel: "",
            },
          },
        }),
      },
    },
  });
  assert.equal(second.status, 200);
  const result = await second.json();
  assert.equal(result.resolvedConflict, true);
  const merged = JSON.parse(result.payload.rawProject);
  assert.equal(merged.relatedParties.management.enabled, false);
  assert.equal(merged.relatedParties.management.company, "管理会社A");
  assert.equal(merged.relatedParties.management.person, "新担当");
  assert.equal(merged.relatedParties.management.office, "既存支店");
  assert.equal(merged.relatedParties.management.tel, "03-0000-0000");
});

test("csv row conflicts are auto-merged after stale writes", async () => {
  const headerResponse = await apiFetch("/api/manual-editor/csv/headers", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        headers: ["project_id", "property_name", "note_special"],
      },
    },
  });
  assert.equal(headerResponse.status, 200);

  const first = await apiFetch("/api/manual-editor/csv/rows/row_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        rowOrder: 0,
        rawJson: JSON.stringify({
          project_id: "PJ-CSV-1",
          property_name: "CSV初期",
        }),
      },
    },
  });
  assert.equal(first.status, 200);

  const second = await apiFetch("/api/manual-editor/csv/rows/row_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        rowOrder: 0,
        rawJson: JSON.stringify({
          project_id: "PJ-CSV-1",
          note_special: "競合後追加",
        }),
      },
    },
  });
  assert.equal(second.status, 200);
  const result = await second.json();
  assert.equal(result.resolvedConflict, true);
  const merged = JSON.parse(result.payload.rawJson);
  assert.equal(merged.property_name, "CSV初期");
  assert.equal(merged.note_special, "競合後追加");
});

test("template item conflicts are auto-merged", async () => {
  const first = await apiFetch("/api/manual-editor/template-items/sekou-tool-template-notice-v1/notice_conflict_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        itemName: "設備改修 PAS",
        itemScope: "",
        itemCategory: "notice",
        itemOrder: 0,
        rawJson: JSON.stringify({
          id: "notice_conflict_1",
          name: "設備改修 PAS",
          createdAt: "2026-05-19T00:00:00.000Z",
          payload: {
            noticeHeadline: "初回見出し",
          },
        }),
      },
    },
  });
  assert.equal(first.status, 200);

  const second = await apiFetch("/api/manual-editor/template-items/sekou-tool-template-notice-v1/notice_conflict_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        itemName: "設備改修 PAS",
        itemScope: "",
        itemCategory: "notice",
        itemOrder: 0,
        rawJson: JSON.stringify({
          id: "notice_conflict_1",
          name: "設備改修 PAS",
          createdAt: "2026-05-19T00:00:00.000Z",
          payload: {
            noticeIntroText: "追加入力",
          },
        }),
      },
    },
  });
  assert.equal(second.status, 200);
  const result = await second.json();
  assert.equal(result.resolvedConflict, true);
  const merged = JSON.parse(result.payload.rawJson);
  assert.equal(merged.payload.noticeHeadline, "初回見出し");
  assert.equal(merged.payload.noticeIntroText, "追加入力");
});

test("related party template conflicts preserve existing company and incoming edits", async () => {
  const first = await apiFetch("/api/manual-editor/template-items/sekou-tool-template-parties-v1/party_conflict_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        itemName: "管理体制テンプレ",
        itemScope: "",
        itemCategory: "relatedParties",
        itemOrder: 0,
        rawJson: JSON.stringify({
          id: "party_conflict_1",
          name: "管理体制テンプレ",
          createdAt: "2026-05-20T00:00:00.000Z",
          payload: {
            management: {
              enabled: true,
              title: "管理会社",
              company: "管理会社A",
              person: "",
              office: "",
              tel: "",
            },
          },
        }),
      },
    },
  });
  assert.equal(first.status, 200);

  const second = await apiFetch("/api/manual-editor/template-items/sekou-tool-template-parties-v1/party_conflict_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        itemName: "管理体制テンプレ",
        itemScope: "",
        itemCategory: "relatedParties",
        itemOrder: 0,
        rawJson: JSON.stringify({
          id: "party_conflict_1",
          name: "管理体制テンプレ",
          createdAt: "2026-05-20T00:00:00.000Z",
          payload: {
            management: {
              enabled: true,
              title: "管理会社",
              company: "管理会社A",
              person: "担当者B",
              office: "東京支店",
              tel: "",
            },
          },
        }),
      },
    },
  });
  assert.equal(second.status, 200);
  const result = await second.json();
  assert.equal(result.resolvedConflict, true);
  const merged = JSON.parse(result.payload.rawJson);
  assert.equal(merged.payload.management.company, "管理会社A");
  assert.equal(merged.payload.management.person, "担当者B");
  assert.equal(merged.payload.management.office, "東京支店");
});
