import { appendAuditLog, getActiveRunId, getRun, saveRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { settingsSchema } from "@/lib/validation/schemas";
import { createAuditLog, updateRunSettings } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";

export async function GET(): Promise<Response> {
  const runId = await getActiveRunId();
  if (!runId) {
    return ok({ runId: null, settings: null });
  }
  const run = await getRun(runId);
  if (!run) {
    return fail("runが見つかりません", 404);
  }
  return ok({ runId, settings: run.settings });
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const runId = (body.runId as string | undefined) ?? (await getActiveRunId());

    if (!runId) {
      return fail("runId が見つかりません", 400);
    }

    const run = await getRun(runId);
    if (!run) {
      return fail("run が見つかりません", 404);
    }

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return fail("設定値が不正です", 400, parsed.error.flatten());
    }

    updateRunSettings(run, parsed.data);
    await saveRun(run);

    await appendAuditLog(
      createAuditLog({
        runId,
        userId,
        action: "SETTINGS_UPDATE",
        payload: parsed.data
      })
    );

    return ok({ runId, settings: run.settings });
  } catch (error) {
    return fail("設定更新に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
