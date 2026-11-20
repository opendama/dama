"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { EventsPlayerHub } from "@/components/events/EventsPlayerHub";
import { TournamentListFilters } from "@/components/tournaments/TournamentListFilters";
import { TournamentMiniCard } from "@/components/tournaments/TournamentMiniCard";
import { Button } from "@/components/ui/button";
import { TournamentCardGridSkeleton } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { type TournamentEntryFilter, useTournamentsQuery } from "@/hooks/query/useTournamentsQuery";
import { useTournamentsPlayerChromeQuery } from "@/hooks/query/useTournamentsPlayerChromeQuery";
import { useHomeChromeQuery } from "@/hooks/query/useHomeChromeQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import {
  type CompetitionCupSource,
  parseCompetitionCupSource,
  tournamentsHrefFromEventsView,
} from "@/lib/competition-cup-source";
import {
  softCommunityCarouselAria,
  softCommunityChromeUnavailable,
  softCommunityEmpty,
  softCommunitySearchLabel,
  softCommunitySearchPlaceholder,
  softTournamentsEmpty,
  softTournamentsEmptyOfficial,
  softTournamentsBadgeCommunity,
  softTournamentsBadgeOfficial,
  softTournamentsEnrollAction,
  softTournamentsFilterEntryAll,
  softTournamentsFilterEntryFree,
  softTournamentsFilterEntryLabel,
  softTournamentsFilterEntryPaid,
  softTournamentsFilterSourceAll,
  softTournamentsFilterSourceCommunity,
  softTournamentsFilterSourceLabel,
  softTournamentsFilterSourceOfficial,
  softTournamentsFiltersToggleHideAria,
  softTournamentsFiltersToggleLabel,
  softTournamentsFiltersToggleShowAria,
  softTournamentsFreeLabel,
  softTournamentsJoinAction,
  softTournamentsPageTitle,
  softTournamentsPlayersLabel,
} from "@/lib/community-player-chrome-soft";
import {
  type CupLifecyclePhase,
  cupLifecycleStatusLabel,
  resolveCupCardCta,
} from "@/lib/cupLifecycle";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/play-rail-display";
import { tournamentMiniCardGridClass } from "@/lib/player-shell-ui";
import { prizePoolCardLabelsFromHome } from "@/lib/prize-pool-lines";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isHomeSurfaceChromeReady } from "@/types/home-chrome";
import {
  isTournamentsPlayerChromeReady,
  type TournamentsPlayerChrome,
} from "@/types/tournaments-player-chrome";
import type { Tournament } from "@/types/tournament";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function sourceChromeReady(c: TournamentsPlayerChrome): boolean {
  return (
    Boolean((c.filter_source_label || "").trim()) &&
    Boolean((c.filter_source_all_label || "").trim()) &&
    Boolean((c.filter_source_official_label || "").trim()) &&
    Boolean((c.filter_source_community_label || "").trim())
  );
}

type Props = {
  onEnrollTournament?: (t: Tournament) => void;
  onOpenOfficialLobby?: (tournamentId: string) => void;
  localEnrolledIds?: Set<string>;
};

/**
 * Unified player Tournament discovery: Official | Community | All.
 * Community uses hosted-event browse (backend tables unchanged).
 */
