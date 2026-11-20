"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { EventCupLobby } from "@/components/events/EventCupLobby";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { EventListFilters } from "@/components/events/EventListFilters";
import { EventMiniCard } from "@/components/events/EventMiniCard";
import { PaymentEventJoinModal } from "@/components/events/PaymentEventJoinModal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TournamentCardGridSkeleton } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import {
  type JoinHostedEventError,
  useJoinHostedEventMutation,
} from "@/hooks/mutation/useJoinHostedEventMutation";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useEventsPlayerChromeQuery } from "@/hooks/query/useEventsPlayerChromeQuery";
import {
  softCommunityCarouselAria,
  softCommunityChromeUnavailable,
  softCommunityCodeLabel,
  softCommunityCodePlaceholder,
  softCommunityEmpty,
  softCommunityFeatureDisabled,
  softCommunityJoinCodeSectionBlurb,
  softCommunityJoinCodeSectionTitle,
  softCommunityJoinStatusMessage,
  softCommunityLoadFailed,
  softCommunityPublicDisabled,
  softCommunitySearchLabel,
  softCommunitySearchPlaceholder,
  softTournamentsFilterEntryAll,
  softTournamentsFilterEntryFree,
  softTournamentsFilterEntryLabel,
  softTournamentsFilterEntryPaid,
  softTournamentsFiltersToggleHideAria,
  softTournamentsFiltersToggleLabel,
  softTournamentsFiltersToggleShowAria,
  softTournamentsFreeLabel,
  softTournamentsHostedByLabel,
  softTournamentsJoinAction,
  softTournamentsPlayersLabel,
} from "@/lib/community-player-chrome-soft";
import { catalogHostedFeatureOff } from "@/lib/events-catalog-gate";
import {
  type EventEntryFilter,
  useEventsPublicListQuery,
} from "@/hooks/query/useEventsPublicListQuery";
import { useEventEntriesQuery } from "@/hooks/query/useEventEntriesQuery";
import { useEventQuery } from "@/hooks/query/useEventQuery";
import { useJoinedEventsQuery } from "@/hooks/query/useJoinedEventsQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import {
  type CupLifecyclePhase,
  cupLifecycleStatusLabel,
  resolveCupCardCta,
} from "@/lib/cupLifecycle";
import { shouldOpenEventCupLobby } from "@/lib/event-cup-lobby";
import { eventJoinErrorChrome, isAlreadyJoinedEventError } from "@/lib/event-join-error";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/play-rail-display";
import { tournamentMiniCardGridClass } from "@/lib/player-shell-ui";
import { prizePoolCardLabelsFromPlayer } from "@/lib/prize-pool-lines";
import { eventJoinPlayHref } from "@/lib/tournament-free-join";
import { hrefWithQueryPatch } from "@/lib/url-skip";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import type { HostedEvent } from "@/types/events";
import { isEventsPlayerChromeReady } from "@/types/events-player-chrome";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type EventsPlayerHubProps = {
  /** Rendered inside unified Tournaments hub (Community tab). */
  embedded?: boolean;
  sourceBadge?: string;
  /** When true, hide entry filters (parent owns them). Join-by-code strip stays. */
  hideOuterFilters?: boolean;
  /** Parent All-tab free/paid filter (used when hideOuterFilters). */
  controlledEntryFilter?: EventEntryFilter;
  /** Parent All-tab debounced search (used when hideOuterFilters). */
  controlledSearchQ?: string;
  /** Parent All-tab lifecycle (used when hideOuterFilters). */
  controlledLifecycle?: CupLifecyclePhase;
  /** Parent All-tab mine chip (used when hideOuterFilters). */
  controlledMine?: boolean;
  /** Unified hub empty copy (`tournaments_player_chrome.empty_community`). */
  emptyOverride?: string;
};

/**
 * Community tournament browse (hosted events).
 * Standalone: legacy `/?view=events` (redirects to tournaments Community).
 * Embedded: Official|Community unified hub.
 */
