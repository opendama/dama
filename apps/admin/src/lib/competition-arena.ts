import type { ClientEnums } from "@/types/platform";

export function hostedEventArenaFormatId(
  enums?: Pick<ClientEnums, "hosted_event_arena_format"> | null,
): string {
  return (enums?.hosted_event_arena_format || "").trim();
}

export function tournamentFormatIsArena(
  formatId: string,
  enums?: Pick<ClientEnums, "hosted_event_arena_format"> | null,
): boolean {
  const fid = (formatId || "").trim();
  if (!fid) return false;
  return fid === hostedEventArenaFormatId(enums);
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
