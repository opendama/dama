"use client";

import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { playerProfileHref } from "@/lib/player-profile-href";
import { tournamentMiniCardClass } from "@/lib/player-shell-ui";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { type PrizePoolCardLabels, hostedEventPrizePoolLines } from "@/lib/prize-pool-lines";
import { seatCapFillRight } from "@/lib/seat-cap-display";
import type { HostedEvent } from "@/types/events";
import Link from "next/link";

/** Prize media first (Official parity), then branding logo/sponsor when prize media empty. */
export function eventGalleryImages(e: HostedEvent): string[] {
  const out: string[] = [];
  const prize = (e.prize_image_url || "").trim();
  if (prize) out.push(prize);
  for (const raw of e.gallery ?? []) {
    const u = (raw || "").trim();
    if (u && !out.includes(u)) out.push(u);
  }
  if (out.length > 0) return out;
  const logo = (e.logo_url || "").trim();
  if (logo) out.push(logo);
  const sponsor = (e.sponsor_logo_url || "").trim();
  if (sponsor && !out.includes(sponsor)) out.push(sponsor);
  return out;
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
  hostedByLabel: string;
  amountCurrencySeparator?: string;
  metaSeparator?: string;
  /** DB empty_value when counts omitted (never invent 0). */
  emptyValue?: string;
  /** DB unlimited_players_label when max_players omitted. */
  unlimitedPlayersLabel?: string;
  ctaLabel: string;
  statusLabel?: string;
  hostRepFinishedLabel?: string;
  hostRepCancelledLabel?: string;
  hostRepReportsLabel?: string;
  hostRepMetaSeparator?: string;
  /** DB events_player_chrome.detail_description_label when description present. */
  detailDescriptionLabel?: string;
};

type EventMiniCardProps = {
  event: HostedEvent;
  labels: Labels;
  prizePoolLabels?: PrizePoolCardLabels;
  /** Official / Community badge under title (unified discovery). */
  sourceBadge?: string;
  /** Card body tap → detail. */
  onOpen: () => void;
  /** Join CTA → join flow (separate from card open). */
  onJoin: () => void;
  /** When true, CTA stays painted but does not fire join (already seated). */
  ctaDisabled?: boolean;
  ctaSlot?: React.ReactNode;
};

/**
 * Marketplace minicard (tournaments parity): media badges · title · host · pot · fill · Join.
 */
