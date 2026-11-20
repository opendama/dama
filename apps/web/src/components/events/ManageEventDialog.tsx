"use client";

import { EventStandingsTable } from "@/components/events/EventStandingsTable";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EntityMediaEditor } from "@/components/media/EntityMediaEditor";
import { MediaDropzone } from "@/components/ui/media-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import { OfficialPauseConfirmDialog } from "@/components/events/OfficialPauseConfirmDialog";
import { useCloseHostedEventMutation } from "@/hooks/mutation/useCloseHostedEventMutation";
import { useHostedEventEntryActionsMutation } from "@/hooks/mutation/useHostedEventEntryActionsMutation";
import { useBulkOfficialPauseMutation } from "@/hooks/mutation/useBulkOfficialPauseMutation";
import { useBulkOfficialResumeMutation } from "@/hooks/mutation/useBulkOfficialResumeMutation";
import { useOfficialPauseGameMutation } from "@/hooks/mutation/useOfficialPauseGameMutation";
import { useOfficialPauseMetaMutation } from "@/hooks/mutation/useOfficialPauseMetaMutation";
import { useOfficialResumeGameMutation } from "@/hooks/mutation/useOfficialResumeGameMutation";
import { usePatchHostedEventMutation } from "@/hooks/mutation/usePatchHostedEventMutation";
import { useReopenHostedEventMutation } from "@/hooks/mutation/useReopenHostedEventMutation";
import { useForfeitHostedEventMatchMutation } from "@/hooks/mutation/useForfeitHostedEventMatchMutation";
import { useRematchHostedEventMatchMutation } from "@/hooks/mutation/useRematchHostedEventMatchMutation";
import { useStartHostedEventGameMutation } from "@/hooks/mutation/useStartHostedEventGameMutation";
import { useFinishEventArenaMutation } from "@/hooks/mutation/useFinishEventArenaMutation";
import { useStartHostedEventMutation } from "@/hooks/mutation/useStartHostedEventMutation";
import { useClearHostedEventPrizeImageMutation } from "@/hooks/mutation/useClearHostedEventPrizeImageMutation";
import { useRemoveHostedEventGalleryMutation } from "@/hooks/mutation/useRemoveHostedEventGalleryMutation";
import { useUploadHostedEventGalleryMutation } from "@/hooks/mutation/useUploadHostedEventGalleryMutation";
import { useUploadHostedEventLogoMutation } from "@/hooks/mutation/useUploadHostedEventLogoMutation";
import { useUploadHostedEventPrizeImageMutation } from "@/hooks/mutation/useUploadHostedEventPrizeImageMutation";
import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { useEventBracketQuery } from "@/hooks/query/useEventBracketQuery";
import { useEventEntriesQuery } from "@/hooks/query/useEventEntriesQuery";
import { useEventEntriesPagedQuery } from "@/hooks/query/useEventEntriesPagedQuery";
import { useEventLiveBoardsQuery } from "@/hooks/query/useEventLiveBoardsQuery";
import { useEventShareQuery } from "@/hooks/query/useEventShareQuery";
import { useEventStandingsQuery } from "@/hooks/query/useEventStandingsQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { useOfficialPauseChromeQuery } from "@/hooks/query/useOfficialPauseChromeQuery";
import { useOfficialPauseEventsQuery } from "@/hooks/query/useOfficialPauseEventsQuery";
import { DIALOG_CLEAR_MS } from "@/hooks/use-deferred-dialog-selection";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { authHeaders, restClient } from "@/lib/api";
import { isApiClientError } from "@/lib/api-client-error";
import { apiRestUrl } from "@/lib/env";
import {
  applyOfficialPauseFmt,
  formatPauseDurationSeconds,
  formatPauseSinceTime,
  isOfficialPause,
  isPlayerPause,
  livePauseStatusLabel,
  officialPauseErrorLabel,
  officialPauseRoleLabel,
} from "@/lib/official-pause-display";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { resolveEventInviteShareUrl } from "@/lib/event-invite-share-url";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { bracketChromeFrom } from "@/lib/events-bracket-chrome";
import { buildBracketSections } from "@/lib/events-bracket-sections";
import {
  eventsDialogShellLockedStyle,
  eventsLoadingBlockHeight,
} from "@/lib/events-dialog-shell-style";
import {
  buildResultCardBlob,
  buildResultCardText,
  shareOrDownloadResultCard,
} from "@/lib/events-result-card";
import { filenameFromContentDisposition } from "@/lib/filename-from-content-disposition";
import {
  hostedEventPrizePoolLines,
  prizePoolCardLabelsFromOrganizer,
} from "@/lib/prize-pool-lines";
import { tournamentFormatIsArena } from "@/lib/competition-arena";
import {
  buildPlacePercentsPayload,
  placePercentsSumInvalid,
  payoutModeOptions,
} from "@/lib/competition-payout";
import {
  softCommunityBracketTitle,
  softCommunityJoinStatusMessage,
  softCommunityResultCardDownloadAction,
  softCommunityResultCardShareImageAction,
  softCommunityShareResultAction,
  softCommunityWinnersTitle,
} from "@/lib/community-player-chrome-soft";
import {
  softHostingCloseAction,
  softHostingPublicDisabled,
  softHostingReopenAction,
  softHostingStartAction,
  softHostingPatchTitleLocked,
  softHostingTitleLabel,
  softHostingVisibilityPrivateBlurb,
  softHostingVisibilityPublicBlurb,
} from "@/lib/hosting-organizer-chrome-soft";
import { seatCapFillRight } from "@/lib/seat-cap-display";
import { playerProfileHref } from "@/lib/player-profile-href";
import { cn } from "@/lib/utils";
import type { HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import type { GamePayload } from "@/types/game";
import { isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { isOfficialPauseChromeReady } from "@/types/official-pause-chrome";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TabId =
  | "overview"
  | "join"
  | "players"
  | "bracket"
  | "live"
  | "branding"
  | "payments"
  | "results";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: HostedEvent | null;
  chrome: Required<EventsOrganizerChrome>;
  token: string;
  closeLabel: string;
};

export function ManageEventDialog({ open, onOpenChange, event, chrome, token, closeLabel }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [editTitle, setEditTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [editPayoutMode, setEditPayoutMode] = useState("");
  const [editPct1, setEditPct1] = useState("");
  const [editPct2, setEditPct2] = useState("");
  const [editPct3, setEditPct3] = useState("");
  const [officialPauseTarget, setOfficialPauseTarget] = useState<{
    gameId: string;
    mode: "pause" | "resume" | "meta";
  } | null>(null);
  const [bulkPauseRound, setBulkPauseRound] = useState<number | null>(null);
  const [bulkSelectedMode, setBulkSelectedMode] = useState<"pause" | "resume" | null>(null);
  const [liveRowSelection, setLiveRowSelection] = useState<Record<string, boolean>>({});
  const [gamePauseById, setGamePauseById] = useState<Record<string, GamePayload>>({});
  const [pauseStateEpoch, setPauseStateEpoch] = useState(0);
  const [liveOfficialPausedOnly, setLiveOfficialPausedOnly] = useState(false);
  const [activityGameId, setActivityGameId] = useState<string>("");
  const [rosterSkip, setRosterSkip] = useState(0);
  const [liveSkip, setLiveSkip] = useState(0);
  const closeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eventId = event?.id ?? null;
  // Keep queries/chrome warm while parent holds deferred event through exit animation.
  const sessionActive = Boolean(eventId);
  const pageSize = parseListPageSize(chrome.list_page_size);
  const mediaUploadChromeQuery = useMediaUploadChromeQuery(sessionActive && Boolean(token));
  const officialPauseChromeQuery = useOfficialPauseChromeQuery(sessionActive && Boolean(token));
  const officialPauseChrome = isOfficialPauseChromeReady(officialPauseChromeQuery.data)
    ? officialPauseChromeQuery.data
    : undefined;
  const dropzoneChrome = isMediaUploadChromeReady(mediaUploadChromeQuery.data)
    ? mediaUploadChromeQuery.data
    : undefined;
  const catalogQuery = useEventsCatalogQuery(sessionActive);
  const enumsQuery = useClientEnumsQuery(sessionActive && Boolean(token), {
    requireHostedEventDefault: true,
  });
  const defaultEventStatus = (enumsQuery.data?.hosted_event_default_status || "").trim();
  // Fail-closed: missing catalog default status locks title (no invent unlock).
  const editTitleLocked = Boolean(
    event && (!defaultEventStatus || (event.status || "").trim() !== defaultEventStatus),
  );
  // Prefetch tab payloads while the manage shell is open (no shimmer flash on first visit).
  // Results keeps the full unpaged roster; Players/Payments share one skip/limit page.
  const entriesQuery = useEventEntriesQuery(token, eventId, sessionActive);
  const rosterPagedQuery = useEventEntriesPagedQuery(
    token,
    eventId,
    rosterSkip,
    pageSize,
    sessionActive && pageSize > 0,
  );
  const liveBoardsQuery = useEventLiveBoardsQuery(
    token,
    eventId,
    liveSkip,
    pageSize,
    liveOfficialPausedOnly,
    sessionActive && pageSize > 0 && tab === "live",
  );
  const bracketQuery = useEventBracketQuery(eventId, sessionActive);
  const standingsQuery = useEventStandingsQuery(eventId, sessionActive);
  const shareQuery = useEventShareQuery(eventId, sessionActive);
  const patch = usePatchHostedEventMutation(token);

  useResetSkipOnChange(setRosterSkip, [eventId ?? ""]);
  useResetSkipOnChange(setLiveSkip, [eventId ?? "", liveOfficialPausedOnly]);

  const cancelCloseReset = useCallback(() => {
    if (closeResetTimer.current) {
      clearTimeout(closeResetTimer.current);
      closeResetTimer.current = null;
    }
  }, []);

  const resetManageEphemeralState = useCallback(() => {
    setTab("overview");
    setLiveRowSelection({});
    setBulkSelectedMode(null);
    setBulkPauseRound(null);
    setLiveOfficialPausedOnly(false);
    setActivityGameId("");
    setOfficialPauseTarget(null);
    setRosterSkip(0);
    setLiveSkip(0);
  }, []);

  useEffect(() => () => cancelCloseReset(), [cancelCloseReset]);

  useEffect(() => {
    if (!open || !event) return;
    if (tab === "overview") setEditTitle(event.title || "");
    if (tab === "payments") {
      setEditPayoutMode((event.prize_payout_mode || "").trim());
      const pp = event.prize_place_percents || {};
      setEditPct1(pp["1"] != null ? String(pp["1"]) : "");
      setEditPct2(pp["2"] != null ? String(pp["2"]) : "");
      setEditPct3(pp["3"] != null ? String(pp["3"]) : "");
    }
  }, [open, event, tab]);

  const livePageMatches = liveBoardsQuery.data?.matches ?? [];
  const liveGameIds = useMemo(() => {
    if (!sessionActive || (tab !== "bracket" && tab !== "live")) return [] as string[];
    const ids = new Set<string>();
    const source = tab === "live" ? livePageMatches : (bracketQuery.data ?? []);
    for (const m of source) {
      const gid = (m.game_id || "").trim();
      if (!gid || m.is_bye || (m.finished_at || "").trim()) continue;
      ids.add(gid);
    }
    return Array.from(ids).sort();
  }, [bracketQuery.data, livePageMatches, sessionActive, tab]);
  const officiallyPausedCount =
    typeof liveBoardsQuery.data?.officially_paused_count === "number"
      ? liveBoardsQuery.data.officially_paused_count
      : null;
  const rosterEntries = rosterPagedQuery.data?.entries ?? [];
  const rosterMeta = rosterPagedQuery.data?.meta;

  useEffect(() => {
    if (!token || liveGameIds.length === 0) return;
    // pauseStateEpoch intentionally forces a re-fetch after local pause/resume/meta.
    void pauseStateEpoch;
    let cancelled = false;
    void (async () => {
      const next: Record<string, GamePayload> = {};
      await Promise.all(
        liveGameIds.map(async (gameId) => {
          try {
            const { data } = await restClient.get<GamePayload>(
              `/games/${encodeURIComponent(gameId)}/state`,
              { headers: authHeaders(token) },
            );
            if (data?.id) next[data.id] = data;
          } catch {
            // Fail closed per board: no pause/resume CTA until /state loads.
          }
        }),
      );
      if (!cancelled) {
        setGamePauseById((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveGameIds, token, pauseStateEpoch]);

  // Cross-operator pause/resume/meta: refresh live pause snapshots while the dialog is open
  // (admin control room polls game state on a similar cadence).
  useEffect(() => {
    if (!open || (tab !== "live" && tab !== "bracket") || liveGameIds.length === 0) {
      return;
    }
    const bump = () => setPauseStateEpoch((n) => n + 1);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    const timer = window.setInterval(bump, 5000);
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [liveGameIds.length, open, tab]);

  const firstOfficiallyPausedGameId = useMemo(() => {
    for (const gid of liveGameIds) {
      if (isOfficialPause(gamePauseById[gid])) return gid;
    }
    return "";
  }, [gamePauseById, liveGameIds]);

  useEffect(() => {
    if (tab !== "live") return;
    if (activityGameId && liveGameIds.includes(activityGameId)) return;
    setActivityGameId(firstOfficiallyPausedGameId || liveGameIds[0] || "");
  }, [activityGameId, firstOfficiallyPausedGameId, liveGameIds, tab]);

  const pauseEventsQuery = useOfficialPauseEventsQuery(
    token,
    activityGameId,
    sessionActive && tab === "live" && Boolean(activityGameId),
  );

  const entryActions = useHostedEventEntryActionsMutation(token);
  const startEvent = useStartHostedEventMutation(token);
  const finishArena = useFinishEventArenaMutation(token);
  const startGame = useStartHostedEventGameMutation(token);
  const forfeitMatch = useForfeitHostedEventMatchMutation(token);
  const rematchMatch = useRematchHostedEventMatchMutation(token);
  const officialPauseGame = useOfficialPauseGameMutation(token);
  const officialResumeGame = useOfficialResumeGameMutation(token);
  const officialPauseMeta = useOfficialPauseMetaMutation(token);
  const bulkOfficialPause = useBulkOfficialPauseMutation(token);
  const bulkOfficialResume = useBulkOfficialResumeMutation(token);
  const closeEvent = useCloseHostedEventMutation(token);
  const reopenEvent = useReopenHostedEventMutation(token);
  const uploadLogo = useUploadHostedEventLogoMutation(token);
  const uploadPrizeImage = useUploadHostedEventPrizeImageMutation(token);
  const clearPrizeImage = useClearHostedEventPrizeImageMutation(token);
  const uploadGallery = useUploadHostedEventGalleryMutation(token);
  const removeGallery = useRemoveHostedEventGalleryMutation(token);
  const publicEventsEnabled = catalogQuery.data?.public_events_enabled === true;
  const isArenaCup = Boolean(
    event &&
      (tournamentFormatIsArena(event.format_id ?? "", enumsQuery.data, catalogQuery.data) ||
        Boolean((event.arena_ends_at || "").trim()) ||
        (typeof event.arena_duration_minutes === "number" && event.arena_duration_minutes > 0)),
  );
  const arenaFinishAction = (chrome.arena_finish_action || "").trim();
  const arenaFinishPending = (chrome.arena_finish_pending || "").trim();
  const arenaFinishBlocked = (() => {
    if (!event) return "";
    if ((event.finished_at || "").trim()) {
      return (chrome.arena_finish_already_finished || "").trim();
    }
    if (!(event.started_at || "").trim()) {
      return (chrome.arena_finish_requires_started || "").trim();
    }
    return "";
  })();
  // Prefer API visibility_label (client_enums); never invent English from raw codes.
  const visibilityLabel =
    (event?.visibility_label || "").trim() || (chrome.empty_value || "").trim();
  const publicVis = (enumsQuery.data?.hosted_event_public_visibility || "").trim();
  const privateVis = (enumsQuery.data?.hosted_event_private_visibility || "").trim();
  const entryApproved = (enumsQuery.data?.hosted_event_entry_approved || "").trim();
  const visibilityBlurb =
    publicVis && event?.visibility === publicVis
      ? softHostingVisibilityPublicBlurb(chrome.visibility_public_blurb)
      : privateVis && event?.visibility === privateVis
        ? softHostingVisibilityPrivateBlurb(chrome.visibility_private_blurb)
        : "";
  // Player-facing invite: remap legacy view=events /events/join → Community tournaments.
  const inviteShareUrl = resolveEventInviteShareUrl({
    shareUrl: shareQuery.data?.share_url || event?.share_url,
    joinCode: shareQuery.data?.join_code || event?.join_code,
    sharePathTemplate: catalogQuery.data?.share_path_template,
    origin: typeof window !== "undefined" ? window.location.origin : "",
  });

  const shellStyle = eventsDialogShellLockedStyle(chrome, { wide: true });
  const loadH = eventsLoadingBlockHeight(chrome);
  if (!shellStyle || loadH == null) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: chrome.overview_tab },
    { id: "join", label: chrome.join_tab },
    { id: "players", label: chrome.players_tab },
    { id: "bracket", label: chrome.bracket_tab },
    { id: "live", label: chrome.live_board_tab },
    { id: "branding", label: chrome.branding_tab },
    { id: "payments", label: chrome.payments_tab },
    { id: "results", label: chrome.results_tab },
  ];

  const copyText = async (text: string) => {
    const next = text.trim();
    // Never copy bare origin - that opens home instead of an invite.
    if (!next || /^https?:\/\/[^/]+\/?$/i.test(next)) {
      toast.error(chrome.toast_copy_failed);
      return;
    }
    try {
      await navigator.clipboard.writeText(next);
      toast.success(chrome.copied_blurb);
    } catch {
      toast.error(chrome.toast_copy_failed);
    }
  };

  const downloadQr = async () => {
    if (!eventId || !(token || "").trim()) return;
    try {
      const res = await fetch(`${apiRestUrl()}/events/${eventId}/qr.png`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error(chrome.toast_qr_download_failed);
        return;
      }
      const filename = filenameFromContentDisposition(res.headers.get("Content-Disposition"));
      if (!filename) {
        toast.error(chrome.toast_qr_download_failed);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(chrome.toast_qr_download_failed);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            cancelCloseReset();
          } else {
            // Defer tab/ephemeral reset until exit animation ends - instant
            // jump to Overview mid-close was the post-tab flicker/glitch.
            cancelCloseReset();
            closeResetTimer.current = setTimeout(() => {
              closeResetTimer.current = null;
              resetManageEphemeralState();
            }, DIALOG_CLEAR_MS);
          }
          onOpenChange(next);
        }}
      >
        <DialogContent
          // Lock height to DB shell so tab swaps do not reflow the centered modal.
          className="flex h-full min-h-0 w-full max-h-none flex-col overflow-hidden"
          style={shellStyle}
          closeLabel={closeLabel || undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex min-w-0 items-center gap-2 pr-2">
              <span className="truncate">
                {(event?.title || "").trim() || (chrome.empty_value || "").trim()}
              </span>
              <HostTrustBadge
                label={event?.organizer_host_trust_badge}
                tier={event?.organizer_host_trust_tier}
                className="shrink-0 text-[10px]"
              />
            </DialogTitle>
            <DialogDescription>
              {event
                ? `${(event.status_label || "").trim() || (chrome.empty_value || "").trim()}${chrome.meta_separator}${event.join_code}`
                : (chrome.empty_value || "").trim()}
            </DialogDescription>
            {(() => {
              const rep = hostReputationLine({
                finished: event?.organizer_finished_paid_cups,
                cancelled: event?.organizer_cancelled_paid_cups,
                openReports: event?.organizer_open_reports,
                finishedLabel: chrome.host_rep_finished_label,
                cancelledLabel: chrome.host_rep_cancelled_label,
                reportsLabel: chrome.host_rep_reports_label,
                separator: chrome.host_rep_meta_separator,
              });
              return rep ? <p className="text-[11px] text-[var(--dama-muted)]">{rep}</p> : null;
            })()}
          </DialogHeader>

          {event ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1 border-b border-[var(--dama-border)] pb-2">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      tab === t.id
                        ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                        : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
                    )}
                    onClick={() => {
                      setTab(t.id);
                      if (t.id === "overview") {
                        setEditTitle(event.title || "");
                      }
                      if (t.id === "branding") {
                        setDescription(event.description || "");
                        setSponsorName(event.sponsor_name || "");
                        setBrandColor(event.brand_color || "");
                      }
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "overview" ? (
                <div className="space-y-3 text-sm">
                  {(() => {
                    const poolLines = hostedEventPrizePoolLines(
                      event,
                      prizePoolCardLabelsFromOrganizer(chrome),
                    );
                    return (
                      <>
                        <p className="text-[var(--dama-muted)]">
                          {(() => {
                            const empty = (chrome.empty_value || "").trim();
                            const approved =
                              typeof event.approved_count === "number" &&
                              Number.isFinite(event.approved_count)
                                ? String(event.approved_count)
                                : empty;
                            const fillRight = seatCapFillRight(
                              event.max_players,
                              event.seat_cap_unlimited,
                              chrome.unlimited_players_label || "",
                            );
                            const suffix = (chrome.players_count_suffix || "").trim();
                            const playersLine = fillRight
                              ? `${approved}/${fillRight} ${suffix}`.trim()
                              : `${approved} ${suffix}`.trim();
                            const unlimLabel = (chrome.unlimited_players_label || "").trim();
                            const sizeLabel = (event.size_label || "").trim();
                            // Skip size when it duplicates Unlimited chrome / fill right.
                            const showSize =
                              Boolean(sizeLabel) &&
                              sizeLabel !== unlimLabel &&
                              sizeLabel !== (fillRight || "").trim();
                            return [
                              playersLine,
                              (event.format_label || "").trim(),
                              showSize ? sizeLabel : "",
                              ...poolLines,
                            ]
                              .filter((part) => (part || "").trim().length > 0)
                              .join(chrome.meta_separator);
                          })()}
                        </p>
                      </>
                    );
                  })()}
                  <Field id="manage-event-title" label={softHostingTitleLabel(chrome.title_label)}>
                    <Input
                      id="manage-event-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={editTitleLocked || !defaultEventStatus}
                      autoComplete="off"
                    />
                    {editTitleLocked && softHostingPatchTitleLocked(chrome.patch_title_locked) ? (
                      <p className="mt-1 text-xs text-[var(--dama-muted)]">
                        {softHostingPatchTitleLocked(chrome.patch_title_locked)}
                      </p>
                    ) : null}
                  </Field>
                  {!editTitleLocked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      isLoading={patch.isPending && patch.variables?.title != null}
                      pendingLabel={chrome.save_pending}
                      disabled={
                        !(editTitle || "").trim() ||
                        (editTitle || "").trim() === (event.title || "").trim()
                      }
                      onClick={() =>
                        patch.mutate({ id: event.id, title: (editTitle || "").trim() })
                      }
                    >
                      {chrome.save_action}
                    </Button>
                  ) : null}
                  <div className="space-y-1">
                    <p>
                      <span className="text-[var(--dama-muted)]">{chrome.visibility_label}</span>
                      {chrome.meta_separator}
                      <span className="font-medium">{visibilityLabel}</span>
                    </p>
                    {visibilityBlurb ? (
                      <p className="text-xs text-[var(--dama-muted)]">{visibilityBlurb}</p>
                    ) : null}
                    <p className="text-xs text-[var(--dama-muted)]">
                      {softCommunityJoinStatusMessage(chrome.force_auto_approve_note)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {privateVis &&
                    event.visibility === privateVis &&
                    publicEventsEnabled &&
                    publicVis ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        isLoading={patch.isPending && patch.variables?.visibility === publicVis}
                        onClick={() => patch.mutate({ id: event.id, visibility: publicVis })}
                      >
                        {chrome.make_public_action}
                      </Button>
                    ) : null}
                    {publicVis && event.visibility === publicVis && privateVis ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        isLoading={patch.isPending && patch.variables?.visibility === privateVis}
                        onClick={() => patch.mutate({ id: event.id, visibility: privateVis })}
                      >
                        {chrome.make_private_action}
                      </Button>
                    ) : null}
                    {!publicEventsEnabled && privateVis && event.visibility === privateVis ? (
                      <p className="w-full text-xs text-[var(--dama-muted)]">
                        {softHostingPublicDisabled(chrome.public_disabled)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {tab === "join" ? (
                <div className="space-y-3 text-sm">
                  {shareQuery.isLoading ? (
                    <ShimmerBlock className="w-full rounded-md" style={{ height: loadH }} />
                  ) : null}
                  <Field id="manage-join-code" label={chrome.join_code_label}>
                    <div className="flex gap-2">
                      <Input
                        id="manage-join-code"
                        readOnly
                        value={shareQuery.data?.join_code || event.join_code}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyText(shareQuery.data?.join_code || event.join_code)}
                      >
                        {chrome.copy_code_action}
                      </Button>
                    </div>
                  </Field>
                  <Field id="manage-join-link" label={chrome.join_link_label}>
                    <div className="flex gap-2">
                      <Input id="manage-join-link" readOnly value={inviteShareUrl} />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!inviteShareUrl}
                        onClick={() => void copyText(inviteShareUrl)}
                      >
                        {chrome.copy_link_action}
                      </Button>
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="gold" onClick={() => void downloadQr()}>
                      {chrome.download_qr_action}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!inviteShareUrl || !(shareQuery.data?.join_code || event.join_code)}
                      onClick={() => {
                        const code = shareQuery.data?.join_code || event.join_code;
                        const text = chrome.invite_text_template
                          .replaceAll("{code}", code)
                          .replaceAll("{link}", inviteShareUrl);
                        void copyText(text);
                      }}
                    >
                      {chrome.copy_invite_action}
                    </Button>
                  </div>
                </div>
              ) : null}

              {tab === "players" ? (
                <div className="space-y-3">
                  {pageSize < 1 ? null : rosterPagedQuery.isLoading ? (
                    <ShimmerBlock className="w-full rounded-md" style={{ height: loadH }} />
                  ) : null}
                  {pageSize > 0 && !rosterPagedQuery.isLoading && rosterEntries.length === 0 ? (
                    <p className="text-sm text-[var(--dama-muted)]">
                      {(chrome.empty_list || "").trim()}
                    </p>
                  ) : null}
                  {(() => {
                    const scrollMax = Number((chrome.dialog_scroll_max_height || "").trim());
                    if (!Number.isFinite(scrollMax) || scrollMax <= 0) return null;
                    if (pageSize < 1 || rosterEntries.length === 0) return null;
                    return (
                      <ul
                        className="space-y-2 overflow-y-auto text-sm"
                        style={{ maxHeight: scrollMax }}
                      >
                        {rosterEntries.map((en) => (
                          <li
                            key={en.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--dama-border)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {(en.username || "").trim() || (chrome.empty_value || "").trim()}
                              </p>
                              <p className="text-xs text-[var(--dama-muted)]">
                                {(en.status_label || "").trim() ||
                                  (chrome.empty_value || "").trim()}
                                {(en.checked_in_at || "").trim() &&
                                (chrome.players_checked_in_label || "").trim()
                                  ? `${chrome.meta_separator}${(chrome.players_checked_in_label || "").trim()}`
                                  : ""}
                                {typeof en.placement === "number"
                                  ? `${chrome.meta_separator}${en.placement}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(chrome.players_open_player_label || "").trim() &&
                              (en.user_id || "").trim() ? (
                                <Button type="button" size="sm" variant="outline" asChild>
                                  <Link
                                    href={playerProfileHref(en.user_id)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {(chrome.players_open_player_label || "").trim()}
                                  </Link>
                                </Button>
                              ) : null}
                              {entryApproved && en.status === entryApproved ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  isLoading={
                                    entryActions.isPending &&
                                    entryActions.variables?.userId === en.user_id &&
                                    entryActions.variables?.action === "kick"
                                  }
                                  onClick={() =>
                                    entryActions.mutate({
                                      eventId: event.id,
                                      userId: en.user_id,
                                      action: "kick",
                                    })
                                  }
                                >
                                  {chrome.kick_action}
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  {pageSize > 0 && rosterMeta ? (
                    <SkipPagination
                      meta={rosterMeta}
                      onPrev={setRosterSkip}
                      onNext={setRosterSkip}
                      disabled={rosterPagedQuery.isFetching && !rosterPagedQuery.isLoading}
                      inputId="manage-event-players-skip"
                    />
                  ) : null}
                </div>
              ) : null}

              {tab === "payments" ? (
                <div className="space-y-3 text-sm">
                  <p>
                    <span className="text-[var(--dama-muted)]">{chrome.host_fee_paid_label}</span>
                    <span className="ml-2 font-mono text-[var(--dama-gold)]">
                      {typeof event.host_fee_amount === "number"
                        ? event.host_fee_amount
                        : (chrome.empty_value || "").trim()}
                      {chrome.amount_currency_separator}
                      {(event.host_fee_currency || "").trim() || (chrome.empty_value || "").trim()}
                    </span>
                  </p>
                  {(() => {
                    const empty = (chrome.empty_value || "").trim();
                    const totals = rosterPagedQuery.data;
                    const paidCount =
                      typeof totals?.entry_fees_paid_count === "number"
                        ? totals.entry_fees_paid_count
                        : null;
                    const gross =
                      typeof totals?.entry_fees_gross === "number" ? totals.entry_fees_gross : null;
                    const net =
                      typeof totals?.entry_fees_organizer_net === "number"
                        ? totals.entry_fees_organizer_net
                        : null;
                    const commissionSum =
                      typeof totals?.entry_fees_commission === "number"
                        ? totals.entry_fees_commission
                        : null;
                    const cur = (totals?.entry_fees_currency || "").trim() || empty;
                    if (
                      event.is_free_entry ||
                      paidCount == null ||
                      paidCount < 1 ||
                      gross == null ||
                      net == null ||
                      commissionSum == null
                    ) {
                      return (
                        <p>
                          <span className="text-[var(--dama-muted)]">
                            {chrome.entry_fees_collected_label}
                          </span>
                          <span className="ml-2 font-mono text-[var(--dama-gold)]">{empty}</span>
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <p>
                          <span className="text-[var(--dama-muted)]">
                            {chrome.entry_fees_gross_label}
                          </span>
                          <span className="ml-2 font-mono text-[var(--dama-gold)]">
                            {gross}
                            {chrome.amount_currency_separator}
                            {cur}
                          </span>
                        </p>
                        <p>
                          <span className="text-[var(--dama-muted)]">
                            {chrome.payments_commission_label}
                          </span>
                          <span className="ml-2 font-mono text-[var(--dama-gold)]">
                            {commissionSum}
                            {chrome.amount_currency_separator}
                            {cur}
                          </span>
                        </p>
                        <p>
                          <span className="text-[var(--dama-muted)]">
                            {chrome.payments_organizer_net_label}
                          </span>
                          <span className="ml-2 font-mono text-[var(--dama-gold)]">
                            {net}
                            {chrome.amount_currency_separator}
                            {cur}
                          </span>
                        </p>
                        <p className="text-xs text-[var(--dama-muted)]">
                          {paidCount}
                          {chrome.amount_currency_separator}
                          {chrome.players_count_suffix}
                        </p>
                      </div>
                    );
                  })()}
                  {pageSize > 0 && rosterEntries.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {rosterEntries.map((en) => {
                        const empty = (chrome.empty_value || "").trim();
                        const cur = (en.fee_currency || "").trim() || empty;
                        const paid =
                          typeof en.fee_paid === "number" && en.fee_paid > 0 ? en.fee_paid : null;
                        return (
                          <li
                            key={`pay-${en.id}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--dama-border)] px-3 py-2"
                          >
                            <p className="min-w-0 truncate font-medium">
                              {(en.username || "").trim() || empty}
                            </p>
                            <p className="font-mono text-[var(--dama-gold)]">
                              {paid == null
                                ? empty
                                : `${paid}${chrome.amount_currency_separator}${cur}`}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {pageSize > 0 && rosterMeta ? (
                    <SkipPagination
                      meta={rosterMeta}
                      onPrev={setRosterSkip}
                      onNext={setRosterSkip}
                      disabled={rosterPagedQuery.isFetching && !rosterPagedQuery.isLoading}
                      inputId="manage-event-payments-skip"
                    />
                  ) : null}
                  {!event.is_free_entry &&
                  typeof event.entry_fee_commission_percent === "number" ? (
                    <div className="space-y-1">
                      <p>
                        <span className="text-[var(--dama-muted)]">
                          {chrome.commission_percent_label}
                        </span>
                        <span className="ml-2 font-mono text-[var(--dama-gold)]">
                          {event.entry_fee_commission_percent}
                        </span>
                      </p>
                      {(chrome.commission_blurb_template || "").trim() ? (
                        <p className="text-xs text-[var(--dama-muted)]">
                          {chrome.commission_blurb_template.replaceAll(
                            "{percent}",
                            String(event.entry_fee_commission_percent),
                          )}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {(() => {
                    const canEditPayout =
                      event.prize_pool_display_enabled === true &&
                      !event.is_free_entry &&
                      !event.started_at &&
                      !event.prize_pool_frozen &&
                      enumsQuery.data &&
                      (chrome.payout_mode_label || "").trim() &&
                      (chrome.payout_mode_blurb || "").trim();
                    if (!canEditPayout) return null;
                    const placesMode = (
                      enumsQuery.data.competition_payout_mode_places_percent || ""
                    ).trim();
                    const scoreMode = (
                      enumsQuery.data.competition_payout_mode_score_share || ""
                    ).trim();
                    const dualMode = (
                      enumsQuery.data.competition_payout_mode_dual_purse || ""
                    ).trim();
                    const needsPlacePercents =
                      editPayoutMode === placesMode || editPayoutMode === dualMode;
                    const sumBad =
                      needsPlacePercents && placePercentsSumInvalid(editPct1, editPct2, editPct3);
                    return (
                      <div className="space-y-3 rounded-lg border border-[var(--dama-border)] p-3">
                        <p className="text-sm font-medium">{chrome.payout_mode_label}</p>
                        <p className="text-xs text-[var(--dama-muted)]">
                          {chrome.payout_mode_blurb}
                        </p>
                        <Field id="manage-payout-mode" label={chrome.payout_mode_label}>
                          <Select
                            value={editPayoutMode || undefined}
                            onValueChange={setEditPayoutMode}
                          >
                            <SelectTrigger id="manage-payout-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {payoutModeOptions(enumsQuery.data, event.format_id).map((opt) => {
                                let label = opt.value;
                                if (opt.value === placesMode) {
                                  label = chrome.payout_mode_places_percent_label;
                                }
                                if (opt.value === scoreMode) {
                                  label = chrome.payout_mode_score_share_label;
                                }
                                if (opt.value === dualMode) {
                                  label = chrome.payout_mode_dual_purse_label;
                                }
                                return (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {label}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </Field>
                        {needsPlacePercents ? (
                          <>
                            <p className="text-sm font-medium">
                              {chrome.prize_place_percents_section_label}
                            </p>
                            <p className="text-xs text-[var(--dama-muted)]">
                              {chrome.prize_place_percents_blurb}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Field id="manage-pct-1" label={chrome.prize_place_percent_1_label}>
                                <Input
                                  id="manage-pct-1"
                                  value={editPct1}
                                  onChange={(e) => setEditPct1(e.target.value)}
                                />
                              </Field>
                              <Field id="manage-pct-2" label={chrome.prize_place_percent_2_label}>
                                <Input
                                  id="manage-pct-2"
                                  value={editPct2}
                                  onChange={(e) => setEditPct2(e.target.value)}
                                />
                              </Field>
                              <Field id="manage-pct-3" label={chrome.prize_place_percent_3_label}>
                                <Input
                                  id="manage-pct-3"
                                  value={editPct3}
                                  onChange={(e) => setEditPct3(e.target.value)}
                                />
                              </Field>
                            </div>
                            {sumBad && (chrome.err_prize_place_percents_sum || "").trim() ? (
                              <p className="text-xs text-red-600">
                                {chrome.err_prize_place_percents_sum}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={
                            patch.isPending ||
                            !editPayoutMode ||
                            sumBad ||
                            (needsPlacePercents &&
                              !buildPlacePercentsPayload(editPct1, editPct2, editPct3))
                          }
                          isLoading={patch.isPending}
                          pendingLabel={(chrome.save_pending || "").trim() || undefined}
                          onClick={() => {
                            const body: {
                              id: string;
                              prize_payout_mode: string;
                              prize_place_percents?: Record<string, number>;
                            } = {
                              id: event.id,
                              prize_payout_mode: editPayoutMode.trim(),
                            };
                            if (needsPlacePercents) {
                              const percents = buildPlacePercentsPayload(
                                editPct1,
                                editPct2,
                                editPct3,
                              );
                              if (!percents) return;
                              body.prize_place_percents = percents;
                            } else {
                              body.prize_place_percents = {};
                            }
                            patch.mutate(body);
                          }}
                        >
                          {(chrome.save_action || "").trim()}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {tab === "results" ? (
                <div className="space-y-4">
                  {(() => {
                    const placed = (entriesQuery.data ?? [])
                      .filter((e) => typeof e.placement === "number")
                      .slice()
                      .sort((a, b) => (a.placement as number) - (b.placement as number));
                    const empty = (chrome.empty_value || "").trim();
                    const winnersTitle = softCommunityWinnersTitle(chrome.winners_title);
                    const shareResultAction = softCommunityShareResultAction(
                      chrome.share_result_action,
                    );
                    const shareImage = softCommunityResultCardShareImageAction(
                      chrome.result_card_share_image_action,
                    );
                    const downloadImage = softCommunityResultCardDownloadAction(
                      chrome.result_card_download_action,
                    );
                    const cardFilename = (chrome.result_card_filename || "").trim();
                    const imageFailed = (chrome.result_card_image_failed || "").trim();
                    const sponsorPrefix = (chrome.result_card_sponsor_prefix || "").trim();
                    const cardBg = (chrome.result_card_bg_color || "").trim();
                    const cardFg = (chrome.result_card_fg_color || "").trim();
                    const cardMuted = (chrome.result_card_muted_color || "").trim();
                    const cardRowWash = (chrome.result_card_row_wash_color || "").trim();
                    const titleFont = (chrome.result_card_title_font || "").trim();
                    const winnersFont = (chrome.result_card_winners_font || "").trim();
                    const sponsorFont = (chrome.result_card_sponsor_font || "").trim();
                    const placementFont = (chrome.result_card_placement_font || "").trim();
                    const nameFont = (chrome.result_card_name_font || "").trim();
                    const washAlpha = (chrome.result_card_header_wash_alpha || "").trim();
                    const cardWidth = (chrome.result_card_width || "").trim();
                    const cardRowH = (chrome.result_card_row_height || "").trim();
                    const cardHeaderH = (chrome.result_card_header_height || "").trim();
                    const cardSponsorH = (chrome.result_card_sponsor_height || "").trim();
                    const cardPlacementsMax = (chrome.result_card_placements_max || "").trim();
                    const cardRowRadius = (chrome.result_card_row_radius || "").trim();
                    const cardPad = (chrome.result_card_pad || "").trim();
                    const cardLogoSize = (chrome.result_card_logo_size || "").trim();
                    const cardTitleY = (chrome.result_card_title_y || "").trim();
                    const cardWinnersY = (chrome.result_card_winners_y || "").trim();
                    const cardBodyGap = (chrome.result_card_body_gap || "").trim();
                    const cardRowsTopGap = (chrome.result_card_rows_top_gap || "").trim();
                    const cardBottomPad = (chrome.result_card_bottom_pad || "").trim();
                    const cardRowInset = (chrome.result_card_row_inset || "").trim();
                    const cardRowInnerGap = (chrome.result_card_row_inner_gap || "").trim();
                    const cardPlacementX = (chrome.result_card_placement_x || "").trim();
                    const cardNameX = (chrome.result_card_name_x || "").trim();
                    const cardRowTextY = (chrome.result_card_row_text_y || "").trim();
                    const cardSponsorLogoW = (chrome.result_card_sponsor_logo_w || "").trim();
                    const cardSponsorLogoH = (chrome.result_card_sponsor_logo_h || "").trim();
                    const cardSponsorLogoGap = (chrome.result_card_sponsor_logo_gap || "").trim();
                    const cardLogoTextGap = (chrome.result_card_logo_text_gap || "").trim();
                    const imageChromeReady = Boolean(
                      shareImage &&
                        downloadImage &&
                        cardFilename &&
                        imageFailed &&
                        sponsorPrefix &&
                        cardBg &&
                        cardFg &&
                        cardMuted &&
                        cardRowWash &&
                        titleFont &&
                        winnersFont &&
                        sponsorFont &&
                        placementFont &&
                        nameFont &&
                        washAlpha &&
                        cardWidth &&
                        cardRowH &&
                        cardHeaderH &&
                        cardSponsorH &&
                        cardPlacementsMax &&
                        cardRowRadius &&
                        cardPad &&
                        cardLogoSize &&
                        cardTitleY &&
                        cardWinnersY &&
                        cardBodyGap &&
                        cardRowsTopGap &&
                        cardBottomPad &&
                        cardRowInset &&
                        cardRowInnerGap &&
                        cardPlacementX &&
                        cardNameX &&
                        cardRowTextY &&
                        cardSponsorLogoW &&
                        cardSponsorLogoH &&
                        cardSponsorLogoGap &&
                        cardLogoTextGap,
                    );
                    const placements = placed.map((e) => ({
                      placement: e.placement as number,
                      username: (e.username || "").trim(),
                    }));
                    const text = buildResultCardText({
                      title: (event.title || "").trim(),
                      winnersTitle,
                      logoUrl: event.logo_url,
                      sponsorName: event.sponsor_name,
                      sponsorLogoUrl: event.sponsor_logo_url,
                      sponsorNameLabel: chrome.sponsor_name_label,
                      placements,
                      emptyValue: empty,
                      metaSeparator: chrome.meta_separator,
                    });
                    const shareText = async () => {
                      try {
                        if (typeof navigator !== "undefined" && navigator.share) {
                          await navigator.share({ text });
                          return;
                        }
                        await navigator.clipboard.writeText(text);
                        toast.success(chrome.copied_blurb);
                      } catch {
                        try {
                          await navigator.clipboard.writeText(text);
                          toast.success(chrome.copied_blurb);
                        } catch {
                          toast.error(chrome.toast_copy_failed);
                        }
                      }
                    };
                    const shareImageCard = async (preferDownload: boolean) => {
                      if (!imageChromeReady) {
                        toast.error(imageFailed);
                        return;
                      }
                      try {
                        const blob = await buildResultCardBlob({
                          title: (event.title || "").trim(),
                          logoUrl: event.logo_url,
                          sponsorName: event.sponsor_name,
                          sponsorLogoUrl: event.sponsor_logo_url,
                          brandColor: event.brand_color,
                          placements,
                          chrome: {
                            winners_title: winnersTitle,
                            result_card_sponsor_prefix: sponsorPrefix,
                            result_card_image_failed: imageFailed,
                            empty_value: empty,
                            meta_separator: chrome.meta_separator,
                            result_card_bg_color: cardBg,
                            result_card_fg_color: cardFg,
                            result_card_muted_color: cardMuted,
                            result_card_row_wash_color: cardRowWash,
                            result_card_title_font: titleFont,
                            result_card_winners_font: winnersFont,
                            result_card_sponsor_font: sponsorFont,
                            result_card_placement_font: placementFont,
                            result_card_name_font: nameFont,
                            result_card_header_wash_alpha: washAlpha,
                            result_card_width: cardWidth,
                            result_card_row_height: cardRowH,
                            result_card_header_height: cardHeaderH,
                            result_card_sponsor_height: cardSponsorH,
                            result_card_placements_max: cardPlacementsMax,
                            result_card_row_radius: cardRowRadius,
                            result_card_pad: cardPad,
                            result_card_logo_size: cardLogoSize,
                            result_card_title_y: cardTitleY,
                            result_card_winners_y: cardWinnersY,
                            result_card_body_gap: cardBodyGap,
                            result_card_rows_top_gap: cardRowsTopGap,
                            result_card_bottom_pad: cardBottomPad,
                            result_card_row_inset: cardRowInset,
                            result_card_row_inner_gap: cardRowInnerGap,
                            result_card_placement_x: cardPlacementX,
                            result_card_name_x: cardNameX,
                            result_card_row_text_y: cardRowTextY,
                            result_card_sponsor_logo_w: cardSponsorLogoW,
                            result_card_sponsor_logo_h: cardSponsorLogoH,
                            result_card_sponsor_logo_gap: cardSponsorLogoGap,
                            result_card_logo_text_gap: cardLogoTextGap,
                          },
                        });
                        if (!blob) {
                          toast.error(imageFailed);
                          return;
                        }
                        if (preferDownload) {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = cardFilename;
                          a.click();
                          URL.revokeObjectURL(url);
                          return;
                        }
                        const result = await shareOrDownloadResultCard(blob, cardFilename, {
                          mode: "share",
                          shareActionPresent: Boolean(shareImage),
                          canShareFiles: true,
                          shareCompanionText: text,
                        });
                        if (result === "failed") {
                          toast.error(imageFailed);
                        }
                      } catch {
                        toast.error(imageFailed);
                      }
                    };
                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[var(--dama-gold)]">
                            {winnersTitle}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {shareResultAction && placed.length > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void shareText()}
                              >
                                {shareResultAction}
                              </Button>
                            ) : null}
                            {imageChromeReady && placed.length > 0 ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void shareImageCard(false)}
                                >
                                  {shareImage}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void shareImageCard(true)}
                                >
                                  {downloadImage}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {event.logo_url || event.sponsor_logo_url ? (
                          <div className="flex flex-wrap items-center gap-3">
                            {(() => {
                              const previewH = Number(
                                (chrome.branding_preview_height || "").trim(),
                              );
                              const previewMaxW = Number(
                                (chrome.branding_preview_max_width || "").trim(),
                              );
                              if (
                                !Number.isFinite(previewH) ||
                                previewH <= 0 ||
                                !Number.isFinite(previewMaxW) ||
                                previewMaxW <= 0
                              ) {
                                return null;
                              }
                              return (
                                <>
                                  {event.logo_url ? (
                                    <img
                                      src={event.logo_url}
                                      alt=""
                                      className="rounded object-cover"
                                      style={{ height: previewH, width: previewH }}
                                    />
                                  ) : null}
                                  {event.sponsor_logo_url ? (
                                    <img
                                      src={event.sponsor_logo_url}
                                      alt=""
                                      className="object-contain"
                                      style={{
                                        height: previewH,
                                        maxWidth: previewMaxW,
                                      }}
                                    />
                                  ) : null}
                                </>
                              );
                            })()}
                            {(event.sponsor_name || "").trim() ? (
                              <span className="text-sm text-[var(--dama-muted)]">
                                {sponsorPrefix
                                  ? `${sponsorPrefix} ${(event.sponsor_name || "").trim()}`
                                  : (event.sponsor_name || "").trim()}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {entriesQuery.isLoading ? (
                          <ShimmerBlock className="w-full rounded-md" style={{ height: loadH }} />
                        ) : null}
                        {(() => {
                          const scrollMax = Number((chrome.dialog_scroll_max_height || "").trim());
                          if (!Number.isFinite(scrollMax) || scrollMax <= 0) return null;
                          return (
                            <ul
                              className="space-y-2 overflow-y-auto text-sm"
                              style={{ maxHeight: scrollMax }}
                            >
                              {placed.map((e) => (
                                <li
                                  key={e.user_id}
                                  className="flex items-center gap-3 rounded-md border border-[var(--dama-border)] px-3 py-2"
                                >
                                  <span className="tabular-nums font-semibold text-[var(--dama-gold)]">
                                    {e.placement}
                                  </span>
                                  <span>{(e.username || "").trim() || empty}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                        {!entriesQuery.isLoading && placed.length === 0 ? (
                          <p className="text-sm text-[var(--dama-muted)]">{empty}</p>
                        ) : null}
                        <EventStandingsTable
                          standings={standingsQuery.data?.standings ?? []}
                          chrome={chrome}
                          loading={standingsQuery.isLoading}
                        />
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {tab === "bracket" || tab === "live" ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--dama-gold)]">
                    {tab === "live"
                      ? (chrome.live_paused_section_title || "").trim() ||
                        (chrome.live_board_tab || "").trim()
                      : softCommunityBracketTitle(chrome.bracket_title)}
                  </h3>
                  {tab === "live" ? (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--dama-muted)]">
                      {(chrome.kpi_paused_boards_label || "").trim() &&
                      chromeSeparatorPresent(officialPauseChrome?.kpi_count_separator) &&
                      typeof officiallyPausedCount === "number" ? (
                        <span>
                          {(chrome.kpi_paused_boards_label || "").trim()}
                          {chromeSeparator(officialPauseChrome?.kpi_count_separator)}
                          {officiallyPausedCount}
                        </span>
                      ) : null}
                      {/* Completed avg lives on organizer dashboard (API official_pause_avg_seconds). */}
                    </div>
                  ) : null}
                  {tab === "live" && officialPauseChrome ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {(officialPauseChrome.filter_all || "").trim() ||
                      (officialPauseChrome.filter_official_paused || "").trim() ? (
                        <div
                          role="tablist"
                          aria-label={
                            (chrome.live_paused_section_title || "").trim() ||
                            (chrome.live_board_tab || "").trim() ||
                            undefined
                          }
                          className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
                        >
                          {(officialPauseChrome.filter_all || "").trim() ? (
                            <button
                              type="button"
                              role="tab"
                              aria-selected={!liveOfficialPausedOnly}
                              className={
                                !liveOfficialPausedOnly
                                  ? "rounded-md bg-[var(--dama-card)] px-3 py-1.5 text-sm font-medium text-[var(--dama-fg)] shadow-sm"
                                  : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--dama-muted)] hover:text-[var(--dama-fg)]"
                              }
                              onClick={() => {
                                setLiveRowSelection({});
                                setLiveOfficialPausedOnly(false);
                                setLiveSkip(0);
                              }}
                            >
                              {(officialPauseChrome.filter_all || "").trim()}
                            </button>
                          ) : null}
                          {(officialPauseChrome.filter_official_paused || "").trim() ? (
                            <button
                              type="button"
                              role="tab"
                              aria-selected={liveOfficialPausedOnly}
                              className={
                                liveOfficialPausedOnly
                                  ? "rounded-md bg-[var(--dama-card)] px-3 py-1.5 text-sm font-medium text-[var(--dama-fg)] shadow-sm"
                                  : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--dama-muted)] hover:text-[var(--dama-fg)]"
                              }
                              onClick={() => {
                                setLiveRowSelection({});
                                setLiveOfficialPausedOnly(true);
                                setLiveSkip(0);
                              }}
                            >
                              {(officialPauseChrome.filter_official_paused || "").trim()}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {(officialPauseChrome.bulk_pause_action || "").trim() &&
                        eventId &&
                        (bracketQuery.data ?? [])
                          .filter((m) => (m.game_id || "").trim() && !(m.finished_at || "").trim())
                          .map((m) => m.round_index)
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .map((roundIndex) => (
                            <Button
                              key={`bulk-round-${roundIndex}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setBulkPauseRound(roundIndex)}
                            >
                              {(officialPauseChrome.bulk_pause_action || "").trim()}
                              {chromeSeparatorPresent(chrome.meta_separator)
                                ? `${chromeSeparator(chrome.meta_separator)}${roundIndex + 1}`
                                : null}
                            </Button>
                          ))}
                    </div>
                  ) : null}
                  {tab === "live" &&
                  officialPauseChrome &&
                  (officialPauseChrome.select_all_label || "").trim() &&
                  (officialPauseChrome.select_row_label || "").trim()
                    ? (() => {
                        const selectedIds = Object.entries(liveRowSelection)
                          .filter(([, on]) => on)
                          .map(([id]) => id);
                        const selectedFmt = (officialPauseChrome.selected_count_fmt || "").trim();
                        const countLabel =
                          selectedFmt.includes("{count}") && selectedIds.length > 0
                            ? selectedFmt.replaceAll("{count}", String(selectedIds.length))
                            : "";
                        const canPauseSelected = selectedIds.some(
                          (id) => !isOfficialPause(gamePauseById[id]),
                        );
                        const canResumeSelected = selectedIds.some((id) =>
                          isOfficialPause(gamePauseById[id]),
                        );
                        if (selectedIds.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            {countLabel ? (
                              <span className="text-sm text-[var(--dama-muted)]">{countLabel}</span>
                            ) : null}
                            {(officialPauseChrome.bulk_selected_pause_action || "").trim() &&
                            canPauseSelected ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={bulkOfficialPause.isPending}
                                isLoading={
                                  bulkOfficialPause.isPending && bulkSelectedMode === "pause"
                                }
                                pendingLabel={(
                                  officialPauseChrome.bulk_selected_pause_pending || ""
                                ).trim()}
                                onClick={() => setBulkSelectedMode("pause")}
                              >
                                {(officialPauseChrome.bulk_selected_pause_action || "").trim()}
                              </Button>
                            ) : null}
                            {(officialPauseChrome.bulk_selected_resume_action || "").trim() &&
                            canResumeSelected ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={bulkOfficialResume.isPending}
                                isLoading={
                                  bulkOfficialResume.isPending && bulkSelectedMode === "resume"
                                }
                                pendingLabel={(
                                  officialPauseChrome.bulk_selected_resume_pending || ""
                                ).trim()}
                                onClick={() => setBulkSelectedMode("resume")}
                              >
                                {(officialPauseChrome.bulk_selected_resume_action || "").trim()}
                              </Button>
                            ) : null}
                            {(officialPauseChrome.clear_selection_action || "").trim() ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setLiveRowSelection({})}
                              >
                                {(officialPauseChrome.clear_selection_action || "").trim()}
                              </Button>
                            ) : null}
                          </div>
                        );
                      })()
                    : null}
                  {tab === "live" &&
                  activityGameId &&
                  ((chrome.activity_section_title || "").trim() ||
                    (officialPauseChrome?.activity_title || "").trim()) ? (
                    <div className="space-y-1 rounded-md border border-[var(--dama-border)] p-2">
                      <p className="text-xs font-medium text-[var(--dama-muted)]">
                        {(chrome.activity_section_title || "").trim() ||
                          (officialPauseChrome?.activity_title || "").trim()}
                      </p>
                      {(pauseEventsQuery.data ?? []).length === 0 ? (
                        (officialPauseChrome?.activity_empty || "").trim() ? (
                          <p className="text-xs text-[var(--dama-muted)]">
                            {(officialPauseChrome?.activity_empty || "").trim()}
                          </p>
                        ) : null
                      ) : (
                        <ul className="space-y-1">
                          {(pauseEventsQuery.data ?? []).slice(0, 5).map((ev) => {
                            const role = officialPauseRoleLabel(ev.actor_role, officialPauseChrome);
                            const name = (ev.actor_display_name || "").trim();
                            const reason = (ev.reason_label || "").trim();
                            const action = (ev.action || "").trim();
                            const fmt =
                              action === "resume"
                                ? (officialPauseChrome?.activity_resume_fmt || "").trim()
                                : action === "meta"
                                  ? (officialPauseChrome?.activity_meta_fmt || "").trim()
                                  : (officialPauseChrome?.activity_pause_fmt || "").trim();
                            if (!fmt) return null;
                            // Fail closed: never show hollow "by ·" (fmt needs both role and name).
                            if (!role || !name) return null;
                            const line = applyOfficialPauseFmt(fmt, {
                              role,
                              name,
                              reason,
                              note: (ev.note || "").trim(),
                            });
                            if (!line) return null;
                            return (
                              <li key={ev.id} className="text-xs text-[var(--dama-text)]">
                                {line}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                  {(tab === "live" ? liveBoardsQuery.isLoading : bracketQuery.isLoading) ? (
                    <ShimmerBlock className="w-full rounded-md" style={{ height: loadH }} />
                  ) : null}
                  {(() => {
                    const scrollMax = Number((chrome.dialog_scroll_max_height || "").trim());
                    if (!Number.isFinite(scrollMax) || scrollMax <= 0) return null;
                    const liveListSource =
                      tab === "live" ? livePageMatches : (bracketQuery.data ?? []);
                    return (
                      <div
                        className="space-y-4 overflow-y-auto text-sm"
                        style={{ maxHeight: scrollMax }}
                      >
                        {tab === "live" &&
                        officialPauseChrome &&
                        (officialPauseChrome.select_all_label || "").trim() &&
                        (officialPauseChrome.select_row_label || "").trim()
                          ? (() => {
                              const visibleGids = livePageMatches
                                .map((m) => (m.game_id || "").trim())
                                .filter(Boolean);
                              const selectedOnPage = visibleGids.filter(
                                (id) => liveRowSelection[id],
                              ).length;
                              const allOn =
                                visibleGids.length > 0 && selectedOnPage === visibleGids.length;
                              const someOn =
                                selectedOnPage > 0 && selectedOnPage < visibleGids.length;
                              const selectAllLabel = (
                                officialPauseChrome.select_all_label || ""
                              ).trim();
                              if (visibleGids.length === 0) return null;
                              return (
                                <div className="flex items-center gap-2 px-1">
                                  <Checkbox
                                    checked={allOn ? true : someOn ? "indeterminate" : false}
                                    aria-label={selectAllLabel}
                                    title={selectAllLabel}
                                    onCheckedChange={(checked) => {
                                      const on = checked === true;
                                      setLiveRowSelection((prev) => {
                                        const next = { ...prev };
                                        for (const id of visibleGids) {
                                          if (on) next[id] = true;
                                          else delete next[id];
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                  <span className="text-xs text-[var(--dama-muted)]">
                                    {selectAllLabel}
                                  </span>
                                </div>
                              );
                            })()
                          : null}
                        {tab === "live" &&
                        officialPauseChrome &&
                        (officialPauseChrome.live_boards_empty || "").trim() &&
                        pageSize > 0 &&
                        !liveBoardsQuery.isLoading &&
                        typeof liveBoardsQuery.data?.meta?.total === "number" &&
                        liveBoardsQuery.data.meta.total < 1 ? (
                          <p className="text-sm text-[var(--dama-muted)]">
                            {(officialPauseChrome.live_boards_empty || "").trim()}
                          </p>
                        ) : null}
                        {buildBracketSections(
                          liveListSource,
                          bracketChromeFrom(chrome, enumsQuery.data),
                        ).map((section) => (
                          <div key={section.key} className="space-y-2">
                            {section.title ? (
                              <p className="text-xs font-semibold text-[var(--dama-muted)]">
                                {section.title}
                              </p>
                            ) : null}
                            <ul className="space-y-2">
                              {section.matches.map((m) => {
                                const emptySeat = (chrome.bracket_empty_seat || "").trim();
                                const vs = (chrome.bracket_vs_label || "").trim();
                                const sep = chromeSeparator(chrome.meta_separator);
                                const seatA = (m.player_a_username || "").trim() || emptySeat;
                                const seatB = (m.player_b_username || "").trim() || emptySeat;
                                const winnerDisp = (m.winner_username || "").trim();
                                const gid = (m.game_id || "").trim();
                                const pausePayload = gid ? gamePauseById[gid] : undefined;
                                const officiallyPaused = isOfficialPause(pausePayload);
                                const playerPaused = isPlayerPause(pausePayload);
                                const boardPaused = officiallyPaused || playerPaused;
                                const pauseStatus = livePauseStatusLabel(
                                  pausePayload,
                                  officialPauseChrome,
                                );
                                const pausedByRole = officialPauseRoleLabel(
                                  pausePayload?.pause_actor_role,
                                  officialPauseChrome,
                                );
                                const pausedByName = (
                                  pausePayload?.pause_actor_display_name || ""
                                ).trim();
                                const pauseReason = (pausePayload?.pause_reason_label || "").trim();
                                const selectAllLabel = (
                                  officialPauseChrome?.select_all_label || ""
                                ).trim();
                                const selectRowLabel = (
                                  officialPauseChrome?.select_row_label || ""
                                ).trim();
                                const selectionEnabled =
                                  tab === "live" &&
                                  Boolean(gid) &&
                                  Boolean(selectAllLabel) &&
                                  Boolean(selectRowLabel);
                                return (
                                  <li
                                    key={m.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--dama-border)] px-3 py-2"
                                  >
                                    <div className="flex min-w-0 flex-1 items-start gap-2">
                                      {selectionEnabled ? (
                                        <Checkbox
                                          className="mt-1"
                                          checked={Boolean(liveRowSelection[gid])}
                                          aria-label={selectRowLabel}
                                          title={selectRowLabel}
                                          onCheckedChange={(checked) => {
                                            setLiveRowSelection((prev) => {
                                              const next = { ...prev };
                                              if (checked === true) next[gid] = true;
                                              else delete next[gid];
                                              return next;
                                            });
                                          }}
                                        />
                                      ) : null}
                                      <div className="min-w-0">
                                        <span className="tabular-nums text-[var(--dama-muted)]">
                                          {m.round_index + 1}/{m.match_index + 1}
                                        </span>
                                        <span className="ml-2">
                                          {(m.status_label || "").trim() ||
                                            (chrome.empty_value || "").trim()}
                                        </span>
                                        {!m.is_bye ? (
                                          <span className="ml-2 text-[var(--dama-muted)]">
                                            {seatA}
                                            {sep}
                                            {vs}
                                            {sep}
                                            {seatB}
                                          </span>
                                        ) : null}
                                        {winnerDisp ? (
                                          <span className="ml-2 text-[var(--dama-gold)]">
                                            {winnerDisp}
                                          </span>
                                        ) : null}
                                        {pauseStatus ? (
                                          <span
                                            className={
                                              boardPaused
                                                ? "ml-2 text-[var(--dama-brand)]"
                                                : "ml-2 text-[var(--dama-muted)]"
                                            }
                                          >
                                            {pauseStatus}
                                          </span>
                                        ) : null}
                                        {boardPaused &&
                                        pausedByRole &&
                                        pausedByName &&
                                        (officialPauseChrome?.col_paused_by || "").trim() &&
                                        sep ? (
                                          <span className="ml-2 text-[var(--dama-muted)]">
                                            {(officialPauseChrome?.col_paused_by || "").trim()}
                                            {sep}
                                            {[pausedByRole, pausedByName].join(sep)}
                                          </span>
                                        ) : null}
                                        {officiallyPaused &&
                                        pauseReason &&
                                        (officialPauseChrome?.col_reason || "").trim() &&
                                        sep ? (
                                          <span className="ml-2 text-[var(--dama-muted)]">
                                            {(officialPauseChrome?.col_reason || "").trim()}
                                            {sep}
                                            {pauseReason}
                                          </span>
                                        ) : null}
                                        {boardPaused &&
                                        (officialPauseChrome?.clock_frozen_label || "").trim() ? (
                                          <span className="ml-2 text-[var(--dama-brand)]">
                                            {(officialPauseChrome?.clock_frozen_label || "").trim()}
                                          </span>
                                        ) : null}
                                        {boardPaused
                                          ? (() => {
                                              const sinceFmt = (
                                                officialPauseChrome?.banner_since_fmt || ""
                                              ).trim();
                                              const sinceTime = formatPauseSinceTime(
                                                Number(pausePayload?.paused_at_unix_ms) || 0,
                                              );
                                              if (!sinceFmt || !sinceTime) return null;
                                              const line = sinceFmt
                                                .split("{time}")
                                                .join(sinceTime)
                                                .trim();
                                              return line ? (
                                                <span className="ml-2 text-[var(--dama-muted)]">
                                                  {line}
                                                </span>
                                              ) : null;
                                            })()
                                          : null}
                                        {boardPaused &&
                                        (officialPauseChrome?.col_duration || "").trim() &&
                                        sep
                                          ? (() => {
                                              const dur = formatPauseDurationSeconds(
                                                Number(pausePayload?.paused_at_unix_ms) || 0,
                                              );
                                              if (!dur) return null;
                                              const label = (
                                                officialPauseChrome?.col_duration || ""
                                              ).trim();
                                              return (
                                                <span className="ml-2 text-[var(--dama-muted)]">
                                                  {label}
                                                  {sep}
                                                  {dur}
                                                </span>
                                              );
                                            })()
                                          : null}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {!m.game_id && !m.is_bye ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="gold"
                                          isLoading={
                                            startGame.isPending &&
                                            startGame.variables?.matchId === m.id
                                          }
                                          onClick={() =>
                                            startGame.mutate({
                                              eventId: event.id,
                                              matchId: m.id,
                                            })
                                          }
                                        >
                                          {chrome.start_game_action}
                                        </Button>
                                      ) : null}
                                      {m.game_id ? (
                                        <Button asChild size="sm" variant="outline">
                                          <Link
                                            href={`/?view=spectate&gameId=${encodeURIComponent(m.game_id)}`}
                                          >
                                            {chrome.open_match_action}
                                          </Link>
                                        </Button>
                                      ) : null}
                                      {m.game_id &&
                                      !(m.finished_at || "").trim() &&
                                      officialPauseChrome &&
                                      (chrome.official_pause_action || "").trim() &&
                                      (chrome.official_resume_action || "").trim()
                                        ? (() => {
                                            const rowGid = (m.game_id || "").trim();
                                            const payload = gamePauseById[rowGid];
                                            // Fail-closed: no pause/resume CTA until /state snapshot loads.
                                            if (!payload) return null;
                                            const officiallyPaused = isOfficialPause(payload);
                                            const pauseBusy =
                                              officialPauseGame.isPending &&
                                              officialPauseGame.variables?.gameId === rowGid;
                                            const resumeBusy =
                                              officialResumeGame.isPending &&
                                              officialResumeGame.variables?.gameId === rowGid;
                                            const metaBusy =
                                              officialPauseMeta.isPending &&
                                              officialPauseMeta.variables?.gameId === rowGid;
                                            const menuLabel = (
                                              officialPauseChrome.actions_menu_label || ""
                                            ).trim();
                                            // Fail-closed: dedicated actions_menu_label only (no col_actions invent).
                                            if (!menuLabel) return null;
                                            const copyLabel = (
                                              officialPauseChrome.copy_game_id_action || ""
                                            ).trim();
                                            const copiedToast = (
                                              officialPauseChrome.toast_copied_game_id || ""
                                            ).trim();
                                            return (
                                              <OpsDataTableRowActions
                                                triggerLabel={menuLabel}
                                                actions={[
                                                  {
                                                    id: "copy",
                                                    label: copyLabel,
                                                    onSelect: () => {
                                                      void navigator.clipboard
                                                        .writeText(rowGid)
                                                        .then(() => {
                                                          if (copiedToast) {
                                                            toast.success(copiedToast);
                                                          }
                                                        });
                                                    },
                                                  },
                                                  {
                                                    id: "pause",
                                                    label: !officiallyPaused
                                                      ? (chrome.official_pause_action || "").trim()
                                                      : "",
                                                    disabled:
                                                      pauseBusy ||
                                                      resumeBusy ||
                                                      rematchMatch.isPending ||
                                                      forfeitMatch.isPending,
                                                    isLoading: pauseBusy,
                                                    pendingLabel: (
                                                      chrome.official_pause_pending || ""
                                                    ).trim(),
                                                    onSelect: () =>
                                                      setOfficialPauseTarget({
                                                        gameId: rowGid,
                                                        mode: "pause",
                                                      }),
                                                  },
                                                  {
                                                    id: "meta",
                                                    label: officiallyPaused
                                                      ? (
                                                          officialPauseChrome.meta_action || ""
                                                        ).trim()
                                                      : "",
                                                    disabled:
                                                      pauseBusy ||
                                                      resumeBusy ||
                                                      metaBusy ||
                                                      rematchMatch.isPending ||
                                                      forfeitMatch.isPending,
                                                    isLoading: metaBusy,
                                                    pendingLabel: (
                                                      officialPauseChrome.meta_pending || ""
                                                    ).trim(),
                                                    onSelect: () =>
                                                      setOfficialPauseTarget({
                                                        gameId: rowGid,
                                                        mode: "meta",
                                                      }),
                                                  },
                                                  {
                                                    id: "resume",
                                                    label: officiallyPaused
                                                      ? (chrome.official_resume_action || "").trim()
                                                      : "",
                                                    disabled:
                                                      pauseBusy ||
                                                      resumeBusy ||
                                                      metaBusy ||
                                                      rematchMatch.isPending ||
                                                      forfeitMatch.isPending,
                                                    isLoading: resumeBusy,
                                                    pendingLabel: (
                                                      chrome.official_resume_pending || ""
                                                    ).trim(),
                                                    onSelect: () =>
                                                      setOfficialPauseTarget({
                                                        gameId: rowGid,
                                                        mode: "resume",
                                                      }),
                                                  },
                                                ]}
                                              />
                                            );
                                          })()
                                        : null}
                                      {!m.is_bye &&
                                      !(m.finished_at || "").trim() &&
                                      (m.player_a_id || "").trim() &&
                                      (m.player_b_id || "").trim() &&
                                      (chrome.rematch_action || "").trim() ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={
                                            rematchMatch.isPending ||
                                            forfeitMatch.isPending ||
                                            startGame.isPending
                                          }
                                          isLoading={
                                            rematchMatch.isPending &&
                                            rematchMatch.variables?.matchId === m.id
                                          }
                                          pendingLabel={(chrome.rematch_pending || "").trim()}
                                          onClick={() =>
                                            rematchMatch.mutate({
                                              eventId: event.id,
                                              matchId: m.id,
                                            })
                                          }
                                        >
                                          {(chrome.rematch_action || "").trim()}
                                        </Button>
                                      ) : null}
                                      {!m.is_bye &&
                                      !(m.finished_at || "").trim() &&
                                      (m.player_a_id || "").trim() &&
                                      (m.player_b_id || "").trim() &&
                                      (chrome.forfeit_action || "").trim() ? (
                                        <>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                              forfeitMatch.isPending ||
                                              rematchMatch.isPending ||
                                              startGame.isPending
                                            }
                                            isLoading={
                                              forfeitMatch.isPending &&
                                              forfeitMatch.variables?.matchId === m.id &&
                                              forfeitMatch.variables?.userId ===
                                                (m.player_a_id || "").trim()
                                            }
                                            pendingLabel={(chrome.forfeit_pending || "").trim()}
                                            onClick={() =>
                                              forfeitMatch.mutate({
                                                eventId: event.id,
                                                matchId: m.id,
                                                userId: (m.player_a_id || "").trim(),
                                              })
                                            }
                                          >
                                            {`${(chrome.forfeit_action || "").trim()}${sep}${seatA}`.trim()}
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                              forfeitMatch.isPending ||
                                              rematchMatch.isPending ||
                                              startGame.isPending
                                            }
                                            isLoading={
                                              forfeitMatch.isPending &&
                                              forfeitMatch.variables?.matchId === m.id &&
                                              forfeitMatch.variables?.userId ===
                                                (m.player_b_id || "").trim()
                                            }
                                            pendingLabel={(chrome.forfeit_pending || "").trim()}
                                            onClick={() =>
                                              forfeitMatch.mutate({
                                                eventId: event.id,
                                                matchId: m.id,
                                                userId: (m.player_b_id || "").trim(),
                                              })
                                            }
                                          >
                                            {`${(chrome.forfeit_action || "").trim()}${sep}${seatB}`.trim()}
                                          </Button>
                                        </>
                                      ) : null}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {tab === "live" && pageSize > 0 && liveBoardsQuery.data?.meta ? (
                    <SkipPagination
                      meta={liveBoardsQuery.data.meta}
                      onPrev={setLiveSkip}
                      onNext={setLiveSkip}
                      disabled={liveBoardsQuery.isFetching && !liveBoardsQuery.isLoading}
                      inputId="manage-event-live-boards-skip"
                    />
                  ) : null}
                  {tab === "bracket" ? (
                    <EventStandingsTable
                      standings={standingsQuery.data?.standings ?? []}
                      chrome={chrome}
                      loading={standingsQuery.isLoading}
                    />
                  ) : null}
                </div>
              ) : null}

              {tab === "branding" ? (
                <div className="space-y-4 text-sm">
                  <Field id="manage-description" label={chrome.description_label}>
                    <textarea
                      id="manage-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder={chrome.description_placeholder}
                      className={cn(
                        "flex w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] transition-colors",
                        "placeholder:text-[var(--dama-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    />
                  </Field>
                  <div className="space-y-2 border-b border-[var(--dama-border)] pb-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--dama-text)]">
                        {chrome.prize_media_section_title}
                      </p>
                      <p className="text-xs text-[var(--dama-muted)]">
                        {chrome.prize_media_section_blurb}
                      </p>
                    </div>
                    {dropzoneChrome ? (
                      <EntityMediaEditor
                        chrome={{
                          thumbnail_label: chrome.thumbnail_label,
                          gallery_label: chrome.gallery_label,
                          gallery_empty: chrome.gallery_empty,
                          gallery_add_action: chrome.gallery_add_action,
                          gallery_max_slots: chrome.gallery_max_slots,
                          gallery_slots_fmt: chrome.gallery_slots_fmt,
                          thumbnail_main_badge: chrome.thumbnail_main_badge,
                          thumbnail_empty_hint: chrome.thumbnail_empty_hint,
                          thumbnail_hint: chrome.thumbnail_hint,
                          gallery_limit_reached: chrome.gallery_limit_reached,
                          uploading_label: dropzoneChrome.uploading_label,
                          remove_action: dropzoneChrome.remove_action,
                        }}
                        thumbnailUrl={(event.prize_image_url || "").trim()}
                        galleryUrls={(event.gallery ?? []).filter(
                          (u) => (u || "").trim().length > 0,
                        )}
                        busyThumbnail={uploadPrizeImage.isPending || clearPrizeImage.isPending}
                        busyGallery={uploadGallery.isPending || removeGallery.isPending}
                        onThumbnail={(file) => uploadPrizeImage.mutate({ id: event.id, file })}
                        onClearThumbnail={() => clearPrizeImage.mutate({ id: event.id })}
                        onGalleryFiles={(files) => uploadGallery.mutate({ id: event.id, files })}
                        onRemoveGallery={(index) => removeGallery.mutate({ id: event.id, index })}
                      />
                    ) : (
                      <p className="text-sm text-[var(--dama-danger)]" role="alert">
                        {(mediaUploadChromeQuery.data?.media_upload_unavailable || "").trim()}
                      </p>
                    )}
                  </div>
                  <Field id="manage-sponsor" label={chrome.sponsor_name_label}>
                    <Input
                      id="manage-sponsor"
                      value={sponsorName}
                      onChange={(e) => setSponsorName(e.target.value)}
                      placeholder={chrome.sponsor_name_placeholder}
                      autoComplete="off"
                    />
                  </Field>
                  <Field id="manage-brand-color" label={chrome.brand_color_label}>
                    <Input
                      id="manage-brand-color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      placeholder={chrome.brand_color_placeholder}
                      autoComplete="off"
                    />
                  </Field>
                  <p className="text-xs text-[var(--dama-muted)]">
                    {softCommunityJoinStatusMessage(chrome.force_auto_approve_note)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="gold"
                      isLoading={patch.isPending}
                      pendingLabel={chrome.save_pending}
                      disabled={
                        description === (event.description || "") &&
                        sponsorName === (event.sponsor_name || "") &&
                        brandColor === (event.brand_color || "")
                      }
                      onClick={() =>
                        patch.mutate({
                          id: event.id,
                          description,
                          sponsor_name: sponsorName,
                          brand_color: brandColor,
                        })
                      }
                    >
                      {chrome.save_action}
                    </Button>
                  </div>
                  {dropzoneChrome ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MediaDropzone
                        id={`event-logo-${event.id}`}
                        label={chrome.upload_logo_action}
                        chrome={dropzoneChrome}
                        busy={uploadLogo.isPending && uploadLogo.variables?.kind === "logo"}
                        previewUrl={(event.logo_url || "").trim() || undefined}
                        onFile={(file) => uploadLogo.mutate({ id: event.id, file, kind: "logo" })}
                      />
                      <MediaDropzone
                        id={`event-sponsor-${event.id}`}
                        label={chrome.upload_sponsor_action}
                        chrome={dropzoneChrome}
                        busy={uploadLogo.isPending && uploadLogo.variables?.kind === "sponsor-logo"}
                        previewUrl={(event.sponsor_logo_url || "").trim() || undefined}
                        onFile={(file) =>
                          uploadLogo.mutate({ id: event.id, file, kind: "sponsor-logo" })
                        }
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--dama-danger)]" role="alert">
                      {(mediaUploadChromeQuery.data?.media_upload_unavailable || "").trim()}
                    </p>
                  )}
                  {(() => {
                    const previewH = Number((chrome.branding_preview_height || "").trim());
                    const previewMaxW = Number((chrome.branding_preview_max_width || "").trim());
                    if (
                      !Number.isFinite(previewH) ||
                      previewH <= 0 ||
                      !Number.isFinite(previewMaxW) ||
                      previewMaxW <= 0
                    ) {
                      return null;
                    }
                    return (
                      <>
                        {event.logo_url ? (
                          <img
                            src={event.logo_url}
                            alt=""
                            className="rounded object-cover"
                            style={{ height: previewH, width: previewH }}
                          />
                        ) : null}
                        {event.sponsor_logo_url ? (
                          <img
                            src={event.sponsor_logo_url}
                            alt=""
                            className="object-contain"
                            style={{ height: previewH, maxWidth: previewMaxW }}
                          />
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="min-h-14" damaDialogFooter>
            {event && isArenaCup && arenaFinishAction ? (
              <div className="mr-auto flex max-w-full flex-col gap-1 sm:mr-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={finishArena.isPending}
                  pendingLabel={arenaFinishPending || undefined}
                  title={arenaFinishBlocked || undefined}
                  onClick={() => {
                    if (arenaFinishBlocked) {
                      toast.message(arenaFinishBlocked);
                      return;
                    }
                    finishArena.mutate(event.id);
                  }}
                >
                  {arenaFinishAction}
                </Button>
                {arenaFinishBlocked ? (
                  <p className="text-xs text-[var(--dama-muted)]">{arenaFinishBlocked}</p>
                ) : null}
              </div>
            ) : null}
            {event && tab === "overview" ? (
              <>
                {!event.started_at && !event.finished_at && !event.cancelled_at ? (
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    isLoading={startEvent.isPending}
                    onClick={() => startEvent.mutate(event.id)}
                  >
                    {softHostingStartAction(chrome.start_action)}
                  </Button>
                ) : null}
                {!event.started_at &&
                !event.finished_at &&
                !event.cancelled_at &&
                softHostingCloseAction(chrome.close_action) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={closeEvent.isPending}
                    onClick={() => closeEvent.mutate(event.id)}
                  >
                    {softHostingCloseAction(chrome.close_action)}
                  </Button>
                ) : null}
                {event.cancelled_at &&
                !event.started_at &&
                !event.finished_at &&
                softHostingReopenAction(chrome.reopen_action) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={reopenEvent.isPending}
                    onClick={() => reopenEvent.mutate(event.id)}
                  >
                    {softHostingReopenAction(chrome.reopen_action)}
                  </Button>
                ) : null}
              </>
            ) : null}
            {closeLabel ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {closeLabel}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OfficialPauseConfirmDialog
        open={bulkPauseRound != null}
        onOpenChange={(next) => {
          if (!next) setBulkPauseRound(null);
        }}
        mode="pause"
        chrome={officialPauseChrome}
        titleOverride={(officialPauseChrome?.bulk_confirm_title || "").trim()}
        descriptionOverride={(officialPauseChrome?.bulk_confirm_description || "").trim()}
        confirmOverride={(officialPauseChrome?.bulk_confirm || "").trim()}
        pendingOverride={(officialPauseChrome?.bulk_pause_pending || "").trim()}
        pending={bulkOfficialPause.isPending}
        onConfirm={({ reason_key, note }) => {
          const bulkReasonKey = (reason_key || "").trim();
          if (bulkPauseRound == null || !eventId || !bulkReasonKey) return;
          bulkOfficialPause.mutate(
            {
              eventId,
              roundIndex: bulkPauseRound,
              reasonKey: bulkReasonKey,
              note,
            },
            {
              onSuccess: (res) => {
                setBulkPauseRound(null);
                void bracketQuery.refetch();
                setPauseStateEpoch((n) => n + 1);
                const ok = Number(res.ok) || 0;
                const skipped = Number(res.skipped_count) || 0;
                const failed = Number(res.failed_count) || 0;
                const partial = (officialPauseChrome?.toast_bulk_partial || "").trim();
                const full = (officialPauseChrome?.toast_bulk_paused || "").trim();
                if ((skipped > 0 || failed > 0) && partial) {
                  toast.message(
                    partial
                      .split("{ok}")
                      .join(String(ok))
                      .split("{skipped}")
                      .join(String(skipped))
                      .split("{failed}")
                      .join(String(failed)),
                  );
                } else if (full) {
                  toast.success(full.split("{ok}").join(String(ok)));
                }
              },
              onError: (err) => {
                const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
                const msg =
                  officialPauseErrorLabel(officialPauseChrome, key, "pause") ||
                  (officialPauseChrome?.toast_bulk_failed || "").trim();
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
      <OfficialPauseConfirmDialog
        open={bulkSelectedMode === "pause"}
        onOpenChange={(next) => {
          if (!next) setBulkSelectedMode(null);
        }}
        mode="pause"
        chrome={officialPauseChrome}
        titleOverride={(officialPauseChrome?.bulk_selected_confirm_title || "").trim()}
        descriptionOverride={(officialPauseChrome?.bulk_selected_confirm_description || "").trim()}
        confirmOverride={(officialPauseChrome?.bulk_selected_confirm || "").trim()}
        pendingOverride={(officialPauseChrome?.bulk_selected_pause_pending || "").trim()}
        pending={bulkOfficialPause.isPending}
        onConfirm={({ reason_key, note }) => {
          const bulkReasonKey = (reason_key || "").trim();
          const ids = Object.entries(liveRowSelection)
            .filter(([, on]) => on)
            .map(([id]) => id)
            .filter((id) => !isOfficialPause(gamePauseById[id]));
          if (!bulkReasonKey || ids.length === 0) return;
          bulkOfficialPause.mutate(
            { gameIds: ids, reasonKey: bulkReasonKey, note },
            {
              onSuccess: (res) => {
                setBulkSelectedMode(null);
                setLiveRowSelection({});
                void bracketQuery.refetch();
                setPauseStateEpoch((n) => n + 1);
                const ok = Number(res.ok) || 0;
                const skipped = Number(res.skipped_count) || 0;
                const failed = Number(res.failed_count) || 0;
                const partial = (officialPauseChrome?.toast_bulk_partial || "").trim();
                const full = (officialPauseChrome?.toast_bulk_paused || "").trim();
                if ((skipped > 0 || failed > 0) && partial) {
                  toast.message(
                    partial
                      .split("{ok}")
                      .join(String(ok))
                      .split("{skipped}")
                      .join(String(skipped))
                      .split("{failed}")
                      .join(String(failed)),
                  );
                } else if (full) {
                  toast.success(full.split("{ok}").join(String(ok)));
                }
              },
              onError: (err) => {
                const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
                const msg =
                  officialPauseErrorLabel(officialPauseChrome, key, "pause") ||
                  (officialPauseChrome?.toast_bulk_failed || "").trim();
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
      <OfficialPauseConfirmDialog
        open={bulkSelectedMode === "resume"}
        onOpenChange={(next) => {
          if (!next) setBulkSelectedMode(null);
        }}
        mode="resume"
        chrome={officialPauseChrome}
        titleOverride={(officialPauseChrome?.bulk_selected_resume_confirm_title || "").trim()}
        descriptionOverride={(
          officialPauseChrome?.bulk_selected_resume_confirm_description || ""
        ).trim()}
        confirmOverride={(officialPauseChrome?.bulk_selected_resume_confirm || "").trim()}
        pendingOverride={(officialPauseChrome?.bulk_selected_resume_pending || "").trim()}
        pending={bulkOfficialResume.isPending}
        onConfirm={({ note }) => {
          const ids = Object.entries(liveRowSelection)
            .filter(([, on]) => on)
            .map(([id]) => id)
            .filter((id) => isOfficialPause(gamePauseById[id]));
          if (ids.length === 0) return;
          bulkOfficialResume.mutate(
            { gameIds: ids, note },
            {
              onSuccess: (res) => {
                setBulkSelectedMode(null);
                setLiveRowSelection({});
                void bracketQuery.refetch();
                setPauseStateEpoch((n) => n + 1);
                const ok = Number(res.ok) || 0;
                const skipped = Number(res.skipped_count) || 0;
                const failed = Number(res.failed_count) || 0;
                const partial = (officialPauseChrome?.toast_bulk_resume_partial || "").trim();
                const full = (officialPauseChrome?.toast_bulk_resumed || "").trim();
                if ((skipped > 0 || failed > 0) && partial) {
                  toast.message(
                    partial
                      .split("{ok}")
                      .join(String(ok))
                      .split("{skipped}")
                      .join(String(skipped))
                      .split("{failed}")
                      .join(String(failed)),
                  );
                } else if (full) {
                  toast.success(full.split("{ok}").join(String(ok)));
                }
              },
              onError: (err) => {
                const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
                const msg =
                  officialPauseErrorLabel(officialPauseChrome, key, "resume") ||
                  (officialPauseChrome?.toast_bulk_resume_failed || "").trim();
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
      <OfficialPauseConfirmDialog
        open={Boolean(officialPauseTarget)}
        onOpenChange={(next) => {
          if (!next) setOfficialPauseTarget(null);
        }}
        mode={officialPauseTarget?.mode || "pause"}
        chrome={officialPauseChrome}
        initialReasonKey={
          officialPauseTarget?.mode === "meta"
            ? (gamePauseById[officialPauseTarget.gameId]?.pause_reason_key || "").trim()
            : ""
        }
        initialNote={
          officialPauseTarget?.mode === "meta"
            ? (gamePauseById[officialPauseTarget.gameId]?.pause_note || "").trim()
            : ""
        }
        pending={
          officialPauseTarget?.mode === "resume"
            ? officialResumeGame.isPending
            : officialPauseTarget?.mode === "meta"
              ? officialPauseMeta.isPending
              : officialPauseGame.isPending
        }
        onConfirm={({ reason_key, note }) => {
          const target = officialPauseTarget;
          if (!target) return;
          if (target.mode === "meta") {
            const metaReasonKey = (reason_key || "").trim();
            if (!metaReasonKey) return;
            officialPauseMeta.mutate(
              { gameId: target.gameId, reason_key: metaReasonKey, note },
              {
                onSuccess: (payload) => {
                  if (payload?.id) {
                    setGamePauseById((prev) => ({ ...prev, [payload.id]: payload }));
                    setActivityGameId(payload.id);
                  }
                  setOfficialPauseTarget(null);
                  const msg = (officialPauseChrome?.toast_meta_saved || "").trim();
                  if (msg) toast.success(msg);
                },
                onError: (err) => {
                  const key = isApiClientError(err) ? err.errorKey || "" : "";
                  const msg = officialPauseErrorLabel(officialPauseChrome, key, "meta");
                  if (msg) toast.error(msg);
                },
              },
            );
            return;
          }
          if (target.mode === "pause") {
            const pauseReasonKey = (reason_key || "").trim();
            if (!pauseReasonKey) return;
            officialPauseGame.mutate(
              { gameId: target.gameId, reason_key: pauseReasonKey, note },
              {
                onSuccess: (payload) => {
                  if (payload?.id) {
                    setGamePauseById((prev) => ({ ...prev, [payload.id]: payload }));
                    setActivityGameId(payload.id);
                  }
                  setOfficialPauseTarget(null);
                  const msg = (chrome.toast_official_paused || "").trim();
                  if (msg) toast.success(msg);
                },
                onError: (err) => {
                  const key = isApiClientError(err) ? err.errorKey || "" : "";
                  const msg =
                    officialPauseErrorLabel(officialPauseChrome, key, "pause") ||
                    (chrome.toast_official_pause_failed || "").trim();
                  if (msg) toast.error(msg);
                },
              },
            );
            return;
          }
          officialResumeGame.mutate(
            { gameId: target.gameId, note },
            {
              onSuccess: (payload) => {
                if (payload?.id) {
                  setGamePauseById((prev) => ({ ...prev, [payload.id]: payload }));
                  setActivityGameId(payload.id);
                }
                setOfficialPauseTarget(null);
                const msg = (chrome.toast_official_resumed || "").trim();
                if (msg) toast.success(msg);
              },
              onError: (err) => {
                const key = isApiClientError(err) ? err.errorKey || "" : "";
                const msg =
                  officialPauseErrorLabel(officialPauseChrome, key, "resume") ||
                  (chrome.toast_official_resume_failed || "").trim();
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
    </>
  );
}
