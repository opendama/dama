"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OpsDataTable,
  selectedRowIds,
  type OpsColumn,
  type OpsRowSelectionState,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import { OfficialPauseDialog } from "@/components/tournaments/OfficialPauseDialog";
import { useBulkOfficialPauseMutation } from "@/hooks/mutation/useBulkOfficialPauseMutation";
import { useBulkOfficialResumeMutation } from "@/hooks/mutation/useBulkOfficialResumeMutation";
import { useOfficialPauseGameMutation } from "@/hooks/mutation/useOfficialPauseGameMutation";
import { useOfficialPauseMetaMutation } from "@/hooks/mutation/useOfficialPauseMetaMutation";
import { useOfficialResumeGameMutation } from "@/hooks/mutation/useOfficialResumeGameMutation";
import {
  useOfficialPauseLiveQuery,
  type OfficialPauseLiveGame,
} from "@/hooks/query/useOfficialPauseLiveQuery";
import {
  formatPauseDurationSeconds,
  formatPauseSinceTime,
  livePauseStatusLabel,
  officialPauseRoleLabel,
  type OfficialPauseChrome,
} from "@/types/official-pause-chrome";
import { officialPauseChromeApiToast } from "@/lib/api-toast-message";
import { toast } from "sonner";

type Props = {
  token: string;
  chrome: OfficialPauseChrome;
  metaSep: string;
  /** DB tournaments chrome list_page_size - never invent a client default. */
  pageSize: number;
};

function lastActionLabel(action: string, chrome: OfficialPauseChrome): string {
  const a = (action || "").trim().toLowerCase();
  if (a === "pause") return (chrome.pause_action || "").trim();
  if (a === "resume") return (chrome.resume_action || "").trim();
  if (a === "meta") return (chrome.meta_action || "").trim();
  return "";
}

function isOfficialPaused(g: OfficialPauseLiveGame): boolean {
  return Boolean(g.paused) && (g.pause_kind || "").trim() === "official";
}

