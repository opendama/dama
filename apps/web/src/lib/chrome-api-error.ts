/**
 * Extract a plain API `error` string without ever exposing JSON envelopes
 * like `{"error":"..."}` to toasts or field copy.
 */
export function extractApiErrorMessage(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return "";
    if (t.startsWith("{") && t.includes("error")) {
      try {
        const parsed = JSON.parse(t) as { error?: unknown };
        if (typeof parsed.error === "string") return parsed.error.trim();
      } catch {
        /* keep trimmed string below */
      }
    }
    return t;
  }
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    const e = (raw as { error?: unknown }).error;
    if (typeof e === "string") return e.trim();
  }
  return "";
}

/** True when the server/chrome incomplete KYC copy (current or legacy) was returned. */
export function isDocKycIncompleteError(errBody: string, chromeIncomplete: string): boolean {
  const body = extractApiErrorMessage(errBody).trim();
  if (!body) return false;
  const incomplete = (chromeIncomplete || "").trim();
  if (incomplete && body === incomplete) return true;
  const lower = body.toLowerCase();
  return (
    lower === "complete identity documents before submitting" ||
    lower === "complete all required identity fields before submitting." ||
    lower.includes("complete all required identity") ||
    lower.includes("complete identity documents")
  );
}
