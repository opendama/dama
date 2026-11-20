"use client";

import {
  type TournamentFilterOption,
  type TournamentLifecycleFilterOption,
  TournamentListFilters,
} from "@/components/tournaments/TournamentListFilters";
import type { EventEntryFilter } from "@/hooks/query/useEventsPublicListQuery";

export type EventFilterOption = {
  id: EventEntryFilter;
  label: string;
};

type Props = {
  sectionTitle?: string;
  sectionBlurb?: string;
  filterLifecycleLabel?: string;
  lifecycleFilters?: TournamentLifecycleFilterOption[];
  lifecycleFilter?: string;
  onLifecycleFilterChange?: (next: string) => void;
  filterMineLabel?: string;
  mineFilter?: boolean;
  onMineFilterChange?: (next: boolean) => void;
  filterEntryLabel: string;
  filters: EventFilterOption[];
  entryFilter: EventEntryFilter;
  onEntryFilterChange: (next: EventEntryFilter) => void;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchValueChange: (next: string) => void;
  filtersToggleLabel: string;
  filtersToggleShowAria: string;
  filtersToggleHideAria: string;
  sticky?: boolean;
  stickBelowChrome?: boolean;
  hideOnScroll?: boolean;
  className?: string;
  searchInputId?: string;
};

/**
 * Sticky Community cups filters - same chrome as TournamentListFilters
 * (hide-on-scroll, mobile collapse, search below entry chips).
 */
export function EventListFilters({ filters, entryFilter, onEntryFilterChange, ...rest }: Props) {
  const tournamentFilters = filters as TournamentFilterOption[];
  return (
    <TournamentListFilters
      {...rest}
      filters={tournamentFilters}
      entryFilter={entryFilter}
      onEntryFilterChange={(next) => onEntryFilterChange(next as EventEntryFilter)}
    />
  );
}
