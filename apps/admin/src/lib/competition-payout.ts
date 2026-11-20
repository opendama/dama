import type { ClientEnums } from "@/types/platform";

export function defaultPayoutModeForFormat(enums: ClientEnums, formatId: string): string {
  const id = (formatId || "").trim();
  const ko = (enums.hosted_event_knockout_format || "").trim();
  const rr = (enums.competition_default_payout_mode_round_robin || "").trim();
  if (id && id === ko) {
    return (enums.competition_default_payout_mode_knockout || "").trim();
  }
  if (id && id === (enums.hosted_event_round_robin_format || "").trim()) {
    return rr || (enums.competition_default_payout_mode_round_robin || "").trim();
  }
  const arena = (enums.hosted_event_arena_format || "").trim();
  if (id && arena && id === arena) {
    return (enums.competition_default_payout_mode_arena || "").trim();
  }
  const swiss = (enums.hosted_event_swiss_format || "").trim();
  if (id && swiss && id === swiss) {
    return (enums.competition_default_payout_mode_swiss || "").trim();
  }
  const gk = (enums.hosted_event_groups_knockout_format || "").trim();
  if (id && gk && id === gk) {
    return (enums.competition_default_payout_mode_groups_knockout || "").trim();
  }
  return (enums.competition_payout_mode_places_percent || "").trim();
}

export function payoutModeOptions(
  enums: ClientEnums,
  _formatId: string,
): { value: string; label: string }[] {
  const places = (enums.competition_payout_mode_places_percent || "").trim();
  const score = (enums.competition_payout_mode_score_share || "").trim();
  const dual = (enums.competition_payout_mode_dual_purse || "").trim();
  const out: { value: string; label: string }[] = [];
  for (const m of enums.competition_payout_modes ?? []) {
    const v = (m || "").trim();
    if (!v) continue;
    let label = v;
    if (v === places) label = places;
    if (v === score) label = score;
    if (v === dual) label = dual;
    out.push({ value: v, label });
  }
  return out;
}

export function buildPlacePercentsPayload(
  p1: string,
  p2: string,
  p3: string,
): Record<string, number> | null {
  const out: Record<string, number> = {};
  const rows: [string, string][] = [
    ["1", p1],
    ["2", p2],
    ["3", p3],
  ];
  for (const [place, raw] of rows) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[place] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function placePercentsSumInvalid(p1: string, p2: string, p3: string): boolean {
  const rows = [p1, p2, p3];
  let any = false;
  let sum = 0;
  for (const raw of rows) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) continue;
    any = true;
    sum += n;
  }
  return any && (sum < 99.999 || sum > 100.001);
}

/** Place purse % of pot for dual_purse: must be finite and in (0, 100) exclusive (server 1–99). */
export function dualPursePlacePercentInvalid(raw: string): boolean {
  const trimmed = (raw || "").trim();
  if (!trimmed) return true;
  const n = Number(trimmed);
  return !Number.isFinite(n) || n <= 0 || n >= 100;
}
