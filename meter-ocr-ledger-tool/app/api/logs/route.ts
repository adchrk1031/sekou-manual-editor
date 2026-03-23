import { readAuditLogs } from "@/lib/storage/fs-store";
import { ok } from "@/lib/http";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "200");
  const logs = await readAuditLogs(Number.isFinite(limit) ? limit : 200);
  return ok({ logs });
}
