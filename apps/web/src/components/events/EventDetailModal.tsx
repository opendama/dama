"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { eventGalleryImages } from "@/components/events/EventMiniCard";
import { PaymentEventJoinModal } from "@/components/events/PaymentEventJoinModal";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  type JoinHostedEventError,
  useJoinHostedEventMutation,
} from "@/hooks/mutation/useJoinHostedEventMutation";
import { useEventEntriesQuery } from "@/hooks/query/useEventEntriesQuery";
import { useEventQuery } from "@/hooks/query/useEventQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import {
  softCommunityCarouselAria,
  softCommunityJoinStatusMessage,
  softCommunityLoadFailed,
  softCommunityPageTitle,
  softCommunityRosterTitle,
  softCommunityShareAction,
  softTournamentsFilterEntryLabel,
  softTournamentsFreeLabel,
  softTournamentsHostedByLabel,
  softTournamentsJoinAction,
  softTournamentsPlayersLabel,
} from "@/lib/community-player-chrome-soft";
import { resolveCupCardCta } from "@/lib/cupLifecycle";
import { resolveEventInviteShareUrl } from "@/lib/event-invite-share-url";
import { eventJoinErrorChrome, isAlreadyJoinedEventError } from "@/lib/event-join-error";
import { playerProfileHref } from "@/lib/player-profile-href";
import { hostedEventPrizePoolLines, prizePoolCardLabelsFromPlayer } from "@/lib/prize-pool-lines";
import { seatCapFillRight } from "@/lib/seat-cap-display";
import { eventJoinPlayHref } from "@/lib/tournament-free-join";
import { useAuthStore } from "@/store/auth";
import type { EventsPlayerChrome } from "@/types/events-player-chrome";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  eventId: string | null;
  chrome: Required<EventsPlayerChrome>;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful seat so list cards can flip Join → already joined. */
  onJoined?: (eventId: string) => void;
};

/**
 * Player event detail modal (list stays mounted). No organizer manage tools.
 */