export function EventsPlayerHub({
  embedded = false,
  sourceBadge,
  hideOuterFilters = false,
  controlledEntryFilter,
  controlledSearchQ,
  controlledLifecycle,
  controlledMine,
  emptyOverride,
}: EventsPlayerHubProps = {}) {
  const searchParams = useSearchParams();
  // Unified hub uses source=community&id= for hosted deep links.
  const eventId = (searchParams.get("id") || "").trim();
  const initialCode = (searchParams.get("code") || "").trim().toUpperCase();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const myUserId = (useAuthStore((s) => s.user?.id) || "").trim();
  const signInModal = useOptionalSignInModal();
  const router = useRouter();
  const chromeQuery = useEventsPlayerChromeQuery(true);
  const chrome = isEventsPlayerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const catalogQuery = useEventsCatalogQuery(true);
  const join = useJoinHostedEventMutation(token);

  const [skip, setSkip] = useUrlSkip("events_skip");
  const [entryFilter, setEntryFilter] = useState<EventEntryFilter>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<CupLifecyclePhase>("open");
  const [mineFilter, setMineFilter] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [codeDraft, setCodeDraft] = useState(initialCode);
  /** Paid event confirm-join modal (tournament PaymentEnrollModal parity). */
  const [payJoinEvent, setPayJoinEvent] = useState<HostedEvent | null>(null);
  /** Optimistic joined ids until /events/joined catches up (card CTA parity). */
  const [localJoinedIds, setLocalJoinedIds] = useState<Set<string>>(() => new Set());
  const [cupLobbyDismissed, setCupLobbyDismissed] = useState(false);
  const focusedEventLobbyRef = useRef<string | null>(null);
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const debounceMs = chrome ? parseSearchDebounceMs(chrome.search_debounce_ms) : 0;
  const searchQ = useDebouncedValue(searchInput.trim(), debounceMs);
  // All-tab: parent Tournament filters drive Community list too.
  const listEntryFilter =
    hideOuterFilters && controlledEntryFilter != null ? controlledEntryFilter : entryFilter;
  const listSearchQ =
    hideOuterFilters && controlledSearchQ !== undefined ? controlledSearchQ : searchQ;
  const listLifecycle =
    hideOuterFilters && controlledLifecycle != null ? controlledLifecycle : lifecycleFilter;
  const listMine = hideOuterFilters && controlledMine != null ? controlledMine : mineFilter;

  useEffect(() => {
    const next = initialCode.trim().toUpperCase();
    if (next) setCodeDraft(next);
  }, [initialCode]);

  useResetSkipOnChange(setSkip, [listEntryFilter, listSearchQ, listLifecycle, listMine]);

  // Off when catalog says false, or 503 from requireEventsEnabled (missing key / other errs → keep Community).
  const hostedKnownOff = catalogHostedFeatureOff(catalogQuery.data, catalogQuery.error);
  const publicEnabled = catalogQuery.data?.public_events_enabled === true;
  const listQuery = useEventsPublicListQuery(
    Boolean(chrome) && pageSize > 0 && !hostedKnownOff && publicEnabled,
    skip,
    pageSize,
    listEntryFilter,
    listSearchQ,
    listLifecycle,
    listMine,
    token,
  );
  const joinedQuery = useJoinedEventsQuery(
    token,
    pageSize > 0 ? Math.max(pageSize, 50) : 0,
    Boolean(token) && Boolean(chrome) && pageSize > 0,
  );
  const events = listQuery.data?.events ?? [];
  const meta = listQuery.data?.meta;
  const joinedIds = useMemo(() => {
    const ids = new Set(localJoinedIds);
    for (const row of joinedQuery.data?.events ?? []) {
      const id = (row.id || "").trim();
      if (id) ids.add(id);
    }
    return ids;
  }, [joinedQuery.data?.events, localJoinedIds]);

  // Deep-link /?view=events&id= must not depend only on paginated /events/joined.
  const focusEventQuery = useEventQuery(eventId, Boolean(eventId));
  const focusEntriesQuery = useEventEntriesQuery(
    token,
    eventId,
    Boolean(token) && Boolean(eventId),
  );
  const seatedFromEntries = useMemo(() => {
    if (!eventId || !myUserId) return false;
    return (focusEntriesQuery.data ?? []).some(
      (e) => (e.user_id || "").trim() === myUserId && (e.event_id || "").trim() === eventId,
    );
  }, [eventId, myUserId, focusEntriesQuery.data]);

  const seatedForLobby = Boolean(eventId && (joinedIds.has(eventId) || seatedFromEntries));
  // Official tournament ids also appear as ?id= on All tab - only open Community
  // surfaces when GET /events/{id} succeeded (points notif parity).
  const focusEventOk =
    Boolean(eventId) && Boolean(focusEventQuery.data?.id) && !focusEventQuery.isError;
  const openCupLobby = Boolean(
    focusEventOk &&
      !cupLobbyDismissed &&
      shouldOpenEventCupLobby(focusEventQuery.data, seatedForLobby),
  );

  useEffect(() => {
    if (!eventId || !token || cupLobbyDismissed) return;
    if (focusedEventLobbyRef.current === eventId) return;
    if (!openCupLobby) return;
    focusedEventLobbyRef.current = eventId;
  }, [eventId, token, openCupLobby, cupLobbyDismissed]);

  useEffect(() => {
    if (!eventId) setCupLobbyDismissed(false);
  }, [eventId]);

  const markJoined = useCallback((id: string) => {
    const next = id.trim();
    if (!next) return;
    setLocalJoinedIds((prev) => {
      if (prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
  }, []);

  // Embedded in HomePlayHub center column (tournaments parity): parent owns scroll.
  // Cache-first: card-grid shimmer only when chrome is not yet available.
  if (!hydrated || (chromeQuery.isLoading && !chrome)) {
    return <TournamentCardGridSkeleton count={6} />;
  }

  if (!chrome) {
    const unavailable = softCommunityChromeUnavailable(
      (chromeQuery.data?.events_player_chrome_unavailable || "").trim(),
    );
    return unavailable ? (
      <p className="text-sm text-[var(--dama-danger)]" role="alert">
        {unavailable}
      </p>
    ) : null;
  }

  // Narrow for nested callbacks (tsc does not retain control-flow after early return).
  const ready = chrome;

  const filters: { id: EventEntryFilter; label: string }[] = [
    { id: "all", label: softTournamentsFilterEntryAll(ready.filter_all_label) },
    { id: "free", label: softTournamentsFilterEntryFree(ready.filter_free_label) },
    { id: "paid", label: softTournamentsFilterEntryPaid(ready.filter_paid_label) },
  ];

  const lifecycleFilters = [
    { id: "open", label: (ready.filter_lifecycle_open_label || "").trim() },
    { id: "live", label: (ready.filter_lifecycle_live_label || "").trim() },
    { id: "finished", label: (ready.filter_lifecycle_finished_label || "").trim() },
  ].filter((f) => f.label);

  const discoveryEmpty = (() => {
    if (listMine) {
      const mineEmpty = (ready.empty_mine || "").trim();
      if (mineEmpty) return mineEmpty;
    }
    const byLife =
      listLifecycle === "live"
        ? (ready.empty_lifecycle_live || "").trim()
        : listLifecycle === "finished"
          ? (ready.empty_lifecycle_finished || "").trim()
          : (ready.empty_lifecycle_open || "").trim();
    if (byLife) return byLife;
    return softCommunityEmpty((emptyOverride || "").trim() || ready.empty_web);
  })();

  /** Prefer live location search - Next `searchParams` can lag behind replaceState skip writes. */
  function eventsHubSearch(): string {
    if (typeof window !== "undefined") {
      return window.location.search.replace(/^\?/, "");
    }
    return searchParams.toString();
  }

  function communityBrowsePatch(extra: Record<string, string | null>) {
    return hrefWithQueryPatch(
      "/",
      { toString: () => eventsHubSearch() },
      {
        view: "tournaments",
        source: "community",
        ...extra,
      },
    );
  }

  function openDetail(e: HostedEvent) {
    // Keep skip/query; Community cups live under unified Tournaments discovery.
    router.replace(communityBrowsePatch({ id: e.id }), { scroll: false });
  }

  function closeDetail() {
    router.replace(communityBrowsePatch({ id: null }), { scroll: false });
  }

  function runJoin(code: string, fromCardId?: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (!token) {
      signInModal?.openSignIn({
        nextPath: `/?view=tournaments&source=community&code=${encodeURIComponent(c)}`,
      });
      return;
    }
    join.mutate(
      { code: c },
      {
        onSuccess: (data) => {
          const pending = (catalogQuery.data?.hosted_event_entry_pending || "").trim();
          const isPending = Boolean(pending && data.entry?.status === pending);
          toast.success(
            softCommunityJoinStatusMessage(
              isPending ? ready.pending_approval : ready.approved_blurb,
            ),
          );
          const id = (data.event?.id || fromCardId || "").trim();
          if (id) markJoined(id);
          void joinedQuery.refetch();
          // Tournament parity: approved seat → play lobby (pending stays on events).
          if (!isPending) {
            const lobbyId = (id || fromCardId || "").trim();
            router.replace(eventJoinPlayHref(lobbyId || undefined));
          }
        },
        onError: (err) => {
          if (isAlreadyJoinedEventError(err)) {
            const msg = softCommunityJoinStatusMessage(
              (ready.already_joined || "").trim() || (ready.approved_blurb || "").trim(),
            );
            if (msg) toast.success(msg);
            if (fromCardId) markJoined(fromCardId);
            void joinedQuery.refetch();
            router.replace(eventJoinPlayHref(fromCardId));
            return;
          }
          const payment = (err as JoinHostedEventError).paymentRequired;
          if (payment) {
            const href = (ready.top_up_href || "").trim();
            const payMsg =
              softCommunityJoinStatusMessage(ready.insufficient_entry_fee) ||
              eventJoinErrorChrome(err, ready);
            const actionLabel = (ready.top_up_action || "").trim();
            toast.error(
              payMsg || undefined,
              href && actionLabel
                ? { action: { label: actionLabel, onClick: () => router.push(href) } }
                : undefined,
            );
            return;
          }
          const msg = eventJoinErrorChrome(err, ready);
          if (msg) toast.error(msg);
        },
      },
    );
  }

  function onCardCta(e: HostedEvent) {
    const seated = joinedIds.has(e.id) || (e.id === eventId && seatedFromEntries);
    const liveGameId = (e.live_game_id || "").trim();
    const cta = resolveCupCardCta(e, {
      enrolled: seated,
      isFree: Boolean(e.is_free_entry),
      liveGameId,
      labels: {
        joinAction: softTournamentsJoinAction(ready.join_action),
        enrollAction: softTournamentsJoinAction(ready.join_action),
        lobbyAction: (ready.lobby_action || "").trim(),
        watchAction: (ready.watch_action || "").trim(),
        resultsAction: (ready.results_action || "").trim(),
      },
    });
    if (cta.kind === "enroll") {
      const code = (e.join_code || "").trim();
      if (!code) {
        openDetail(e);
        return;
      }
      if (!e.is_free_entry) {
        if (!token) {
          signInModal?.openSignIn({
            nextPath: `/?view=tournaments&source=community&id=${encodeURIComponent(e.id)}`,
          });
          return;
        }
        setPayJoinEvent(e);
        return;
      }
      runJoin(code, e.id);
      return;
    }
    if (cta.kind === "watch" && liveGameId) {
      router.push(`/?view=spectate&gameId=${encodeURIComponent(liveGameId)}`);
      return;
    }
    // Lobby / results → cup lobby shell (finished never enrolls).
    if (seated) markJoined(e.id);
    router.replace(eventJoinPlayHref(e.id));
  }

  void embedded;

  return (
    <div className="w-full min-h-0 space-y-3 self-start">
      {/* Join-by-code stays on All-tab embed (parent only owns free/paid/search). */}
      <section className="rounded-xl border border-[var(--dama-border)]/80 bg-[var(--dama-panel)]/40 px-3 py-3 sm:px-4">
        <h2 className="text-sm font-semibold text-[var(--dama-text)]">
          {softCommunityJoinCodeSectionTitle(ready.join_code_section_title)}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--dama-muted)]">
          {softCommunityJoinCodeSectionBlurb(ready.join_code_section_blurb)}
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(ev) => {
            ev.preventDefault();
            runJoin(codeDraft);
          }}
        >
          <Field
            id="events-hub-join-code"
            label={softCommunityCodeLabel(ready.code_label)}
            className="min-w-0 flex-1"
          >
            <Input
              id="events-hub-join-code"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
              placeholder={softCommunityCodePlaceholder(ready.code_placeholder)}
              autoComplete="off"
              spellCheck={false}
              className="uppercase tracking-wider"
            />
          </Field>
          <Button
            type="submit"
            variant="play"
            size="sm"
            disabled={join.isPending || !codeDraft.trim()}
          >
            {softTournamentsJoinAction(ready.join_action)}
          </Button>
        </form>
      </section>

      {hostedKnownOff ? (
        <p className="text-sm text-[var(--dama-muted)]">
          {/* Hosted feature off - not empty list / not public-only gate. */}
          {softCommunityFeatureDisabled(ready.feature_disabled)}
        </p>
      ) : !publicEnabled && catalogQuery.data ? (
        <p className="text-sm text-[var(--dama-muted)]">
          {/* Public cups gate off ≠ empty list - use public_disabled (soft fail-open). */}
          {softCommunityPublicDisabled(ready.public_disabled)}
        </p>
      ) : (
        <>
          {!hideOuterFilters ? (
            <EventListFilters
              sticky
              // Modal scroll must not drive filter headroom while detail is open.
              hideOnScroll={!eventId}
              filterLifecycleLabel={(ready.filter_lifecycle_label || "").trim() || undefined}
              lifecycleFilters={lifecycleFilters.length ? lifecycleFilters : undefined}
              lifecycleFilter={lifecycleFilters.length ? lifecycleFilter : undefined}
              onLifecycleFilterChange={
                lifecycleFilters.length
                  ? (next) => {
                      if (next === "open" || next === "live" || next === "finished") {
                        setLifecycleFilter(next);
                      }
                    }
                  : undefined
              }
              filterMineLabel={
                token ? (ready.filter_mine_label || "").trim() || undefined : undefined
              }
              mineFilter={token ? mineFilter : undefined}
              onMineFilterChange={token ? setMineFilter : undefined}
              filterEntryLabel={softTournamentsFilterEntryLabel(ready.filter_entry_label)}
              filters={filters}
              entryFilter={entryFilter}
              onEntryFilterChange={setEntryFilter}
              searchLabel={softCommunitySearchLabel(ready.search_label)}
              searchPlaceholder={softCommunitySearchPlaceholder(ready.search_placeholder)}
              searchValue={searchInput}
              onSearchValueChange={setSearchInput}
              filtersToggleLabel={softTournamentsFiltersToggleLabel(ready.filters_toggle_label)}
              filtersToggleShowAria={softTournamentsFiltersToggleShowAria(
                ready.filters_toggle_show_aria,
              )}
              filtersToggleHideAria={softTournamentsFiltersToggleHideAria(
                ready.filters_toggle_hide_aria,
              )}
              searchInputId="home-events-search"
            />
          ) : null}

          {pageSize < 1 ? (
            softCommunityLoadFailed(ready.load_failed) ? (
              <p className="text-sm text-[var(--dama-danger)]" role="alert">
                {softCommunityLoadFailed(ready.load_failed)}
              </p>
            ) : null
          ) : listQuery.isLoading && events.length === 0 ? (
            <TournamentCardGridSkeleton count={6} />
          ) : listQuery.isError && events.length === 0 ? (
            softCommunityLoadFailed(ready.load_failed) ? (
              <p className="text-sm text-[var(--dama-danger)]" role="alert">
                {softCommunityLoadFailed(ready.load_failed)}
              </p>
            ) : null
          ) : events.length === 0 ? (
            <p className="text-sm text-[var(--dama-muted)]">{discoveryEmpty}</p>
          ) : (
            <div className="space-y-4">
              <div
                className={
                  listQuery.isFetching && !listQuery.isLoading
                    ? "opacity-70 transition-opacity"
                    : undefined
                }
              >
                <div className={tournamentMiniCardGridClass}>
                  {events.map((e) => {
                    const seated = joinedIds.has(e.id);
                    const liveGameId = (e.live_game_id || "").trim();
                    const cta = resolveCupCardCta(e, {
                      enrolled: seated,
                      isFree: Boolean(e.is_free_entry),
                      liveGameId,
                      labels: {
                        joinAction: softTournamentsJoinAction(ready.join_action),
                        enrollAction: softTournamentsJoinAction(ready.join_action),
                        lobbyAction: (ready.lobby_action || "").trim(),
                        watchAction: (ready.watch_action || "").trim(),
                        resultsAction: (ready.results_action || "").trim(),
                      },
                    });
                    return (
                      <EventMiniCard
                        key={e.id}
                        event={e}
                        sourceBadge={sourceBadge}
                        prizePoolLabels={prizePoolCardLabelsFromPlayer(ready)}
                        labels={{
                          carouselAria: softCommunityCarouselAria(ready.carousel_aria),
                          playersLabel: softTournamentsPlayersLabel(ready.players_label),
                          unlimitedPlayersLabel: (ready.unlimited_players_label || "").trim(),
                          entryLabel: softTournamentsFilterEntryLabel(ready.entry_label),
                          freeLabel: softTournamentsFreeLabel(ready.free_label),
                          hostedByLabel: softTournamentsHostedByLabel(ready.hosted_by_label),
                          amountCurrencySeparator: ready.amount_currency_separator,
                          metaSeparator: ready.meta_separator,
                          emptyValue: ready.empty_value,
                          hostRepFinishedLabel: (ready.host_rep_finished_label || "").trim(),
                          hostRepCancelledLabel: (ready.host_rep_cancelled_label || "").trim(),
                          hostRepReportsLabel: (ready.host_rep_reports_label || "").trim(),
                          hostRepMetaSeparator: ready.host_rep_meta_separator,
                          detailDescriptionLabel: (ready.detail_description_label || "").trim(),
                          ctaLabel: cta.label,
                          statusLabel:
                            cupLifecycleStatusLabel(
                              e,
                              ready,
                              (e.status_label || e.status || "").trim(),
                            ) || undefined,
                        }}
                        onOpen={() => openDetail(e)}
                        onJoin={() => onCardCta(e)}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="py-8">
                <SkipPagination
                  meta={meta}
                  onPrev={setSkip}
                  onNext={setSkip}
                  disabled={listQuery.isFetching && !listQuery.isLoading}
                  inputId="home-events-skip"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Keep eventId while exit animates; defer URL strip so detail modal cannot flash. */}
      <EventCupLobby
        open={openCupLobby}
        eventId={(eventId || "").trim() || null}
        chromeRaw={ready}
        viewerJoined={seatedForLobby}
        onOpenChange={(next) => {
          if (!next) {
            setCupLobbyDismissed(true);
            window.setTimeout(() => closeDetail(), 200);
          }
        }}
        closeLabel={ready.dialog_close_label}
      />

      <EventDetailModal
        open={focusEventOk && !openCupLobby && !cupLobbyDismissed}
        eventId={focusEventOk ? eventId || null : null}
        chrome={ready}
        onJoined={(id) => {
          markJoined(id);
          void joinedQuery.refetch();
        }}
        onOpenChange={(next) => {
          if (!next) closeDetail();
        }}
      />

      <PaymentEventJoinModal
        open={Boolean(payJoinEvent)}
        onOpenChange={(next) => {
          if (!next) setPayJoinEvent(null);
        }}
        event={payJoinEvent}
        prizePoolLabels={prizePoolCardLabelsFromPlayer(ready)}
        onJoined={(id) => {
          markJoined(id);
          void joinedQuery.refetch();
        }}
        joinChrome={{
          pending_approval: ready.pending_approval,
          approved_blurb: ready.approved_blurb,
          already_joined: ready.already_joined,
          insufficient_entry_fee: ready.insufficient_entry_fee,
          top_up_action: ready.top_up_action,
          top_up_href: ready.top_up_href,
        }}
      />
    </div>
  );
}
