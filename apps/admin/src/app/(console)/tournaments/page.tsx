"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { TournamentReportsPanel } from "@/components/tournaments/TournamentReportsPanel";
import { OfficialPauseDialog } from "@/components/tournaments/OfficialPauseDialog";
import { OfficialPauseLiveBoards } from "@/components/tournaments/OfficialPauseLiveBoards";
import { ArenaDurationField } from "@/components/tournaments/ArenaDurationField";
import {
  ArenaSettingsCard,
  PayoutDefaultsCard,
  PrizeSettleSettingsCard,
  PointsToastSettingsCard,
  StandingsPointsCard,
} from "@/components/tournaments/tournament-settings-cards";
import { SignInLink } from "@/components/auth/SignInLink";
import { EntityMediaEditor } from "@/components/media/EntityMediaEditor";
import { GalleryCarousel } from "@/components/media/GalleryCarousel";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
  selectedRowIds,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OpsDataTableSkeleton,
  ShimmerBlock,
  TournamentBodySkeleton,
  TournamentListBodySkeleton,
  TournamentListSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { Textarea } from "@/components/ui/textarea";
import { parseDefaultArenaDurationMinutes, tournamentFormatIsArena } from "@/lib/competition-arena";
import { classicSeatCeiling, formatSeatCapDisplay } from "@/lib/seat-cap-display";
import {
  buildPlacePercentsPayload,
  defaultPayoutModeForFormat,
  payoutModeOptions,
  placePercentsSumInvalid,
} from "@/lib/competition-payout";
import {
  useClearTournamentPrizeImageMutation,
  useCreateTournamentMutation,
  useDeleteTournamentMutation,
  useRemoveTournamentGalleryMutation,
  useSetTournamentStatusMutation,
  useConsoleForfeitTournamentMatchMutation,
  useConsoleRematchTournamentMatchMutation,
  useConsoleStartTournamentMatchMutation,
  useOfficialPauseGameMutation,
  useOfficialPauseMetaMutation,
  useOfficialResumeGameMutation,
  useSettleCompetitionPrizesMutation,
  useFinishTournamentArenaMutation,
  useStartTournamentCupMutation,
  useUpdateTournamentMutation,
  useUploadTournamentGalleryMutation,
  useUploadTournamentPrizeImageMutation,
} from "@/hooks/mutation";
import {
  type AdminTournamentEntryFilter,
  useAdminGameStateQuery,
  useAdminTournamentBracketQuery,
  useAdminTournamentEntriesQuery,
  useAdminTournamentScoreboardQuery,
  useAdminTournamentsQuery,
  useMyPermissionsQuery,
  useClientEnumsQuery,
  useConsoleFeatureFlagsQuery,
  useEventsCatalogQuery,
  useOfficialPauseChromeQuery,
  useOfficialPauseEventsQuery,
  usePaymentCurrencyQuery,
  useTournamentChromeQuery,
} from "@/hooks/query";
import { adminGameStateQueryKey } from "@/hooks/query/useAdminGameStateQuery";
import {
  fillOfficialPauseFmt,
  formatPauseDurationSeconds,
  formatPauseSinceTime,
  isOfficialPauseChromeReady,
  livePauseStatusLabel,
  officialPauseRoleLabel,
} from "@/types/official-pause-chrome";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { parsePositiveDecimal } from "@/lib/sanitize-decimal-input";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { toast } from "sonner";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { AdminTournament } from "@/types";
import type { GamePayload } from "@/types/game";
import type { ClientEnums } from "@/types/platform";
import type { EventsCatalogFormat } from "@/types/events-catalog";
import { type MediaUploadChrome, isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import type { TournamentBracketMatch } from "@/types/tournament-bracket";
import { type TournamentChrome, isTournamentChromeReady } from "@/types/tournament-chrome";
import { useQueries } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TournamentFormMode = { kind: "create" } | { kind: "edit"; tournament: AdminTournament };

/** Arena cup (any lifecycle) - Finish arena stays visible; actionability is separate. */
function isArenaTournament(
  t: Pick<AdminTournament, "formatId" | "arenaEndsAt" | "arenaDurationMinutes">,
  enums: ClientEnums | undefined,
): boolean {
  if (tournamentFormatIsArena((t.formatId || "").trim(), enums)) return true;
  // Arena clock / duration is set only for Arena starts - keep Finish visible if format enum lags.
  return (
    Boolean((t.arenaEndsAt || "").trim()) ||
    (typeof t.arenaDurationMinutes === "number" && t.arenaDurationMinutes > 0)
  );
}

function arenaFinishBlockedReason(
  t: Pick<AdminTournament, "startedAt" | "finishedAt">,
  chrome: Pick<TournamentChrome, "arena_finish_requires_started" | "arena_finish_already_finished">,
): string {
  if ((t.finishedAt || "").trim()) {
    return (chrome.arena_finish_already_finished || "").trim();
  }
  if (!(t.startedAt || "").trim()) {
    return (chrome.arena_finish_requires_started || "").trim();
  }
  return "";
}

function buildTournamentFormatOptions(
  enumFormats: string[],
  catalogFormats: EventsCatalogFormat[] | undefined,
): { id: string; label: string }[] {
  const list = catalogFormats ?? [];
  const labelById = new Map<string, string>();
  for (const f of list) {
    const label = (f.label || "").trim();
    if (label) labelById.set(f.id, label);
  }
  // Enum ids drive which formats exist; catalog label is required (no invent raw id).
  // Create/update still fail closed server-side if a format is not enabled in events_catalog.
  const out: { id: string; label: string }[] = [];
  for (const id of enumFormats) {
    const label = labelById.get(id);
    if (!label) continue;
    out.push({ id, label });
  }
  return out;
}

function formatDisplayLabel(t: AdminTournament, empty: string): string {
  const labeled = (t.formatLabel || "").trim();
  if (labeled) return labeled;
  return empty;
}

function parseSearchDebounceMs(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  sep: string,
  empty: string,
): string {
  if (amount == null || !Number.isFinite(amount) || !(currency || "").trim()) return empty;
  return `${amount}${sep}${currency}`.trim();
}

function rawTournamentTableThumb(t: AdminTournament): string {
  const prize = (t.prizeImageUrl || "").trim();
  if (prize) return prize;
  const firstGallery = (t.gallery ?? []).map((u) => (u || "").trim()).find(Boolean);
  return firstGallery || "";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const l = label.trim();
  if (!l) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">{l}</p>
      <p className="text-sm text-[var(--dama-text)]">{value}</p>
    </div>
  );
}

