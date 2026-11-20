import type { EventsCatalog } from "@/types/events";
import type { ClientEnums } from "@/types/platform";

/** Resolve arena format id from platform enums / catalog only (fail-closed empty). */
export function hostedEventArenaFormatId(
  enums?: Pick<ClientEnums, "hosted_event_arena_format"> | null,
  catalog?: Pick<EventsCatalog, "hosted_event_arena_format"> | null,
): string {
  const fromEnums = (enums?.hosted_event_arena_format || "").trim();
  if (fromEnums) return fromEnums;
  return (catalog?.hosted_event_arena_format || "").trim();
}

export function tournamentFormatIsArena(
  formatId: string,
  enums?: Pick<ClientEnums, "hosted_event_arena_format"> | null,
  catalog?: Pick<EventsCatalog, "hosted_event_arena_format"> | null,
): boolean {
  const fid = (formatId || "").trim();
  if (!fid) return false;
  const arenaId = hostedEventArenaFormatId(enums, catalog);
  return fid === arenaId;
}

export function tournamentFormatUsesStandingsOrArenaTable(
  formatId: string,
  catalog: EventsCatalog | null | undefined,
  enums?: Pick<ClientEnums, "hosted_event_arena_format"> | null,
): boolean {
  if (tournamentFormatIsArena(formatId, enums, catalog)) return true;
  const fid = (formatId || "").trim();
  if (!fid || !catalog) return false;
  const ko = (catalog.hosted_event_knockout_format || "").trim();
  if (ko !== "" && fid === ko) return false;
  const rr = (catalog.hosted_event_round_robin_format || "").trim();
  const sw = (catalog.hosted_event_swiss_format || "").trim();
  const gk = (catalog.hosted_event_groups_knockout_format || "").trim();
  return fid === rr || fid === sw || fid === gk;
}

export function parseDefaultArenaDurationMinutes(
  enums?: Pick<ClientEnums, "competition_arena_default_duration_minutes"> | null,
): number | null {
  const n = Number.parseInt(
    String(enums?.competition_arena_default_duration_minutes || "").trim(),
    10,
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function arenaRemainingMs(
  arenaEndsAt: string | null | undefined,
  nowMs = Date.now(),
): number {
  const raw = (arenaEndsAt || "").trim();
  if (!raw) return 0;
  const end = Date.parse(raw);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - nowMs);
}

export function arenaClockActive(
  arenaEndsAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  return arenaRemainingMs(arenaEndsAt, nowMs) > 0;
}