export function EventMiniCard({
  event: e,
  labels,
  prizePoolLabels,
  sourceBadge,
  onOpen,
  onJoin,
  ctaDisabled = false,
  ctaSlot,
}: EventMiniCardProps) {
  const liveLines = prizePoolLabels != null ? hostedEventPrizePoolLines(e, prizePoolLabels) : [];
  const images = eventGalleryImages(e);
  const empty = (labels.emptyValue || "").trim();
  // Keep whitespace separators (DB often stores a single space).
  const amountSep = labels.amountCurrencySeparator ?? "";
  const sep = labels.metaSeparator ?? "";
  const feeCur = (e.entry_fee_currency || "").trim();
  const entry = e.is_free_entry
    ? labels.freeLabel
    : typeof e.entry_fee_amount === "number" && feeCur && amountSep.length > 0
      ? `${e.entry_fee_amount}${amountSep}${feeCur}`
      : empty;
  const status = (labels.statusLabel || e.status_label || "").trim();
  const approved =
    typeof e.approved_count === "number" && Number.isFinite(e.approved_count)
      ? e.approved_count
      : null;
  const fillLeft = approved != null ? String(approved) : empty;
  // Classic: "7/8 players". Unlimited (null or high ceiling): "7/Unlimited players".
  const fillRight = seatCapFillRight(
    e.max_players,
    e.seat_cap_unlimited,
    labels.unlimitedPlayersLabel || "",
  );
  const playersLine = fillRight
    ? `${fillLeft}/${fillRight} ${labels.playersLabel}`.trim()
    : `${fillLeft} ${labels.playersLabel}`.trim();
  const hostName = (e.organizer_username || "").trim();
  const hostAvatar = (e.organizer_avatar_url || "").trim();
  const hostTrustBadge = (e.organizer_host_trust_badge || "").trim();
  const hostTrustTier = (e.organizer_host_trust_tier || "").trim();
  const hostProfileHref = playerProfileHref((e.organizer_id || "").trim());
  const hostRepLine = hostReputationLine({
    finished: e.organizer_finished_paid_cups,
    cancelled: e.organizer_cancelled_paid_cups,
    openReports: e.organizer_open_reports,
    finishedLabel: labels.hostRepFinishedLabel,
    cancelledLabel: labels.hostRepCancelledLabel,
    reportsLabel: labels.hostRepReportsLabel,
    separator: labels.hostRepMetaSeparator,
  });
  // Fail closed: DB meta_separator only (never invent middle-dot).
  const formatSize = [e.format_label, e.size_label]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(sep);

  return (
    <article className={tournamentMiniCardClass}>
      {/* Media stays a non-interactive well (TournamentMiniCard parity); title/meta buttons open. */}
      <div
        className="relative aspect-square w-full min-w-0 overflow-hidden rounded-xl bg-[var(--dama-surface)]"
        style={
          images.length === 0 && (e.brand_color || "").trim()
            ? { backgroundColor: (e.brand_color || "").trim() }
            : undefined
        }
      >
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
      <button
        type="button"
        className="mt-2 block w-full min-w-0 cursor-pointer text-left"
        onClick={onOpen}
        aria-label={e.title}
      >
        <h3
          className="truncate text-[14px] font-semibold leading-tight text-[var(--dama-text)]"
          title={e.title}
        >
          {e.title}
        </h3>
        {(sourceBadge || "").trim() ? (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {(sourceBadge || "").trim()}
          </p>
        ) : null}
      </button>

      {hostName ? (
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {hostProfileHref ? (
            <Link
              href={hostProfileHref}
              className="shrink-0 cursor-pointer rounded-full outline-none transition-opacity hover:opacity-90"
              aria-label={hostName}
            >
              <DamaUserAvatar src={hostAvatar || null} className="h-5 w-5 rounded-full" />
            </Link>
          ) : (
            <DamaUserAvatar src={hostAvatar || null} className="h-5 w-5 rounded-full" />
          )}
          <p
            className="min-w-0 truncate text-[12px] text-[var(--dama-muted)]"
            title={`${labels.hostedByLabel} ${hostName}`}
          >
            <span className="text-[var(--dama-muted)]">{labels.hostedByLabel} </span>
            {hostProfileHref ? (
              <Link
                href={hostProfileHref}
                className="cursor-pointer font-medium text-[var(--dama-text)] underline-offset-2 hover:underline"
              >
                {hostName}
              </Link>
            ) : (
              <span className="font-medium text-[var(--dama-text)]">{hostName}</span>
            )}
          </p>
          <HostTrustBadge
            label={hostTrustBadge}
            tier={hostTrustTier}
            className="shrink-0 text-[9px]"
          />
        </div>
      ) : null}
      {hostRepLine ? (
        <p className="mt-0.5 truncate text-[10px] text-[var(--dama-muted)]" title={hostRepLine}>
          {hostRepLine}
        </p>
      ) : null}

      <button
        type="button"
        className="mt-0.5 block w-full min-w-0 cursor-pointer space-y-1 text-left"
        onClick={onOpen}
      >
        {formatSize ? (
          <p className="truncate text-[12px] text-[var(--dama-muted)]" title={formatSize}>
            {formatSize}
          </p>
        ) : null}
        {(e.description || "").trim() ? (
          <div className="space-y-0.5">
            {(labels.detailDescriptionLabel || "").trim() ? (
              <p className="truncate text-[10px] font-semibold tracking-wide text-[var(--dama-muted)]">
                {(labels.detailDescriptionLabel || "").trim()}
              </p>
            ) : null}
            <p
              className="line-clamp-2 text-[12px] leading-snug text-[var(--dama-text)]"
              title={(e.description || "").trim()}
            >
              {(e.description || "").trim()}
            </p>
          </div>
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
      </button>

      <div className="mt-2 min-w-0">
        {ctaSlot ??
          ((labels.ctaLabel || "").trim() ? (
            <Button
              type="button"
              variant="play"
              size="sm"
              className="h-8 w-full rounded-lg text-[12px] font-semibold"
              disabled={ctaDisabled}
              onClick={(ev) => {
                ev.stopPropagation();
                if (ctaDisabled) return;
                onJoin();
              }}
            >
              {labels.ctaLabel}
            </Button>
          ) : null)}
      </div>
    </article>
  );
}
