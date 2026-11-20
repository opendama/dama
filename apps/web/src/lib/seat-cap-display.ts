/** Largest fixed classic bracket size from DB swiss_rounds_by_max_players keys. */
export function classicSeatCeiling(
  swissRoundsByMaxPlayers: Record<string, number> | undefined,
): number {
  let max = 0;
  for (const key of Object.keys(swissRoundsByMaxPlayers || {})) {
    const n = Number.parseInt(String(key).trim(), 10);
    if (Number.isFinite(n) && n >= 2 && n > max) max = n;
  }
  return max;
}

/** Null Unlimited or high safety ceiling above the DB classic seat table. */
export function sizeIsUnlimitedMode(
  maxPlayers: number | null | undefined,
  swissRoundsByMaxPlayers: Record<string, number> | undefined,
): boolean {
  // Present but under 2 is invalid, not Unlimited.
  if (maxPlayers == null) return true;
  if (!(Number(maxPlayers) >= 2)) return false;
  const ceiling = classicSeatCeiling(swissRoundsByMaxPlayers);
  if (ceiling < 2) return false;
  return Number(maxPlayers) > ceiling;
}

/**
 * Organizer/admin display: Unlimited for null/high; high also shows (N).
 * Classic fixed sizes show the number only.
 */
export function formatSeatCapDisplay(
  maxPlayers: number | null | undefined,
  swissRoundsByMaxPlayers: Record<string, number> | undefined,
  unlimitedLabel: string,
  empty: string,
): string {
  const unlimLabel = (unlimitedLabel || "").trim() || empty;
  const capped =
    maxPlayers != null && Number.isFinite(Number(maxPlayers)) && Number(maxPlayers) >= 2
      ? Number(maxPlayers)
      : null;
  if (sizeIsUnlimitedMode(maxPlayers, swissRoundsByMaxPlayers)) {
    return capped != null ? `${unlimLabel} (${capped})` : unlimLabel;
  }
  if (capped != null) return String(capped);
  if (maxPlayers != null && Number.isFinite(Number(maxPlayers))) return String(Number(maxPlayers));
  return empty;
}

/**
 * Player fill right side (n/X): API seat_cap_unlimited or null max → Unlimited label;
 * classic fixed max → the number. High safety ceilings use the Unlimited label, not raw N.
 */
export function seatCapFillRight(
  maxPlayers: number | null | undefined,
  seatCapUnlimited: boolean | undefined,
  unlimitedLabel: string,
): string | null {
  const unlimited = (unlimitedLabel || "").trim();
  const capped =
    maxPlayers != null && Number.isFinite(Number(maxPlayers)) && Number(maxPlayers) >= 2
      ? Number(maxPlayers)
      : null;
  if (seatCapUnlimited === true) {
    return unlimited || null;
  }
  if (maxPlayers == null) {
    return unlimited || null;
  }
  if (capped != null) {
    return String(capped);
  }
  // Present but under 2: never invent Unlimited label.
  return String(Number(maxPlayers));
}
