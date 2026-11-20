import { isApiClientError } from "@/lib/api-client-error";
import { toast } from "sonner";

/** Fail-closed: user-facing toasts use DB chrome only (never Error.message / transport invent). */
export function apiToastMessage(_err: unknown, chromeFallback: string): string {
  return (chromeFallback || "").trim();
}

/**
 * Resolve toast from REST error_key → official_pause_chrome, else fallback chrome string.
 * Covers mig 504/505 keys (err_otp, err_invalid_body) without inventing copy.
 */
export function officialPauseChromeApiToast(
  err: unknown,
  chrome: Record<string, unknown> | null | undefined,
  fallbackChrome: string,
): string {
  if (chrome && isApiClientError(err)) {
    let key = (err.errorKey || "").trim();
    // OTP middleware uses otp_chrome keys; map onto official_pause err_otp copy.
    if (
      key === "err_verification_required" ||
      key === "err_verification_unavailable" ||
      key === "err_unauthorized"
    ) {
      key = "err_otp";
    }
    if (key) {
      const keyed = chrome[key];
      if (typeof keyed === "string" && keyed.trim()) return keyed.trim();
    }
  }
  return apiToastMessage(err, fallbackChrome);
}

/**
 * Resolve toast from API error_key → payments chrome, else fallback chrome string.
 * Never invents copy; empty when chrome missing.
 */
export function paymentsChromeApiToast(
  err: unknown,
  payments: Record<string, unknown> | null | undefined,
  fallbackChrome: string,
): string {
  if (payments && isApiClientError(err)) {
    const key = (err.errorKey || "").trim();
    if (key) {
      const keyed = payments[key];
      if (typeof keyed === "string" && keyed.trim()) return keyed.trim();
    }
  }
  return apiToastMessage(err, fallbackChrome);
}

/**
 * Resolve toast from REST error_key → tournament chrome, else fallback.
 * Also matches GraphQL error.message when it equals a known chrome err string
 * (GraphQL create returns chrome copy as message without error_key).
 */
export function tournamentChromeApiToast(
  err: unknown,
  chrome: Record<string, unknown> | null | undefined,
  fallbackChrome: string,
  preferKeys: string[] = [],
): string {
  if (chrome && isApiClientError(err)) {
    const key = (err.errorKey || "").trim();
    if (key) {
      // preferKeys (e.g. not_enough_players): server `error` is DB chrome at request time.
      // Prefer it over a possibly stale client chrome cache.
      if (preferKeys.includes(key)) {
        const api = (err.apiError || "").trim();
        if (api) return api;
      }
      const keyed = chrome[key];
      if (typeof keyed === "string" && keyed.trim()) return keyed.trim();
    }
  }
  if (chrome && err instanceof Error) {
    const msg = (err.message || "").trim();
    if (msg) {
      for (const key of preferKeys) {
        const keyed = chrome[key];
        if (typeof keyed === "string" && keyed.trim() && msg.includes(keyed.trim())) {
          return keyed.trim();
        }
      }
    }
  }
  return apiToastMessage(err, fallbackChrome);
}

/**
 * Resolve toast from REST error_key → events_admin_chrome, else fallback.
 * PreferKeys cover Unlimited Arena-only and catalog validation keys.
 */
export function eventsAdminChromeApiToast(
  err: unknown,
  chrome: Record<string, unknown> | null | undefined,
  fallbackChrome: string,
  preferKeys: string[] = ["err_unlimited_arena_only", "err_catalog_invalid"],
): string {
  return tournamentChromeApiToast(err, chrome, fallbackChrome, preferKeys);
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
 * Refuses JSON envelopes and empty copy. Stable id dedupes double-fires.
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
