import { ApiClientError, isApiClientError } from "@/lib/api-client-error";
import {
  softCommunityJoinStatusMessage,
  softCommunityLoadFailed,
} from "@/lib/community-player-chrome-soft";

function chromeOnly(raw: string | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "";
  // Never surface transport / API JSON blobs as toast copy.
  if (s.startsWith("{") || s.startsWith("[")) return "";
  return s;
}

type JoinChrome = {
  already_joined?: string;
  event_full?: string;
  event_not_joinable?: string;
  insufficient_entry_fee?: string;
  load_failed?: string;
  approved_blurb?: string;
};

function errMessage(err: unknown): string {
  // Prefer empty for interceptor ApiClientError (key-only); chrome maps via errorKey.
  if (isApiClientError(err)) return (err.message || "").trim();
  if (err instanceof Error) return (err.message || "").trim();
  return "";
}

function errKey(err: unknown): string {
  return isApiClientError(err) ? (err.errorKey || "").trim() : "";
}

function errStatus(err: unknown): number | undefined {
  if (isApiClientError(err)) return err.status;
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: number }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

/** True when the player already holds a seat (re-join conflict). */
export function isAlreadyJoinedEventError(err: unknown): boolean {
  const msg = errMessage(err).toLowerCase();
  const key = errKey(err);
  const status = errStatus(err);
  return (
    key === "already_joined" ||
    msg.includes("already joined") ||
    (status === 409 && (key === "already_joined" || key === ""))
  );
}

/**
 * Map join failure to events_player_chrome (tournaments enroll parity).
 * Prefer error_key → DB chrome; never toast raw JSON.
 */
export function eventJoinErrorChrome(err: unknown, chrome: JoinChrome): string {
  const status = errStatus(err);
  const apiMsg = chromeOnly(errMessage(err));
  const lower = apiMsg.toLowerCase();
  const key = errKey(err);

  if (
    key === "already_joined" ||
    lower.includes("already joined") ||
    (status === 409 && (key === "already_joined" || lower.includes("already")))
  ) {
    return (
      softCommunityJoinStatusMessage(chromeOnly(chrome.already_joined)) ||
      softCommunityJoinStatusMessage(apiMsg)
    );
  }
  if (key === "event_full" || lower.includes("full")) {
    return (
      softCommunityJoinStatusMessage(chromeOnly(chrome.event_full)) ||
      softCommunityJoinStatusMessage(apiMsg)
    );
  }
  if (key === "event_not_joinable" || lower.includes("not joinable")) {
    return (
      softCommunityJoinStatusMessage(chromeOnly(chrome.event_not_joinable)) ||
      softCommunityJoinStatusMessage(apiMsg)
    );
  }
  if (status === 402 || key === "insufficient_entry_fee") {
    return (
      softCommunityJoinStatusMessage(chromeOnly(chrome.insufficient_entry_fee)) ||
      softCommunityJoinStatusMessage(apiMsg)
    );
  }
  // Legacy / unmapped API text - scrub Event-sport before surfacing.
  if (apiMsg) {
    const scrubbed = softCommunityJoinStatusMessage(apiMsg);
    return scrubbed || softCommunityLoadFailed(chromeOnly(chrome.load_failed));
  }
  return softCommunityLoadFailed(chromeOnly(chrome.load_failed));
}

/** Normalize join failures from raw fetch into ApiClientError (same shape as Axios). */
export function joinHostedEventClientError(
  status: number,
  body: { error?: string; error_key?: string },
): ApiClientError {
  const errorKey = (body.error_key || "").trim() || undefined;
  // Key-only when possible; keep chrome-only body.error for legacy maps.
  const msg = errorKey ? "" : chromeOnly(body.error) || "";
  return new ApiClientError(msg, { status, errorKey });
}