export function CompetitionTournamentsHub({
  onEnrollTournament,
  onOpenOfficialLobby,
  localEnrolledIds,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const signInModal = useOptionalSignInModal();

  // Legacy /?view=events → /?view=tournaments&source=community
  useEffect(() => {
    const view = (searchParams.get("view") || "").trim();
    if (view !== "events") return;
    router.replace(tournamentsHrefFromEventsView(searchParams.toString()), { scroll: false });
  }, [router, searchParams]);

  // Invite `?code=` with omitted source (defaults All) → Community (Flutter parity).
  // Explicit source=all|official is left alone; join strip still shows under Community embed.
  useEffect(() => {
    const code = (searchParams.get("code") || "").trim();
    if (!code) return;
    const sourceRaw = searchParams.get("source");
    if (sourceRaw != null && sourceRaw.trim() !== "") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "tournaments");
    params.set("source", "community");
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const cupSource = parseCompetitionCupSource(searchParams.get("source"));
  const setCupSource = useCallback(
    (next: CompetitionCupSource) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "tournaments");
      if (next === "all") params.delete("source");
      else params.set("source", next);
      // Switching source clears the other kind's deep-link id.
      if (next === "community") params.delete("id");
      if (next === "official") params.delete("id");
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const tournamentsChromeQuery = useTournamentsPlayerChromeQuery(true);
  const homeChromeQuery = useHomeChromeQuery(true);
  const tournamentsChrome = isTournamentsPlayerChromeReady(tournamentsChromeQuery.data)
    ? tournamentsChromeQuery.data
    : undefined;
  const homeChrome = isHomeSurfaceChromeReady(homeChromeQuery.data)
    ? homeChromeQuery.data
    : undefined;

  const showSource = Boolean(tournamentsChrome && sourceChromeReady(tournamentsChrome));
  const pageSize = parseListPageSize(tournamentsChrome?.list_page_size);
  const [skip, setSkip] = useUrlSkip("tournaments_skip");
  const [entryFilter, setEntryFilter] = useState<TournamentEntryFilter>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<CupLifecyclePhase>("open");
  const [mineFilter, setMineFilter] = useState(() => {
    const m = (searchParams.get("mine") || "").trim();
    return m === "1" || m === "true";
  });
  useEffect(() => {
    const m = (searchParams.get("mine") || "").trim();
    const next = m === "1" || m === "true";
    setMineFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);
  const [searchInput, setSearchInput] = useState("");
  const debounceMs = tournamentsChrome
    ? parseSearchDebounceMs(tournamentsChrome.search_debounce_ms)
    : 0;
  const searchQ = useDebouncedValue(searchInput.trim(), debounceMs);
  useResetSkipOnChange(setSkip, [entryFilter, searchQ, cupSource, lifecycleFilter, mineFilter]);

  const showOfficial = cupSource === "all" || cupSource === "official";
  const showCommunity = cupSource === "all" || cupSource === "community";

  const tournamentsQuery = useTournamentsQuery(
    skip,
    pageSize,
    Boolean(tournamentsChrome) && pageSize > 0 && showOfficial && debounceMs >= 0,
    entryFilter,
    searchQ,
    token,
    lifecycleFilter,
    mineFilter,
  );
  const tournaments = tournamentsQuery.data?.tournaments ?? [];
  const tournamentsMeta = tournamentsQuery.data?.meta;

  const tournamentFilters = useMemo(() => {
    if (!tournamentsChrome) return [];
    return [
      {
        id: "all" as const,
        label: softTournamentsFilterEntryAll(tournamentsChrome.filter_all_label),
      },
      {
        id: "free" as const,
        label: softTournamentsFilterEntryFree(tournamentsChrome.filter_free_label),
      },
      {
        id: "paid" as const,
        label: softTournamentsFilterEntryPaid(tournamentsChrome.filter_paid_label),
      },
    ];
  }, [tournamentsChrome]);

  const sourceFilters = useMemo(() => {
    if (!tournamentsChrome || !showSource) return [];
    return [
      {
        id: "all",
        label: softTournamentsFilterSourceAll(tournamentsChrome.filter_source_all_label || ""),
      },
      {
        id: "official",
        label: softTournamentsFilterSourceOfficial(
          tournamentsChrome.filter_source_official_label || "",
        ),
      },
      {
        id: "community",
        label: softTournamentsFilterSourceCommunity(
          tournamentsChrome.filter_source_community_label || "",
        ),
      },
    ].filter((f) => f.label.trim());
  }, [tournamentsChrome, showSource]);

  const enrolled = localEnrolledIds ?? new Set<string>();

  const officialBadge = softTournamentsBadgeOfficial(
    tournamentsChrome?.badge_official_label || "",
  ).trim();
  const communityBadge = softTournamentsBadgeCommunity(
    tournamentsChrome?.badge_community_label || "",
  ).trim();
  const emptyOfficial = (() => {
    if (mineFilter) {
      const mineEmpty = (tournamentsChrome?.empty_mine || "").trim();
      if (mineEmpty) return mineEmpty;
    }
    const byLife =
      lifecycleFilter === "live"
        ? (tournamentsChrome?.empty_lifecycle_live || "").trim()
        : lifecycleFilter === "finished"
          ? (tournamentsChrome?.empty_lifecycle_finished || "").trim()
          : (tournamentsChrome?.empty_lifecycle_open || "").trim();
    if (byLife) return byLife;
    return (
      softTournamentsEmptyOfficial((tournamentsChrome?.empty_official || "").trim()) ||
      softTournamentsEmpty((tournamentsChrome?.empty || "").trim()) ||
      (homeChrome?.empty_live || "").trim()
    );
  })();

  const lifecycleFilters = useMemo(() => {
    if (!tournamentsChrome) return [];
    return [
      {
        id: "open",
        label: (tournamentsChrome.filter_lifecycle_open_label || "").trim(),
      },
      {
        id: "live",
        label: (tournamentsChrome.filter_lifecycle_live_label || "").trim(),
      },
      {
        id: "finished",
        label: (tournamentsChrome.filter_lifecycle_finished_label || "").trim(),
      },
    ].filter((f) => f.label);
  }, [tournamentsChrome]);
  // Flutter AppBar parity: name the discovery region; soft-fail if page_title regresses to Event sport.
  const tournamentsRegionLabel = softTournamentsPageTitle(
    (tournamentsChrome?.page_title || "").trim(),
  );

  return (
    <section
      className="w-full min-h-0 space-y-3 self-start overflow-y-auto overscroll-contain"
      aria-label={tournamentsRegionLabel || undefined}
    >
      {tournamentsChrome && showOfficial ? (
        <TournamentListFilters
          sticky
          filterSourceLabel={
            showSource
              ? softTournamentsFilterSourceLabel(tournamentsChrome.filter_source_label)
              : undefined
          }
          sourceFilters={showSource ? sourceFilters : undefined}
          sourceFilter={showSource ? cupSource : undefined}
          onSourceFilterChange={
            showSource ? (next) => setCupSource(parseCompetitionCupSource(next)) : undefined
          }
          filterLifecycleLabel={
            (tournamentsChrome.filter_lifecycle_label || "").trim() || undefined
          }
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
            token ? (tournamentsChrome.filter_mine_label || "").trim() || undefined : undefined
          }
          mineFilter={token ? mineFilter : undefined}
          onMineFilterChange={
            token
              ? (next) => {
                  setMineFilter(next);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("view", "tournaments");
                  if (next) params.set("mine", "1");
                  else params.delete("mine");
                  const q = params.toString();
                  router.replace(q ? `/?${q}` : "/?view=tournaments", { scroll: false });
                }
              : undefined
          }
          filterEntryLabel={softTournamentsFilterEntryLabel(tournamentsChrome.filter_entry_label)}
          filters={tournamentFilters}
          entryFilter={entryFilter}
          onEntryFilterChange={setEntryFilter}
          searchLabel={softCommunitySearchLabel(tournamentsChrome.search_label)}
          searchPlaceholder={softCommunitySearchPlaceholder(tournamentsChrome.search_placeholder)}
          searchValue={searchInput}
          onSearchValueChange={setSearchInput}
          filtersToggleLabel={softTournamentsFiltersToggleLabel(
            tournamentsChrome.filters_toggle_label,
          )}
          filtersToggleShowAria={softTournamentsFiltersToggleShowAria(
            tournamentsChrome.filters_toggle_show_aria,
          )}
          filtersToggleHideAria={softTournamentsFiltersToggleHideAria(
            tournamentsChrome.filters_toggle_hide_aria,
          )}
          searchInputId="competition-tournaments-search"
        />
      ) : null}
      {tournamentsChrome && showSource && cupSource === "community" ? (
        <div className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-medium text-[var(--dama-muted)]">
            {softTournamentsFilterSourceLabel(tournamentsChrome.filter_source_label)}
          </span>
          {sourceFilters.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={cupSource === f.id ? "gold" : "outline"}
              aria-pressed={cupSource === f.id}
              onClick={() => setCupSource(parseCompetitionCupSource(f.id))}
            >
              {f.label}
            </Button>
          ))}
        </div>
      ) : null}

      {showOfficial ? (
        <div className="space-y-3">
          {cupSource === "all" && officialBadge ? (
            <h3 className="text-sm font-semibold text-[var(--dama-text)]">{officialBadge}</h3>
          ) : null}
          {tournamentsQuery.isLoading ||
          homeChromeQuery.isLoading ||
          tournamentsChromeQuery.isLoading ? (
            <TournamentCardGridSkeleton count={6} />
          ) : !tournamentsChrome ? (
            <p className="text-sm text-[var(--dama-danger)]" role="alert">
              {softCommunityChromeUnavailable(
                tournamentsChromeQuery.error instanceof Error
                  ? tournamentsChromeQuery.error.message
                  : "",
              )}
            </p>
          ) : !homeChrome ? (
            <p className="text-sm text-[var(--dama-danger)]" role="alert">
              {softCommunityChromeUnavailable(
                homeChromeQuery.error instanceof Error
                  ? homeChromeQuery.error.message
                  : homeChromeQuery.data?.home_chrome_unavailable,
              )}
            </p>
          ) : tournaments.length === 0 ? (
            <p className="text-sm text-[var(--dama-muted)]">{emptyOfficial}</p>
          ) : (
            <div className="space-y-4">
              <div className={tournamentMiniCardGridClass}>
                {tournaments.map((t) => {
                  const seated = enrolled.has(t.id) || t.viewer_enrolled === true;
                  const liveGameId = (t.live_game_id || "").trim();
                  const cta = resolveCupCardCta(t, {
                    enrolled: seated,
                    isFree: Boolean(t.is_free),
                    liveGameId,
                    labels: {
                      joinAction:
                        softTournamentsJoinAction(tournamentsChrome?.join_action || "").trim() ||
                        softTournamentsJoinAction(homeChrome.join_cta),
                      enrollAction:
                        softTournamentsEnrollAction(
                          tournamentsChrome?.enroll_action || "",
                        ).trim() || softTournamentsEnrollAction(homeChrome.enroll_cta),
                      lobbyAction: (tournamentsChrome?.lobby_action || "").trim(),
                      watchAction: (tournamentsChrome?.watch_action || "").trim(),
                      resultsAction: (tournamentsChrome?.results_action || "").trim(),
                    },
                  });
                  return (
                    <TournamentMiniCard
                      key={`official-${t.id}`}
                      tournament={t}
                      sourceBadge={officialBadge || undefined}
                      labels={{
                        carouselAria: softCommunityCarouselAria(homeChrome.carousel_aria),
                        playersLabel: softTournamentsPlayersLabel(homeChrome.players_label),
                        unlimitedPlayersLabel: (
                          tournamentsChrome?.unlimited_players_label || ""
                        ).trim(),
                        entryLabel: softTournamentsFilterEntryLabel(homeChrome.entry_label),
                        freeLabel: softTournamentsFreeLabel(homeChrome.free_label),
                        amountCurrencySeparator: homeChrome.amount_currency_separator,
                        metaSeparator: homeChrome.meta_separator,
                        emptyValue: homeChrome.empty_value,
                        ctaLabel: cta.label,
                        statusLabel:
                          cupLifecycleStatusLabel(
                            t,
                            tournamentsChrome,
                            (t.status_label || t.status || "").trim(),
                          ) || undefined,
                      }}
                      prizePoolLabels={prizePoolCardLabelsFromHome(homeChrome)}
                      onEnroll={() => {
                        if (cta.kind === "enroll") {
                          if (!token) {
                            if (!hydrated) return;
                            signInModal?.openSignIn({
                              nextPath: "/?view=tournaments&source=official",
                            });
                            return;
                          }
                          onEnrollTournament?.(t);
                          return;
                        }
                        if (cta.kind === "watch" && liveGameId) {
                          router.push(`/?view=spectate&gameId=${encodeURIComponent(liveGameId)}`);
                          return;
                        }
                        onOpenOfficialLobby?.(t.id);
                        router.replace(
                          `/?view=tournaments&source=official&id=${encodeURIComponent(t.id)}`,
                        );
                      }}
                    />
                  );
                })}
              </div>
              {cupSource === "official" ? (
                <div className="py-8">
                  <SkipPagination
                    meta={tournamentsMeta}
                    onPrev={setSkip}
                    onNext={setSkip}
                    disabled={tournamentsQuery.isFetching && !tournamentsQuery.isLoading}
                    inputId="competition-tournaments-skip"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {showCommunity ? (
        <div className="space-y-3">
          {cupSource === "all" && communityBadge ? (
            <h3 className="text-sm font-semibold text-[var(--dama-text)]">{communityBadge}</h3>
          ) : null}
          <EventsPlayerHub
            embedded
            sourceBadge={communityBadge || undefined}
            hideOuterFilters={cupSource === "all"}
            controlledEntryFilter={cupSource === "all" ? entryFilter : undefined}
            controlledSearchQ={cupSource === "all" ? searchQ : undefined}
            controlledLifecycle={cupSource === "all" ? lifecycleFilter : undefined}
            controlledMine={cupSource === "all" ? mineFilter : undefined}
            emptyOverride={
              softCommunityEmpty((tournamentsChrome?.empty_community || "").trim()) || undefined
            }
          />
        </div>
      ) : null}
    </section>
  );
}
