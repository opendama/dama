"use client";

import { ArenaClock } from "@/components/competition/ArenaClock";
import {
  softCommunityArenaLobbyBlurb,
  softCommunityArenaLobbyTitle,
  softCommunityBracketTitle,
  softCommunityCarouselAria,
  softCommunityEstPrizeShareBlurb,
  softCommunityJoinStatusMessage,
  softCommunityLoadFailed,
  softCommunityLobbyBlurb,
  softCommunityLobbyTitle,
  softCommunityLobbyUnavailable,
  softCommunityPrizePendingBlurb,
  softCommunityReportSubmitAction,
  softCommunityReportTitle,
  softCommunityRosterTitle,
  softCommunitySpectateAction,
} from "@/lib/community-player-chrome-soft";
import { softHostingReportAction } from "@/lib/hosting-organizer-chrome-soft";
import { ArenaStandingsTable } from "@/components/competition/ArenaStandingsTable";
import { eventGalleryImages } from "@/components/events/EventMiniCard";
import { EventStandingsTable } from "@/components/events/EventStandingsTable";
import { ReportEventDialog } from "@/components/events/ReportEventDialog";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { Button } from "@/components/ui/button";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  useEventArenaLeaveQueueMutation,
  useEventArenaQueueMutation,
} from "@/hooks/mutation/useEventArenaQueueMutation";
import { useEventCheckInMutation } from "@/hooks/mutation/useEventCheckInMutation";
import { useEventMatchReadyMutation } from "@/hooks/mutation/useEventMatchReadyMutation";
import { useStartHostedEventGameMutation } from "@/hooks/mutation/useStartHostedEventGameMutation";
import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { useEventArenaStandingsQuery } from "@/hooks/query/useEventArenaStandingsQuery";
import { useEventBracketQuery } from "@/hooks/query/useEventBracketQuery";
import { useEventEntriesQuery } from "@/hooks/query/useEventEntriesQuery";
import { useEventQuery } from "@/hooks/query/useEventQuery";
import { useEventStandingsQuery } from "@/hooks/query/useEventStandingsQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import {
  isRadixSelectPortalTarget,
  releaseBodyPointerEvents,
} from "@/hooks/use-deferred-dialog-selection";
import { isApiClientError } from "@/lib/api-client-error";
import { cupLobbyPlayerErrMsg } from "@/lib/cup-lobby-player-err";
import { arenaClockActive } from "@/lib/competition-arena";
import { cn } from "@/lib/utils";
import {
  eventCheckInWindowState,
  eventCupStarted,
  eventFormatUsesStandingsTable,
  tournamentFormatIsArena,
} from "@/lib/event-cup-lobby";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { computeEstPrizeShare, formatEstPrizeShareAmount } from "@/lib/est-prize-share";
import { cupLifecycleStatusLabel } from "@/lib/cupLifecycle";
import { hostedEventPrizePoolLines, prizePoolCardLabelsFromPlayer } from "@/lib/prize-pool-lines";
import { useAuthStore } from "@/store/auth";
import type { HostedBracketMatch } from "@/types/events";
import type { EventsPlayerChrome } from "@/types/events-player-chrome";
import {
  isEventsArenaLobbyChromeReady,
  isEventsCupLobbyChromeReady,
  isEventsPlayerChromeReady,
  isEventsReportChromeReady,
} from "@/types/events-player-chrome";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function parseLobbyPollMs(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type Props = {
  open: boolean;
  eventId: string | null;
  chromeRaw: EventsPlayerChrome | null | undefined;
  /** List / optimistic joined when detail has not refetched yet. */
  viewerJoined?: boolean;
  onOpenChange: (open: boolean) => void;
  closeLabel?: string;
};

function pickNextMatch(
  bracket: HostedBracketMatch[],
  userId: string,
): HostedBracketMatch | undefined {
  const id = userId.trim();
  if (!id) return undefined;
  const mine = bracket.filter(
    (m) =>
      !m.is_bye &&
      ((m.player_a_id || "").trim() === id || (m.player_b_id || "").trim() === id) &&
      !(m.finished_at || "").trim(),
  );
  mine.sort((a, b) => {
    if (a.round_index !== b.round_index) return a.round_index - b.round_index;
    return a.match_index - b.match_index;
  });
  return mine[0];
}

export function EventCupLobby({
  open,
  eventId,
  chromeRaw,
  viewerJoined = false,
  onOpenChange,
  closeLabel = "",
}: Props) {
  const id = (eventId || "").trim();
  const token = useAuthStore((s) => s.token);
  const myUserId = (useAuthStore((s) => s.user?.id) || "").trim();
  const router = useRouter();
  // Enable on id (not open): keep cache warm through close animation (deferred id clear).
  const detailQuery = useEventQuery(id, Boolean(id));
  const entriesQuery = useEventEntriesQuery(token, id, Boolean(id));
  const catalogQuery = useEventsCatalogQuery(Boolean(id));
  const enumsQuery = useClientEnumsQuery(Boolean(id));

  const evEarly = detailQuery.data;
  const isArenaFormat = useMemo(
    () => tournamentFormatIsArena(evEarly?.format_id ?? "", enumsQuery.data, catalogQuery.data),
    [evEarly?.format_id, enumsQuery.data, catalogQuery.data],
  );
  const lobbyChromeReady = isArenaFormat
    ? isEventsArenaLobbyChromeReady(chromeRaw)
    : isEventsCupLobbyChromeReady(chromeRaw);
  const lobbyChrome = lobbyChromeReady ? chromeRaw : undefined;
  const lobbyPollMs = parseLobbyPollMs(chromeRaw?.lobby_poll_interval_ms);
  const bracketQuery = useEventBracketQuery(id, Boolean(id), lobbyPollMs);

  const [reportOpen, setReportOpen] = useState(false);
  const reportChromeReady = isEventsReportChromeReady(chromeRaw);
  const reasonCodes = catalogQuery.data?.report_reason_codes ?? [];
  const reasonLabels = catalogQuery.data?.report_reason_labels ?? {};

  const checkIn = useEventCheckInMutation(token);
  const ready = useEventMatchReadyMutation(token);
  const startGame = useStartHostedEventGameMutation(token);
  const arenaQueue = useEventArenaQueueMutation(token);
  const arenaLeave = useEventArenaLeaveQueueMutation(token);
  const [arenaQueued, setArenaQueued] = useState(false);
  const autoOpenedGameRef = useRef("");

  const ev = detailQuery.data;
  useEffect(() => {
    if (ev?.viewer_arena_queued === true) {
      setArenaQueued(true);
    }
  }, [ev?.viewer_arena_queued]);
  const myEntry = useMemo(() => {
    if (!myUserId) return undefined;
    return (entriesQuery.data ?? []).find((e) => (e.user_id || "").trim() === myUserId);
  }, [entriesQuery.data, myUserId]);
  const joined = viewerJoined || Boolean(myEntry);
  const started = eventCupStarted(ev);
  const canReport =
    Boolean(token) && joined && started && reportChromeReady && reasonCodes.length > 0;
  const empty = (lobbyChrome?.empty_value || "").trim();
  const sep = chromeSeparator(lobbyChrome?.meta_separator);

  const usesStandingsTable = useMemo(
    () =>
      !isArenaFormat &&
      eventFormatUsesStandingsTable(ev?.format_id ?? "", catalogQuery.data, enumsQuery.data),
    [ev?.format_id, catalogQuery.data, enumsQuery.data, isArenaFormat],
  );
  // KO hides the standings table, but score_share / dual_purse still need /standings Pts for est. share.
  const needsStandingsForEstShare = useMemo(() => {
    if (isArenaFormat || !enumsQuery.data) return false;
    const mode = (ev?.prize_payout_mode || "").trim();
    if (!mode) return false;
    const scoreMode = (enumsQuery.data.competition_payout_mode_score_share || "").trim();
    const dualMode = (enumsQuery.data.competition_payout_mode_dual_purse || "").trim();
    return (Boolean(scoreMode) && mode === scoreMode) || (Boolean(dualMode) && mode === dualMode);
  }, [isArenaFormat, enumsQuery.data, ev?.prize_payout_mode]);
  const standingsQuery = useEventStandingsQuery(
    id,
    Boolean(id) && started && !isArenaFormat && (usesStandingsTable || needsStandingsForEstShare),
    lobbyPollMs,
  );
  const arenaStandingsQuery = useEventArenaStandingsQuery(
    token,
    id,
    Boolean(id) && started && isArenaFormat,
    lobbyPollMs,
  );
  const arenaActive = arenaClockActive(ev?.arena_ends_at);
  // Only server finished_at counts - timer expiry alone must not fake a finished cup.
  const arenaFinished = isArenaFormat && started && (ev?.finished_at || "").trim() !== "";

  const placedEntries = useMemo(
    () =>
      (entriesQuery.data ?? [])
        .filter((e) => typeof e.placement === "number")
        .slice()
        .sort((a, b) => (a.placement as number) - (b.placement as number)),
    [entriesQuery.data],
  );

  const nextMatch = useMemo(
    () => pickNextMatch(bracketQuery.data ?? [], myUserId),
    [bracketQuery.data, myUserId],
  );

  useEffect(() => {
    if (!open || !joined || !started) return;
    const gid = (nextMatch?.game_id || "").trim();
    if (!gid || gid === autoOpenedGameRef.current) return;
    autoOpenedGameRef.current = gid;
    setArenaQueued(false);
    router.push(`/?gameId=${encodeURIComponent(gid)}&mode=pvp`);
  }, [open, joined, started, nextMatch?.game_id, router]);

  const formatLabel = useMemo(() => {
    const label = (ev?.format_label || "").trim();
    if (!label || !lobbyChrome) return "";
    return `${lobbyChrome.format_label}${sep}${label}`.trim();
  }, [ev?.format_label, lobbyChrome, sep]);

  const prizeLines =
    ev && isEventsPlayerChromeReady(chromeRaw)
      ? hostedEventPrizePoolLines(ev, prizePoolCardLabelsFromPlayer(chromeRaw))
      : [];

  const estPrizeShare = useMemo(() => {
    if (!ev || prizeLines.length === 0 || !chromeRaw || !enumsQuery.data) return null;
    const mode = (ev.prize_payout_mode || "").trim();
    if (!mode) return null;
    const label = (chromeRaw.est_prize_share_label || "").trim();
    const blurb = softCommunityEstPrizeShareBlurb(chromeRaw.est_prize_share_blurb);
    if (!label || !blurb) return null;
    const placesMode = (enumsQuery.data.competition_payout_mode_places_percent || "").trim();
    const scoreMode = (enumsQuery.data.competition_payout_mode_score_share || "").trim();
    const dualMode = (enumsQuery.data.competition_payout_mode_dual_purse || "").trim();
    const dualPlacePursePercent = Number(
      (enumsQuery.data.competition_dual_purse_place_percent || "").trim(),
    );
    const standings = standingsQuery.data?.standings ?? [];
    const arenaRows = arenaStandingsQuery.data?.standings ?? [];
    let myPoints: number | null = null;
    let totalPoints = 0;
    if (isArenaFormat) {
      for (const r of arenaRows) {
        const pts = r.arena_points;
        if (typeof pts !== "number" || !Number.isFinite(pts) || pts <= 0) continue;
        totalPoints += pts;
        if ((r.user_id || "").trim() === myUserId) myPoints = pts;
      }
    } else {
      for (const r of standings) {
        const pts = r.points;
        if (typeof pts !== "number" || !Number.isFinite(pts) || pts <= 0) continue;
        totalPoints += pts;
        if ((r.user_id || "").trim() === myUserId) myPoints = pts;
      }
    }
    let placement: number | null =
      typeof myEntry?.placement === "number" ? myEntry.placement : null;
    if (placement == null && isArenaFormat) {
      const arenaIdx = arenaRows.findIndex((r) => (r.user_id || "").trim() === myUserId);
      if (arenaIdx >= 0) {
        const row = arenaRows[arenaIdx];
        placement =
          typeof row?.placement === "number" && Number.isFinite(row.placement)
            ? row.placement
            : arenaIdx + 1;
      }
    }
    if (placement == null) {
      const myRow = standings.find((r) => (r.user_id || "").trim() === myUserId);
      if (typeof myRow?.placement === "number") placement = myRow.placement;
    }
    const amount = computeEstPrizeShare({
      mode,
      placesMode,
      scoreMode,
      dualMode,
      dualPlacePursePercent: Number.isFinite(dualPlacePursePercent) ? dualPlacePursePercent : null,
      potNow: ev.prize_pool_now,
      myPoints,
      totalPoints: totalPoints > 0 ? totalPoints : null,
      myPlacement: placement,
      placePercents: ev.prize_place_percents ?? null,
    });
    if (amount == null) return null;
    const amtCurSep = chromeSeparator(chromeRaw.amount_currency_separator);
    const formatted = formatEstPrizeShareAmount(
      amount,
      (ev.prize_pool_currency || "").trim(),
      amtCurSep,
    );
    if (!formatted) return null;
    const metaSep = chromeSeparator(chromeRaw.meta_separator);
    const line = chromeSeparatorPresent(metaSep)
      ? [label, formatted].join(metaSep)
      : `${label} ${formatted}`;
    return { line, blurb };
  }, [
    ev,
    prizeLines.length,
    chromeRaw,
    enumsQuery.data,
    isArenaFormat,
    standingsQuery.data,
    arenaStandingsQuery.data,
    myUserId,
    myEntry?.placement,
  ]);

  const checkInState = eventCheckInWindowState(ev);
  const checkedIn = Boolean((myEntry?.checked_in_at || "").trim());

  if (!open) return null;

  const loading = Boolean(id) && detailQuery.isLoading && !ev;

  function openBoard(gameId: string) {
    const gid = gameId.trim();
    if (!gid) return;
    router.push(`/?gameId=${encodeURIComponent(gid)}&mode=pvp`);
  }

  function onCheckIn() {
    if (!id || !lobbyChrome) return;
    checkIn.mutate(
      { eventId: id },
      {
        onSuccess: () => {
          const ok = softCommunityJoinStatusMessage(lobbyChrome.check_in_success);
          if (ok) toast.success(ok);
        },
        onError: (err) => {
          const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
          const msg =
            key === "check_in_not_open"
              ? softCommunityJoinStatusMessage(lobbyChrome.check_in_not_open)
              : key === "check_in_closed"
                ? softCommunityJoinStatusMessage(lobbyChrome.check_in_closed)
                : softCommunityLoadFailed(lobbyChrome.load_failed);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  function onReady() {
    if (!id || !nextMatch?.id || !lobbyChrome) return;
    ready.mutate(
      { eventId: id, matchId: nextMatch.id },
      {
        onSuccess: (data) => {
          const ok = softCommunityJoinStatusMessage(lobbyChrome.ready_success);
          if (ok) toast.success(ok);
          const gid = (data.game_id || data.match?.game_id || "").trim();
          if (gid) openBoard(gid);
        },
        onError: (err) => {
          const msg = cupLobbyPlayerErrMsg(lobbyChrome, err);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  function onArenaQueue() {
    if (!id || !lobbyChrome) return;
    arenaQueue.mutate(
      { eventId: id },
      {
        onSuccess: () => {
          setArenaQueued(true);
          const ok = softCommunityJoinStatusMessage(lobbyChrome.arena_queue_done);
          if (ok) toast.success(ok);
        },
        onError: (err) => {
          const msg = cupLobbyPlayerErrMsg(lobbyChrome, err);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  function onArenaLeave() {
    if (!id || !lobbyChrome) return;
    arenaLeave.mutate(
      { eventId: id },
      {
        onSuccess: () => {
          setArenaQueued(false);
          const ok = softCommunityJoinStatusMessage(lobbyChrome.arena_left_blurb);
          if (ok) toast.success(ok);
        },
        onError: (err) => {
          const msg = cupLobbyPlayerErrMsg(lobbyChrome, err);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  function onOpenPlay() {
    if (!id || !nextMatch?.id || !lobbyChrome) return;
    const existing = (nextMatch.game_id || "").trim();
    if (existing) {
      openBoard(existing);
      return;
    }
    startGame.mutate(
      { eventId: id, matchId: nextMatch.id },
      {
        onSuccess: (data) => {
          const gid = (data.game_id || data.match?.game_id || "").trim();
          if (gid) openBoard(gid);
        },
        onError: (err) => {
          const msg = cupLobbyPlayerErrMsg(lobbyChrome, err);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  const myReady =
    nextMatch &&
    myUserId &&
    ((nextMatch.player_a_id || "").trim() === myUserId
      ? Boolean((nextMatch.player_a_ready_at || "").trim())
      : (nextMatch.player_b_id || "").trim() === myUserId
        ? Boolean((nextMatch.player_b_ready_at || "").trim())
        : false);

  const oppReady =
    nextMatch &&
    myUserId &&
    ((nextMatch.player_a_id || "").trim() === myUserId
      ? Boolean((nextMatch.player_b_ready_at || "").trim())
      : (nextMatch.player_b_id || "").trim() === myUserId
        ? Boolean((nextMatch.player_a_ready_at || "").trim())
        : false);

  const gameId = (nextMatch?.game_id || "").trim();

  useEffect(() => {
    if (open) return;
    releaseBodyPointerEvents();
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[220] bg-[var(--dama-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-skip-hide-on-scroll=""
          onOpenAutoFocus={(ev) => ev.preventDefault()}
          onCloseAutoFocus={(ev) => {
            ev.preventDefault();
            releaseBodyPointerEvents();
          }}
          onPointerDownOutside={(ev) => {
            if (isRadixSelectPortalTarget(ev.target)) {
              ev.preventDefault();
            }
          }}
          onInteractOutside={(ev) => {
            if (isRadixSelectPortalTarget(ev.target)) {
              ev.preventDefault();
            }
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-[221] flex max-h-[min(92dvh,44rem)] w-[min(96vw,40rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-float-shadow)] outline-none duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--dama-border)] px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold sm:text-lg">
                {lobbyChrome
                  ? isArenaFormat
                    ? softCommunityArenaLobbyTitle(lobbyChrome.arena_lobby_title)
                    : softCommunityLobbyTitle(lobbyChrome.lobby_title)
                  : softCommunityLobbyUnavailable(chromeRaw?.lobby_unavailable)}
              </Dialog.Title>
              {lobbyChrome ? (
                <p className="mt-0.5 text-xs text-[var(--dama-muted)]">
                  {isArenaFormat
                    ? softCommunityArenaLobbyBlurb(lobbyChrome.arena_lobby_blurb)
                    : softCommunityLobbyBlurb(lobbyChrome.lobby_blurb)}
                </p>
              ) : null}
            </div>
            <Dialog.Close
              className="shrink-0 rounded-md p-1.5 text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
              {...(closeLabel.trim()
                ? { "aria-label": closeLabel.trim() }
                : { "aria-hidden": true as const, tabIndex: -1 })}
            >
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {!lobbyChrome ? (
              <p className="text-sm text-[var(--dama-danger)]" role="alert">
                {softCommunityLobbyUnavailable(chromeRaw?.lobby_unavailable)}
              </p>
            ) : loading ? (
              <div className="space-y-3" aria-hidden>
                <ShimmerBlock className="h-6 w-2/3" />
                <ShimmerBlock className="h-24 w-full rounded-lg" />
              </div>
            ) : detailQuery.isError ? (
              <p className="text-sm text-[var(--dama-danger)]">
                {softCommunityLoadFailed(lobbyChrome.load_failed)}
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  {ev
                    ? (() => {
                        const images = eventGalleryImages(ev);
                        const brand = (ev.brand_color || "").trim();
                        if (images.length === 0 && !brand) return null;
                        return (
                          <div
                            className="relative mb-2 aspect-[16/10] w-full overflow-hidden rounded-lg bg-[var(--dama-surface)]"
                            style={
                              images.length === 0 && brand ? { backgroundColor: brand } : undefined
                            }
                          >
                            {images.length > 0 ? (
                              <GalleryCarousel
                                images={images}
                                ariaLabel={softCommunityCarouselAria(chromeRaw?.carousel_aria)}
                                className="absolute inset-0 h-full w-full"
                              />
                            ) : null}
                          </div>
                        );
                      })()
                    : null}
                  <p className="font-medium">{ev?.title?.trim() || empty}</p>
                  <p className="text-sm text-[var(--dama-muted)]">
                    {cupLifecycleStatusLabel(
                      ev,
                      chromeRaw,
                      (ev?.status_label || ev?.status || "").trim(),
                    ) || empty}
                  </p>
                  {(() => {
                    const desc = (ev?.description || "").trim();
                    const descLabel = (chromeRaw?.detail_description_label || "").trim();
                    if (!desc) return null;
                    return (
                      <div className="space-y-0.5 pt-1">
                        {descLabel ? (
                          <p className="text-xs text-[var(--dama-muted)]">{descLabel}</p>
                        ) : null}
                        <p className="whitespace-pre-wrap text-sm text-[var(--dama-text)]">
                          {desc}
                        </p>
                      </div>
                    );
                  })()}
                  {formatLabel ? (
                    <p className="text-xs text-[var(--dama-muted)]">{formatLabel}</p>
                  ) : null}
                  {prizeLines.map((line) => (
                    <p key={line} className="text-sm font-medium text-[var(--dama-text)]">
                      {line}
                    </p>
                  ))}
                  {estPrizeShare ? (
                    <>
                      <p className="text-sm font-medium text-[var(--dama-gold)]">
                        {estPrizeShare.line}
                      </p>
                      <p className="text-xs text-[var(--dama-muted)]">{estPrizeShare.blurb}</p>
                    </>
                  ) : null}
                </div>

                {(ev?.prize_settled_at || "").trim() ? (
                  <p className="text-sm text-[var(--dama-gold)]">
                    {softCommunityJoinStatusMessage(lobbyChrome.prize_settled_blurb)}
                  </p>
                ) : (ev?.dispute_window_ends_at || "").trim() ? (
                  // Escrow opened (paid pot). Free/no-escrow finishes omit dispute_window_ends_at - never invent pending.
                  <p className="text-sm text-[var(--dama-muted)]">
                    {softCommunityPrizePendingBlurb(lobbyChrome.prize_pending_blurb)}
                  </p>
                ) : null}

                {canReport && chromeRaw ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setReportOpen(true)}
                  >
                    {softHostingReportAction(chromeRaw.report_action)}
                  </Button>
                ) : null}

                {joined && !started ? (
                  <div className="space-y-2">
                    {(() => {
                      const checkInReq = softCommunityJoinStatusMessage(
                        chromeRaw?.check_in_required_blurb,
                      );
                      return checkInReq ? (
                        <p className="text-xs text-[var(--dama-muted)]">{checkInReq}</p>
                      ) : null;
                    })()}
                    {checkedIn ? (
                      <p className="text-sm text-[var(--dama-gold)]">{lobbyChrome.check_in_done}</p>
                    ) : checkInState === "not_open" ? (
                      <p className="text-sm text-[var(--dama-muted)]">
                        {softCommunityJoinStatusMessage(lobbyChrome.check_in_not_open)}
                      </p>
                    ) : checkInState === "closed" ? (
                      <p className="text-sm text-[var(--dama-muted)]">
                        {softCommunityJoinStatusMessage(lobbyChrome.check_in_closed)}
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        disabled={checkIn.isPending}
                        isLoading={checkIn.isPending}
                        pendingLabel={lobbyChrome.check_in_pending}
                        onClick={onCheckIn}
                      >
                        {lobbyChrome.check_in_action}
                      </Button>
                    )}
                  </div>
                ) : null}

                {isArenaFormat && joined && started ? (
                  <section className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-panel)]/40 p-3">
                    {arenaFinished ? (
                      <p className="text-sm text-[var(--dama-muted)]">
                        {lobbyChrome.arena_finished_blurb}
                      </p>
                    ) : (
                      <>
                        {arenaActive ? (
                          <ArenaClock
                            arenaEndsAt={ev?.arena_ends_at}
                            clockLabel={(lobbyChrome.arena_clock_label || "").trim()}
                          />
                        ) : null}
                        {gameId ? (
                          <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            onClick={() => openBoard(gameId)}
                          >
                            {lobbyChrome.lobby_open_play_action}
                          </Button>
                        ) : arenaActive && arenaQueued ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm text-[var(--dama-muted)]">
                              {lobbyChrome.arena_waiting_pair}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={arenaLeave.isPending}
                              isLoading={arenaLeave.isPending}
                              pendingLabel={lobbyChrome.arena_leave_queue_pending}
                              onClick={onArenaLeave}
                            >
                              {lobbyChrome.arena_leave_queue_action}
                            </Button>
                          </div>
                        ) : arenaActive ? (
                          <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            disabled={arenaQueue.isPending}
                            isLoading={arenaQueue.isPending}
                            pendingLabel={lobbyChrome.arena_queue_pending}
                            onClick={onArenaQueue}
                          >
                            {lobbyChrome.arena_queue_action}
                          </Button>
                        ) : null}
                      </>
                    )}
                  </section>
                ) : null}

                {!isArenaFormat && joined && started && !nextMatch && !gameId ? (
                  <p className="text-sm text-[var(--dama-muted)]">
                    {lobbyChrome.lobby_waiting_start}
                  </p>
                ) : null}

                {!isArenaFormat && joined && nextMatch ? (
                  <section className="space-y-2 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-panel)]/40 p-3">
                    <h2 className="text-sm font-semibold text-[var(--dama-gold)]">
                      {lobbyChrome.lobby_next_match_title}
                    </h2>
                    <p className="text-sm text-[var(--dama-muted)]">
                      {(nextMatch.player_a_username || "").trim() || empty}
                      {sep}
                      {(nextMatch.player_b_username || "").trim() || empty}
                    </p>
                    <p className="text-xs text-[var(--dama-muted)]">
                      {(nextMatch.status_label || "").trim() || empty}
                    </p>
                    {(() => {
                      const readyTimeout = softCommunityJoinStatusMessage(
                        chromeRaw?.ready_timeout_blurb,
                      );
                      return readyTimeout && !gameId ? (
                        <p className="text-xs text-[var(--dama-muted)]">{readyTimeout}</p>
                      ) : null;
                    })()}
                    <div className="flex flex-wrap gap-2">
                      {gameId ? (
                        <Button
                          type="button"
                          variant="gold"
                          size="sm"
                          onClick={() => openBoard(gameId)}
                        >
                          {lobbyChrome.lobby_open_play_action}
                        </Button>
                      ) : null}
                      {!gameId && myReady && oppReady ? (
                        <Button
                          type="button"
                          variant="gold"
                          size="sm"
                          disabled={startGame.isPending}
                          isLoading={startGame.isPending}
                          pendingLabel={lobbyChrome.ready_pending}
                          onClick={onOpenPlay}
                        >
                          {lobbyChrome.lobby_open_play_action}
                        </Button>
                      ) : null}
                      {!gameId && myReady && !oppReady ? (
                        <p className="text-sm text-[var(--dama-gold)]">
                          {softCommunityJoinStatusMessage(lobbyChrome.ready_waiting_opponent)}
                        </p>
                      ) : null}
                      {!gameId && !myReady ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={ready.isPending}
                          isLoading={ready.isPending}
                          pendingLabel={lobbyChrome.ready_pending}
                          onClick={onReady}
                        >
                          {lobbyChrome.ready_action}
                        </Button>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {(entriesQuery.data ?? []).length > 0 ? (
                  <section className="space-y-2">
                    <h2 className="font-semibold text-[var(--dama-gold)]">
                      {softCommunityRosterTitle(lobbyChrome.lobby_roster_title)}
                    </h2>
                    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                      {(entriesQuery.data ?? []).map((e) => (
                        <li
                          key={e.user_id}
                          className="flex items-center justify-between gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
                        >
                          <span>{(e.username || "").trim() || empty}</span>
                          {(e.checked_in_at || "").trim() ? (
                            <span className="text-xs text-[var(--dama-gold)]">
                              {lobbyChrome.check_in_done}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {isArenaFormat && started ? (
                  <ArenaStandingsTable
                    standings={arenaStandingsQuery.data?.standings ?? []}
                    chrome={{
                      arena_standings_title: lobbyChrome.arena_standings_title,
                      arena_points_label: lobbyChrome.arena_points_label,
                      arena_streak_label: lobbyChrome.arena_streak_label,
                      empty_value: lobbyChrome.empty_value,
                      standings_table_min_width: chromeRaw?.standings_table_min_width,
                    }}
                    loading={arenaStandingsQuery.isLoading}
                  />
                ) : null}

                {usesStandingsTable && started ? (
                  <EventStandingsTable
                    standings={standingsQuery.data?.standings ?? []}
                    chrome={{
                      standings_title: lobbyChrome.lobby_standings_title,
                      standings_played_label: chromeRaw?.standings_played_label,
                      standings_wins_label: chromeRaw?.standings_wins_label,
                      standings_losses_label: chromeRaw?.standings_losses_label,
                      standings_points_label: chromeRaw?.standings_points_label,
                      group_label_template: chromeRaw?.group_label_template,
                      empty_value: lobbyChrome.empty_value,
                      standings_table_min_width: chromeRaw?.standings_table_min_width,
                    }}
                    loading={standingsQuery.isLoading}
                  />
                ) : placedEntries.length > 0 ? (
                  <section className="space-y-2">
                    <h2 className="font-semibold text-[var(--dama-gold)]">
                      {lobbyChrome.lobby_standings_title}
                    </h2>
                    <ul className="space-y-2 text-sm">
                      {placedEntries.map((e) => (
                        <li
                          key={e.user_id}
                          className="flex items-center gap-3 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
                        >
                          <span className="tabular-nums font-semibold text-[var(--dama-gold)]">
                            {e.placement}
                          </span>
                          <span>{(e.username || "").trim() || empty}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {bracketQuery.data && bracketQuery.data.length > 0 ? (
                  <section className="space-y-2">
                    <h2 className="font-semibold text-[var(--dama-gold)]">
                      {softCommunityBracketTitle(lobbyChrome.lobby_bracket_title)}
                    </h2>
                    <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                      {bracketQuery.data.map((m) => {
                        const seatA = (m.player_a_username || "").trim();
                        const seatB = (m.player_b_username || "").trim();
                        const winner = (m.winner_username || "").trim();
                        const gid = (m.game_id || "").trim();
                        return (
                          <li
                            key={m.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
                          >
                            <span className="tabular-nums text-[var(--dama-muted)]">
                              {m.round_index + 1}/{m.match_index + 1}
                            </span>
                            <span>{(m.status_label || "").trim() || empty}</span>
                            {!m.is_bye && (seatA || seatB) ? (
                              <span className="text-[var(--dama-muted)]">
                                {seatA || empty}
                                {sep}
                                {seatB || empty}
                              </span>
                            ) : null}
                            {winner ? (
                              <span className="text-[var(--dama-gold)]">{winner}</span>
                            ) : null}
                            {gid ? (
                              <Link
                                href={`/?view=spectate&gameId=${encodeURIComponent(gid)}`}
                                className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
                              >
                                {softCommunitySpectateAction(lobbyChrome.spectate_action)}
                              </Link>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {started &&
                    !bracketQuery.data.some((m) => (m.game_id || "").trim()) &&
                    (chromeRaw?.lobby_no_live_boards || "").trim() ? (
                      <p className="text-sm text-[var(--dama-muted)]">
                        {(chromeRaw?.lobby_no_live_boards || "").trim()}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      {token && chromeRaw && reportChromeReady ? (
        <ReportEventDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          eventId={id || null}
          reportTarget="event"
          reasonCodes={reasonCodes}
          reasonLabels={reasonLabels}
          emptyValue={lobbyChrome?.empty_value ?? chromeRaw.empty_value ?? ""}
          chrome={{
            report_title: softCommunityReportTitle(chromeRaw.report_title ?? ""),
            report_reason_label: chromeRaw.report_reason_label ?? "",
            report_note_label: chromeRaw.report_note_label ?? "",
            report_submit_action: softCommunityReportSubmitAction(
              chromeRaw.report_submit_action ?? "",
            ),
            cancel_action: chromeRaw.cancel_action ?? "",
          }}
          token={token}
          closeLabel=""
        />
      ) : null}
    </Dialog.Root>
  );
}
