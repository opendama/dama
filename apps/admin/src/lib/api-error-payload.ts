/** Normalize REST error bodies (object or JSON string) → error + error_key. */

export type ApiErrorPayload = {
  error: string;
  errorKey: string;
};

export function normalizeApiErrorPayload(data: unknown): ApiErrorPayload {
  if (data == null) return { error: "", errorKey: "" };
  if (typeof data === "string") {
    const t = data.trim();
    if (!t) return { error: "", errorKey: "" };
    if (t.startsWith("{")) {
      try {
        return normalizeApiErrorPayload(JSON.parse(t) as unknown);
      } catch {
        return { error: "", errorKey: "" };
      }
    }
    return { error: "", errorKey: "" };
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const error = typeof o.error === "string" ? o.error.trim() : "";
    const errorKey = typeof o.error_key === "string" ? o.error_key.trim() : "";
    return { error, errorKey };
  }
  return { error: "", errorKey: "" };
}
