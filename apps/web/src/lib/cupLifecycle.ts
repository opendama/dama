/** Cup discovery lifecycle from server timestamps (status enums stay draft/open/archived). */

export type CupLifecyclePhase = "open" | "live" | "finished";

/** List filter: discovery phases plus `all` for profile / My tournaments history. */
export type CupLifecycleListFilter = CupLifecyclePhase | "all";

export type CupLifecycleFields = {
  started_at?: string | null;
  finished_at?: string | null;
};

export function cupLifecyclePhase(cup: CupLifecycleFields | null | undefined): CupLifecyclePhase {
  if (!cup) return "open";
  if (String(cup.finished_at || "").trim()) return "finished";
  if (String(cup.started_at || "").trim()) return "live";
  return "open";
}

/** DB Status-filter chrome labels for discovery badges (not enum status_label). */
export type CupLifecycleLabelChrome = {
  filter_lifecycle_open_label?: string;
  filter_lifecycle_live_label?: string;
  filter_lifecycle_finished_label?: string;
};

/**
 * Card/lobby status must match Status Open|Live|Finished filters.
 * Official cups keep enum status_label "Open" after start - never use that for discovery.
 */
export function cupLifecycleStatusLabel(
  cup: CupLifecycleFields | null | undefined,
  chrome: CupLifecycleLabelChrome | null | undefined,
  fallback = "",
): string {
  const phase = cupLifecyclePhase(cup);
  const fromChrome =
    phase === "finished"
      ? (chrome?.filter_lifecycle_finished_label || "").trim()
      : phase === "live"
        ? (chrome?.filter_lifecycle_live_label || "").trim()
        : (chrome?.filter_lifecycle_open_label || "").trim();
  return fromChrome || (fallback || "").trim();
}

export type CupCardCtaKind = "enroll" | "join_lobby" | "watch" | "results";

export type CupCardCtaLabels = {
  joinAction: string;
  enrollAction: string;
  lobbyAction: string;
  watchAction: string;
  resultsAction: string;
};

/**
 * Status-honest primary CTA: never Join on finished.
 * Watch only when a live board id exists; otherwise Enter lobby (cup Live ≠ board live).
 */
export function resolveCupCardCta(
  cup: CupLifecycleFields | null | undefined,
  opts: {
    enrolled: boolean;
    isFree: boolean;
    labels: CupCardCtaLabels;
    /** Unfinished bracket board from API `live_game_id` (Watch deep-link). */
    liveGameId?: string | null;
  },
): { kind: CupCardCtaKind; label: string } {
  const phase = cupLifecyclePhase(cup);
  const {
    enrolled,
    isFree,
    liveGameId,
    labels: { joinAction, enrollAction, lobbyAction, watchAction, resultsAction },
  } = opts;
  const boardId = (liveGameId || "").trim();

  if (phase === "finished") {
    const label = (resultsAction || "").trim() || (lobbyAction || "").trim();
    return { kind: "results", label };
  }
  if (phase === "live") {
    if (enrolled) {
      const label = (lobbyAction || "").trim() || (joinAction || "").trim();
      return { kind: "join_lobby", label };
    }
    if (boardId) {
      const label = (watchAction || "").trim() || (lobbyAction || "").trim();
      return { kind: "watch", label };
    }
    const label = (lobbyAction || "").trim() || (watchAction || "").trim();
    return { kind: "join_lobby", label };
  }
  // open
  if (enrolled) {
    const label = (lobbyAction || "").trim() || (joinAction || "").trim();
    return { kind: "join_lobby", label };
  }
  if (isFree) {
    return { kind: "enroll", label: (joinAction || "").trim() };
  }
  return { kind: "enroll", label: (enrollAction || "").trim() || (joinAction || "").trim() };
}