export function EventDetailModal({ open, eventId, chrome, onOpenChange, onJoined }: Props) {
  const id = (eventId || "").trim();
  const token = useAuthStore((s) => s.token);
  const myUserId = useAuthStore((s) => s.user?.id);
  const signInModal = useOptionalSignInModal();
  const router = useRouter();
  const eventQuery = useEventQuery(id, open && Boolean(id));
  const catalogQuery = useEventsCatalogQuery(open);
  const entriesQuery = useEventEntriesQuery(token, id, open && Boolean(id));
  const join = useJoinHostedEventMutation(token);
  const e = eventQuery.data;
  const [payJoinOpen, setPayJoinOpen] = useState(false);

  if (!open) return null;

  const empty = (chrome.empty_value || "").trim();
  const amountSep = chrome.amount_currency_separator ?? "";
  const feeCur = (e?.entry_fee_currency || "").trim();
  const entry = e
    ? e.is_free_entry
      ? softTournamentsFreeLabel(chrome.free_label)
      : typeof e.entry_fee_amount === "number" && feeCur && amountSep
        ? `${e.entry_fee_amount}${amountSep}${feeCur}`
        : empty
    : empty;
  // Marketplace parity: capped "n/max players"; uncapped "n players" (never "n/-").
  const fill = (() => {
    if (!e) return "";
    const approved =
      typeof e.approved_count === "number" && Number.isFinite(e.approved_count)
        ? String(e.approved_count)
        : empty;
    const playersLbl = softTournamentsPlayersLabel(chrome.players_label);
    const fillRight = seatCapFillRight(
      e.max_players,
      e.seat_cap_unlimited,
      chrome.unlimited_players_label || "",
    );
    if (fillRight) return `${approved}/${fillRight} ${playersLbl}`.trim();
    return `${approved} ${playersLbl}`.trim();
  })();
  const hostName = (e?.organizer_username || "").trim();
  const hostAvatar = (e?.organizer_avatar_url || "").trim();
  const hostTrustBadge = (e?.organizer_host_trust_badge || "").trim();
  const hostRepLine = e
    ? hostReputationLine({
        finished: e.organizer_finished_paid_cups,
        cancelled: e.organizer_cancelled_paid_cups,
        openReports: e.organizer_open_reports,
        finishedLabel: chrome.host_rep_finished_label,
        cancelledLabel: chrome.host_rep_cancelled_label,
        reportsLabel: chrome.host_rep_reports_label,
        separator: chrome.host_rep_meta_separator,
      })
    : "";
  const hostProfileHref = playerProfileHref((e?.organizer_id || "").trim());
  const prizeLabels = prizePoolCardLabelsFromPlayer(chrome);
  const poolLines = e ? hostedEventPrizePoolLines(e, prizeLabels) : [];
  const publicVis = (catalogQuery.data?.hosted_event_public_visibility || "").trim();
  const isPublic = Boolean(e && publicVis && e.visibility === publicVis);
  const ratedBlurb = isPublic
    ? softCommunityJoinStatusMessage(
        catalogQuery.data?.public_event_matches_rated === true
          ? chrome.public_rated_on_blurb
          : chrome.public_rated_off_blurb,
      )
    : "";
  // Organizer parity: Share copies invite link (never navigates / opens a tab).
  // Fail closed: bare origin (e.g. http://localhost:3000/) is not a valid invite.
  const shareUrl = isPublic
    ? resolveEventInviteShareUrl({
        shareUrl: e?.share_url,
        joinCode: e?.join_code,
        sharePathTemplate: catalogQuery.data?.share_path_template,
        origin: typeof window !== "undefined" ? window.location.origin : "",
      })
    : "";
  async function copyShareLink() {
    const url = shareUrl.trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      const ok = (chrome.copied_blurb || "").trim();
      if (ok) toast.success(ok);
    } catch {
      const fail = (chrome.toast_copy_failed || "").trim();
      if (fail) toast.error(fail);
    }
  }
  const gallery = e ? eventGalleryImages(e) : [];
  const brandFallback = (e?.brand_color || "").trim();
  const approvedEntries = (entriesQuery.data ?? []).filter((row) => {
    const approved = (catalogQuery.data?.hosted_event_entry_approved || "").trim();
    return approved ? row.status === approved : Boolean((row.username || "").trim());
  });
  const rosterPreview = approvedEntries.slice(0, 8);
  const myId = (myUserId || "").trim();
  const myEntry = myId
    ? (entriesQuery.data ?? []).find((row) => (row.user_id || "").trim() === myId)
    : undefined;
  const pendingStatus = (catalogQuery.data?.hosted_event_entry_pending || "").trim();
  const approvedStatus = (catalogQuery.data?.hosted_event_entry_approved || "").trim();
  const myPending = Boolean(myEntry && pendingStatus && myEntry.status === pendingStatus);
  const myApproved = Boolean(
    myEntry &&
      (approvedStatus
        ? myEntry.status === approvedStatus
        : Boolean((myEntry.username || "").trim())),
  );
  const loading = Boolean(id) && eventQuery.isLoading && !e;
  const closeLabel = (chrome.dialog_close_label || "").trim();
  const cardCta = resolveCupCardCta(e, {
    enrolled: myApproved,
    isFree: Boolean(e?.is_free_entry),
    labels: {
      joinAction: softTournamentsJoinAction(
        chrome.detail_join_action || chrome.join_action || "",
      ).trim(),
      enrollAction: softTournamentsJoinAction(
        chrome.detail_join_action || chrome.join_action || "",
      ).trim(),
      lobbyAction: (chrome.lobby_action || "").trim(),
      watchAction: (chrome.watch_action || "").trim(),
      resultsAction: (chrome.results_action || "").trim(),
    },
  });
  // Never invent Join on finished/live - only fall back to join chrome for enroll kind.
  const joinCta = myPending
    ? softCommunityJoinStatusMessage(chrome.pending_approval)
    : (cardCta.label || "").trim() ||
      (cardCta.kind === "enroll"
        ? softTournamentsJoinAction(chrome.detail_join_action || chrome.join_action || "").trim()
        : "");

  function onJoin() {
    // Pending stays locked on this dialog.
    if (myPending) return;
    // Approved / Watch / Results → same cup lobby shell (never enroll finished).
    if (myApproved || cardCta.kind !== "enroll") {
      onJoined?.(id);
      router.replace(eventJoinPlayHref(id));
      return;
    }
    const code = (e?.join_code || "").trim();
    if (!code || !id) return;
    if (!token) {
      signInModal?.openSignIn({
        nextPath: `/?view=tournaments&source=community&id=${encodeURIComponent(id)}`,
      });
      return;
    }
    // Paid: confirm fee from wallet (tournament PaymentEnrollModal parity).
    if (e && !e.is_free_entry) {
      setPayJoinOpen(true);
      return;
    }
    join.mutate(
      { code },
      {
        onSuccess: (data) => {
          const pending = (catalogQuery.data?.hosted_event_entry_pending || "").trim();
          const isPending = Boolean(pending && data.entry?.status === pending);
          toast.success(
            softCommunityJoinStatusMessage(
              isPending ? chrome.pending_approval : chrome.approved_blurb,
            ),
          );
          if (id) onJoined?.(id);
          onOpenChange(false);
          // Tournament parity: approved seat → play lobby.
          if (!isPending) router.replace(eventJoinPlayHref(id));
        },
        onError: (err) => {
          // Already seated: soft-success like tournament already_enrolled → cup lobby.
          if (isAlreadyJoinedEventError(err)) {
            const msg = softCommunityJoinStatusMessage(
              (chrome.already_joined || "").trim() || (chrome.approved_blurb || "").trim(),
            );
            if (msg) toast.success(msg);
            if (id) onJoined?.(id);
            router.replace(eventJoinPlayHref(id));
            return;
          }
          const payment = (err as JoinHostedEventError).paymentRequired;
          if (payment) {
            const href = (chrome.top_up_href || "").trim();
            const payMsg =
              softCommunityJoinStatusMessage(chrome.insufficient_entry_fee) ||
              eventJoinErrorChrome(err, chrome);
            const actionLabel = (chrome.top_up_action || "").trim();
            toast.error(
              payMsg || undefined,
              href && actionLabel
                ? { action: { label: actionLabel, onClick: () => router.push(href) } }
                : undefined,
            );
            return;
          }
          const msg = eventJoinErrorChrome(err, chrome);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[220] bg-[var(--dama-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            data-skip-hide-on-scroll=""
            onOpenAutoFocus={(ev) => ev.preventDefault()}
            onWheel={(ev) => ev.stopPropagation()}
            onTouchMove={(ev) => ev.stopPropagation()}
            className="fixed left-1/2 top-1/2 z-[221] flex max-h-[min(92dvh,40rem)] w-[min(96vw,36rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-float-shadow)] outline-none"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--dama-border)] px-4 py-3 sm:px-5">
              <Dialog.Title className="min-w-0 flex-1 truncate pr-2 text-base font-semibold sm:text-lg">
                {e?.title?.trim() || softCommunityPageTitle(chrome.page_title)}
              </Dialog.Title>
              <Dialog.Close
                className="shrink-0 rounded-md p-1.5 text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
                {...(closeLabel
                  ? { "aria-label": closeLabel }
                  : { "aria-hidden": true as const, tabIndex: -1 })}
              >
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
            </div>

            <div
              data-skip-hide-on-scroll=""
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
              onScroll={(ev) => {
                // Keep page filter headroom from seeing modal scroll (capture listeners).
                ev.stopPropagation();
              }}
              onWheel={(ev) => ev.stopPropagation()}
              onTouchMove={(ev) => ev.stopPropagation()}
            >
              {loading ? (
                <div className="space-y-3" aria-hidden>
                  <ShimmerBlock className="aspect-[16/10] w-full rounded-xl" />
                  <ShimmerBlock className="h-6 w-2/3" />
                  <ShimmerBlock className="h-10 w-full" />
                </div>
              ) : !e ? (
                <p className="text-sm text-[var(--dama-danger)]" role="alert">
                  {softCommunityLoadFailed(
                    (chrome.detail_unavailable || chrome.load_failed || "").trim(),
                  )}
                </p>
              ) : (
                <>
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[var(--dama-surface)]"
                    style={
                      gallery.length === 0 && brandFallback
                        ? { backgroundColor: brandFallback }
                        : undefined
                    }
                  >
                    <GalleryCarousel
                      images={gallery}
                      ariaLabel={softCommunityCarouselAria(chrome.carousel_aria)}
                      className="absolute inset-0 h-full w-full"
                    />
                    {(e.status_label || e.status || "").trim() ? (
                      <span className="pointer-events-none absolute left-3 top-3 z-10 max-w-[75%] truncate rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-900 shadow-sm">
                        {(e.status_label || e.status || "").trim()}
                      </span>
                    ) : null}
                  </div>

                  {hostName ? (
                    <div className="flex min-w-0 items-center gap-2">
                      {hostProfileHref ? (
                        <Link
                          href={hostProfileHref}
                          className="shrink-0 cursor-pointer rounded-full outline-none ring-offset-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--dama-ring)]"
                          aria-label={hostName}
                        >
                          <DamaUserAvatar
                            src={hostAvatar || null}
                            className="h-8 w-8 rounded-full"
                          />
                        </Link>
                      ) : (
                        <DamaUserAvatar src={hostAvatar || null} className="h-8 w-8 rounded-full" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--dama-muted)]">
                          {softTournamentsHostedByLabel(chrome.hosted_by_label)}{" "}
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
                        {typeof e.organizer_rating === "number" && e.organizer_rating > 0 ? (
                          <p className="text-xs text-[var(--dama-muted)]">{e.organizer_rating}</p>
                        ) : null}
                        <HostTrustBadge
                          label={hostTrustBadge}
                          tier={(e?.organizer_host_trust_tier || "").trim()}
                          className="mt-1"
                        />
                        {hostRepLine ? (
                          <p className="mt-1 text-[11px] text-[var(--dama-muted)]">{hostRepLine}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {(e.description || "").trim() ? (
                    <div className="space-y-1 text-sm">
                      {(chrome.detail_description_label || "").trim() ? (
                        <p className="text-xs text-[var(--dama-muted)]">
                          {(chrome.detail_description_label || "").trim()}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-[var(--dama-text)]">
                        {(e.description || "").trim()}
                      </p>
                    </div>
                  ) : null}

                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-[var(--dama-muted)]">{chrome.format_label}</dt>
                      <dd className="font-medium">{(e.format_label || "").trim() || empty}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--dama-muted)]">{chrome.size_label}</dt>
                      <dd className="font-medium">{(e.size_label || "").trim() || empty}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--dama-muted)]">
                        {softTournamentsFilterEntryLabel(chrome.entry_label)}
                      </dt>
                      <dd className="font-medium">{entry}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--dama-muted)]">
                        {softTournamentsPlayersLabel(chrome.players_label)}
                      </dt>
                      <dd className="font-medium">{fill}</dd>
                    </div>
                  </dl>

                  {poolLines.length > 0 ? (
                    <div className="space-y-1 text-sm text-[var(--dama-muted)]">
                      {poolLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  ) : null}

                  {ratedBlurb ? (
                    <p className="text-sm text-[var(--dama-muted)]">{ratedBlurb}</p>
                  ) : null}

                  {rosterPreview.length > 0 ? (
                    <section className="space-y-2">
                      <h2 className="text-sm font-semibold">
                        {softCommunityRosterTitle(chrome.roster_title)}
                      </h2>
                      <ul className="flex flex-wrap gap-2">
                        {rosterPreview.map((row) => (
                          <li
                            key={row.id}
                            className="rounded-full border border-[var(--dama-border)] px-2.5 py-1 text-xs text-[var(--dama-muted)]"
                          >
                            {(row.username || "").trim() || empty}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              )}
            </div>

            {e && joinCta ? (
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--dama-border)] px-4 py-3 sm:px-5">
                <Button
                  type="button"
                  variant="play"
                  className="min-w-[8rem] flex-1 sm:flex-none"
                  disabled={join.isPending || myPending}
                  onClick={onJoin}
                >
                  {joinCta}
                </Button>
                {shareUrl && (chrome.share_action || "").trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      void copyShareLink();
                    }}
                  >
                    {softCommunityShareAction(chrome.share_action)}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PaymentEventJoinModal
        open={payJoinOpen && Boolean(e)}
        onOpenChange={(next) => {
          setPayJoinOpen(next);
        }}
        event={e ?? null}
        prizePoolLabels={prizeLabels}
        onJoined={(joinedId) => {
          onJoined?.(joinedId);
          onOpenChange(false);
        }}
        joinChrome={{
          pending_approval: chrome.pending_approval,
          approved_blurb: chrome.approved_blurb,
          already_joined: chrome.already_joined,
          insufficient_entry_fee: chrome.insufficient_entry_fee,
          top_up_action: chrome.top_up_action,
          top_up_href: chrome.top_up_href,
        }}
      />
    </>
  );
}
