import { tournamentFormatIsArena as formatIsArena } from "@/lib/competition-arena";
import type { EventsCatalog, HostedEvent } from "@/types/events";
import type { ClientEnums } from "@/types/platform";

export { tournamentFormatIsArena, hostedEventArenaFormatId } from "@/lib/competition-arena";

export function eventCupStarted(ev: HostedEvent | null | undefined): boolean {
  return Boolean((ev?.started_at || "").trim());
}

export function eventCupFinished(ev: HostedEvent | null | undefined): boolean {
  return Boolean((ev?.finished_at || "").trim());
}

/** True for round-robin, Swiss, and groups formats (not pure knockout). */
export function eventFormatUsesStandingsTable(
  formatId: string,
  catalog: EventsCatalog | null | undefined,
  enums?: Pick<ClientEnums, "hosted_event_arena_format"> | null,
): boolean {
  const fid = (formatId || "").trim();
  if (!fid || !catalog) return false;
  if (formatIsArena(fid, enums, catalog)) return true;
  const ko = (catalog.hosted_event_knockout_format || "").trim();
  if (ko !== "" && fid === ko) return false;
  const rr = (catalog.hosted_event_round_robin_format || "").trim();
  const sw = (catalog.hosted_event_swiss_format || "").trim();
  const gk = (catalog.hosted_event_groups_knockout_format || "").trim();
  return fid === rr || fid === sw || fid === gk;
}

/** Open event lobby when seated, started, or finished (never enroll into results). */
export function shouldOpenEventCupLobby(
  ev: HostedEvent | null | undefined,
  joined: boolean,
): boolean {
  // Seated seat must open lobby even while detail is still loading (paginated joined miss).
  if (joined) return true;
  if (!ev) return false;
  return eventCupStarted(ev) || eventCupFinished(ev);
}

export type CheckInWindowState = "open" | "not_open" | "closed" | "none";

export function eventCheckInWindowState(
  ev: HostedEvent | null | undefined,
  nowMs = Date.now(),
): CheckInWindowState {
  if (!ev) return "none";
  const opens = (ev.check_in_opens_at || "").trim();
  const closes = (ev.check_in_closes_at || "").trim();
  if (!opens && !closes) return "open";
  const now = nowMs;
  if (opens) {
    const o = Date.parse(opens);
    if (Number.isFinite(o) && now < o) return "not_open";
  }
  if (closes) {
    const c = Date.parse(closes);
    if (Number.isFinite(c) && now > c) return "closed";
  }
  return "open";
}
