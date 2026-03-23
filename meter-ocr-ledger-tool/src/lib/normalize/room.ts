const ROOM_PATTERN = /(?:room|r)?\s*0*([1-9]\d{1,4})\s*(?:号室)?/i;

export function normalizeRoom(raw: string): string | null {
  const base = raw
    .toLowerCase()
    .replace(/[＿ー－\-]/g, "_")
    .replace(/\s+/g, "");
  const match = base.match(ROOM_PATTERN);
  if (!match) {
    return null;
  }
  const room = match[1];
  if (!room) {
    return null;
  }
  return String(Number(room));
}

export function normalizeMeterNo(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function toNumericReading(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  const normalized = String(raw).replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
