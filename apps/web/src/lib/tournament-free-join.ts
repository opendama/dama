import { isApiClientError } from "@/lib/api-client-error";
import { softCommunityJoinStatusMessage } from "@/lib/community-player-chrome-soft";

function chromeOnly(raw: string | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "";
  // Never surface transport / API JSON blobs as toast copy.
  if (s.startsWith("{") || s.startsWith("[")) return "";
  return s;
}

/** Map enroll failure to payment-modal chrome (never toast API / transport JSON). */
export function tournamentEnrollErrorChrome(
  err: unknown,
  chrome: { already_enrolled?: string; enroll_failed?: string },
): string {
  const status = isApiClientError(err) ? err.status : undefined;
  const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
  const msg = isApiClientError(err) ? (err.message || "").trim().toLowerCase() : "";
  const already = status === 409 || key === "already_enrolled" || msg.includes("already enrolled");
  if (already) {
    return (
      softCommunityJoinStatusMessage(chromeOnly(chrome.already_enrolled)) ||
      softCommunityJoinStatusMessage(chromeOnly(chrome.enroll_failed)) ||
      ""
    );
  }
  return softCommunityJoinStatusMessage(chromeOnly(chrome.enroll_failed));
}

export function isAlreadyEnrolledError(err: unknown): boolean {
  if (!isApiClientError(err)) return false;
  const key = (err.errorKey || "").trim();
  const msg = (err.message || "").trim().toLowerCase();
  return err.status === 409 || key === "already_enrolled" || msg.includes("already enrolled");
}

/** Casual play shell (board / matchmaking). Not the cup lobby. */
export function casualPlayHref(): string {
  return "/";
}

/**
 * After tournament enroll / seated Join: open cup lobby (DB notif parity).
 * Fail closed: without id, stay on tournaments browse (never invent a fake cup).
 */
export function tournamentLobbyHref(tournamentId?: string | null): string {
  const id = (tournamentId || "").trim();
  if (!id) return "/?view=tournaments";
  return `/?view=tournaments&id=${encodeURIComponent(id)}`;
}

/**
 * After community tournament join / seated Join: open lobby under unified Tournaments.
 * Fail closed: without id, stay on Community browse.
 */
export function eventLobbyHref(eventId?: string | null): string {
  const id = (eventId || "").trim();
  if (!id) return "/?view=tournaments&source=community";
  return `/?view=tournaments&source=community&id=${encodeURIComponent(id)}`;
}

/** @deprecated Prefer tournamentLobbyHref(id). Kept for call-site migration. */
export function freeJoinPlayHref(tournamentId?: string | null): string {
  return tournamentLobbyHref(tournamentId);
}

/** @deprecated Prefer eventLobbyHref(id). Kept for call-site migration. */
export function eventJoinPlayHref(eventId?: string | null): string {
  return eventLobbyHref(eventId);
}
