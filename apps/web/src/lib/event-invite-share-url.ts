import { playerTournamentDiscoveryHref } from "./competition-cup-source";

/**
 * Resolve a copyable event invite URL (organizer copy-link parity).
 * Fail closed: bare origin (e.g. http://localhost:3000/) is never returned.
 * Legacy `view=events` / `/events/public` / `/events/join` → Community tournaments
 * (one player word).
 */
export function resolveEventInviteShareUrl(opts: {
  shareUrl?: string | null;
  joinCode?: string | null;
  sharePathTemplate?: string | null;
  origin?: string | null;
}): string {
  const code = (opts.joinCode || "").trim().toUpperCase();
  if (!code) return "";

  const raw = (opts.shareUrl || "").trim();
  if (isValidInviteUrl(raw, code)) {
    return normalizeInviteDiscoveryUrl(raw, code);
  }

  const tpl = (opts.sharePathTemplate || "").trim();
  const origin = (opts.origin || "").trim().replace(/\/+$/, "");
  if (!origin || !tpl.includes("{code}")) return "";

  let path = tpl.split("{code}").join(code);
  if (!path.startsWith("/")) path = `/${path}`;
  if (path === "/" || !path.toUpperCase().includes(code)) return "";

  const built = `${origin}${path}`;
  if (!isValidInviteUrl(built, code)) return "";
  return normalizeInviteDiscoveryUrl(built, code);
}

/** Remap legacy Events browse invite paths → unified Tournaments Community. */
function normalizeInviteDiscoveryUrl(url: string, joinCodeUpper: string): string {
  const u = url.trim();
  try {
    const parsed = new URL(u);
    const remapped = playerTournamentDiscoveryHref(`${parsed.pathname}${parsed.search}`);
    if (!remapped.startsWith("/") || remapped.startsWith("//")) return u;
    const rel = new URL(remapped, "http://local.invalid");
    parsed.pathname = rel.pathname;
    parsed.search = rel.search;
    const out = parsed.toString();
    return isValidInviteUrl(out, joinCodeUpper) ? out : u;
  } catch {
    return u;
  }
}

function isValidInviteUrl(url: string, joinCodeUpper: string): boolean {
  const u = url.trim();
  if (!u) return false;
  // Bare origin must never be treated as an invite (opens home, not join).
  if (/^https?:\/\/[^/]+\/?$/i.test(u)) return false;
  return u.toUpperCase().includes(joinCodeUpper);
}
