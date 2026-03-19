import { compressToUTF16, decompressFromUTF16 } from "lz-string";

const STORAGE_COMPRESSION_PREFIX = "lz:";
const STORAGE_COMPRESSION_THRESHOLD = 4 * 1024;

function encodeStoragePayload(rawJson: string): string {
  if (rawJson.length < STORAGE_COMPRESSION_THRESHOLD) {
    return rawJson;
  }
  try {
    const compressed = compressToUTF16(rawJson);
    if (!compressed) {
      return rawJson;
    }
    const wrapped = `${STORAGE_COMPRESSION_PREFIX}${compressed}`;
    return wrapped.length < rawJson.length ? wrapped : rawJson;
  } catch {
    return rawJson;
  }
}

function decodeStoragePayload(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  if (!raw.startsWith(STORAGE_COMPRESSION_PREFIX)) {
    return raw;
  }
  const encoded = raw.slice(STORAGE_COMPRESSION_PREFIX.length);
  try {
    const decoded = decompressFromUTF16(encoded);
    return decoded ?? null;
  } catch {
    return null;
  }
}

export function stringifyForStorage(value: unknown): string {
  return encodeStoragePayload(JSON.stringify(value));
}

export function parseStorageJson<T>(raw: string | null): T | null {
  const payload = decodeStoragePayload(raw);
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
