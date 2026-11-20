"use client";

import { EventListFilters } from "@/components/events/EventListFilters";
import { EventMiniCard } from "@/components/events/EventMiniCard";
import { Button } from "@/components/ui/button";
import { TournamentCardGridSkeleton } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import {
  type EventEntryFilter,
  useEventsPublicListQuery,
} from "@/hooks/query/useEventsPublicListQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/play-rail-display";
import {
  softCommunityCarouselAria,
  softCommunityLoadFailed,
  softCommunityPublicListBlurb,
  softCommunityPublicListTitle,
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
import { cupLifecycleStatusLabel, resolveCupCardCta } from "@/lib/cupLifecycle";
import { softHostingPublicListEmpty } from "@/lib/hosting-organizer-chrome-soft";
import { tournamentMiniCardGridClass } from "@/lib/player-shell-ui";
import type { PrizePoolCardLabels } from "@/lib/prize-pool-lines";
import type { HostedEvent } from "@/types/events";
import { useEffect, useState } from "react";

/**
 * Legacy standalone public cups grid. Player discovery is unified under
 * `/?view=tournaments&source=community` - do not mount this as a second browse.
 * Kept for type/`EventEntryFilter` reuse and emergency ops; unused in routes.
 */
export type PublicEventsBrowseChrome = {
  public_list_title: string;
  public_list_blurb: string;
  public_list_empty: string;
  join_open_action: string;
  /** Positive decimal string from DB events_player_chrome.list_page_size. */
  list_page_size: string;
  meta_separator?: string;
  amount_currency_separator?: string;
  players_count_suffix?: string;
  empty_value?: string;
  load_failed?: string;
  already_joined?: string;
  filter_all_label: string;
  filter_free_label: string;
  filter_paid_label: string;
  filter_entry_label: string;
  search_label: string;
  search_placeholder: string;
  filters_toggle_label: string;
  filters_toggle_show_aria: string;
  filters_toggle_hide_aria: string;
  search_debounce_ms: string;
  hosted_by_label: string;
  carousel_aria: string;
  free_label: string;
  players_label: string;
  /** DB unlimited_players_label for Arena Unlimited seat fill. */
  unlimited_players_label?: string;
  entry_label: string;
  view_action?: string;
  watch_action?: string;
  results_action?: string;
  lobby_action?: string;
  filter_lifecycle_open_label?: string;
  filter_lifecycle_live_label?: string;
  filter_lifecycle_finished_label?: string;
  host_rep_finished_label?: string;
  host_rep_cancelled_label?: string;
  host_rep_reports_label?: string;
  host_rep_meta_separator?: string;
  detail_description_label?: string;
};

type Props = {
  chrome: PublicEventsBrowseChrome;
  prizePoolLabels?: PrizePoolCardLabels;
  enabled?: boolean;
  /** Joined event ids for the signed-in viewer (disables Join CTA). */
  joinedIds?: Set<string>;
  /** Card Join CTA. */
  onJoin: (event: HostedEvent) => void;
  /** Card body / View → detail (optional; defaults to onJoin). */
  onOpen?: (event: HostedEvent) => void;
  onReport?: (event: HostedEvent) => void;
  reportAction?: string;
  stickyFilters?: boolean;
  stickBelowChrome?: boolean;
};

/**
 * Public events browse grid (tournaments card parity): filters + EventMiniCard.
 */
export function PublicEventsBrowse({
  chrome,
  prizePoolLabels,
  enabled = true,
  joinedIds,
  onJoin,
  onOpen,
  onReport,
  reportAction,
  stickyFilters = false,
  stickBelowChrome = false,
}: Props) {
  const [skip, setSkip] = useUrlSkip("skip");
  const [entryFilter, setEntryFilter] = useState<EventEntryFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const pageSize = parseListPageSize(chrome.list_page_size);
  const debounceMs = parseSearchDebounceMs(chrome.search_debounce_ms);
  const searchQ = useDebouncedValue(searchInput.trim(), debounceMs);

  useResetSkipOnChange(setSkip, [entryFilter, searchQ]);

  const listQuery = useEventsPublicListQuery(
    enabled && pageSize > 0 && debounceMs >= 0,
    skip,
    pageSize,
    entryFilter,
    searchQ,
  );
  const events = listQuery.data?.events ?? [];
  const softFetching = listQuery.isFetching && !listQuery.isLoading;

  if (pageSize < 1) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-[var(--dama-gold)]">
            {softCommunityPublicListTitle(chrome.public_list_title)}
          </h2>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">
            {softCommunityPublicListBlurb(chrome.public_list_blurb)}
          </p>
        </div>
        {(chrome.load_failed || "").trim() ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert">
            {softCommunityLoadFailed(chrome.load_failed)}
          </p>
        ) : null}
      </section>
    );
  }

  const filters: { id: EventEntryFilter; label: string }[] = [
    { id: "all", label: softTournamentsFilterEntryAll(chrome.filter_all_label) },
    { id: "free", label: softTournamentsFilterEntryFree(chrome.filter_free_label) },
    { id: "paid", label: softTournamentsFilterEntryPaid(chrome.filter_paid_label) },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-[var(--dama-gold)]">
          {softCommunityPublicListTitle(chrome.public_list_title)}
        </h2>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">
          {softCommunityPublicListBlurb(chrome.public_list_blurb)}
        </p>
      </div>

      <EventListFilters
        sticky={stickyFilters}
        stickBelowChrome={stickBelowChrome}
        filterEntryLabel={softTournamentsFilterEntryLabel(chrome.filter_entry_label)}
        filters={filters}
        entryFilter={entryFilter}
        onEntryFilterChange={setEntryFilter}
        searchLabel={softCommunitySearchLabel(chrome.search_label)}
        searchPlaceholder={softCommunitySearchPlaceholder(chrome.search_placeholder)}
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        filtersToggleLabel={softTournamentsFiltersToggleLabel(chrome.filters_toggle_label)}
        filtersToggleShowAria={softTournamentsFiltersToggleShowAria(
          chrome.filters_toggle_show_aria,
        )}
        filtersToggleHideAria={softTournamentsFiltersToggleHideAria(
          chrome.filters_toggle_hide_aria,
        )}
        searchInputId="events-public-search"
      />

      {listQuery.isLoading ? <TournamentCardGridSkeleton count={6} /> : null}

      {listQuery.isError ? (
        (chrome.load_failed || "").trim() ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert">
            {softCommunityLoadFailed(chrome.load_failed)}
          </p>
        ) : null
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && events.length === 0 ? (
        <p className="text-sm text-[var(--dama-muted)]">
          {softHostingPublicListEmpty(chrome.public_list_empty)}
        </p>
      ) : null}

      {events.length > 0 ? (
        <div className="space-y-4">
          <div className={softFetching ? "opacity-70 transition-opacity" : undefined}>
            <div className={tournamentMiniCardGridClass}>
              {events.map((e) => {
                const seated = Boolean(joinedIds?.has(e.id));
                const cta = resolveCupCardCta(e, {
                  enrolled: seated,
                  isFree: Boolean(e.is_free_entry),
                  labels: {
                    joinAction: softTournamentsJoinAction(chrome.join_open_action),
                    enrollAction: softTournamentsJoinAction(chrome.join_open_action),
                    lobbyAction: (chrome.lobby_action || "").trim(),
                    watchAction: (chrome.watch_action || "").trim(),
                    resultsAction: (chrome.results_action || "").trim(),
                  },
                });
                const ctaLabel = (cta.label || "").trim();
                return (
                  <EventMiniCard
                    key={e.id}
                    event={e}
                    prizePoolLabels={prizePoolLabels}
                    labels={{
                      carouselAria: softCommunityCarouselAria(chrome.carousel_aria),
                      playersLabel: softTournamentsPlayersLabel(chrome.players_label),
                      unlimitedPlayersLabel: (chrome.unlimited_players_label || "").trim(),
                      entryLabel: softTournamentsFilterEntryLabel(chrome.entry_label),
                      freeLabel: softTournamentsFreeLabel(chrome.free_label),
                      hostedByLabel: softTournamentsHostedByLabel(chrome.hosted_by_label),
                      amountCurrencySeparator: chrome.amount_currency_separator,
                      metaSeparator: chrome.meta_separator,
                      emptyValue: chrome.empty_value,
                      hostRepFinishedLabel: (chrome.host_rep_finished_label || "").trim(),
                      hostRepCancelledLabel: (chrome.host_rep_cancelled_label || "").trim(),
                      hostRepReportsLabel: (chrome.host_rep_reports_label || "").trim(),
                      hostRepMetaSeparator: chrome.host_rep_meta_separator,
                      detailDescriptionLabel: (chrome.detail_description_label || "").trim(),
                      ctaLabel,
                      statusLabel:
                        cupLifecycleStatusLabel(
                          e,
                          chrome,
                          (e.status_label || e.status || "").trim(),
                        ) || undefined,
                    }}
                    onOpen={() => (onOpen ?? onJoin)(e)}
                    onJoin={() => onJoin(e)}
                    ctaSlot={
                      onReport && reportAction && ctaLabel ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="play"
                            className="h-8 min-w-0 flex-1 rounded-lg text-[12px] font-semibold"
                            onClick={() => onJoin(e)}
                          >
                            {ctaLabel}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 rounded-lg text-[12px]"
                            onClick={() => onReport(e)}
                          >
                            {reportAction}
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
          <div className="py-8">
            <SkipPagination
              meta={listQuery.data?.meta}
              onPrev={setSkip}
              onNext={setSkip}
              disabled={softFetching}
              inputId="events-public-skip"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
