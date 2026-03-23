export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, message, details }, { status });
}
