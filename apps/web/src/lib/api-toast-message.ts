import { toast } from "sonner";

/** Fail-closed: user-facing toasts use DB chrome only (never Error.message / transport invent). */
export function apiToastMessage(_err: unknown, chromeFallback: string): string {
  return (chromeFallback || "").trim();
}

/** True when a string looks like a raw API JSON envelope (never show in toasts). */
export function isRawApiJsonEnvelope(msg: string): boolean {
  const t = (msg || "").trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  return (
    t.includes('"error"') ||
    t.includes("'error'") ||
    t.includes('"error_key"') ||
    t.includes("'error_key'")
  );
}

/**
 * Industry-standard toast: DB chrome string only.
 * Refuses JSON envelopes and empty copy. Stable id dedupes double-fires
 * (Strict Mode / overlapping mutation handlers) for the same action.
 */
export function chromeOnlyToastError(msg: string | null | undefined, opts?: { id?: string }): void {
  const t = (msg || "").trim();
  if (!t || isRawApiJsonEnvelope(t)) return;
  if (opts?.id) {
    toast.error(t, { id: opts.id });
    return;
  }
  toast.error(t);
}
