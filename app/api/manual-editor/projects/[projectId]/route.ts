import { NextRequest, NextResponse } from "next/server.js";
import { requireManualEditorUser } from "../../../../../lib/manualEditorServerAuth";
import {
  deleteStructuredProjectItem,
  readStructuredProjectItem,
  writeStructuredProjectItem,
} from "../../../../../lib/manualEditorStructuredStore";

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeProjectId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return NextResponse.json({ ok: false, error: "invalid_project_id" }, { status: 400 });
  }

  const stored = await readStructuredProjectItem(normalizedProjectId);
  if (!stored.exists || !stored.payload) {
    return NextResponse.json({ ok: true, exists: false, payload: null, updatedAt: null });
  }

  return NextResponse.json({
    ok: true,
    exists: true,
    payload: stored.payload,
    updatedAt: stored.updatedAt,
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return NextResponse.json({ ok: false, error: "invalid_project_id" }, { status: 400 });
  }

  let body: {
    payload?: { sortOrder?: unknown; rawProject?: unknown };
    baseUpdatedAt?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const sortOrder = Number(body.payload?.sortOrder);
  const rawProject = typeof body.payload?.rawProject === "string" ? body.payload.rawProject : "";
  if (!Number.isFinite(sortOrder) || !rawProject) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const result = await writeStructuredProjectItem(
    {
      projectId: normalizedProjectId,
      sortOrder,
      rawProject,
    },
    normalizeTimestamp(body.baseUpdatedAt),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "conflict",
        payload: result.payload,
        updatedAt: result.updatedAt,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    payload: result.payload,
    updatedAt: result.updatedAt,
    resolvedConflict: result.resolvedConflict,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return NextResponse.json({ ok: false, error: "invalid_project_id" }, { status: 400 });
  }

  let body: { baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // body is optional for delete
  }

  const result = await deleteStructuredProjectItem(
    normalizedProjectId,
    normalizeTimestamp(body.baseUpdatedAt),
  );

  return NextResponse.json({
    ok: true,
    updatedAt: result.updatedAt,
    resolvedConflict: result.resolvedConflict,
  });
}
