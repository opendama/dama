export type EstPrizeShareInput = {
  mode: string;
  placesMode: string;
  scoreMode: string;
  dualMode?: string;
  dualPlacePursePercent?: number | null;
  potNow?: number | null;
  myPoints?: number | null;
  totalPoints?: number | null;
  myPlacement?: number | null;
  placePercents?: Record<string, number> | null;
};

function roundMoney2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Parses place percents; returns null unless percents sum to 100. */
export function placePercentsForEst(
  raw: Record<string, number> | undefined | null,
): Record<number, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<number, number> = {};
  let sum = 0;
  for (const [k, v] of Object.entries(raw)) {
    const place = Number.parseInt(String(k).trim(), 10);
    if (!Number.isFinite(place) || place < 1) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out[place] = v;
    sum += v;
  }
  if (sum < 99.999 || sum > 100.001) return null;
  return out;
}

function scoreShareAmount(
  pot: number,
  myPts: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (
    myPts == null ||
    total == null ||
    !Number.isFinite(myPts) ||
    !Number.isFinite(total) ||
    myPts <= 0 ||
    total <= 0
  ) {
    return null;
  }
  return roundMoney2((pot * myPts) / total);
}

function placesAmount(
  pot: number,
  myPlacement: number | null | undefined,
  placePercents: Record<string, number> | null | undefined,
): number | null {
  const place = myPlacement;
  if (place == null || !Number.isFinite(place) || place < 1) return null;
  const percents = placePercentsForEst(placePercents ?? undefined);
  if (!percents) return null;
  const pct = percents[Math.floor(place)];
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return null;
  return roundMoney2((pot * pct) / 100);
}

/** Estimated prize share from payout mode and live pot (fail closed). */
export function computeEstPrizeShare(input: EstPrizeShareInput): number | null {
  const mode = (input.mode || "").trim();
  const placesMode = (input.placesMode || "").trim();
  const scoreMode = (input.scoreMode || "").trim();
  const dualMode = (input.dualMode || "").trim();
  if (!mode) return null;
  if (mode !== placesMode && mode !== scoreMode && mode !== dualMode) return null;

  const pot = input.potNow;
  if (pot == null || !Number.isFinite(pot) || pot <= 0) return null;

  if (mode === placesMode) {
    return placesAmount(pot, input.myPlacement, input.placePercents);
  }

  if (mode === scoreMode) {
    return scoreShareAmount(pot, input.myPoints, input.totalPoints);
  }

  // dual_purse: place purse + performance purse.
  // When nobody has points (totalPts null/<=0), mirror server fail-closed: full-pot places%.
  const placePursePct = input.dualPlacePursePercent;
  if (
    placePursePct == null ||
    !Number.isFinite(placePursePct) ||
    placePursePct <= 0 ||
    placePursePct >= 100
  ) {
    return null;
  }
  const totalPts = input.totalPoints;
  if (totalPts == null || !Number.isFinite(totalPts) || totalPts <= 0) {
    return placesAmount(pot, input.myPlacement, input.placePercents);
  }
  const placePurse = roundMoney2((pot * placePursePct) / 100);
  const perfPurse = roundMoney2(pot - placePurse);
  const placePart = placesAmount(placePurse, input.myPlacement, input.placePercents);
  const perfPart = scoreShareAmount(perfPurse, input.myPoints, totalPts);
  if (placePart == null && perfPart == null) return null;
  return roundMoney2((placePart ?? 0) + (perfPart ?? 0));
}

export function formatEstPrizeShareAmount(
  amount: number,
  currency: string,
  amountCurrencySeparator: string,
): string | null {
  const cur = (currency || "").trim();
  if (!cur || !Number.isFinite(amount) || amount <= 0) return null;
  return `${amount}${amountCurrencySeparator}${cur}`;
}