export function OfficialPauseLiveBoards({ token, chrome, metaSep, pageSize }: Props) {
  const title = (chrome.live_boards_title || "").trim();
  const blurb = (chrome.live_boards_blurb || "").trim();
  const liveEmpty = (chrome.live_boards_empty || "").trim();
  const filterAll = (chrome.filter_all || "").trim();
  const filterOfficial = (chrome.filter_official_paused || "").trim();
  const kpiLabel = (chrome.kpi_live_official_paused || "").trim();
  // Fail closed: DB kpi_count_separator only (never metaSep middle-dot invent).
  // Do not trim - separators may be intentional whitespace.
  const kpiSep = typeof chrome.kpi_count_separator === "string" ? chrome.kpi_count_separator : "";
  const searchPlaceholder = (chrome.live_search_placeholder || "").trim();
  const copyAction = (chrome.copy_game_id_action || "").trim();
  const copiedToast = (chrome.toast_copied_game_id || "").trim();
  const pauseAction = (chrome.pause_action || "").trim();
  const resumeAction = (chrome.resume_action || "").trim();
  const metaAction = (chrome.meta_action || "").trim();
  const bulkAction = (chrome.bulk_pause_action || "").trim();
  const actionsMenu = (chrome.actions_menu_label || "").trim();
  const selectAll = (chrome.select_all_label || "").trim();
  const selectRow = (chrome.select_row_label || "").trim();
  const selectedFmt = (chrome.selected_count_fmt || "").trim();
  const clearSelection = (chrome.clear_selection_action || "").trim();
  const bulkSelectedPause = (chrome.bulk_selected_pause_action || "").trim();
  const bulkSelectedPausePending = (chrome.bulk_selected_pause_pending || "").trim();
  const bulkSelectedResume = (chrome.bulk_selected_resume_action || "").trim();
  const bulkSelectedResumePending = (chrome.bulk_selected_resume_pending || "").trim();

  const [officialOnly, setOfficialOnly] = useState(false);
  const [q, setQ] = useState("");
  const [skip, setSkip] = useState(0);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [pauseGameId, setPauseGameId] = useState("");
  const [resumeGameId, setResumeGameId] = useState("");
  const [metaGameId, setMetaGameId] = useState("");
  const [bulkRound, setBulkRound] = useState<{
    tournamentId?: string;
    eventId?: string;
    roundIndex: number;
  } | null>(null);
  const [bulkSelectedMode, setBulkSelectedMode] = useState<"pause" | "resume" | null>(null);

  const liveQuery = useOfficialPauseLiveQuery(token, Boolean(title) && pageSize > 0, {
    officialOnly,
    q,
    skip,
    limit: pageSize,
  });
  const pauseMut = useOfficialPauseGameMutation(token);
  const resumeMut = useOfficialResumeGameMutation(token);
  const metaMut = useOfficialPauseMetaMutation(token);
  const bulkMut = useBulkOfficialPauseMutation(token);
  const bulkResumeMut = useBulkOfficialResumeMutation(token);

  const games = liveQuery.data?.games ?? [];
  const metaGame = games.find((g) => g.id === metaGameId);
  const officialCount =
    typeof liveQuery.data?.officially_paused_count === "number"
      ? liveQuery.data.officially_paused_count
      : null;
  const selectedIds = selectedRowIds(rowSelection);
  const selectedGames = games.filter((g) => selectedIds.includes(g.id));
  const selectedCanPause = selectedGames.some((g) => !isOfficialPaused(g));
  const selectedCanResume = selectedGames.some((g) => isOfficialPaused(g));

  const colMatch = (chrome.col_match || "").trim();
  const colPlayers = (chrome.col_players || "").trim();
  const colStatus = (chrome.col_status || "").trim();
  const colClock = (chrome.col_clock || "").trim();
  const colBy = (chrome.col_paused_by || "").trim();
  const colReason = (chrome.col_reason || "").trim();
  const colPausedAt = (chrome.col_paused_at || "").trim();
  const colDuration = (chrome.col_duration || "").trim();
  const colLast = (chrome.col_last_action || "").trim();
  const colActions = (chrome.col_actions || "").trim();
  const frozen = (chrome.clock_frozen_label || "").trim();

  const columns = useMemo<OpsColumn<OfficialPauseLiveGame>[]>(() => {
    const cols: OpsColumn<OfficialPauseLiveGame>[] = [];
    if (colMatch) {
      cols.push({
        id: "match",
        header: colMatch,
        cell: (g) => {
          const matchLabel = [
            g.source === "tournament" && g.tournament_id ? g.tournament_id.slice(0, 8) : "",
            g.source === "hosted" && g.event_id ? g.event_id.slice(0, 8) : "",
            typeof g.round_index === "number" ? String(g.round_index + 1) : "",
            typeof g.match_index === "number" ? String(g.match_index + 1) : "",
            g.id.slice(0, 8),
          ]
            .filter(Boolean)
            .join(metaSep);
          return <span className="text-[var(--dama-text)]">{matchLabel}</span>;
        },
      });
    }
    if (colPlayers) {
      cols.push({
        id: "players",
        header: colPlayers,
        cell: (g) => {
          const players = [(g.player1_username || "").trim(), (g.player2_username || "").trim()]
            .filter(Boolean)
            .join(metaSep);
          return <span className="text-[var(--dama-text)]">{players}</span>;
        },
      });
    }
    if (colStatus) {
      cols.push({
        id: "status",
        header: colStatus,
        cell: (g) => (
          <span className="text-[var(--dama-text)]">{livePauseStatusLabel(g, chrome)}</span>
        ),
      });
    }
    if (colClock) {
      cols.push({
        id: "clock",
        header: colClock,
        cell: (g) => {
          const clock =
            g.paused && frozen
              ? frozen
              : `${Number(g.clock_p1_remaining_ms) || 0}${metaSep}${Number(g.clock_p2_remaining_ms) || 0}`;
          return <span className="text-[var(--dama-text)]">{clock}</span>;
        },
      });
    }
    if (colBy) {
      cols.push({
        id: "by",
        header: colBy,
        cell: (g) => {
          const role = officialPauseRoleLabel(chrome, g.pause_actor_role);
          const name = (g.pause_actor_display_name || "").trim();
          const by = role && name ? [role, name].join(metaSep) : "";
          return <span className="text-[var(--dama-text)]">{by}</span>;
        },
      });
    }
    if (colReason) {
      cols.push({
        id: "reason",
        header: colReason,
        cell: (g) => (
          <span className="text-[var(--dama-text)]">{(g.pause_reason_label || "").trim()}</span>
        ),
      });
    }
    if (colPausedAt) {
      cols.push({
        id: "paused_at",
        header: colPausedAt,
        cell: (g) => (
          <span className="text-[var(--dama-text)]">
            {formatPauseSinceTime(Number(g.paused_at_unix_ms) || 0)}
          </span>
        ),
      });
    }
    if (colDuration) {
      cols.push({
        id: "duration",
        header: colDuration,
        cell: (g) => (
          <span className="text-[var(--dama-text)]">
            {formatPauseDurationSeconds(Number(g.paused_at_unix_ms) || 0)}
          </span>
        ),
      });
    }
    if (colLast) {
      cols.push({
        id: "last",
        header: colLast,
        cell: (g) => (
          <span className="text-[var(--dama-text)]">
            {lastActionLabel((g.last_action || "").trim(), chrome)}
          </span>
        ),
      });
    }
    if (colActions && actionsMenu) {
      cols.push({
        id: "actions",
        header: colActions,
        className: "w-12 text-right",
        cell: (g) => {
          const official = isOfficialPaused(g);
          const canRoundBulk =
            Boolean(bulkAction) &&
            typeof g.round_index === "number" &&
            (g.source === "tournament"
              ? Boolean(g.tournament_id)
              : g.source === "hosted"
                ? Boolean(g.event_id)
                : false);
          return (
            <OpsDataTableRowActions
              triggerLabel={actionsMenu}
              actions={[
                {
                  id: "copy",
                  label: copyAction,
                  onSelect: () => {
                    void navigator.clipboard.writeText(g.id).then(() => {
                      if (copiedToast) toast.success(copiedToast);
                    });
                  },
                },
                {
                  id: "pause",
                  label: !official ? pauseAction : "",
                  onSelect: () => setPauseGameId(g.id),
                },
                {
                  id: "resume",
                  label: official ? resumeAction : "",
                  onSelect: () => setResumeGameId(g.id),
                },
                {
                  id: "meta",
                  label: official ? metaAction : "",
                  onSelect: () => setMetaGameId(g.id),
                },
                {
                  id: "bulk-round",
                  label: canRoundBulk ? bulkAction : "",
                  onSelect: () =>
                    setBulkRound({
                      tournamentId: g.source === "tournament" ? g.tournament_id : undefined,
                      eventId: g.source === "hosted" ? g.event_id : undefined,
                      roundIndex: g.round_index as number,
                    }),
                },
              ]}
            />
          );
        },
      });
    }
    return cols;
  }, [
    actionsMenu,
    bulkAction,
    chrome,
    colActions,
    colBy,
    colClock,
    colDuration,
    colLast,
    colMatch,
    colPausedAt,
    colPlayers,
    colReason,
    colStatus,
    copyAction,
    copiedToast,
    frozen,
    metaAction,
    metaSep,
    pauseAction,
    resumeAction,
  ]);

  if (!title) return null;

  const toastBulkOutcome = (
    res: { ok?: number; skipped_count?: number; failed_count?: number },
    partialKey: string,
    fullKey: string,
  ) => {
    const ok = Number(res.ok) || 0;
    const skipped = Number(res.skipped_count) || 0;
    const failed = Number(res.failed_count) || 0;
    const partial = partialKey.trim();
    const full = fullKey.trim();
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
  };

  // Page-tab panel (peer of List / Arena): no nested bordered "Live boards" card.
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {blurb ? <p className="text-sm text-[var(--dama-muted)]">{blurb}</p> : null}
        {kpiLabel && kpiSep && typeof officialCount === "number" ? (
          <p className="text-xs text-[var(--dama-muted)]">
            {kpiLabel}
            {kpiSep}
            {officialCount}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filterAll || filterOfficial ? (
          <div
            role="tablist"
            aria-label={title}
            className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
          >
            {filterAll ? (
              <button
                type="button"
                role="tab"
                aria-selected={!officialOnly}
                className={
                  !officialOnly
                    ? "rounded-md bg-[var(--dama-card)] px-3 py-1.5 text-sm font-medium text-[var(--dama-fg)] shadow-sm"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--dama-muted)] hover:text-[var(--dama-fg)]"
                }
                onClick={() => {
                  setSkip(0);
                  setRowSelection({});
                  setOfficialOnly(false);
                }}
              >
                {filterAll}
              </button>
            ) : null}
            {filterOfficial ? (
              <button
                type="button"
                role="tab"
                aria-selected={officialOnly}
                className={
                  officialOnly
                    ? "rounded-md bg-[var(--dama-card)] px-3 py-1.5 text-sm font-medium text-[var(--dama-fg)] shadow-sm"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--dama-muted)] hover:text-[var(--dama-fg)]"
                }
                onClick={() => {
                  setSkip(0);
                  setRowSelection({});
                  setOfficialOnly(true);
                }}
              >
                {filterOfficial}
              </button>
            ) : null}
          </div>
        ) : null}
        {searchPlaceholder ? (
          <Input
            className="max-w-xs"
            value={q}
            onChange={(e) => {
              setSkip(0);
              setRowSelection({});
              setQ(e.target.value);
            }}
            placeholder={searchPlaceholder}
          />
        ) : null}
      </div>

      {columns.length > 0 ? (
        <OpsDataTable
          columns={columns}
          data={games}
          getRowId={(g) => g.id}
          isFetching={liveQuery.isFetching}
          empty={
            liveEmpty ? (
              <p className="py-8 text-center text-sm text-[var(--dama-muted)]">{liveEmpty}</p>
            ) : undefined
          }
          meta={liveQuery.data?.meta ?? null}
          onPage={(nextSkip) => {
            setSkip(nextSkip);
            setRowSelection({});
          }}
          pageDisabled={liveQuery.isFetching || bulkMut.isPending || bulkResumeMut.isPending}
          pageInputId="admin-live-boards-skip"
          selection={
            selectAll && selectRow
              ? {
                  chrome: {
                    selectAllLabel: selectAll,
                    selectRowLabel: selectRow,
                    selectedCountFmt: selectedFmt,
                  },
                  rowSelection,
                  onRowSelectionChange: setRowSelection,
                  toolbar: (
                    <div className="flex flex-wrap gap-2">
                      {bulkSelectedPause && selectedCanPause ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={selectedIds.length === 0 || bulkMut.isPending}
                          isLoading={bulkMut.isPending && bulkSelectedMode === "pause"}
                          pendingLabel={bulkSelectedPausePending}
                          onClick={() => setBulkSelectedMode("pause")}
                        >
                          {bulkSelectedPause}
                        </Button>
                      ) : null}
                      {bulkSelectedResume && selectedCanResume ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={selectedIds.length === 0 || bulkResumeMut.isPending}
                          isLoading={bulkResumeMut.isPending && bulkSelectedMode === "resume"}
                          pendingLabel={bulkSelectedResumePending}
                          onClick={() => setBulkSelectedMode("resume")}
                        >
                          {bulkSelectedResume}
                        </Button>
                      ) : null}
                      {clearSelection ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={bulkMut.isPending || bulkResumeMut.isPending}
                          onClick={() => setRowSelection({})}
                        >
                          {clearSelection}
                        </Button>
                      ) : null}
                    </div>
                  ),
                }
              : undefined
          }
        />
      ) : null}

      <OfficialPauseDialog
        open={Boolean(pauseGameId)}
        onOpenChange={(open) => {
          if (!open) setPauseGameId("");
        }}
        mode="pause"
        chrome={chrome}
        isPending={pauseMut.isPending}
        onConfirm={({ reasonKey, note }) => {
          if (!pauseGameId || !reasonKey) return;
          pauseMut.mutate(
            { gameId: pauseGameId, reasonKey, note },
            { onSuccess: () => setPauseGameId("") },
          );
        }}
      />
      <OfficialPauseDialog
        open={Boolean(resumeGameId)}
        onOpenChange={(open) => {
          if (!open) setResumeGameId("");
        }}
        mode="resume"
        chrome={chrome}
        isPending={resumeMut.isPending}
        onConfirm={({ note }) => {
          if (!resumeGameId) return;
          resumeMut.mutate(
            { gameId: resumeGameId, note },
            { onSuccess: () => setResumeGameId("") },
          );
        }}
      />
      <OfficialPauseDialog
        open={Boolean(metaGameId)}
        onOpenChange={(open) => {
          if (!open) setMetaGameId("");
        }}
        mode="meta"
        chrome={chrome}
        initialReasonKey={(metaGame?.pause_reason_key || "").trim()}
        initialNote={(metaGame?.pause_note || "").trim()}
        isPending={metaMut.isPending}
        onConfirm={({ reasonKey, note }) => {
          if (!metaGameId || !reasonKey) return;
          metaMut.mutate(
            { gameId: metaGameId, reasonKey, note },
            { onSuccess: () => setMetaGameId("") },
          );
        }}
      />
      <OfficialPauseDialog
        open={Boolean(bulkRound)}
        onOpenChange={(open) => {
          if (!open) setBulkRound(null);
        }}
        mode="pause"
        chrome={chrome}
        titleOverride={(chrome.bulk_confirm_title || "").trim()}
        descriptionOverride={(chrome.bulk_confirm_description || "").trim()}
        confirmOverride={(chrome.bulk_confirm || "").trim()}
        pendingOverride={(chrome.bulk_pause_pending || "").trim()}
        isPending={bulkMut.isPending}
        onConfirm={({ reasonKey, note }) => {
          if (!bulkRound || !reasonKey) return;
          bulkMut.mutate(
            {
              tournamentId: bulkRound.tournamentId,
              eventId: bulkRound.eventId,
              roundIndex: bulkRound.roundIndex,
              reasonKey,
              note,
            },
            {
              onSuccess: (res) => {
                setBulkRound(null);
                toastBulkOutcome(
                  res,
                  (chrome.toast_bulk_partial || "").trim(),
                  (chrome.toast_bulk_paused || "").trim(),
                );
              },
              onError: (err) => {
                const fail = (chrome.toast_bulk_failed || "").trim();
                const msg = officialPauseChromeApiToast(
                  err,
                  chrome as unknown as Record<string, unknown>,
                  fail,
                );
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
      <OfficialPauseDialog
        open={bulkSelectedMode === "pause"}
        onOpenChange={(open) => {
          if (!open) setBulkSelectedMode(null);
        }}
        mode="pause"
        chrome={chrome}
        titleOverride={(chrome.bulk_selected_confirm_title || "").trim()}
        descriptionOverride={(chrome.bulk_selected_confirm_description || "").trim()}
        confirmOverride={(chrome.bulk_selected_confirm || "").trim()}
        pendingOverride={bulkSelectedPausePending}
        isPending={bulkMut.isPending}
        onConfirm={({ reasonKey, note }) => {
          if (!reasonKey || selectedIds.length === 0) return;
          const ids = selectedGames.filter((g) => !isOfficialPaused(g)).map((g) => g.id);
          if (ids.length === 0) return;
          bulkMut.mutate(
            { gameIds: ids, reasonKey, note },
            {
              onSuccess: (res) => {
                setBulkSelectedMode(null);
                setRowSelection({});
                toastBulkOutcome(
                  res,
                  (chrome.toast_bulk_partial || "").trim(),
                  (chrome.toast_bulk_paused || "").trim(),
                );
              },
              onError: (err) => {
                const fail = (chrome.toast_bulk_failed || "").trim();
                const msg = officialPauseChromeApiToast(
                  err,
                  chrome as unknown as Record<string, unknown>,
                  fail,
                );
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
      <OfficialPauseDialog
        open={bulkSelectedMode === "resume"}
        onOpenChange={(open) => {
          if (!open) setBulkSelectedMode(null);
        }}
        mode="resume"
        chrome={chrome}
        titleOverride={(chrome.bulk_selected_resume_confirm_title || "").trim()}
        descriptionOverride={(chrome.bulk_selected_resume_confirm_description || "").trim()}
        confirmOverride={(chrome.bulk_selected_resume_confirm || "").trim()}
        pendingOverride={bulkSelectedResumePending}
        isPending={bulkResumeMut.isPending}
        onConfirm={({ note }) => {
          if (selectedIds.length === 0) return;
          const ids = selectedGames.filter((g) => isOfficialPaused(g)).map((g) => g.id);
          if (ids.length === 0) return;
          bulkResumeMut.mutate(
            { gameIds: ids, note },
            {
              onSuccess: (res) => {
                setBulkSelectedMode(null);
                setRowSelection({});
                toastBulkOutcome(
                  res,
                  (chrome.toast_bulk_resume_partial || "").trim(),
                  (chrome.toast_bulk_resumed || "").trim(),
                );
              },
              onError: (err) => {
                const fail = (chrome.toast_bulk_resume_failed || "").trim();
                const msg = officialPauseChromeApiToast(
                  err,
                  chrome as unknown as Record<string, unknown>,
                  fail,
                );
                if (msg) toast.error(msg);
              },
            },
          );
        }}
      />
    </div>
  );
}