function TournamentDetailControlRoom({
  tournamentId,
  token,
  roomTitle,
  forceStartLabel,
  forceStartPending,
  forfeitLabel,
  forfeitPending,
  rematchLabel,
  rematchPending,
  officialPauseLabel,
  officialPausePending,
  officialResumeLabel,
  officialResumePending,
  officialPauseStatusLabel,
  bracketReadyStatus,
  bracketLiveStatus,
  metaSep,
  empty,
}: {
  tournamentId: string;
  token: string;
  roomTitle: string;
  forceStartLabel: string;
  forceStartPending: string;
  forfeitLabel: string;
  forfeitPending: string;
  rematchLabel: string;
  rematchPending: string;
  officialPauseLabel: string;
  officialPausePending: string;
  officialResumeLabel: string;
  officialResumePending: string;
  officialPauseStatusLabel: string;
  bracketReadyStatus: string;
  bracketLiveStatus: string;
  metaSep: string;
  empty: string;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [officialPausedOnly, setOfficialPausedOnly] = useState(false);
  const bracketQuery = useAdminTournamentBracketQuery(token, tournamentId, true);
  const startMatch = useConsoleStartTournamentMatchMutation(token);
  const forfeitMatch = useConsoleForfeitTournamentMatchMutation(token);
  const rematchMatch = useConsoleRematchTournamentMatchMutation(token);
  const officialPause = useOfficialPauseGameMutation(token);
  const officialResume = useOfficialResumeGameMutation(token);
  const officialPauseMeta = useOfficialPauseMetaMutation(token);
  const pauseChromeQuery = useOfficialPauseChromeQuery(
    Boolean(officialPauseLabel.trim() || officialResumeLabel.trim()),
  );

  const readyStatus = bracketReadyStatus.trim();
  const liveStatus = bracketLiveStatus.trim();
  const forfeitEnabled = Boolean(forfeitLabel.trim());
  const rematchEnabled = Boolean(rematchLabel.trim());
  const officialPauseEnabled = Boolean(officialPauseLabel.trim());
  const officialResumeEnabled = Boolean(officialResumeLabel.trim());
  const opsBusy =
    startMatch.isPending ||
    forfeitMatch.isPending ||
    rematchMatch.isPending ||
    officialPause.isPending ||
    officialResume.isPending ||
    officialPauseMeta.isPending;

  const controlMatches = useMemo(() => {
    const pauseOpsReady = (officialPauseEnabled || officialResumeEnabled) && Boolean(liveStatus);
    if (!readyStatus && !((forfeitEnabled || rematchEnabled) && liveStatus) && !pauseOpsReady) {
      return [] as TournamentBracketMatch[];
    }
    return (bracketQuery.data ?? []).filter((m) => {
      if (m.is_bye || (m.finished_at || "").trim()) return false;
      if (!(m.player_a_id || "").trim() || !(m.player_b_id || "").trim()) return false;
      const st = (m.status || "").trim();
      const gid = (m.game_id || "").trim();
      const canForce =
        Boolean(readyStatus) && st === readyStatus && !gid && Boolean(forceStartLabel.trim());
      const canForfeit = forfeitEnabled && (st === readyStatus || st === liveStatus);
      const canRematch = rematchEnabled && (st === readyStatus || st === liveStatus);
      const canOfficialPause =
        (officialPauseEnabled || officialResumeEnabled) && Boolean(gid) && st === liveStatus;
      return canForce || canForfeit || canRematch || canOfficialPause;
    });
  }, [
    bracketQuery.data,
    readyStatus,
    liveStatus,
    forfeitEnabled,
    rematchEnabled,
    forceStartLabel,
    officialPauseEnabled,
    officialResumeEnabled,
  ]);

  const liveGameIds = useMemo(
    () => controlMatches.map((m) => (m.game_id || "").trim()).filter(Boolean),
    [controlMatches],
  );
  const pauseOpsEnabled = Boolean(
    token && (officialPauseEnabled || officialResumeEnabled) && liveGameIds.length > 0,
  );
  const livePauseQueries = useQueries({
    queries: liveGameIds.map((gid) => ({
      queryKey: adminGameStateQueryKey(gid),
      enabled: pauseOpsEnabled,
      staleTime: QueryStale.live,
      refetchInterval: 5_000,
      queryFn: async (): Promise<GamePayload> => {
        if (!token || !gid) throw new Error("");
        const { data } = await restClient.get<GamePayload>(
          `/games/${encodeURIComponent(gid)}/state`,
          { headers: authHeaders(token) },
        );
        return data;
      },
    })),
  });
  const officialPausedGameIds = useMemo(() => {
    const ids = new Set<string>();
    liveGameIds.forEach((gid, i) => {
      const payload = livePauseQueries[i]?.data;
      if (payload?.paused && (payload.pause_kind || "").trim() === "official") {
        ids.add(gid);
      }
    });
    return ids;
  }, [liveGameIds, livePauseQueries]);
  const visibleControlMatches = useMemo(() => {
    if (!officialPausedOnly) return controlMatches;
    return controlMatches.filter((m) => officialPausedGameIds.has((m.game_id || "").trim()));
  }, [controlMatches, officialPausedOnly, officialPausedGameIds]);

  const selectedMatch = useMemo(
    () => visibleControlMatches.find((m) => m.id === selectedMatchId),
    [visibleControlMatches, selectedMatchId],
  );

  const selectedGameId = (selectedMatch?.game_id || "").trim();
  const gameStateQuery = useAdminGameStateQuery(
    token,
    selectedGameId,
    Boolean(selectedGameId && (officialPauseEnabled || officialResumeEnabled)),
  );
  const pauseEventsQuery = useOfficialPauseEventsQuery(
    token,
    selectedGameId,
    Boolean(selectedGameId && pauseChromeQuery.isSuccess),
  );

  const canForceSelected =
    selectedMatch &&
    readyStatus &&
    (selectedMatch.status || "").trim() === readyStatus &&
    !(selectedMatch.game_id || "").trim() &&
    forceStartLabel.trim();

  const canForfeitSelected =
    selectedMatch &&
    forfeitEnabled &&
    ((selectedMatch.status || "").trim() === readyStatus ||
      (liveStatus && (selectedMatch.status || "").trim() === liveStatus));

  const canRematchSelected =
    selectedMatch &&
    rematchEnabled &&
    ((selectedMatch.status || "").trim() === readyStatus ||
      (liveStatus && (selectedMatch.status || "").trim() === liveStatus));

  const gamePaused = Boolean(gameStateQuery.data?.paused);
  const pauseKind = (gameStateQuery.data?.pause_kind || "").trim();
  const isOfficialPaused = gamePaused && pauseKind === "official";
  const canPauseBoard =
    Boolean(selectedMatch) &&
    Boolean(selectedGameId) &&
    officialPauseEnabled &&
    liveStatus &&
    (selectedMatch?.status || "").trim() === liveStatus &&
    !isOfficialPaused &&
    pauseChromeQuery.isSuccess;
  const canResumeBoard =
    Boolean(selectedMatch) &&
    Boolean(selectedGameId) &&
    officialResumeEnabled &&
    gamePaused &&
    pauseChromeQuery.isSuccess;

  useEffect(() => {
    if (!selectedMatchId) return;
    if (!visibleControlMatches.some((m) => m.id === selectedMatchId)) {
      setSelectedMatchId("");
    }
  }, [visibleControlMatches, selectedMatchId]);

  if (!bracketQuery.isSuccess) return null;

  const pauseChrome = pauseChromeQuery.data;
  const activityTitle = (pauseChrome?.activity_title || "").trim();
  const activityEmpty = (pauseChrome?.activity_empty || "").trim();
  const activityPauseFmt = (pauseChrome?.activity_pause_fmt || "").trim();
  const activityResumeFmt = (pauseChrome?.activity_resume_fmt || "").trim();
  const activityMetaFmt = (pauseChrome?.activity_meta_fmt || "").trim();
  const metaAction = (pauseChrome?.meta_action || "").trim();
  const metaPending = (pauseChrome?.meta_pending || "").trim();
  const clockFrozen = (pauseChrome?.clock_frozen_label || "").trim();
  const sinceFmt = (pauseChrome?.banner_since_fmt || "").trim();
  const durationLabel = (pauseChrome?.col_duration || "").trim();
  const filterAll = (pauseChrome?.filter_all || "").trim();
  const filterOfficialPaused = (pauseChrome?.filter_official_paused || "").trim();
  const events = pauseEventsQuery.data ?? [];
  const pausedAtMs = Number(gameStateQuery.data?.paused_at_unix_ms) || 0;
  const sinceTime = formatPauseSinceTime(pausedAtMs);
  const durationText = formatPauseDurationSeconds(pausedAtMs);
  const boardStatusLabel = livePauseStatusLabel(gameStateQuery.data, pauseChrome);
  const pausedByLabel = (pauseChrome?.col_paused_by || "").trim();
  const reasonColLabel = (pauseChrome?.col_reason || "").trim();
  const pauseActorRole = officialPauseRoleLabel(pauseChrome, gameStateQuery.data?.pause_actor_role);
  const pauseActorName = (gameStateQuery.data?.pause_actor_display_name || "").trim();
  const pauseReasonLabel = (gameStateQuery.data?.pause_reason_label || "").trim();
  const canMetaBoard = isOfficialPaused && Boolean(metaAction) && pauseChromeQuery.isSuccess;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
        {roomTitle}
      </p>
      {controlMatches.length > 0 ? (
        <>
          {filterAll || filterOfficialPaused ? (
            <div
              role="tablist"
              aria-label={roomTitle}
              className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
            >
              {filterAll ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={!officialPausedOnly}
                  className={
                    !officialPausedOnly
                      ? "rounded-md bg-[var(--dama-card)] px-3 py-1.5 text-sm font-medium text-[var(--dama-fg)] shadow-sm"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--dama-muted)] hover:text-[var(--dama-fg)]"
                  }
                  onClick={() => setOfficialPausedOnly(false)}
                >
                  {filterAll}
                </button>
              ) : null}
              {filterOfficialPaused ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={officialPausedOnly}
                  className={
                    officialPausedOnly
                      ? "rounded-md bg-[var(--dama-card)] px-3 py-1.5 text-sm font-medium text-[var(--dama-fg)] shadow-sm"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--dama-muted)] hover:text-[var(--dama-fg)]"
                  }
                  onClick={() => setOfficialPausedOnly(true)}
                >
                  {filterOfficialPaused}
                </button>
              ) : null}
            </div>
          ) : null}
          <Select value={selectedMatchId || undefined} onValueChange={setSelectedMatchId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={empty} />
            </SelectTrigger>
            <SelectContent>
              {visibleControlMatches.map((m) => {
                const a = (m.player_a_username || "").trim() || empty;
                const b = (m.player_b_username || "").trim() || empty;
                const gid = (m.game_id || "").trim();
                const liveIdx = gid ? liveGameIds.indexOf(gid) : -1;
                const livePayload = liveIdx >= 0 ? livePauseQueries[liveIdx]?.data : undefined;
                const statusBadge = livePauseStatusLabel(livePayload, pauseChrome);
                const pausedBadge = statusBadge ? `${metaSep}${statusBadge}` : "";
                const label =
                  `${m.round_index + 1}/${m.match_index + 1}${metaSep}${a}${metaSep}${b}${pausedBadge}`.trim();
                return (
                  <SelectItem key={m.id} value={m.id}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedGameId && boardStatusLabel ? (
            <p className="text-xs text-[var(--dama-muted)]">{boardStatusLabel}</p>
          ) : selectedGameId && isOfficialPaused && officialPauseStatusLabel.trim() ? (
            <p className="text-xs text-[var(--dama-muted)]">{officialPauseStatusLabel.trim()}</p>
          ) : null}
          {gamePaused ? (
            <p className="text-xs text-[var(--dama-muted)]">
              {[
                pausedByLabel && pauseActorRole && pauseActorName
                  ? `${pausedByLabel}${metaSep}${pauseActorRole}${metaSep}${pauseActorName}`.trim()
                  : "",
                isOfficialPaused && reasonColLabel && pauseReasonLabel
                  ? `${reasonColLabel}${metaSep}${pauseReasonLabel}`.trim()
                  : "",
                clockFrozen,
                sinceFmt && sinceTime ? sinceFmt.split("{time}").join(sinceTime).trim() : "",
                durationLabel && durationText
                  ? `${durationLabel}${metaSep}${durationText}`.trim()
                  : "",
              ]
                .filter(Boolean)
                .join(metaSep)}
            </p>
          ) : null}
          {canForceSelected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={opsBusy}
              isLoading={startMatch.isPending}
              pendingLabel={forceStartPending}
              onClick={() => {
                if (!selectedMatchId) return;
                startMatch.mutate(
                  { tournamentId, matchId: selectedMatchId },
                  {
                    onSuccess: () => {
                      void bracketQuery.refetch();
                      setSelectedMatchId("");
                    },
                  },
                );
              }}
            >
              {forceStartLabel}
            </Button>
          ) : null}
          {canRematchSelected && selectedMatch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={opsBusy}
              isLoading={rematchMatch.isPending}
              pendingLabel={rematchPending}
              onClick={() => {
                rematchMatch.mutate(
                  { tournamentId, matchId: selectedMatch.id },
                  {
                    onSuccess: () => {
                      void bracketQuery.refetch();
                      setSelectedMatchId("");
                    },
                  },
                );
              }}
            >
              {rematchLabel}
            </Button>
          ) : null}
          {canForfeitSelected && selectedMatch ? (
            <div className="flex flex-wrap gap-2">
              {[selectedMatch.player_a_id, selectedMatch.player_b_id].map((uid, i) => {
                const id = (uid || "").trim();
                if (!id) return null;
                const name =
                  (i === 0 ? selectedMatch.player_a_username : selectedMatch.player_b_username) ||
                  empty;
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={opsBusy}
                    isLoading={forfeitMatch.isPending}
                    pendingLabel={forfeitPending}
                    onClick={() => {
                      forfeitMatch.mutate(
                        { tournamentId, matchId: selectedMatch.id, loserUserId: id },
                        {
                          onSuccess: () => {
                            void bracketQuery.refetch();
                            setSelectedMatchId("");
                          },
                        },
                      );
                    }}
                  >
                    {`${forfeitLabel}${metaSep}${name}`.trim()}
                  </Button>
                );
              })}
            </div>
          ) : null}
          {selectedMatch &&
          selectedGameId &&
          (pauseChrome?.actions_menu_label || "").trim() &&
          (canPauseBoard ||
            canResumeBoard ||
            canMetaBoard ||
            (pauseChrome?.copy_game_id_action || "").trim()) ? (
            <OpsDataTableRowActions
              triggerLabel={(pauseChrome?.actions_menu_label || "").trim()}
              actions={[
                {
                  id: "copy",
                  label: (pauseChrome?.copy_game_id_action || "").trim(),
                  onSelect: () => {
                    void navigator.clipboard.writeText(selectedGameId).then(() => {
                      const copied = (pauseChrome?.toast_copied_game_id || "").trim();
                      if (copied) toast.success(copied);
                    });
                  },
                },
                {
                  id: "pause",
                  label: canPauseBoard ? officialPauseLabel : "",
                  disabled: opsBusy,
                  isLoading: officialPause.isPending,
                  pendingLabel: officialPausePending,
                  onSelect: () => setPauseDialogOpen(true),
                },
                {
                  id: "meta",
                  label: canMetaBoard ? metaAction : "",
                  disabled: opsBusy,
                  isLoading: officialPauseMeta.isPending,
                  pendingLabel: metaPending,
                  onSelect: () => setMetaDialogOpen(true),
                },
                {
                  id: "resume",
                  label: canResumeBoard ? officialResumeLabel : "",
                  disabled: opsBusy,
                  isLoading: officialResume.isPending,
                  pendingLabel: officialResumePending,
                  onSelect: () => setResumeDialogOpen(true),
                },
              ]}
            />
          ) : null}
          {selectedGameId && activityTitle ? (
            <div className="space-y-1 rounded-md border border-[var(--dama-border)] p-2">
              <p className="text-xs font-medium text-[var(--dama-muted)]">{activityTitle}</p>
              {events.length === 0 ? (
                activityEmpty ? (
                  <p className="text-xs text-[var(--dama-muted)]">{activityEmpty}</p>
                ) : null
              ) : (
                <ul className="space-y-1">
                  {events.slice(0, 5).map((ev) => {
                    const role = officialPauseRoleLabel(pauseChrome, ev.actor_role);
                    const name = (ev.actor_display_name || "").trim();
                    const reason = (ev.reason_label || "").trim();
                    const action = (ev.action || "").trim();
                    const fmt =
                      action === "resume"
                        ? activityResumeFmt
                        : action === "meta"
                          ? activityMetaFmt
                          : activityPauseFmt;
                    if (!fmt) return null;
                    // Fail closed: never show hollow "by ·" (fmt needs both role and name).
                    if (!role || !name) return null;
                    const line = fillOfficialPauseFmt(fmt, {
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
        </>
      ) : null}
      <OfficialPauseDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        mode="pause"
        chrome={pauseChrome}
        isPending={officialPause.isPending}
        onConfirm={({ reasonKey, note }) => {
          if (!selectedGameId || !reasonKey) return;
          officialPause.mutate(
            { gameId: selectedGameId, reasonKey, note },
            {
              onSuccess: () => {
                setPauseDialogOpen(false);
                void gameStateQuery.refetch();
                void pauseEventsQuery.refetch();
              },
            },
          );
        }}
      />
      <OfficialPauseDialog
        open={resumeDialogOpen}
        onOpenChange={setResumeDialogOpen}
        mode="resume"
        chrome={pauseChrome}
        isPending={officialResume.isPending}
        onConfirm={({ note }) => {
          if (!selectedGameId) return;
          officialResume.mutate(
            { gameId: selectedGameId, note },
            {
              onSuccess: () => {
                setResumeDialogOpen(false);
                void gameStateQuery.refetch();
                void pauseEventsQuery.refetch();
              },
            },
          );
        }}
      />
      <OfficialPauseDialog
        open={metaDialogOpen}
        onOpenChange={setMetaDialogOpen}
        mode="meta"
        chrome={pauseChrome}
        initialReasonKey={(gameStateQuery.data?.pause_reason_key || "").trim()}
        initialNote={(gameStateQuery.data?.pause_note || "").trim()}
        isPending={officialPauseMeta.isPending}
        onConfirm={({ reasonKey, note }) => {
          if (!selectedGameId || !reasonKey) return;
          officialPauseMeta.mutate(
            { gameId: selectedGameId, reasonKey, note },
            {
              onSuccess: () => {
                setMetaDialogOpen(false);
                void gameStateQuery.refetch();
                void pauseEventsQuery.refetch();
              },
            },
          );
        }}
      />
    </div>
  );
}

function TournamentFormFields({
  chrome,
  isFree,
  setIsFree,
  title,
  setTitle,
  description,
  setDescription,
  entryFee,
  setEntryFee,
  entryCurrency,
  setEntryCurrency,
  prizePool,
  setPrizePool,
  prizeCurrency,
  setPrizeCurrency,
  prizePlace1,
  setPrizePlace1,
  prizePlace2,
  setPrizePlace2,
  prizePlace3,
  setPrizePlace3,
  prizePoolDisplay,
  setPrizePoolDisplay,
  maxPlayers,
  setMaxPlayers,
  formatId,
  setFormatId,
  formatOptions,
  formatLocked,
  supportedCurrencies,
  currencySelectLoading,
  prizePoolDisplayPlatform,
  disabled,
  idPrefix,
  titleError,
  entryFeeError,
  formatError,
  maxPlayersError,
  placesSumError,
  showArenaDuration,
  arenaDurationMinutes,
  setArenaDurationMinutes,
  arenaDurationError,
  payoutMode,
  setPayoutMode,
  prizePercent1,
  setPrizePercent1,
  prizePercent2,
  setPrizePercent2,
  prizePercent3,
  setPrizePercent3,
  enums,
  percentsSumError,
}: {
  chrome: Required<TournamentChrome>;
  isFree: boolean;
  setIsFree: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  entryFee: string;
  setEntryFee: (v: string) => void;
  entryCurrency: string;
  setEntryCurrency: (v: string) => void;
  prizePool: string;
  setPrizePool: (v: string) => void;
  prizeCurrency: string;
  setPrizeCurrency: (v: string) => void;
  prizePlace1: string;
  setPrizePlace1: (v: string) => void;
  prizePlace2: string;
  setPrizePlace2: (v: string) => void;
  prizePlace3: string;
  setPrizePlace3: (v: string) => void;
  prizePoolDisplay: boolean;
  setPrizePoolDisplay: (v: boolean) => void;
  maxPlayers: string;
  setMaxPlayers: (v: string) => void;
  formatId: string;
  setFormatId: (v: string) => void;
  formatOptions: { id: string; label: string }[];
  formatLocked: boolean;
  supportedCurrencies: string[];
  currencySelectLoading: boolean;
  prizePoolDisplayPlatform: boolean;
  disabled: boolean;
  idPrefix: string;
  titleError?: string;
  entryFeeError?: string;
  formatError?: string;
  maxPlayersError?: string;
  placesSumError?: string;
  showArenaDuration?: boolean;
  arenaDurationMinutes?: string;
  setArenaDurationMinutes?: (v: string) => void;
  arenaDurationError?: string;
  payoutMode?: string;
  setPayoutMode?: (v: string) => void;
  prizePercent1?: string;
  setPrizePercent1?: (v: string) => void;
  prizePercent2?: string;
  setPrizePercent2?: (v: string) => void;
  prizePercent3?: string;
  setPrizePercent3?: (v: string) => void;
  enums?: import("@/types/platform").ClientEnums;
  percentsSumError?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id={`${idPrefix}-format`}
        label={chrome.format_label}
        error={formatError}
        className="sm:col-span-2"
      >
        <Select
          value={formatId || undefined}
          onValueChange={setFormatId}
          disabled={disabled || formatLocked || formatOptions.length === 0}
        >
          <SelectTrigger id={`${idPrefix}-format`} aria-label={chrome.format_label}>
            <SelectValue placeholder={chrome.format_label} />
          </SelectTrigger>
          <SelectContent>
            {formatOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {showArenaDuration ? (
        <div className="sm:col-span-2">
          <ArenaDurationField
            idPrefix={idPrefix}
            chrome={chrome}
            minutesValue={arenaDurationMinutes ?? ""}
            onMinutesChange={(v) => setArenaDurationMinutes?.(v)}
            error={arenaDurationError}
            disabled={disabled}
          />
        </div>
      ) : null}
      <Field
        id={`${idPrefix}-title`}
        label={chrome.title_label}
        className="sm:col-span-2"
        error={titleError}
      >
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={(chrome.title_placeholder || "").trim() || undefined}
          autoComplete="off"
          required
          disabled={disabled}
          aria-invalid={titleError ? true : undefined}
        />
      </Field>
      <Field
        id={`${idPrefix}-description`}
        label={chrome.description_label}
        className="sm:col-span-2"
      >
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={(chrome.description_placeholder || "").trim() || undefined}
          rows={3}
          disabled={disabled}
        />
      </Field>
      <Field id={`${idPrefix}-is-free`} label={chrome.make_free_label} className="sm:col-span-2">
        <div className="flex min-h-10 items-center gap-2 pt-1">
          <Checkbox
            id={`${idPrefix}-is-free`}
            checked={isFree}
            disabled={disabled}
            onCheckedChange={(v) => {
              const on = v === true;
              setIsFree(on);
              if (on) {
                setEntryFee("0");
                setPrizePool("");
                setPrizePoolDisplay(false);
              } else if (entryFee.trim() === "0") {
                setEntryFee("");
              }
            }}
          />
        </div>
      </Field>
      <Field id={`${idPrefix}-entry-currency`} label={chrome.entry_currency_label}>
        {currencySelectLoading ? (
          <ShimmerBlock className="h-10 w-full rounded-md" />
        ) : (
          <Select
            value={entryCurrency}
            onValueChange={setEntryCurrency}
            disabled={isFree || disabled}
          >
            <SelectTrigger
              id={`${idPrefix}-entry-currency`}
              aria-label={chrome.entry_currency_label}
            >
              <SelectValue placeholder={chrome.entry_currency_label} />
            </SelectTrigger>
            <SelectContent>
              {supportedCurrencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field
        id={`${idPrefix}-entry-fee`}
        label={chrome.entry_amount_label}
        error={!isFree ? entryFeeError : undefined}
      >
        <AmountInput
          id={`${idPrefix}-entry-fee`}
          disabled={isFree || disabled}
          value={entryFee}
          onValueChange={setEntryFee}
          placeholder={chrome.prize_placeholder}
          aria-invalid={!isFree && entryFeeError ? true : undefined}
        />
      </Field>
      {!isFree ? (
        <>
          <Field id={`${idPrefix}-prize-pool`} label={chrome.prize_amount_label}>
            <AmountInput
              id={`${idPrefix}-prize-pool`}
              value={prizePool}
              onValueChange={setPrizePool}
              placeholder={chrome.prize_placeholder}
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-prize-currency`} label={chrome.prize_currency_label}>
            {currencySelectLoading ? (
              <ShimmerBlock className="h-10 w-full rounded-md" />
            ) : (
              <Select value={prizeCurrency} onValueChange={setPrizeCurrency} disabled={disabled}>
                <SelectTrigger
                  id={`${idPrefix}-prize-currency`}
                  aria-label={chrome.prize_currency_label}
                >
                  <SelectValue placeholder={chrome.prize_currency_label} />
                </SelectTrigger>
                <SelectContent>
                  {supportedCurrencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2 space-y-3 rounded-md border border-[var(--dama-border)] p-3">
            <p className="text-sm font-medium">{chrome.prize_places_section_label}</p>
            <p className="text-xs text-[var(--dama-muted)]">{chrome.prize_places_blurb}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id={`${idPrefix}-prize-place-1`} label={chrome.prize_place_1_label}>
                <AmountInput
                  id={`${idPrefix}-prize-place-1`}
                  value={prizePlace1}
                  onValueChange={setPrizePlace1}
                  placeholder={chrome.prize_placeholder}
                  disabled={disabled}
                />
              </Field>
              <Field id={`${idPrefix}-prize-place-2`} label={chrome.prize_place_2_label}>
                <AmountInput
                  id={`${idPrefix}-prize-place-2`}
                  value={prizePlace2}
                  onValueChange={setPrizePlace2}
                  placeholder={chrome.prize_placeholder}
                  disabled={disabled}
                />
              </Field>
              <Field id={`${idPrefix}-prize-place-3`} label={chrome.prize_place_3_label}>
                <AmountInput
                  id={`${idPrefix}-prize-place-3`}
                  value={prizePlace3}
                  onValueChange={setPrizePlace3}
                  placeholder={chrome.prize_placeholder}
                  disabled={disabled}
                />
              </Field>
            </div>
            {placesSumError ? (
              <p className="text-xs text-[var(--dama-danger)]" role="alert">
                {placesSumError}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
      {!isFree && prizePoolDisplayPlatform ? (
        <>
          <Field
            id={`${idPrefix}-prize-pool-display`}
            label={chrome.prize_pool_display_label}
            className="sm:col-span-2"
          >
            <div className="space-y-2">
              <div className="flex min-h-10 items-center gap-2 pt-1">
                <Checkbox
                  id={`${idPrefix}-prize-pool-display`}
                  checked={prizePoolDisplay}
                  disabled={disabled}
                  onCheckedChange={(v) => {
                    setPrizePoolDisplay(v === true);
                  }}
                />
                <label htmlFor={`${idPrefix}-prize-pool-display`} className="text-sm">
                  {chrome.prize_pool_display_label}
                </label>
              </div>
              <p className="text-xs text-[var(--dama-muted)]">{chrome.prize_pool_display_blurb}</p>
            </div>
          </Field>
          {prizePoolDisplay && payoutMode != null && setPayoutMode && enums ? (
            <div className="sm:col-span-2 space-y-3 rounded-md border border-[var(--dama-border)] p-3">
              <p className="text-sm font-medium">{chrome.payout_mode_label}</p>
              <p className="text-xs text-[var(--dama-muted)]">{chrome.payout_mode_blurb}</p>
              <Field id={`${idPrefix}-payout-mode`} label={chrome.payout_mode_label}>
                <Select
                  value={payoutMode || undefined}
                  onValueChange={setPayoutMode}
                  disabled={disabled}
                >
                  <SelectTrigger id={`${idPrefix}-payout-mode`}>
                    <SelectValue placeholder={chrome.payout_mode_label} />
                  </SelectTrigger>
                  <SelectContent>
                    {payoutModeOptions(enums, formatId).map((opt) => {
                      const places = (enums.competition_payout_mode_places_percent || "").trim();
                      const score = (enums.competition_payout_mode_score_share || "").trim();
                      const dual = (enums.competition_payout_mode_dual_purse || "").trim();
                      let label = opt.value;
                      if (opt.value === places) label = chrome.payout_mode_places_percent_label;
                      if (opt.value === score) label = chrome.payout_mode_score_share_label;
                      if (opt.value === dual) label = chrome.payout_mode_dual_purse_label;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              {payoutMode === (enums.competition_payout_mode_places_percent || "").trim() ||
              payoutMode === (enums.competition_payout_mode_dual_purse || "").trim() ? (
                <>
                  <p className="text-sm font-medium">{chrome.prize_place_percents_section_label}</p>
                  <p className="text-xs text-[var(--dama-muted)]">
                    {chrome.prize_place_percents_blurb}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field id={`${idPrefix}-pct-1`} label={chrome.prize_place_percent_1_label}>
                      <Input
                        id={`${idPrefix}-pct-1`}
                        inputMode="decimal"
                        value={prizePercent1 ?? ""}
                        onChange={(e) => setPrizePercent1?.(e.target.value)}
                        placeholder={chrome.prize_place_percent_1_placeholder}
                        disabled={disabled}
                      />
                    </Field>
                    <Field id={`${idPrefix}-pct-2`} label={chrome.prize_place_percent_2_label}>
                      <Input
                        id={`${idPrefix}-pct-2`}
                        inputMode="decimal"
                        value={prizePercent2 ?? ""}
                        onChange={(e) => setPrizePercent2?.(e.target.value)}
                        placeholder={chrome.prize_place_percent_2_placeholder}
                        disabled={disabled}
                      />
                    </Field>
                    <Field id={`${idPrefix}-pct-3`} label={chrome.prize_place_percent_3_label}>
                      <Input
                        id={`${idPrefix}-pct-3`}
                        inputMode="decimal"
                        value={prizePercent3 ?? ""}
                        onChange={(e) => setPrizePercent3?.(e.target.value)}
                        placeholder={chrome.prize_place_percent_3_placeholder}
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                  {percentsSumError ? (
                    <p className="text-xs text-[var(--dama-danger)]" role="alert">
                      {percentsSumError}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      <div className="space-y-1 sm:col-span-2">
        <Field
          id={`${idPrefix}-max-players`}
          label={chrome.prize_pool_max_players_label}
          error={maxPlayersError}
        >
          <Input
            id={`${idPrefix}-max-players`}
            inputMode="numeric"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(sanitizeIntegerInput(e.target.value))}
            disabled={disabled}
            placeholder={
              showArenaDuration
                ? (chrome.unlimited_players_label || "").trim() || undefined
                : undefined
            }
          />
        </Field>
        {showArenaDuration && (chrome.prize_pool_max_players_unlimited_blurb || "").trim() ? (
          <p className="text-xs text-[var(--dama-muted)]">
            {(chrome.prize_pool_max_players_unlimited_blurb || "").trim()}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminTournamentsPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useTournamentChromeQuery(true);
  const chrome = isTournamentChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const officialPauseChromeQuery = useOfficialPauseChromeQuery(Boolean(token));

  const [isFree, setIsFree] = useState(false);
  const [title, setTitle] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [entryCurrency, setEntryCurrency] = useState("");
  const [description, setDescription] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [prizeCurrency, setPrizeCurrency] = useState("");
  const [prizePlace1, setPrizePlace1] = useState("");
  const [prizePlace2, setPrizePlace2] = useState("");
  const [prizePlace3, setPrizePlace3] = useState("");
  const [payoutMode, setPayoutMode] = useState("");
  const [prizePercent1, setPrizePercent1] = useState("");
  const [prizePercent2, setPrizePercent2] = useState("");
  const [prizePercent3, setPrizePercent3] = useState("");
  const [prizePoolDisplay, setPrizePoolDisplay] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState("");
  const [formatId, setFormatId] = useState("");
  const [arenaDurationMinutes, setArenaDurationMinutes] = useState("");
  const [formAttempted, setFormAttempted] = useState(false);

  const pageSize = parseListPageSize(chrome?.list_page_size);
  const searchDebounceMs = parseSearchDebounceMs(chrome?.search_debounce_ms);
  const [skip, setSkip] = useUrlSkip("skip");
  const [entryFilter, setEntryFilter] = useState<AdminTournamentEntryFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const searchQ = useDebouncedValue(searchDraft.trim(), searchDebounceMs);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const searchParams = useSearchParams();
  type TournamentTab =
    | "list"
    | "live-boards"
    | "arena"
    | "standings"
    | "points-toast"
    | "payout-defaults"
    | "prize-settle"
    | "reports";
  const [tab, setTab] = useState<TournamentTab>("list");
  useEffect(() => {
    const reportId = (searchParams.get("report") || "").trim();
    if (reportId) setTab("reports");
  }, [searchParams]);
  useResetSkipOnChange(setSkip, [entryFilter, searchQ]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [entryFilter, searchQ, skip]);

  const formDialog = useDeferredDialogValue<TournamentFormMode>();
  /** Deferred clear keeps detail content through Dialog exit animation (cup lobby parity). */
  const detailDialog = useDeferredDialogValue<AdminTournament>();
  const detailTournament = detailDialog.value;
  const setDetailTournament = detailDialog.setValue;
  const openDetailTournament = detailDialog.openWith;
  const [detailEntriesSkip, setDetailEntriesSkip] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AdminTournament | null>(null);
  useResetSkipOnChange(setDetailEntriesSkip, [detailTournament?.id || ""]);

  const currencyQuery = usePaymentCurrencyQuery();
  const enumsQuery = useClientEnumsQuery(isAdmin);
  const catalogQuery = useEventsCatalogQuery(token, isAdmin);
  const tournamentFormats = enumsQuery.data?.tournament_formats ?? [];
  const formatOptions = useMemo(
    () => buildTournamentFormatOptions(tournamentFormats, catalogQuery.data?.formats),
    [tournamentFormats, catalogQuery.data?.formats],
  );
  const arenaFormatSelected = tournamentFormatIsArena(formatId, enumsQuery.data);
  const swissRoundsByMax = catalogQuery.data?.swiss_rounds_by_max_players || {};
  const classicSeatCeilingVal = useMemo(
    () => classicSeatCeiling(swissRoundsByMax),
    [swissRoundsByMax],
  );
  const tournamentStatuses = enumsQuery.data?.tournament_statuses ?? [];
  const tournamentStatusLabels = enumsQuery.data?.tournament_status_labels ?? {};
  const permsQuery = useMyPermissionsQuery(token, isAdmin);
  const canReviewReports =
    permsQuery.data?.permissions?.includes("tournaments.write") === true ||
    permsQuery.data?.permissions?.includes("payments.review") === true;
  const canWriteTournaments = permsQuery.data?.permissions?.includes("tournaments.write") === true;
  const detailEntriesQuery = useAdminTournamentEntriesQuery(
    token,
    detailTournament?.id || "",
    detailEntriesSkip,
    pageSize,
    Boolean(detailTournament?.id) && canWriteTournaments && pageSize > 0,
  );
  const detailEntries = detailEntriesQuery.data?.entries ?? [];
  const detailEntriesMeta = detailEntriesQuery.data?.meta;
  const bracketReadyStatus = (enumsQuery.data?.tournament_bracket_ready || "").trim();
  const bracketLiveStatus = (enumsQuery.data?.tournament_bracket_live || "").trim();
  const listQuery = useAdminTournamentsQuery(token, skip, pageSize, entryFilter, searchQ);
  const detailScoreMode = (enumsQuery.data?.competition_payout_mode_score_share || "").trim();
  const detailDualMode = (enumsQuery.data?.competition_payout_mode_dual_purse || "").trim();
  const detailIsArena = tournamentFormatIsArena(detailTournament?.formatId || "", enumsQuery.data);
  const detailPayoutMode = (detailTournament?.prizePayoutMode || "").trim();
  // score_share + dual_purse both need live Pts for projected performance lines
  const detailNeedsScoreboard =
    Boolean(detailTournament) &&
    detailTournament?.prizePoolDisplayEnabled === true &&
    ((detailScoreMode !== "" && detailPayoutMode === detailScoreMode) ||
      (detailDualMode !== "" && detailPayoutMode === detailDualMode));
  const detailScoreboardMode = detailNeedsScoreboard
    ? detailIsArena
      ? ("arena" as const)
      : ("standings" as const)
    : null;
  const detailScoreboardQuery = useAdminTournamentScoreboardQuery(
    token,
    detailTournament?.id,
    detailScoreboardMode,
    Boolean(detailTournament && detailScoreboardMode),
  );
  const flagsQuery = useConsoleFeatureFlagsQuery(token);
  const prizePoolDisplayPlatform = flagsQuery.data?.prizePoolDisplayEnabled === true;
  const createMutation = useCreateTournamentMutation(token);
  const updateMutation = useUpdateTournamentMutation(token);
  const deleteMutation = useDeleteTournamentMutation(token);
  const statusMutation = useSetTournamentStatusMutation(token);
  const startCupMutation = useStartTournamentCupMutation(token);
  const finishArenaMutation = useFinishTournamentArenaMutation(token);
  const settlePrizesMutation = useSettleCompetitionPrizesMutation(token, chrome);
  const prizeImageMutation = useUploadTournamentPrizeImageMutation(token);
  const clearPrizeImageMutation = useClearTournamentPrizeImageMutation(token);
  const galleryMutation = useUploadTournamentGalleryMutation(token);
  const removeGalleryMutation = useRemoveTournamentGalleryMutation(token);
  const mediaUploadChromeQuery = useMediaUploadChromeQuery(Boolean(token));
  const dropzoneChrome = isMediaUploadChromeReady(mediaUploadChromeQuery.data)
    ? mediaUploadChromeQuery.data
    : undefined;

  const supportedCurrencies = currencyQuery.data?.supported ?? [];
  const formMode = formDialog.value;
  const isEditing = formMode?.kind === "edit";
  const editCupStarted =
    isEditing && formMode?.kind === "edit" && Boolean((formMode.tournament.startedAt || "").trim());
  const editMediaTournament = useMemo(() => {
    if (!isEditing || formMode?.kind !== "edit") return null;
    const id = formMode.tournament.id;
    return listQuery.data?.tournaments.find((t) => t.id === id) ?? formMode.tournament;
  }, [isEditing, formMode, listQuery.data?.tournaments]);
  const formPending = createMutation.isPending || updateMutation.isPending;
  const currencySelectLoading = currencyQuery.isLoading;
  const pageLoading = roleLoading || (isAdmin && (listQuery.isLoading || currencySelectLoading));
  const softFetching = listQuery.isFetching && !listQuery.isLoading;

  useEffect(() => {
    if (!formDialog.open || !formMode) return;
    if (formMode.kind === "create") {
      setIsFree(false);
      setTitle("");
      setDescription("");
      setEntryFee("");
      setPrizePool("");
      setPrizePlace1("");
      setPrizePlace2("");
      setPrizePlace3("");
      setPayoutMode("");
      setPrizePercent1("");
      setPrizePercent2("");
      setPrizePercent3("");
      setPrizePoolDisplay(false);
      setMaxPlayers("");
      setFormatId((enumsQuery.data?.tournament_default_format || "").trim());
      const defArena = parseDefaultArenaDurationMinutes(enumsQuery.data);
      setArenaDurationMinutes(defArena != null ? String(defArena) : "");
      setFormAttempted(false);
      setEntryCurrency(currencyQuery.data?.global || "");
      setPrizeCurrency(currencyQuery.data?.global || "");
      return;
    }
    const t = formMode.tournament;
    setIsFree(t.isFree);
    setTitle(t.title);
    setDescription(t.description || "");
    setEntryFee(t.isFree ? "0" : t.entryFeeAmount != null ? String(t.entryFeeAmount) : "");
    setEntryCurrency(t.entryFeeCurrency || currencyQuery.data?.global || "");
    setPrizePool(
      t.prizePoolAmount != null && t.prizePoolAmount > 0 ? String(t.prizePoolAmount) : "",
    );
    setPrizeCurrency(t.prizePoolCurrency || currencyQuery.data?.global || "");
    setPrizePlace1(
      t.prizePoolPlaces?.["1"] != null && t.prizePoolPlaces["1"] > 0
        ? String(t.prizePoolPlaces["1"])
        : "",
    );
    setPrizePlace2(
      t.prizePoolPlaces?.["2"] != null && t.prizePoolPlaces["2"] > 0
        ? String(t.prizePoolPlaces["2"])
        : "",
    );
    setPrizePlace3(
      t.prizePoolPlaces?.["3"] != null && t.prizePoolPlaces["3"] > 0
        ? String(t.prizePoolPlaces["3"])
        : "",
    );
    setPrizePoolDisplay(t.prizePoolDisplayEnabled === true);
    setPayoutMode((t.prizePayoutMode || "").trim());
    setPrizePercent1(t.prizePlacePercents?.["1"] != null ? String(t.prizePlacePercents["1"]) : "");
    setPrizePercent2(t.prizePlacePercents?.["2"] != null ? String(t.prizePlacePercents["2"]) : "");
    setPrizePercent3(t.prizePlacePercents?.["3"] != null ? String(t.prizePlacePercents["3"]) : "");
    setMaxPlayers(t.maxPlayers != null ? String(t.maxPlayers) : "");
    setFormatId((t.formatId || enumsQuery.data?.tournament_default_format || "").trim());
    setArenaDurationMinutes(
      t.arenaDurationMinutes != null && t.arenaDurationMinutes > 0
        ? String(t.arenaDurationMinutes)
        : "",
    );
    setFormAttempted(false);
  }, [formDialog.open, formMode, currencyQuery.data?.global, enumsQuery.data]);

  useEffect(() => {
    if (!prizePoolDisplay || !enumsQuery.data || payoutMode.trim()) return;
    const def = defaultPayoutModeForFormat(enumsQuery.data, formatId);
    if (def) setPayoutMode(def);
    if (!prizePercent1.trim()) {
      setPrizePercent1((enumsQuery.data.competition_default_place_percent_1 || "").trim());
      setPrizePercent2((enumsQuery.data.competition_default_place_percent_2 || "").trim());
      setPrizePercent3((enumsQuery.data.competition_default_place_percent_3 || "").trim());
    }
  }, [prizePoolDisplay, formatId, enumsQuery.data, payoutMode, prizePercent1]);

  useEffect(() => {
    if (!detailTournament) return;
    const rows = listQuery.data?.tournaments ?? [];
    const fresh = rows.find((r) => r.id === detailTournament.id);
    if (fresh && fresh !== detailTournament) setDetailTournament(fresh);
  }, [listQuery.data?.tournaments, detailTournament, setDetailTournament]);

  const tournamentColumns = useMemo((): OpsColumn<AdminTournament>[] => {
    if (!chrome) return [];
    const empty = (chrome.empty_value || "").trim();
    const sep = chrome.amount_currency_separator;
    const metaSep = chrome.meta_separator ?? "";
    const labelFor = (code: string) => {
      const labeled = (tournamentStatusLabels[code] || "").trim();
      return labeled || empty;
    };
    const thumbHeader = (chrome.thumbnail_label || "").trim();
    const cols: OpsColumn<AdminTournament>[] = [
      {
        id: "title",
        header: chrome.col_title,
        cell: (t) => <span className="font-medium">{t.title}</span>,
      },
      {
        id: "entry",
        header: chrome.col_entry,
        cell: (t) => {
          const maxLabel = (chrome.prize_pool_max_players_label || "").trim();
          const maxVal = formatSeatCapDisplay(
            t.maxPlayers,
            swissRoundsByMax,
            chrome.unlimited_players_label || "",
            empty,
          );
          return (
            <div className="text-xs">
              <p>{t.isFree ? chrome.filter_free_label : chrome.filter_paid_label}</p>
              <p className="mt-0.5 font-mono text-[var(--dama-gold)]">
                {t.isFree
                  ? `${chrome.free_entry_amount}${sep}${t.entryFeeCurrency || empty}`.trim()
                  : formatMoney(t.entryFeeAmount, t.entryFeeCurrency, sep, empty)}
              </p>
              {maxLabel ? (
                <p className="mt-0.5 text-[var(--dama-muted)]">
                  {maxLabel}
                  {metaSep}
                  {maxVal}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "status",
        header: chrome.col_status,
        cell: (t) => <span className="text-xs">{labelFor(t.status)}</span>,
      },
      {
        id: "prize",
        header: chrome.col_prize,
        cell: (t) => {
          if (t.prizePoolDisplayEnabled && t.prizePoolNow != null) {
            return (
              <span className="font-mono text-xs">
                {formatMoney(
                  t.prizePoolNow,
                  t.prizePoolCurrencyLive || t.prizePoolCurrency,
                  sep,
                  empty,
                )}
              </span>
            );
          }
          return (
            <span className="font-mono text-xs">
              {formatMoney(t.prizePoolAmount, t.prizePoolCurrency, sep, empty)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: chrome.col_actions,
        className: "w-12 text-right",
        cell: (t) => (
          <OpsDataTableRowActions
            triggerLabel={chrome.actions_label}
            actions={[
              {
                id: "view",
                label: chrome.view_detail_action,
                onSelect: () => openDetailTournament(t),
              },
              {
                id: "edit",
                label: chrome.edit_action,
                onSelect: () => formDialog.openWith({ kind: "edit", tournament: t }),
              },
              {
                id: "delete",
                label: chrome.delete_action,
                destructive: true,
                onSelect: () => setDeleteTarget(t),
              },
            ]}
          />
        ),
      },
    ];
    if (thumbHeader) {
      cols.unshift({
        id: "thumb",
        header: thumbHeader,
        className: "w-14",
        cell: (t) => {
          const src = resolvePublicMediaUrl(rawTournamentTableThumb(t));
          if (!src) {
            return <span className="text-xs text-[var(--dama-muted)]">{empty}</span>;
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-10 w-10 shrink-0 rounded-md object-cover bg-[var(--dama-surface)]"
            />
          );
        },
      });
    }
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, formDialog, openDetailTournament, swissRoundsByMax, tournamentStatusLabels]);

  function buildPrizePlaces(prizeAmount: number): Record<string, number> | null {
    const places: Record<string, number> = {};
    let sum = 0;
    const rows: [string, string][] = [
      ["1", prizePlace1],
      ["2", prizePlace2],
      ["3", prizePlace3],
    ];
    for (const [place, raw] of rows) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const amt = Number(trimmed);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      places[place] = amt;
      sum += amt;
    }
    if (Object.keys(places).length === 0) return null;
    if (sum > prizeAmount + 0.001) return null;
    return places;
  }

  function buildPayload(paidFee: number) {
    const prizeAmount = isFree || prizePool.trim() === "" ? 0 : Number(prizePool);
    const prizeOk = !isFree && Number.isFinite(prizeAmount) && prizeAmount > 0;
    // Empty → null Unlimited (Arena). Non-empty values pass through (incl. lt2)
    // so the API can reject with err_max_players_required; never coerce invalid to Unlimited.
    const mpRaw = maxPlayers.trim();
    const mpParsed = mpRaw === "" ? null : Number.parseInt(mpRaw, 10);
    const mp = mpRaw === "" ? null : mpParsed != null && Number.isFinite(mpParsed) ? mpParsed : 0;
    const places = prizeOk ? buildPrizePlaces(prizeAmount) : null;
    const arenaDurRaw = arenaDurationMinutes.trim();
    const arenaDurParsed =
      arenaFormatSelected && arenaDurRaw !== "" ? Number.parseInt(arenaDurRaw, 10) : null;
    const arenaDur =
      arenaDurParsed != null && Number.isFinite(arenaDurParsed) && arenaDurParsed > 0
        ? arenaDurParsed
        : undefined;
    return {
      title: title.trim(),
      description: description || null,
      isFree,
      entryFeeAmount: isFree ? 0 : paidFee,
      entryFeeCurrency: entryCurrency,
      prizePoolAmount: prizeOk ? prizeAmount : 0,
      prizePoolCurrency: prizeOk ? prizeCurrency : null,
      prizePoolDisplayEnabled:
        !isFree && prizePoolDisplayPlatform && prizePoolDisplay ? true : undefined,
      prizePoolPlaces: places,
      maxPlayers: arenaFormatSelected ? (mp ?? null) : (mp ?? undefined),
      formatId: formatId.trim(),
      arenaDurationMinutes: arenaFormatSelected ? (arenaDur ?? null) : null,
      prizePayoutMode:
        !isFree && prizePoolDisplayPlatform && prizePoolDisplay && payoutMode.trim()
          ? payoutMode.trim()
          : undefined,
      prizePlacePercents:
        !isFree &&
        prizePoolDisplayPlatform &&
        prizePoolDisplay &&
        (payoutMode.trim() ===
          (enumsQuery.data?.competition_payout_mode_places_percent || "").trim() ||
          payoutMode.trim() === (enumsQuery.data?.competition_payout_mode_dual_purse || "").trim())
          ? (buildPlacePercentsPayload(prizePercent1, prizePercent2, prizePercent3) ?? undefined)
          : undefined,
    };
  }

  function placesSumInvalid(prizeAmount: number): boolean {
    const rows = [prizePlace1, prizePlace2, prizePlace3];
    let any = false;
    let sum = 0;
    for (const raw of rows) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const amt = Number(trimmed);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      any = true;
      sum += amt;
    }
    return any && sum > prizeAmount + 0.001;
  }

  function submitForm() {
    setFormAttempted(true);
    if (!title.trim() || !entryCurrency || !formatId.trim()) return;
    if (arenaFormatSelected) {
      const d = Number.parseInt(arenaDurationMinutes.trim(), 10);
      if (!Number.isFinite(d) || d <= 0) return;
      // Empty max = Unlimited. Non-empty but < 2 must not silently become Unlimited.
      const mpRaw = maxPlayers.trim();
      if (mpRaw !== "") {
        const mpParsed = Number.parseInt(mpRaw, 10);
        if (!Number.isFinite(mpParsed) || mpParsed < 2) return;
      }
    } else {
      const mpRaw = maxPlayers.trim();
      const mpParsed = mpRaw === "" ? null : Number.parseInt(mpRaw, 10);
      if (mpParsed == null || !Number.isFinite(mpParsed) || mpParsed < 2) return;
      if (classicSeatCeilingVal >= 2 && mpParsed > classicSeatCeilingVal) return;
    }
    const paidFee = isFree ? 0 : parsePositiveDecimal(entryFee);
    if (!isFree && paidFee == null) return;
    const prizeAmount = isFree || prizePool.trim() === "" ? 0 : Number(prizePool);
    if (
      !isFree &&
      Number.isFinite(prizeAmount) &&
      prizeAmount > 0 &&
      placesSumInvalid(prizeAmount)
    ) {
      return;
    }
    if (
      !isFree &&
      prizePoolDisplay &&
      (payoutMode.trim() ===
        (enumsQuery.data?.competition_payout_mode_places_percent || "").trim() ||
        payoutMode.trim() === (enumsQuery.data?.competition_payout_mode_dual_purse || "").trim()) &&
      placePercentsSumInvalid(prizePercent1, prizePercent2, prizePercent3)
    ) {
      return;
    }
    const payload = buildPayload(paidFee ?? 0);
    if (isEditing && formMode?.kind === "edit") {
      updateMutation.mutate(
        { id: formMode.tournament.id, ...payload },
        { onSuccess: () => formDialog.close() },
      );
      return;
    }
    const createVars = {
      title: payload.title,
      description: payload.description,
      isFree: payload.isFree,
      entryFeeAmount: payload.entryFeeAmount,
      entryFeeCurrency: payload.entryFeeCurrency,
      prizePoolAmount: payload.prizePoolAmount,
      prizePoolCurrency: payload.prizePoolCurrency,
      prizePoolDisplayEnabled: payload.prizePoolDisplayEnabled,
      maxPlayers: payload.maxPlayers,
      formatId: payload.formatId,
      arenaDurationMinutes:
        payload.arenaDurationMinutes != null && payload.arenaDurationMinutes > 0
          ? payload.arenaDurationMinutes
          : undefined,
      prizePayoutMode: payload.prizePayoutMode || undefined,
      prizePlacePercents: payload.prizePlacePercents
        ? JSON.stringify(payload.prizePlacePercents)
        : undefined,
    };
    createMutation.mutate(createVars, {
      onSuccess: (data) => {
        const created = data?.createTournament;
        if (created?.id) {
          const finishEdit = () => {
            setFormAttempted(false);
            // Prefer payload (REST patch may have written custom dual/places %); else parse GQL JSON string.
            let handoffPercents: Record<string, number> | null = payload.prizePlacePercents ?? null;
            if (!handoffPercents) {
              const raw = (created.prizePlacePercents || "").trim();
              if (raw) {
                try {
                  const parsed = JSON.parse(raw) as Record<string, unknown>;
                  const out: Record<string, number> = {};
                  for (const [k, v] of Object.entries(parsed || {})) {
                    const n = Number(v);
                    if (Number.isFinite(n)) out[k] = n;
                  }
                  if (Object.keys(out).length > 0) handoffPercents = out;
                } catch {
                  handoffPercents = null;
                }
              }
            }
            // Stay open in edit so prize thumbnail + gallery uploads work (smart-menu create→media).
            formDialog.openWith({
              kind: "edit",
              tournament: {
                id: created.id,
                title: created.title,
                description: (payload.description as string | null) ?? null,
                isFree: created.isFree,
                entryFeeAmount: created.entryFeeAmount,
                entryFeeCurrency: created.entryFeeCurrency,
                prizePoolAmount: created.prizePoolAmount,
                prizePoolCurrency: created.prizePoolCurrency ?? null,
                prizePoolPlaces: payload.prizePoolPlaces ?? null,
                prizeImageUrl: null,
                gallery: [],
                status: created.status,
                prizePoolDisplayEnabled: created.prizePoolDisplayEnabled,
                prizePoolNow: created.prizePoolNow,
                prizePoolIfFull: created.prizePoolIfFull,
                prizePoolGuaranteeAmount: created.prizePoolGuaranteeAmount,
                prizePoolFrozen: created.prizePoolFrozen,
                maxPlayers: created.maxPlayers,
                seatCapUnlimited: created.seatCapUnlimited === true,
                formatId: (created.formatId || formatId).trim() || null,
                arenaDurationMinutes:
                  created.arenaDurationMinutes ?? payload.arenaDurationMinutes ?? null,
                prizePayoutMode:
                  (created.prizePayoutMode || payload.prizePayoutMode || "").trim() || null,
                prizePlacePercents: handoffPercents,
              },
            });
          };
          const needsRestPatch =
            (payload.prizePoolPlaces && payload.prizePoolAmount > 0) ||
            (arenaFormatSelected && payload.arenaDurationMinutes != null) ||
            Boolean(payload.prizePayoutMode);
          if (needsRestPatch) {
            updateMutation.mutate(
              { id: created.id, ...payload },
              { onSuccess: finishEdit, onError: finishEdit },
            );
            return;
          }
          finishEdit();
          return;
        }
        formDialog.close();
      },
    });
  }

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-8">
        <TournamentListSkeleton tab={tab} />
      </div>
    );
  }

  if (!chrome) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-[var(--dama-muted)]">
          {(chromeQuery.data?.tournament_chrome_unavailable || "").trim()}
        </p>
      </div>
    );
  }

  const formTitle = isEditing ? chrome.edit_modal_title : chrome.create_modal_title;
  const formReady =
    Boolean(chrome.dialog_close_label.trim()) &&
    Boolean(chrome.cancel_action.trim()) &&
    Boolean(chrome.save_action.trim()) &&
    Boolean(chrome.save_pending.trim()) &&
    Boolean(formTitle.trim());
  const empty = chrome.empty_value;
  const sep = chrome.amount_currency_separator;
  const labelFor = (code: string) => {
    const labeled = (tournamentStatusLabels[code] || "").trim();
    return labeled || empty;
  };

  const tabListLabel = (chrome.tab_list_label || "").trim() || (chrome.page_title || "").trim();
  const tabLiveBoards = (chrome.tab_live_boards_label || "").trim();
  const tabArena = (chrome.arena_settings_title || "").trim();
  const tabStandings = (chrome.standings_settings_title || "").trim();
  const tabPointsToast = (chrome.points_toast_settings_title || "").trim();
  const tabPayout = (chrome.payout_settings_title || "").trim();
  const tabPrizeSettle = (chrome.prize_settle_settings_title || "").trim();
  const tabReports = (chrome.reports_title || "").trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        {isAdmin && !roleLoading && tab === "list" ? (
          <Button variant="gold" onClick={() => formDialog.openWith({ kind: "create" })}>
            {chrome.create_action}
          </Button>
        ) : null}
      </div>

      {roleLoading ? (
        <TournamentBodySkeleton tab={tab} />
      ) : !isAdmin ? (
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={(chrome.page_title || "").trim() || undefined}
            className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
          >
            {[
              { id: "list" as TournamentTab, label: tabListLabel },
              ...(tabLiveBoards && isOfficialPauseChromeReady(officialPauseChromeQuery.data)
                ? [{ id: "live-boards" as TournamentTab, label: tabLiveBoards }]
                : []),
              { id: "arena" as TournamentTab, label: tabArena },
              { id: "standings" as TournamentTab, label: tabStandings },
              { id: "points-toast" as TournamentTab, label: tabPointsToast },
              { id: "payout-defaults" as TournamentTab, label: tabPayout },
              { id: "prize-settle" as TournamentTab, label: tabPrizeSettle },
              ...(canReviewReports && tabReports
                ? [{ id: "reports" as TournamentTab, label: tabReports }]
                : []),
            ]
              .filter((t) => Boolean(t.label))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "bg-[var(--dama-card)] text-[var(--dama-fg)] shadow-sm"
                      : "text-[var(--dama-muted)] hover:text-[var(--dama-fg)]",
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
          </div>

          {tab === "live-boards" &&
          token &&
          isOfficialPauseChromeReady(officialPauseChromeQuery.data) ? (
            <OfficialPauseLiveBoards
              token={token}
              chrome={officialPauseChromeQuery.data}
              metaSep={typeof chrome.meta_separator === "string" ? chrome.meta_separator : ""}
              pageSize={pageSize}
            />
          ) : null}

          {tab === "list" ? (
            <div className="space-y-3">
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-tournaments-search",
                    label: (chrome.search_label || "").trim(),
                    placeholder: (chrome.search_placeholder || "").trim(),
                    value: searchDraft,
                    onChange: setSearchDraft,
                  },
                  {
                    kind: "select",
                    id: "admin-tournaments-entry",
                    label: (chrome.filter_entry_label || "").trim(),
                    value: entryFilter === "all" ? "" : entryFilter,
                    onChange: (v) => setEntryFilter((v || "all") as AdminTournamentEntryFilter),
                    allLabel: (chrome.filter_all_label || "").trim() || undefined,
                    options: [
                      { value: "free", label: (chrome.filter_free_label || "").trim() },
                      { value: "paid", label: (chrome.filter_paid_label || "").trim() },
                    ].filter((o) => Boolean(o.label)),
                  },
                ]}
              />
              {pageLoading ? (
                <TournamentListBodySkeleton />
              ) : (
                <OpsDataTable
                  columns={tournamentColumns}
                  data={listQuery.data?.tournaments ?? []}
                  getRowId={(t) => t.id}
                  isFetching={softFetching}
                  meta={listQuery.data?.meta}
                  onPage={(next) => {
                    setSkip(next);
                    setRowSelection({});
                  }}
                  pageDisabled={softFetching || bulkPending}
                  pageInputId="admin-tournaments-skip"
                  empty={
                    <p className="py-8 text-center text-sm text-[var(--dama-muted)]">
                      {chrome.empty_list}
                    </p>
                  }
                  selection={{
                    chrome: {
                      selectAllLabel: (chrome.select_all_label || "").trim(),
                      selectRowLabel: (chrome.select_row_label || "").trim(),
                      selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
                    },
                    rowSelection,
                    onRowSelectionChange: setRowSelection,
                    toolbar: (
                      <div className="flex flex-wrap gap-2">
                        {(chrome.delete_action || "").trim() ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                            isLoading={bulkPending}
                            pendingLabel={(chrome.save_pending || "").trim()}
                            onClick={() => setBulkDeleteOpen(true)}
                          >
                            {(chrome.delete_action || "").trim()}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={bulkPending}
                          onClick={() => setRowSelection({})}
                        >
                          {(chrome.clear_selection_action || "").trim()}
                        </Button>
                      </div>
                    ),
                  }}
                />
              )}
            </div>
          ) : null}

          {tab === "arena" && enumsQuery.data ? (
            <ArenaSettingsCard
              chrome={chrome}
              enums={enumsQuery.data}
              token={token}
              disabled={roleLoading}
            />
          ) : null}
          {tab === "standings" && enumsQuery.data ? (
            <StandingsPointsCard
              chrome={chrome}
              enums={enumsQuery.data}
              token={token}
              disabled={roleLoading}
            />
          ) : null}
          {tab === "points-toast" ? (
            <PointsToastSettingsCard chrome={chrome} token={token} disabled={roleLoading} />
          ) : null}
          {tab === "payout-defaults" && enumsQuery.data ? (
            <PayoutDefaultsCard
              chrome={chrome}
              enums={enumsQuery.data}
              token={token}
              disabled={roleLoading}
            />
          ) : null}
          {tab === "prize-settle" && enumsQuery.data ? (
            <PrizeSettleSettingsCard
              chrome={chrome}
              enums={enumsQuery.data}
              token={token}
              disabled={roleLoading}
            />
          ) : null}
          {tab === "reports" && canReviewReports ? <TournamentReportsPanel /> : null}
        </>
      )}

      {formReady ? (
        <Dialog open={formDialog.open} onOpenChange={formDialog.onOpenChange}>
          <DialogContent closeLabel={chrome.dialog_close_label} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{formTitle}</DialogTitle>
              <DialogDescription className="sr-only">{formTitle}</DialogDescription>
            </DialogHeader>
            <TournamentFormFields
              chrome={chrome}
              isFree={isFree}
              setIsFree={setIsFree}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              entryFee={entryFee}
              setEntryFee={setEntryFee}
              entryCurrency={entryCurrency}
              setEntryCurrency={setEntryCurrency}
              prizePool={prizePool}
              setPrizePool={setPrizePool}
              prizeCurrency={prizeCurrency}
              setPrizeCurrency={setPrizeCurrency}
              prizePlace1={prizePlace1}
              setPrizePlace1={setPrizePlace1}
              prizePlace2={prizePlace2}
              setPrizePlace2={setPrizePlace2}
              prizePlace3={prizePlace3}
              setPrizePlace3={setPrizePlace3}
              prizePoolDisplay={prizePoolDisplay}
              setPrizePoolDisplay={setPrizePoolDisplay}
              maxPlayers={maxPlayers}
              setMaxPlayers={setMaxPlayers}
              formatId={formatId}
              setFormatId={setFormatId}
              formatOptions={formatOptions}
              formatLocked={editCupStarted}
              supportedCurrencies={supportedCurrencies}
              currencySelectLoading={currencySelectLoading}
              prizePoolDisplayPlatform={prizePoolDisplayPlatform}
              disabled={formPending}
              idPrefix={isEditing ? "edit-tournament" : "create-tournament"}
              titleError={
                formAttempted && !title.trim() ? (chrome.title_required || "").trim() : undefined
              }
              entryFeeError={
                formAttempted && !isFree && parsePositiveDecimal(entryFee) == null
                  ? (chrome.entry_fee_required || "").trim()
                  : undefined
              }
              formatError={
                formAttempted && !formatId.trim()
                  ? (chrome.format_required || "").trim()
                  : undefined
              }
              maxPlayersError={
                formAttempted
                  ? (() => {
                      const mpRaw = maxPlayers.trim();
                      const mpParsed = mpRaw === "" ? null : Number.parseInt(mpRaw, 10);
                      if (arenaFormatSelected) {
                        // Empty = Unlimited. Typed invalid low must show required, not open enroll.
                        if (
                          mpRaw !== "" &&
                          (mpParsed == null || !Number.isFinite(mpParsed) || mpParsed < 2)
                        ) {
                          return (chrome.err_max_players_required || "").trim();
                        }
                        return undefined;
                      }
                      if (mpParsed == null || !Number.isFinite(mpParsed) || mpParsed < 2) {
                        return (chrome.err_max_players_required || "").trim();
                      }
                      if (classicSeatCeilingVal >= 2 && mpParsed > classicSeatCeilingVal) {
                        return (chrome.err_unlimited_arena_only || "").trim();
                      }
                      return undefined;
                    })()
                  : undefined
              }
              placesSumError={
                formAttempted &&
                !isFree &&
                Number(prizePool) > 0 &&
                placesSumInvalid(Number(prizePool))
                  ? (chrome.err_prize_places_sum || "").trim()
                  : undefined
              }
              showArenaDuration={arenaFormatSelected}
              arenaDurationMinutes={arenaDurationMinutes}
              setArenaDurationMinutes={setArenaDurationMinutes}
              arenaDurationError={
                formAttempted &&
                arenaFormatSelected &&
                (() => {
                  const d = Number.parseInt(arenaDurationMinutes.trim(), 10);
                  return !Number.isFinite(d) || d <= 0;
                })()
                  ? (chrome.arena_duration_required || "").trim()
                  : undefined
              }
              enums={enumsQuery.data}
              payoutMode={payoutMode}
              setPayoutMode={setPayoutMode}
              prizePercent1={prizePercent1}
              setPrizePercent1={setPrizePercent1}
              prizePercent2={prizePercent2}
              setPrizePercent2={setPrizePercent2}
              prizePercent3={prizePercent3}
              setPrizePercent3={setPrizePercent3}
              percentsSumError={
                formAttempted &&
                prizePoolDisplay &&
                (payoutMode.trim() ===
                  (enumsQuery.data?.competition_payout_mode_places_percent || "").trim() ||
                  payoutMode.trim() ===
                    (enumsQuery.data?.competition_payout_mode_dual_purse || "").trim()) &&
                placePercentsSumInvalid(prizePercent1, prizePercent2, prizePercent3)
                  ? (chrome.err_prize_place_percents_sum || "").trim()
                  : undefined
              }
            />
            {isEditing && editMediaTournament && dropzoneChrome ? (
              <TournamentDetailMedia
                tournament={editMediaTournament}
                chrome={chrome}
                dropzoneChrome={dropzoneChrome}
                uploadingPrize={
                  (prizeImageMutation.isPending &&
                    prizeImageMutation.variables?.id === editMediaTournament.id) ||
                  (clearPrizeImageMutation.isPending &&
                    clearPrizeImageMutation.variables?.id === editMediaTournament.id)
                }
                uploadingGallery={
                  (galleryMutation.isPending &&
                    galleryMutation.variables?.id === editMediaTournament.id) ||
                  (removeGalleryMutation.isPending &&
                    removeGalleryMutation.variables?.id === editMediaTournament.id)
                }
                onPrizeImage={(file) =>
                  prizeImageMutation.mutate({ id: editMediaTournament.id, file })
                }
                onClearPrizeImage={() =>
                  clearPrizeImageMutation.mutate({ id: editMediaTournament.id })
                }
                onGallery={(files) => galleryMutation.mutate({ id: editMediaTournament.id, files })}
                onRemoveGallery={(index) =>
                  removeGalleryMutation.mutate({ id: editMediaTournament.id, index })
                }
              />
            ) : null}
            <DialogFooter damaDialogFooter>
              {isEditing &&
              formMode?.kind === "edit" &&
              editMediaTournament &&
              (chrome.arena_finish_action || "").trim() &&
              isArenaTournament(editMediaTournament, enumsQuery.data) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={
                    finishArenaMutation.isPending &&
                    finishArenaMutation.variables?.id === editMediaTournament.id
                  }
                  pendingLabel={(chrome.arena_finish_pending || "").trim() || undefined}
                  disabled={finishArenaMutation.isPending || formPending}
                  title={arenaFinishBlockedReason(editMediaTournament, chrome) || undefined}
                  onClick={() => {
                    const blocked = arenaFinishBlockedReason(editMediaTournament, chrome);
                    if (blocked) {
                      toast.message(blocked);
                      return;
                    }
                    finishArenaMutation.mutate({ id: editMediaTournament.id });
                  }}
                >
                  {(chrome.arena_finish_action || "").trim()}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={formPending}
                onClick={() => formDialog.close()}
              >
                {chrome.cancel_action}
              </Button>
              <Button
                type="button"
                variant="gold"
                isLoading={formPending}
                pendingLabel={isEditing ? chrome.save_pending : chrome.create_pending}
                disabled={formPending || currencySelectLoading || !entryCurrency}
                onClick={() => submitForm()}
              >
                {isEditing ? chrome.save_action : chrome.create_action}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
        <DialogContent closeLabel={chrome.detail_close_label} className="max-w-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{chrome.detail_modal_title}</DialogTitle>
            <DialogDescription className="sr-only">{chrome.detail_modal_title}</DialogDescription>
          </DialogHeader>
          {detailTournament ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow label={chrome.title_label} value={detailTournament.title || empty} />
                <DetailRow
                  label={chrome.status_field_label}
                  value={labelFor(detailTournament.status)}
                />
                <DetailRow
                  label={chrome.format_label}
                  value={formatDisplayLabel(detailTournament, empty)}
                />
                <DetailRow
                  label={chrome.col_entry}
                  value={
                    detailTournament.isFree ? chrome.filter_free_label : chrome.filter_paid_label
                  }
                />
                <DetailRow
                  label={chrome.entry_amount_label}
                  value={
                    detailTournament.isFree
                      ? `${chrome.free_entry_amount}${sep}${detailTournament.entryFeeCurrency || empty}`.trim()
                      : formatMoney(
                          detailTournament.entryFeeAmount,
                          detailTournament.entryFeeCurrency,
                          sep,
                          empty,
                        )
                  }
                />
                <DetailRow
                  label={chrome.prize_amount_label}
                  value={formatMoney(
                    detailTournament.prizePoolAmount,
                    detailTournament.prizePoolCurrency,
                    sep,
                    empty,
                  )}
                />
                <DetailRow
                  label={chrome.prize_pool_now_label}
                  value={formatMoney(
                    detailTournament.prizePoolNow,
                    detailTournament.prizePoolCurrencyLive || detailTournament.prizePoolCurrency,
                    sep,
                    empty,
                  )}
                />
                <DetailRow
                  label={chrome.prize_pool_if_full_label}
                  value={formatMoney(
                    detailTournament.prizePoolIfFull,
                    detailTournament.prizePoolCurrencyLive || detailTournament.prizePoolCurrency,
                    sep,
                    empty,
                  )}
                />
                {(chrome.prize_pool_guaranteed_label || "").trim() &&
                detailTournament.prizePoolGuaranteeAmount != null ? (
                  <DetailRow
                    label={(chrome.prize_pool_guaranteed_label || "").trim()}
                    value={formatMoney(
                      detailTournament.prizePoolGuaranteeAmount,
                      detailTournament.prizePoolCurrencyLive || detailTournament.prizePoolCurrency,
                      sep,
                      empty,
                    )}
                  />
                ) : null}
                <DetailRow
                  label={chrome.prize_pool_max_players_label}
                  value={formatSeatCapDisplay(
                    detailTournament.maxPlayers,
                    swissRoundsByMax,
                    chrome.unlimited_players_label || "",
                    empty,
                  )}
                />
                <DetailRow
                  label={chrome.description_label}
                  value={(detailTournament.description || "").trim() || empty}
                />
                {(chrome.created_at_label || "").trim() ? (
                  <DetailRow
                    label={(chrome.created_at_label || "").trim()}
                    value={(detailTournament.createdAt || "").trim() || empty}
                  />
                ) : null}
                {(chrome.cup_started_at_label || "").trim() ? (
                  <DetailRow
                    label={(chrome.cup_started_at_label || "").trim()}
                    value={
                      (detailTournament.startedAt || "").trim() ||
                      (chrome.cup_not_started_value || "").trim() ||
                      empty
                    }
                  />
                ) : null}
                {(chrome.cup_finished_at_label || "").trim() ? (
                  <DetailRow
                    label={(chrome.cup_finished_at_label || "").trim()}
                    value={
                      (detailTournament.finishedAt || "").trim() ||
                      ((detailTournament.startedAt || "").trim()
                        ? (chrome.cup_not_finished_value || "").trim() || empty
                        : (chrome.cup_not_started_value || "").trim() || empty)
                    }
                  />
                ) : null}
                {(chrome.dispute_window_ends_at_label || "").trim() ? (
                  <DetailRow
                    label={(chrome.dispute_window_ends_at_label || "").trim()}
                    value={
                      (detailTournament.disputeWindowEndsAt || "").trim() ||
                      (chrome.dispute_window_not_open_value || "").trim() ||
                      empty
                    }
                  />
                ) : null}
                {(chrome.prize_settled_at_label || "").trim() ? (
                  <DetailRow
                    label={(chrome.prize_settled_at_label || "").trim()}
                    value={
                      (detailTournament.prizeSettledAt || "").trim() ||
                      (chrome.prize_not_settled_value || "").trim() ||
                      empty
                    }
                  />
                ) : null}
                {(chrome.arena_duration_ends_at_label || "").trim() &&
                (detailTournament.arenaEndsAt || "").trim() ? (
                  <DetailRow
                    label={(chrome.arena_duration_ends_at_label || "").trim()}
                    value={(detailTournament.arenaEndsAt || "").trim()}
                  />
                ) : null}
              </div>
              {(chrome.prize_pool_frozen_blurb || "").trim() &&
              detailTournament.prizePoolFrozen === true ? (
                <p className="text-sm text-[var(--dama-muted)]">
                  {(chrome.prize_pool_frozen_blurb || "").trim()}
                </p>
              ) : null}

              {(() => {
                const section = (chrome.projected_payout_section_label || "").trim();
                const blurb = (chrome.projected_payout_blurb || "").trim();
                const mode = (detailTournament.prizePayoutMode || "").trim();
                const pot = detailTournament.prizePoolNow;
                const cur = (
                  detailTournament.prizePoolCurrencyLive ||
                  detailTournament.prizePoolCurrency ||
                  ""
                ).trim();
                if (
                  !section ||
                  !blurb ||
                  !mode ||
                  detailTournament.prizePoolDisplayEnabled !== true ||
                  pot == null ||
                  !Number.isFinite(pot) ||
                  pot <= 0
                ) {
                  return null;
                }
                const placesMode = (
                  enumsQuery.data?.competition_payout_mode_places_percent || ""
                ).trim();
                const scoreMode = (
                  enumsQuery.data?.competition_payout_mode_score_share || ""
                ).trim();
                const dualMode = (enumsQuery.data?.competition_payout_mode_dual_purse || "").trim();
                const dualPlacePct = Number(
                  (enumsQuery.data?.competition_dual_purse_place_percent || "").trim(),
                );
                const lines: string[] = [];
                if (mode === placesMode) {
                  const percents = detailTournament.prizePlacePercents || {};
                  for (const place of ["1", "2", "3"]) {
                    const pct = Number(percents[place]);
                    if (!Number.isFinite(pct) || pct <= 0) continue;
                    const amt = Math.round(((pot * pct) / 100) * 100) / 100;
                    lines.push(formatMoney(amt, cur, sep, empty) || `${amt}${sep}${cur}`.trim());
                  }
                  if (lines.length === 0) return null;
                } else if (mode === scoreMode) {
                  const rows = detailScoreboardQuery.data ?? [];
                  let totalPts = 0;
                  for (const r of rows) totalPts += r.points;
                  if (totalPts <= 0) return null;
                  for (const r of rows) {
                    const amt = Math.round(((pot * r.points) / totalPts) * 100) / 100;
                    if (amt <= 0) continue;
                    const money = formatMoney(amt, cur, sep, empty) || `${amt}${sep}${cur}`.trim();
                    const who = (r.username || "").trim() || r.userId;
                    lines.push(`${who}: ${money} (${r.points})`);
                  }
                  if (lines.length === 0) return null;
                } else if (
                  mode === dualMode &&
                  Number.isFinite(dualPlacePct) &&
                  dualPlacePct > 0 &&
                  dualPlacePct < 100
                ) {
                  const rows = detailScoreboardQuery.data ?? [];
                  let totalPts = 0;
                  for (const r of rows) totalPts += r.points;
                  const percents = detailTournament.prizePlacePercents || {};
                  // Zero Pts: mirror server fail-closed - full-pot places% (not place-purse slice).
                  const placeBase =
                    totalPts > 0 ? Math.round(((pot * dualPlacePct) / 100) * 100) / 100 : pot;
                  for (const place of ["1", "2", "3"]) {
                    const pct = Number(percents[place]);
                    if (!Number.isFinite(pct) || pct <= 0) continue;
                    const amt = Math.round(((placeBase * pct) / 100) * 100) / 100;
                    lines.push(
                      `P${place}: ${formatMoney(amt, cur, sep, empty) || `${amt}${sep}${cur}`.trim()}`,
                    );
                  }
                  if (totalPts > 0) {
                    const placePurse = Math.round(((pot * dualPlacePct) / 100) * 100) / 100;
                    const perfPurse = Math.round((pot - placePurse) * 100) / 100;
                    for (const r of rows) {
                      const amt = Math.round(((perfPurse * r.points) / totalPts) * 100) / 100;
                      if (amt <= 0) continue;
                      const money =
                        formatMoney(amt, cur, sep, empty) || `${amt}${sep}${cur}`.trim();
                      const who = (r.username || "").trim() || r.userId;
                      lines.push(`${who}: ${money} (${r.points})`);
                    }
                  }
                  if (lines.length === 0) return null;
                } else {
                  return null;
                }
                return (
                  <div className="space-y-1 rounded-lg border border-[var(--dama-border)] p-3">
                    <p className="text-sm font-medium">{section}</p>
                    <p className="text-xs text-[var(--dama-muted)]">{blurb}</p>
                    <ul className="list-inside list-disc text-sm">
                      {lines.map((line, i) => (
                        <li key={`${i}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                  {chrome.status_field_label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tournamentStatuses.map((status) => {
                    const archivedCode =
                      tournamentStatuses.find((s) => s === "archived") || "archived";
                    const cupStarted = Boolean((detailTournament.startedAt || "").trim());
                    const isCurrent = detailTournament.status === status;
                    // After start/finish: only soft-archive is allowed (backend parity).
                    const lockedAfterStart = cupStarted && !isCurrent && status !== archivedCode;
                    const startedLockMsg = (chrome.err_cup_already_started || "").trim();
                    return (
                      <Button
                        key={status}
                        size="sm"
                        variant={isCurrent ? "gold" : "outline"}
                        isLoading={
                          statusMutation.isPending &&
                          statusMutation.variables?.id === detailTournament.id &&
                          statusMutation.variables.status === status
                        }
                        pendingLabel={chrome.status_update_pending}
                        disabled={
                          isCurrent ||
                          tournamentStatuses.length === 0 ||
                          lockedAfterStart ||
                          statusMutation.isPending
                        }
                        title={lockedAfterStart ? startedLockMsg || undefined : undefined}
                        onClick={() => {
                          if (lockedAfterStart) {
                            if (startedLockMsg) toast.message(startedLockMsg);
                            return;
                          }
                          statusMutation.mutate(
                            { id: detailTournament.id, status },
                            {
                              onSuccess: (tour) => {
                                if (tour) setDetailTournament(tour);
                              },
                            },
                          );
                        }}
                      >
                        {labelFor(status)}
                      </Button>
                    );
                  })}
                </div>
                {(detailTournament.startedAt || "").trim() &&
                (chrome.status_after_start_blurb || "").trim() ? (
                  <p className="text-xs text-[var(--dama-muted)]">
                    {(chrome.status_after_start_blurb || "").trim()}
                  </p>
                ) : null}
              </div>

              {(chrome.start_cup_action || "").trim() &&
              !(detailTournament.startedAt || "").trim() ? (
                <div>
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    isLoading={
                      startCupMutation.isPending &&
                      startCupMutation.variables?.id === detailTournament.id
                    }
                    pendingLabel={chrome.start_cup_pending}
                    disabled={startCupMutation.isPending}
                    onClick={() =>
                      startCupMutation.mutate(
                        { id: detailTournament.id },
                        {
                          onSuccess: (tour) => {
                            if (tour) {
                              setDetailTournament(tour);
                              return;
                            }
                            setDetailTournament((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    startedAt: prev.startedAt || new Date().toISOString(),
                                  }
                                : prev,
                            );
                          },
                        },
                      )
                    }
                  >
                    {chrome.start_cup_action}
                  </Button>
                </div>
              ) : null}

              {(chrome.arena_finish_action || "").trim() &&
              isArenaTournament(detailTournament, enumsQuery.data) ? (
                <div className="space-y-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={
                      finishArenaMutation.isPending &&
                      finishArenaMutation.variables?.id === detailTournament.id
                    }
                    pendingLabel={(chrome.arena_finish_pending || "").trim() || undefined}
                    disabled={finishArenaMutation.isPending}
                    title={arenaFinishBlockedReason(detailTournament, chrome) || undefined}
                    onClick={() => {
                      const blocked = arenaFinishBlockedReason(detailTournament, chrome);
                      if (blocked) {
                        toast.message(blocked);
                        return;
                      }
                      finishArenaMutation.mutate(
                        { id: detailTournament.id },
                        {
                          onSuccess: (tour) => {
                            if (tour) {
                              setDetailTournament(tour);
                              return;
                            }
                            setDetailTournament((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    finishedAt: prev.finishedAt || new Date().toISOString(),
                                  }
                                : prev,
                            );
                          },
                        },
                      );
                    }}
                  >
                    {(chrome.arena_finish_action || "").trim()}
                  </Button>
                  {arenaFinishBlockedReason(detailTournament, chrome) ? (
                    <p className="text-xs text-[var(--dama-muted)]">
                      {arenaFinishBlockedReason(detailTournament, chrome)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(chrome.settle_prizes_action || "").trim() && token ? (
                <div className="space-y-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={settlePrizesMutation.isPending}
                    pendingLabel={(chrome.settle_prizes_pending || "").trim() || undefined}
                    disabled={settlePrizesMutation.isPending}
                    title={
                      !(detailTournament.finishedAt || "").trim()
                        ? (chrome.settle_prizes_requires_finished || "").trim() || undefined
                        : (detailTournament.prizeSettledAt || "").trim()
                          ? (chrome.settle_prizes_already_settled || "").trim() || undefined
                          : undefined
                    }
                    onClick={() => {
                      // Keep clickable so operators always get an explicit DB chrome reason.
                      if (!(detailTournament.finishedAt || "").trim()) {
                        const msg = (chrome.settle_prizes_requires_finished || "").trim();
                        if (msg) toast.message(msg);
                        return;
                      }
                      if ((detailTournament.prizeSettledAt || "").trim()) {
                        const msg = (chrome.settle_prizes_already_settled || "").trim();
                        if (msg) toast.message(msg);
                        return;
                      }
                      settlePrizesMutation.mutate();
                    }}
                  >
                    {(chrome.settle_prizes_action || "").trim()}
                  </Button>
                  {!(detailTournament.finishedAt || "").trim() &&
                  (chrome.settle_prizes_requires_finished || "").trim() ? (
                    <p className="text-xs text-[var(--dama-muted)]">
                      {(chrome.settle_prizes_requires_finished || "").trim()}
                    </p>
                  ) : null}
                  {(detailTournament.finishedAt || "").trim() &&
                  (detailTournament.prizeSettledAt || "").trim() &&
                  (chrome.settle_prizes_already_settled || "").trim() ? (
                    <p className="text-xs text-[var(--dama-muted)]">
                      {(chrome.settle_prizes_already_settled || "").trim()}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(detailTournament.startedAt || "").trim() &&
              (chrome.control_room_title || "").trim() &&
              token &&
              bracketReadyStatus &&
              ((chrome.force_start_match_action || "").trim() ||
                (chrome.forfeit_action || "").trim() ||
                (chrome.rematch_action || "").trim() ||
                (chrome.official_pause_action || "").trim() ||
                (chrome.official_resume_action || "").trim()) ? (
                <TournamentDetailControlRoom
                  tournamentId={detailTournament.id}
                  token={token}
                  roomTitle={(chrome.control_room_title || "").trim()}
                  forceStartLabel={(chrome.force_start_match_action || "").trim()}
                  forceStartPending={(chrome.force_start_match_pending || "").trim()}
                  forfeitLabel={(chrome.forfeit_action || "").trim()}
                  forfeitPending={(chrome.forfeit_pending || "").trim()}
                  rematchLabel={(chrome.rematch_action || "").trim()}
                  rematchPending={(chrome.rematch_pending || "").trim()}
                  officialPauseLabel={(chrome.official_pause_action || "").trim()}
                  officialPausePending={(chrome.official_pause_pending || "").trim()}
                  officialResumeLabel={(chrome.official_resume_action || "").trim()}
                  officialResumePending={(chrome.official_resume_pending || "").trim()}
                  officialPauseStatusLabel={(chrome.official_pause_status_label || "").trim()}
                  bracketReadyStatus={bracketReadyStatus}
                  bracketLiveStatus={bracketLiveStatus}
                  metaSep={typeof chrome.meta_separator === "string" ? chrome.meta_separator : ""}
                  empty={empty}
                />
              ) : null}

              {dropzoneChrome ? (
                <TournamentDetailMedia
                  tournament={detailTournament}
                  chrome={chrome}
                  dropzoneChrome={dropzoneChrome}
                  uploadingPrize={
                    (prizeImageMutation.isPending &&
                      prizeImageMutation.variables?.id === detailTournament.id) ||
                    (clearPrizeImageMutation.isPending &&
                      clearPrizeImageMutation.variables?.id === detailTournament.id)
                  }
                  uploadingGallery={
                    (galleryMutation.isPending &&
                      galleryMutation.variables?.id === detailTournament.id) ||
                    (removeGalleryMutation.isPending &&
                      removeGalleryMutation.variables?.id === detailTournament.id)
                  }
                  onPrizeImage={(file) =>
                    prizeImageMutation.mutate({ id: detailTournament.id, file })
                  }
                  onClearPrizeImage={() =>
                    clearPrizeImageMutation.mutate({ id: detailTournament.id })
                  }
                  onGallery={(files) => galleryMutation.mutate({ id: detailTournament.id, files })}
                  onRemoveGallery={(index) =>
                    removeGalleryMutation.mutate({ id: detailTournament.id, index })
                  }
                />
              ) : null}

              {(chrome.detail_players_section_title || "").trim() ? (
                <div className="space-y-2 border-t border-[var(--dama-border)] pt-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--dama-text)]">
                      {(chrome.detail_players_section_title || "").trim()}
                    </p>
                    {(chrome.detail_players_section_blurb || "").trim() ? (
                      <p className="text-xs text-[var(--dama-muted)]">
                        {(chrome.detail_players_section_blurb || "").trim()}
                      </p>
                    ) : null}
                  </div>
                  {detailEntriesQuery.isLoading ? (
                    <OpsDataTableSkeleton columns={5} rows={4} />
                  ) : detailEntries.length === 0 ? (
                    <p className="text-sm text-[var(--dama-muted)]">
                      {(chrome.detail_players_empty || "").trim() || empty}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[440px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-[var(--dama-border)] text-[var(--dama-muted)]">
                              {(chrome.detail_players_col_user || "").trim() ? (
                                <th className="py-2 pr-2 font-medium">
                                  {(chrome.detail_players_col_user || "").trim()}
                                </th>
                              ) : null}
                              {(chrome.detail_players_col_status || "").trim() ? (
                                <th className="py-2 pr-2 font-medium">
                                  {(chrome.detail_players_col_status || "").trim()}
                                </th>
                              ) : null}
                              {(chrome.detail_players_col_checked_in || "").trim() ? (
                                <th className="py-2 pr-2 font-medium">
                                  {(chrome.detail_players_col_checked_in || "").trim()}
                                </th>
                              ) : null}
                              {(chrome.detail_players_col_placement || "").trim() ? (
                                <th className="py-2 pr-2 font-medium">
                                  {(chrome.detail_players_col_placement || "").trim()}
                                </th>
                              ) : null}
                              {(chrome.detail_players_open_user || "").trim() ? (
                                <th className="py-2 font-medium">
                                  {(chrome.detail_players_open_user || "").trim()}
                                </th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody>
                            {detailEntries.map((en) => (
                              <tr
                                key={en.user_id}
                                className="border-b border-[var(--dama-border)] text-[var(--dama-text)]"
                              >
                                {(chrome.detail_players_col_user || "").trim() ? (
                                  <td className="py-2 pr-2 font-medium">
                                    {(en.username || "").trim() || empty}
                                  </td>
                                ) : null}
                                {(chrome.detail_players_col_status || "").trim() ? (
                                  <td className="py-2 pr-2">{(en.status || "").trim() || empty}</td>
                                ) : null}
                                {(chrome.detail_players_col_checked_in || "").trim() ? (
                                  <td className="py-2 pr-2">
                                    {(en.checked_in_at || "").trim()
                                      ? (chrome.detail_yes || "").trim() || empty
                                      : (chrome.detail_no || "").trim() || empty}
                                  </td>
                                ) : null}
                                {(chrome.detail_players_col_placement || "").trim() ? (
                                  <td className="py-2 pr-2">
                                    {typeof en.placement === "number"
                                      ? String(en.placement)
                                      : empty}
                                  </td>
                                ) : null}
                                {(chrome.detail_players_open_user || "").trim() &&
                                (en.user_id || "").trim() ? (
                                  <td className="py-2">
                                    <a
                                      href={`/users/${encodeURIComponent(en.user_id)}`}
                                      className="text-[var(--dama-gold)] underline-offset-2 hover:underline"
                                    >
                                      {(chrome.detail_players_open_user || "").trim()}
                                    </a>
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {detailEntriesMeta ? (
                        <SkipPagination
                          meta={detailEntriesMeta}
                          onPrev={setDetailEntriesSkip}
                          onNext={setDetailEntriesSkip}
                          disabled={detailEntriesQuery.isFetching && !detailEntriesQuery.isLoading}
                          inputId="admin-tournament-detail-players-skip"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={chrome.delete_action}
        description={chrome.delete_confirm}
        cancelLabel={chrome.cancel_action}
        confirmLabel={chrome.delete_action}
        pendingLabel={chrome.save_pending}
        isPending={deleteMutation.isPending}
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              if (detailTournament?.id === deleteTarget.id) detailDialog.close();
              setDeleteTarget(null);
            },
          });
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !bulkPending) setBulkDeleteOpen(false);
        }}
        title={chrome.delete_action}
        description={chrome.delete_confirm}
        cancelLabel={chrome.cancel_action}
        confirmLabel={chrome.delete_action}
        pendingLabel={chrome.save_pending}
        isPending={bulkPending}
        destructive
        onConfirm={() => {
          const ids = selectedRowIds(rowSelection);
          if (!ids.length) return;
          setBulkPending(true);
          void (async () => {
            try {
              for (const id of ids) {
                await deleteMutation.mutateAsync(id);
              }
              if (detailTournament && ids.includes(detailTournament.id)) {
                detailDialog.close();
              }
              setRowSelection({});
              setBulkDeleteOpen(false);
            } finally {
              setBulkPending(false);
            }
          })();
        }}
      />
    </div>
  );
}

function TournamentDetailMedia({
  tournament,
  chrome,
  dropzoneChrome,
  uploadingPrize,
  uploadingGallery,
  onPrizeImage,
  onClearPrizeImage,
  onGallery,
  onRemoveGallery,
}: {
  tournament: AdminTournament;
  chrome: Required<TournamentChrome>;
  dropzoneChrome: Required<MediaUploadChrome>;
  uploadingPrize: boolean;
  uploadingGallery: boolean;
  onPrizeImage: (file: File) => void;
  onClearPrizeImage: () => void;
  onGallery: (files: File[]) => void;
  onRemoveGallery: (index: number) => void;
}) {
  const gallery = (tournament.gallery ?? []).filter((u) => (u || "").trim().length > 0);
  const prizeUrl = (tournament.prizeImageUrl || "").trim();
  const preview = [...(prizeUrl ? [prizeUrl] : []), ...gallery.filter((u) => u !== prizeUrl)]
    .map(resolvePublicMediaUrl)
    .filter(Boolean);

  return (
    <div className="space-y-4 border-t border-[var(--dama-border)] pt-4">
      {preview.length > 0 ? (
        <GalleryCarousel images={preview} ariaLabel={chrome.gallery_label} />
      ) : null}
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
        thumbnailUrl={prizeUrl}
        galleryUrls={gallery}
        busyThumbnail={uploadingPrize}
        busyGallery={uploadingGallery}
        onThumbnail={onPrizeImage}
        onClearThumbnail={onClearPrizeImage}
        onGalleryFiles={onGallery}
        onRemoveGallery={onRemoveGallery}
      />
    </div>
  );
}
