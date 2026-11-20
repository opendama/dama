import type { HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import type { EventsPlayerChrome } from "@/types/events-player-chrome";
import type { HomeSurfaceChrome } from "@/types/home-chrome";
import type { Tournament } from "@/types/tournament";
import type { TournamentsPlayerChrome } from "@/types/tournaments-player-chrome";

export type PrizePoolCardLabels = {
  nowLabel: string;
  ifFullLabel: string;
  guaranteedLabel: string;
  frozenBlurb: string;
  metaSeparator: string;
  amountCurrencySeparator: string;
};

export function prizePoolCardLabelsFromOrganizer(
  c: Required<EventsOrganizerChrome>,
): PrizePoolCardLabels {
  return {
    nowLabel: c.prize_pool_now_label,
    ifFullLabel: c.prize_pool_if_full_label,
    guaranteedLabel: c.prize_pool_guaranteed_label,
    frozenBlurb: c.prize_pool_frozen_blurb,
    metaSeparator: c.meta_separator,
    amountCurrencySeparator: c.amount_currency_separator,
  };
}

export function prizePoolCardLabelsFromPlayer(
  c: Required<EventsPlayerChrome>,
): PrizePoolCardLabels {
  return {
    nowLabel: c.prize_pool_now_label,
    ifFullLabel: c.prize_pool_if_full_label,
    guaranteedLabel: c.prize_pool_guaranteed_label,
    frozenBlurb: c.prize_pool_frozen_blurb,
    metaSeparator: c.meta_separator,
    amountCurrencySeparator: c.amount_currency_separator,
  };
}

export function prizePoolCardLabelsFromTournaments(
  c: Required<TournamentsPlayerChrome>,
): PrizePoolCardLabels {
  return {
    nowLabel: c.prize_pool_now_label,
    ifFullLabel: c.prize_pool_if_full_label,
    guaranteedLabel: c.prize_pool_guaranteed_label,
    frozenBlurb: c.prize_pool_frozen_blurb,
    metaSeparator: c.meta_separator,
    amountCurrencySeparator: c.amount_currency_separator,
  };
}

export function prizePoolCardLabelsFromHome(c: Required<HomeSurfaceChrome>): PrizePoolCardLabels {
  return {
    nowLabel: c.prize_pool_now_label,
    ifFullLabel: c.prize_pool_if_full_label,
    guaranteedLabel: c.prize_pool_guaranteed_label,
    frozenBlurb: c.prize_pool_frozen_blurb,
    metaSeparator: c.meta_separator,
    amountCurrencySeparator: c.amount_currency_separator,
  };
}

function moneyLine(
  label: string,
  amount: number,
  currency: string,
  labels: PrizePoolCardLabels,
): string {
  const cur = currency.trim();
  const amt = String(amount);
  const value = `${amt}${labels.amountCurrencySeparator}${cur}`;
  return [label, value].join(labels.metaSeparator);
}

export function buildPrizePoolLines(input: {
  isFree: boolean;
  displayEnabled: boolean;
  now?: number | null;
  ifFull?: number | null;
  guaranteeEnabled: boolean;
  guaranteeHeld?: boolean;
  guaranteeAmount?: number | null;
  frozen: boolean;
  currency: string;
  labels: PrizePoolCardLabels;
}): string[] {
  const {
    isFree,
    displayEnabled,
    now,
    ifFull,
    guaranteeEnabled,
    guaranteeHeld,
    guaranteeAmount,
    frozen,
    currency,
    labels,
  } = input;
  const cur = currency.trim();
  if (isFree || !displayEnabled || now == null || !Number.isFinite(now) || !cur) return [];
  const out: string[] = [];
  if (labels.nowLabel.trim()) {
    out.push(moneyLine(labels.nowLabel, now, cur, labels));
  }
  if (ifFull != null && Number.isFinite(ifFull) && labels.ifFullLabel.trim()) {
    out.push(moneyLine(labels.ifFullLabel, ifFull, cur, labels));
  }
  // Guaranteed line only when funds are actually held (or tournament declared, held omitted).
  const showGuarantee =
    guaranteeEnabled &&
    guaranteeAmount != null &&
    guaranteeAmount > 0 &&
    guaranteeHeld !== false &&
    labels.guaranteedLabel.trim();
  if (showGuarantee) {
    out.push(moneyLine(labels.guaranteedLabel, guaranteeAmount, cur, labels));
  }
  if (frozen && labels.frozenBlurb.trim()) {
    out.push(labels.frozenBlurb);
  }
  return out;
}

export function hostedEventPrizePoolLines(ev: HostedEvent, labels: PrizePoolCardLabels): string[] {
  return buildPrizePoolLines({
    isFree: ev.is_free_entry,
    displayEnabled: ev.prize_pool_display_enabled === true,
    now: ev.prize_pool_now,
    ifFull: ev.prize_pool_if_full,
    guaranteeEnabled: ev.prize_pool_guarantee_enabled === true,
    guaranteeHeld: ev.prize_pool_guarantee_held === true,
    guaranteeAmount: ev.prize_pool_guarantee_amount,
    frozen: ev.prize_pool_frozen === true,
    currency: (ev.prize_pool_currency || "").trim(),
    labels,
  });
}

export function tournamentPrizePoolLines(t: Tournament, labels: PrizePoolCardLabels): string[] {
  const guarantee = t.prize_pool_guarantee_amount;
  return buildPrizePoolLines({
    isFree: t.is_free,
    displayEnabled: t.prize_pool_display_enabled === true,
    now: t.prize_pool_now,
    ifFull: t.prize_pool_if_full,
    guaranteeEnabled: guarantee != null && guarantee > 0,
    guaranteeAmount: guarantee,
    frozen: t.prize_pool_frozen === true,
    currency: (t.prize_pool_currency || "").trim(),
    labels,
  });
}
