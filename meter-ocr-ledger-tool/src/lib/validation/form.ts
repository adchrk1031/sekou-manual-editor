export function parseBoolean(value: FormDataEntryValue | null, fallback = false): boolean {
  if (value === null) {
    return fallback;
  }
  const text = String(value).toLowerCase();
  return text === "true" || text === "1" || text === "on" || text === "yes";
}

export function parseUserId(request: Request): string {
  const headerUser = request.headers.get("x-user-id");
  return headerUser && headerUser.trim() ? headerUser.trim() : "local-user";
}
