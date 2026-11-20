import { tournamentFormatIsArena as formatIsArena } from "@/lib/competition-arena";
import type { EventsCatalog } from "@/types/events";
import type { ClientEnums } from "@/types/platform";
import type { Tournament } from "@/types/tournament";

export { tournamentFormatIsArena, hostedEventArenaFormatId } from "@/lib/competition-arena";

/** Survives navigate from /tournaments enroll → /?view=tournaments&id= (HomePlayHub). */
const ENROLLED_TOURNAMENT_LATCH_KEY = "dama_enrolled_tournament_id";

export function latchEnrolledTournamentId(tournamentId: string | null | undefined): void {
  const id = (tournamentId || "").trim();
  if (!id || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ENROLLED_TOURNAMENT_LATCH_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function takeEnrolledTournamentLatch(): string {
  if (typeof window === "undefined") return "";
  try {
    const id = (sessionStorage.getItem(ENROLLED_TOURNAMENT_LATCH_KEY) || "").trim();
    if (id) sessionStorage.removeItem(ENROLLED_TOURNAMENT_LATCH_KEY);
    return id;
  } catch {
    return "";
  }
}

export function tournamentCupStarted(t: Tournament | null | undefined): boolean {
  return Boolean((t?.started_at || "").trim());
}

export function tournamentCupFinished(t: Tournament | null | undefined): boolean {
  return Boolean((t?.finished_at || "").trim());
}

/** Open cup lobby when seated, started, or finished (never enroll into results). */
export function shouldOpenTournamentCupLobby(
  t: Tournament | null | undefined,
  enrolled: boolean,
): boolean {
  if (!t) return false;
  return enrolled || tournamentCupStarted(t) || tournamentCupFinished(t);
}

export type CheckInWindowState = "open" | "not_open" | "closed" | "none";

/** True for round-robin, Swiss, and groups formats (not pure knockout). */
export function tournamentFormatUsesStandingsTable(
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

export function checkInWindowState(
  t: Tournament | null | undefined,
  nowMs = Date.now(),
): CheckInWindowState {
  if (!t) return "none";
  const opens = (t.check_in_opens_at || "").trim();
  const closes = (t.check_in_closes_at || "").trim();
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
