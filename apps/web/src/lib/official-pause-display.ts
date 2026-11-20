import type { GamePayload } from "@/types/game";
import type { OfficialPauseChrome } from "@/types/official-pause-chrome";
import type { PlayChrome } from "@/types/play-chrome";

export function isOfficialPause(game: GamePayload | null | undefined): boolean {
  return Boolean(game?.paused) && (game?.pause_kind || "").trim() === "official";
}

export function isPlayerPause(game: GamePayload | null | undefined): boolean {
  if (!game?.paused) return false;
  const kind = (game.pause_kind || "").trim();
  return kind === "" || kind === "player";
}

/** Live-board status badge from official-pause-chrome (fail closed when chrome incomplete). */
export function livePauseStatusLabel(
  game: GamePayload | null | undefined,
  chrome: OfficialPauseChrome | null | undefined,
): string {
  if (!chrome) return "";
  if (isOfficialPause(game)) return (chrome.status_official_pause || "").trim();
  if (isPlayerPause(game)) return (chrome.status_player_pause || "").trim();
  if (game && !game.paused && game.outcome == null && !game.draw) {
    return (chrome.status_live || "").trim();
  }
  if (game && (game.outcome != null || game.draw)) {
    return (chrome.status_finished || "").trim();
  }
  return "";
}

type RoleChrome = Pick<
  OfficialPauseChrome,
  | "role_admin_label"
  | "role_organizer_label"
  | "role_player_label"
  | "banner_since_fmt"
  | "banner_resumed_fmt"
>;

/** Map payload pause_actor_role onto official-pause-chrome role labels. */
export function officialPauseRoleLabel(
  role: string | null | undefined,
  chrome: RoleChrome | null | undefined,
): string {
  const r = (role || "").trim().toLowerCase();
  if (r === "admin") return (chrome?.role_admin_label || "").trim();
  if (r === "organizer") return (chrome?.role_organizer_label || "").trim();
  if (r === "player") return (chrome?.role_player_label || "").trim();
  return "";
}

export function applyOfficialPauseFmt(
  fmt: string | null | undefined,
  vars: { role?: string; name?: string; reason?: string; note?: string },
): string {
  let out = (fmt || "").trim();
  if (!out) return "";
  out = out.split("{role}").join((vars.role || "").trim());
  out = out.split("{name}").join((vars.name || "").trim());
  out = out.split("{reason}").join((vars.reason || "").trim());
  out = out.split("{note}").join((vars.note || "").trim());
  return out.trim();
}

type PlayOfficialSlice = Pick<
  PlayChrome,
  | "official_paused_blurb"
  | "official_paused_by_fmt"
  | "official_paused_reason_fmt"
  | "official_paused_note_fmt"
>;

/**
 * Lines for the persistent official-pause banner on the player board.
 * Empty when chrome or payload is incomplete (fail-closed).
 */
export function buildOfficialPausedBannerLines(
  game: GamePayload | null | undefined,
  playChrome: PlayOfficialSlice | null | undefined,
  roleChrome: RoleChrome | null | undefined,
): string[] {
  if (!isOfficialPause(game) || !playChrome) return [];
  const role = officialPauseRoleLabel(game?.pause_actor_role, roleChrome);
  const name = (game?.pause_actor_display_name || "").trim();
  const reason = (game?.pause_reason_label || "").trim();
  const note = (game?.pause_note || "").trim();
  const lines: string[] = [];
  const blurb = (playChrome.official_paused_blurb || "").trim();
  if (blurb) lines.push(blurb);
  // Fail closed: never show hollow "Paused by ·" (fmt needs both role and name).
  if (role && name) {
    const by = applyOfficialPauseFmt(playChrome.official_paused_by_fmt, { role, name });
    if (by) lines.push(by);
  }
  if (reason) {
    const reasonLine = applyOfficialPauseFmt(playChrome.official_paused_reason_fmt, { reason });
    if (reasonLine) lines.push(reasonLine);
  }
  if (note) {
    const noteLine = applyOfficialPauseFmt(playChrome.official_paused_note_fmt, { note });
    if (noteLine) lines.push(noteLine);
  }
  const sinceFmt = (roleChrome?.banner_since_fmt || "").trim();
  const sinceTime = formatPauseSinceTime(Number(game?.paused_at_unix_ms) || 0);
  if (sinceFmt && sinceTime) {
    const since = sinceFmt.split("{time}").join(sinceTime).trim();
    if (since) lines.push(since);
  }
  return lines;
}

