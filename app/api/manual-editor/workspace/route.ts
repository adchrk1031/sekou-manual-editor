import { NextRequest, NextResponse } from "next/server.js";
import {
  readManualEditorState,
} from "../../../../lib/manualEditorStateStore";
import {
  isWorkspacePayload,
  readStructuredWorkspaceState,
  writeStructuredWorkspaceState,
} from "../../../../lib/manualEditorStructuredStore";
import { requireManualEditorUser } from "../../../../lib/manualEditorServerAuth";

const WORKSPACE_STATE_ID = "workspace_v1";

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    let stored = await readStructuredWorkspaceState();
    if (!stored.exists || !stored.payload) {
      const legacy = await readManualEditorState(WORKSPACE_STATE_ID, isWorkspacePayload);
      if (legacy.exists && legacy.payload) {
        await writeStructuredWorkspaceState(legacy.payload, null);
        stored = await readStructuredWorkspaceState();
      }
    }
    if (!stored.exists || !stored.payload) {
      return NextResponse.json({
        ok: true,
        exists: false,
        payload: null,
        updatedAt: null,
      });
    }
    return NextResponse.json({
      ok: true,
      exists: true,
      payload: stored.payload,
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_stored_payload") {
      return NextResponse.json({
        ok: false,
        exists: true,
        error: "invalid_stored_payload",
      }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "failed_to_load_workspace" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: { payload?: unknown; baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as { payload?: unknown; baseUpdatedAt?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!isWorkspacePayload(body.payload)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const result = await writeStructuredWorkspaceState(
      body.payload,
      normalizeTimestamp(body.baseUpdatedAt),
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "conflict",
          exists: true,
          payload: result.payload,
          updatedAt: result.updatedAt,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_stored_payload") {
      return NextResponse.json({ ok: false, error: "invalid_stored_payload" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "failed_to_save_workspace" }, { status: 500 });
  }
}
