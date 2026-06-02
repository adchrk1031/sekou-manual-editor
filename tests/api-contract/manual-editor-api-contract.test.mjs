import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import test, { after, before } from "node:test";

const repoRoot = process.cwd();
const port = 3210;
const baseUrl = `http://127.0.0.1:${port}`;
const dbDir = path.join(repoRoot, ".tmp-tests");
const dbPath = path.join(dbDir, "manual-editor-api-contract-runtime.db");

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
      // keep polling until ready
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
      name: "API Tester",
      email: "api.tester@example.com",
      password: "testpass123",
    },
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "initial registration should return a session cookie");
  return cookie.split(";")[0];
}

before(async () => {
  await startServer();
  sessionCookie = await createInitialAdminSession();
});

after(async () => {
  await stopServer();
});

test("manual editor APIs reject unauthorized item access", async () => {
  const response = await apiFetch("/api/manual-editor/projects/PJ-UNAUTH");
  assert.equal(response.status, 401);
});

test("manual editor item APIs persist CSV, project, template, audit and revision payloads", async () => {
  const csvHeaderResponse = await apiFetch("/api/manual-editor/csv/headers", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        headers: ["project_id", "property_name", "note_special"],
      },
    },
  });
  assert.equal(csvHeaderResponse.status, 200);

  const csvRowPayload = {
    project_id: "PJ-001",
    property_name: "テストマンション",
    note_special: "CSV行保存",
  };
  const csvRowResponse = await apiFetch("/api/manual-editor/csv/rows/row_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        rowOrder: 0,
        rawJson: JSON.stringify(csvRowPayload),
      },
    },
  });
  assert.equal(csvRowResponse.status, 200);
  const csvRowResult = await csvRowResponse.json();
  assert.equal(csvRowResult.ok, true);

  const projectResponse = await apiFetch("/api/manual-editor/projects/PJ-001", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        sortOrder: 0,
        rawProject: JSON.stringify({
          projectId: "PJ-001",
          propertyName: "テストマンション",
          workDateStart: "2026-05-19",
          workDateEnd: "2026-05-19",
          approvalStatus: "draft",
        }),
      },
    },
  });
  assert.equal(projectResponse.status, 200);

  const templateResponse = await apiFetch("/api/manual-editor/template-items/sekou-tool-template-notice-v1/notice_tpl_api_1", {
    method: "PUT",
    cookie: sessionCookie,
    body: {
      payload: {
        itemName: "設備改修 UGS",
        itemScope: "",
        itemCategory: "notice",
        itemOrder: 0,
        rawJson: JSON.stringify({
          id: "notice_tpl_api_1",
          name: "設備改修 UGS",
          createdAt: "2026-05-19T01:00:00.000Z",
          payload: {
            noticeTemplateId: "equipment_ugs",
            noticeSenderCompany: "レジル株式会社",
            noticeHeadline: "UGS更新工事のお知らせ",
            noticeIntroText: "テスト導入文",
            noticeMainWorkDate: "2026-05-20",
            noticeOutageDate: "2026-05-20",
            noticeOutageTimeStart: "09:00",
            noticeOutageTimeEnd: "11:00",
            noticeUnitInspectionEnabled: false,
            noticeScheduleRows: [],
            noticePrivateAreaText: "",
            noticeCommonAreaText: "",
            noticeCompensationText: "",
            noticeContactCompany: "",
            noticeContactDepartment: "",
            noticeContactAddress: "",
            noticeContactTel: "",
            noticeContactHours: "",
            noticeAdviceItems: [],
          },
        }),
      },
    },
  });
  assert.equal(templateResponse.status, 200);

  const auditResponse = await apiFetch("/api/manual-editor/audit-logs", {
    method: "POST",
    cookie: sessionCookie,
    body: {
      payload: {
        rawJson: JSON.stringify({
          id: "audit_api_1",
          projectId: "PJ-001",
          at: "2026-05-19T02:00:00.000Z",
          userId: "api-test-user",
          userName: "API Tester",
          action: "csv_apply",
          detail: "API contract test",
        }),
      },
    },
  });
  assert.equal(auditResponse.status, 200);

  const revisionResponse = await apiFetch("/api/manual-editor/revisions", {
    method: "POST",
    cookie: sessionCookie,
    body: {
      payload: {
        rawJson: JSON.stringify({
          id: "revision_api_1",
          projectId: "PJ-001",
          at: "2026-05-19T03:00:00.000Z",
          userId: "api-test-user",
          userName: "API Tester",
          label: "API保存",
          snapshot: {
            projectPresetId: "pas",
            propertyName: "テストマンション",
            propertyAddress: "",
            titleSubject: "件名",
            workDateStart: "2026-05-19",
            workDateEnd: "2026-05-19",
            outageDateStart: "2026-05-19",
            outageDateEnd: "2026-05-19",
            outageTimeStart: "09:00",
            outageTimeEnd: "10:00",
            outageEnabled: true,
            selectedWorkCodes: ["PAS"],
            noteSpecial: "",
            noteApprovalExtra: "",
            approvalRequestItems: [],
            coverRecipientSuffix: "管理組合御中",
            pdfTemplateId: "standard",
            pdfCompanyName: "レジル株式会社",
            pdfTeam: "",
            pdfContactPerson: "",
            pdfAddress: "",
            pdfEmail: "",
            pdfTel: "",
            pdfFax: "",
            pdfExportCount: 0,
            pdfLastExportedAt: "",
            noticeTemplateId: "rezil_basic",
            noticePropertyName: "",
            noticeRecipientName: "",
            noticeSenderCompany: "",
            noticeHeadline: "",
            noticeIntroText: "",
            noticeMainWorkDate: "",
            noticeOutageDate: "",
            noticeOutageTimeStart: "",
            noticeOutageTimeEnd: "",
            noticeUnitInspectionEnabled: false,
            noticeScheduleRows: [],
            noticePrivateAreaText: "",
            noticeCommonAreaText: "",
            noticeCompensationText: "",
            noticeContactCompany: "",
            noticeContactDepartment: "",
            noticeContactAddress: "",
            noticeContactTel: "",
            noticeContactHours: "",
            noticeAdviceItems: [],
            layoutAnnotations: [],
            layoutAnnotationsV2: [],
            scheduleRows: [],
            relatedParties: {
              owner: { enabled: false, title: "", company: "", person: "", office: "", tel: "" },
              utility: { enabled: false, title: "", company: "", person: "", office: "", tel: "" },
              contractor: { enabled: false, title: "", company: "", person: "", office: "", tel: "" },
              management: { enabled: false, title: "", company: "", person: "", office: "", tel: "" },
              residents: { enabled: false, title: "", company: "", person: "", office: "", tel: "" },
            },
          },
        }),
      },
    },
  });
  assert.equal(revisionResponse.status, 200);

  const workspaceResponse = await apiFetch("/api/manual-editor/workspace", {
    cookie: sessionCookie,
  });
  assert.equal(workspaceResponse.status, 200);
  const workspace = await workspaceResponse.json();
  assert.deepEqual(workspace.payload.projectIndex, ["PJ-001"]);

  const configResponse = await apiFetch("/api/manual-editor/config", {
    cookie: sessionCookie,
  });
  assert.equal(configResponse.status, 200);
  const config = await configResponse.json();
  const auditItems = JSON.parse(config.payload.items["sekou-tool-audit-v1"]);
  const revisionItems = JSON.parse(config.payload.items["sekou-tool-revision-v1"]);
  const noticeTemplates = JSON.parse(config.payload.items["sekou-tool-template-notice-v1"]);
  assert.equal(auditItems[0].id, "audit_api_1");
  assert.equal(revisionItems[0].id, "revision_api_1");
  assert.equal(noticeTemplates[0].id, "notice_tpl_api_1");
});
