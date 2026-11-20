"use client";

import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { Button } from "@/components/ui/button";
import { tournamentMiniCardClass } from "@/lib/player-shell-ui";
import { type PrizePoolCardLabels, tournamentPrizePoolLines } from "@/lib/prize-pool-lines";
import { seatCapFillRight } from "@/lib/seat-cap-display";
import type { Tournament } from "@/types/tournament";

export function tournamentGalleryImages(t: Tournament): string[] {
  const out: string[] = [];
  const prize = (t.prize_image_url || "").trim();
  if (prize) out.push(prize);
  for (const url of t.gallery ?? []) {
    const u = (url || "").trim();
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

function finiteAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function MediaBadge({
  children,
  align,
  tone = "status",
}: {
  children: string;
  align: "left" | "right";
  /** Status stays neutral; entry fee matches enroll/Join brand CTA. */
  tone?: "status" | "fee";
}) {
  const pos = align === "left" ? "left-2" : "right-2";
  const colors = tone === "fee" ? "bg-[var(--dama-brand)] text-white" : "bg-white text-neutral-900";
  return (
    <span
      className={`pointer-events-none absolute top-2 z-10 max-w-[55%] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${colors} ${pos}`}
    >
      {children}
    </span>
  );
}

type Labels = {
  carouselAria: string;
  playersLabel: string;
  entryLabel: string;
  freeLabel: string;
  /** DB amount_currency_separator (often a single space - never trim for join). */
  amountCurrencySeparator?: string;
  metaSeparator?: string;
  /** DB empty_value when a cell is omitted (never invent 0; never list-empty copy). */
  emptyValue?: string;
  /** DB unlimited_players_label when max_players omitted. */
  unlimitedPlayersLabel?: string;
  ctaLabel: string;
  statusLabel?: string;
};

type TournamentMiniCardProps = {
  tournament: Tournament;
  labels: Labels;
  prizePoolLabels?: PrizePoolCardLabels;
  onEnroll: () => void;
  /** When true, CTA stays painted but does not fire enroll (already seated). */
  ctaDisabled?: boolean;
  ctaSlot?: React.ReactNode;
  /** Official / Community badge under title (unified discovery). */
  sourceBadge?: string;
};

/**
 * Marketplace minicard: media badges (status + entry) · title · live pot lines · fill · CTA.
 * Entry fee lives on the image (status twin); body keeps prize / seats for marketing scan.
 */
export function TournamentMiniCard({
  tournament: t,
  labels,
  prizePoolLabels,
  onEnroll,
  ctaDisabled = false,
  ctaSlot,
  sourceBadge,
}: TournamentMiniCardProps) {
  const liveLines = prizePoolLabels != null ? tournamentPrizePoolLines(t, prizePoolLabels) : [];
  const images = tournamentGalleryImages(t);
  const empty = (labels.emptyValue || "").trim();
  // Keep whitespace separators (DB often stores a single space).
  const amountSep = labels.amountCurrencySeparator ?? "";
  const feeCur = (t.entry_fee_currency || "").trim();
  const feeAmt = finiteAmount(t.entry_fee_amount);
  // Paid entry requires real currency + configured separator; never show amount-only invent.
  const entry = t.is_free
    ? labels.freeLabel
    : feeAmt != null && feeCur && amountSep.length > 0
      ? `${feeAmt}${amountSep}${feeCur}`
      : empty;
  const status = (labels.statusLabel || t.status_label || "").trim();
  const players =
    typeof t.players_count === "number" && Number.isFinite(t.players_count)
      ? t.players_count
      : null;
  const fillLeft = players != null ? String(players) : empty;
  const fillRight = seatCapFillRight(
    t.max_players,
    t.seat_cap_unlimited,
    labels.unlimitedPlayersLabel || "",
  );
  const playersLine = fillRight
    ? `${fillLeft}/${fillRight} ${labels.playersLabel}`.trim()
    : `${fillLeft} ${labels.playersLabel}`.trim();

  return (
    <article className={tournamentMiniCardClass}>
      <div className="relative aspect-square w-full min-w-0 overflow-hidden rounded-xl bg-[var(--dama-surface)]">
        <GalleryCarousel
          images={images}
          ariaLabel={labels.carouselAria}
          className="absolute inset-0 h-full w-full [&_img]:origin-center [&_img]:transition-transform [&_img]:duration-500 [&_img]:ease-out group-hover/card:[&_img]:scale-[1.03]"
        />
        {status ? <MediaBadge align="left">{status}</MediaBadge> : null}
        {entry ? (
          <MediaBadge align="right" tone="fee">
            {entry}
          </MediaBadge>
        ) : null}
      </div>

      <div className="mt-2 min-w-0 space-y-1">
        <h3
          className="truncate text-[14px] font-semibold leading-tight text-[var(--dama-text)]"
          title={t.title}
        >
          {t.title}
        </h3>
        {(sourceBadge || "").trim() ? (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {(sourceBadge || "").trim()}
          </p>
        ) : null}
        {(t.format_label || "").trim() ? (
          <p
            className="truncate text-[12px] text-[var(--dama-muted)]"
            title={(t.format_label || "").trim()}
          >
            {(t.format_label || "").trim()}
          </p>
        ) : null}
        {liveLines.map((line) => (
          <p
            key={line}
            className="truncate text-[13px] font-medium leading-snug text-[var(--dama-text)]"
            title={line}
          >
            {line}
          </p>
        ))}
        <p
          className="truncate text-[12px] font-normal text-[var(--dama-muted)]"
          title={playersLine}
        >
          {playersLine}
        </p>
      </div>

      <div className="mt-2 min-w-0">
        {ctaSlot ??
          ((labels.ctaLabel || "").trim() ? (
            <Button
              type="button"
              variant="play"
              size="sm"
              className="h-8 w-full rounded-lg text-[12px] font-semibold"
              disabled={ctaDisabled}
              onClick={() => {
                if (ctaDisabled) return;
                onEnroll();
              }}
            >
              {labels.ctaLabel}
            </Button>
          ) : null)}
      </div>
    </article>
  );
}