export type PauseOverlayCopy = {
  statusLabel: string;
  /** Blur cover banner: official_paused_blurb or game_paused_blurb. */
  bannerLine: string;
  byLine: string;
  reasonLine: string;
  noteLine: string;
  sinceLine: string;
  footerLine: string;
  footerLineFmt: string;
  expiresAtUnixMs: number;
  ariaLabel: string;
};

/** Board-cover copy for player or official pause (DB chrome only). */
export function buildPauseOverlayCopy(
  game: GamePayload | null | undefined,
  playChrome: PlayChrome | null | undefined,
  roleChrome: RoleChrome | null | undefined,
): PauseOverlayCopy | null {
  if (!game?.paused || !playChrome) return null;
  const aria = (playChrome.pause_overlay_aria || "").trim();
  if (!aria) return null;
  const official = isOfficialPause(game);
  const statusLabel = official
    ? (playChrome.pause_kind_official || "").trim()
    : (playChrome.pause_kind_player || "").trim();
  if (!statusLabel) return null;
  // Player pause role comes from play_chrome so seat clients do not wait on ops chrome.
  const role = official
    ? officialPauseRoleLabel(game.pause_actor_role, roleChrome)
    : (playChrome.role_player_label || "").trim() ||
      officialPauseRoleLabel(game.pause_actor_role, roleChrome);
  const name = (game.pause_actor_display_name || "").trim();
  const byFmt = official ? playChrome.official_paused_by_fmt : playChrome.player_paused_by_fmt;
  // Fail closed: never show hollow "Paused by ·" (fmt needs both role and name).
  const byLine = role && name ? applyOfficialPauseFmt(byFmt, { role, name }) : "";
  const reason = (game.pause_reason_label || "").trim();
  const reasonLine =
    official && reason
      ? applyOfficialPauseFmt(playChrome.official_paused_reason_fmt, { reason })
      : "";
  const note = (game.pause_note || "").trim();
  const noteLine =
    official && note ? applyOfficialPauseFmt(playChrome.official_paused_note_fmt, { note }) : "";
  const sinceTime = formatPauseSinceTime(Number(game.paused_at_unix_ms) || 0);
  const sinceFmt = (roleChrome?.banner_since_fmt || "").trim();
  // Official only: player pause uses countdown footer, not wall-clock since.
  const sinceLine =
    official && sinceFmt && sinceTime ? sinceFmt.split("{time}").join(sinceTime).trim() : "";
  const bannerLine = official
    ? (playChrome.official_paused_blurb || "").trim()
    : (playChrome.game_paused_blurb || "").trim();
  if (official) {
    return {
      statusLabel,
      bannerLine,
      byLine,
      reasonLine,
      noteLine,
      sinceLine,
      footerLine: (playChrome.pause_overlay_until_resume || "").trim(),
      footerLineFmt: "",
      expiresAtUnixMs: 0,
      ariaLabel: aria,
    };
  }
  return {
    statusLabel,
    bannerLine,
    byLine,
    reasonLine: "",
    noteLine: "",
    sinceLine: "",
    footerLine: "",
    footerLineFmt: (playChrome.pause_remaining_fmt || "").trim(),
    expiresAtUnixMs: Number(game.pause_expires_at_unix_ms) || 0,
    ariaLabel: aria,
  };
}

export function officialPauseErrorLabel(
  chrome: OfficialPauseChrome | null | undefined,
  errorKey: string,
  kind: "pause" | "resume" | "meta",
): string {
  let key = (errorKey || "").trim();
  // OTP middleware uses otp_chrome keys; map onto official_pause err_otp copy.
  if (
    key === "err_verification_required" ||
    key === "err_verification_unavailable" ||
    key === "err_unauthorized"
  ) {
    key = "err_otp";
  }
  if (key && chrome) {
    const typed = chrome[key as keyof OfficialPauseChrome];
    if (typeof typed === "string" && typed.trim()) return typed.trim();
  }
  if (kind === "resume") return (chrome?.toast_resume_failed || "").trim();
  if (kind === "meta") return (chrome?.toast_meta_failed || "").trim();
  return (chrome?.toast_pause_failed || "").trim();
}

/** Local clock time for banner_since_fmt {time} (fail closed when ms invalid). */
export function formatPauseSinceTime(pausedAtUnixMs: number): string {
  if (!Number.isFinite(pausedAtUnixMs) || pausedAtUnixMs <= 0) return "";
  const d = new Date(pausedAtUnixMs);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Elapsed pause seconds as a plain number string (no invented units). */
export function formatPauseDurationSeconds(pausedAtUnixMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(pausedAtUnixMs) || pausedAtUnixMs <= 0) return "";
  if (!Number.isFinite(nowMs) || nowMs < pausedAtUnixMs) return "";
  return String(Math.floor((nowMs - pausedAtUnixMs) / 1000));
}
