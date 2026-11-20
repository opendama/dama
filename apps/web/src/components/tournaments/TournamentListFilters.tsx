"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TournamentEntryFilter } from "@/hooks/query/useTournamentsQuery";
import { useHideOnScrollDown } from "@/hooks/useHideOnScrollDown";
import { cn } from "@/lib/utils";
import { ListFilter } from "lucide-react";
import { useId, useRef, useState } from "react";

export type TournamentFilterOption = {
  id: TournamentEntryFilter;
  label: string;
};

export type TournamentSourceFilterOption = {
  id: string;
  label: string;
};

export type TournamentLifecycleFilterOption = {
  id: string;
  label: string;
};

type Props = {
  /** e.g. home `Live tournaments` / page `Tournaments` - stays with the filter chrome. */
  sectionTitle?: string;
  sectionBlurb?: string;
  /** Official | Community | All (optional). */
  filterSourceLabel?: string;
  sourceFilters?: TournamentSourceFilterOption[];
  sourceFilter?: string;
  onSourceFilterChange?: (next: string) => void;
  /** Open | Live | Finished (optional). */
  filterLifecycleLabel?: string;
  lifecycleFilters?: TournamentLifecycleFilterOption[];
  lifecycleFilter?: string;
  onLifecycleFilterChange?: (next: string) => void;
  /** My cups chip (optional). */
  filterMineLabel?: string;
  mineFilter?: boolean;
  onMineFilterChange?: (next: boolean) => void;
  filterEntryLabel: string;
  filters: TournamentFilterOption[];
  entryFilter: TournamentEntryFilter;
  onEntryFilterChange: (next: TournamentEntryFilter) => void;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchValueChange: (next: string) => void;
  filtersToggleLabel: string;
  filtersToggleShowAria: string;
  filtersToggleHideAria: string;
  /** Stick to top of the scrollport (hub / page). */
  sticky?: boolean;
  /**
   * When sticky on a document-scrolling page under PlayerMobileChrome, offset
   * below the published header height so the bar sits flush (no white gap).
   * Nested hub scrollports already start under the header - leave false.
   */
  stickBelowChrome?: boolean;
  /** Hide while scrolling down; reveal on scroll up. Default on when sticky. */
  hideOnScroll?: boolean;
  className?: string;
  searchInputId?: string;
};

/**
 * Sticky tournament browse filters (Next.js client component).
 * Optional section title/blurb sit above the controls so they are not covered by
 * headroom translate. Search stays below entry chips.
 */
export function TournamentListFilters({
  sectionTitle,
  sectionBlurb,
  filterSourceLabel,
  sourceFilters,
  sourceFilter,
  onSourceFilterChange,
  filterLifecycleLabel,
  lifecycleFilters,
  lifecycleFilter,
  onLifecycleFilterChange,
  filterMineLabel,
  mineFilter,
  onMineFilterChange,
  filterEntryLabel,
  filters,
  entryFilter,
  onEntryFilterChange,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchValueChange,
  filtersToggleLabel,
  filtersToggleShowAria,
  filtersToggleHideAria,
  sticky = false,
  stickBelowChrome = false,
  hideOnScroll,
  className,
  searchInputId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [settleToken, setSettleToken] = useState(0);
  const panelId = useId();
  const inputId = searchInputId?.trim() || `${panelId}-search`;
  const expanded = open;
  const barRef = useRef<HTMLDivElement>(null);
  const scrollHideEnabled = hideOnScroll ?? sticky;
  // Hide/show on scroll even while Filters is expanded. settleToken locks briefly
  // on toggle so the panel height jump is not read as scroll-down (instant close).
  const scrolledAway = useHideOnScrollDown({
    enabled: scrollHideEnabled,
    rootRef: barRef,
    settleToken,
  });

  function toggleFiltersOpen() {
    setOpen((v) => !v);
    setSettleToken((n) => n + 1);
  }

  // Tournament page title/blurb commented out (Live tournaments / enroll copy).
  // const title = (sectionTitle || "").trim();
  // const blurb = (sectionBlurb || "").trim();
  void sectionTitle;
  void sectionBlurb;

  const sourceLabel = (filterSourceLabel || "").trim();
  const sourceOpts = sourceFilters ?? [];
  const showSource =
    sourceLabel.length > 0 &&
    sourceOpts.length > 0 &&
    typeof onSourceFilterChange === "function" &&
    (sourceFilter || "").trim().length > 0;

  const lifecycleLabel = (filterLifecycleLabel || "").trim();
  const lifecycleOpts = lifecycleFilters ?? [];
  const showLifecycle =
    lifecycleLabel.length > 0 &&
    lifecycleOpts.length > 0 &&
    typeof onLifecycleFilterChange === "function" &&
    (lifecycleFilter || "").trim().length > 0;

  const mineLabel = (filterMineLabel || "").trim();
  const showMine =
    mineLabel.length > 0 && typeof onMineFilterChange === "function" && mineFilter != null;

  const filterControls = (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {showSource ? (
        <fieldset className="min-w-0 space-y-1 border-0 p-0">
          <legend className="px-0 text-xs font-medium text-[var(--dama-muted)]">
            {sourceLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {sourceOpts.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={sourceFilter === f.id ? "gold" : "outline"}
                aria-pressed={sourceFilter === f.id}
                onClick={() => onSourceFilterChange?.(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {showLifecycle ? (
        <fieldset className="min-w-0 space-y-1 border-0 p-0">
          <legend className="px-0 text-xs font-medium text-[var(--dama-muted)]">
            {lifecycleLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {lifecycleOpts.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={lifecycleFilter === f.id ? "gold" : "outline"}
                aria-pressed={lifecycleFilter === f.id}
                onClick={() => onLifecycleFilterChange?.(f.id)}
              >
                {f.label}
              </Button>
            ))}
            {showMine ? (
              <Button
                type="button"
                size="sm"
                variant={mineFilter ? "gold" : "outline"}
                aria-pressed={Boolean(mineFilter)}
                onClick={() => onMineFilterChange?.(!mineFilter)}
              >
                {mineLabel}
              </Button>
            ) : null}
          </div>
        </fieldset>
      ) : null}
      <fieldset className="min-w-0 space-y-1 border-0 p-0">
        <legend className="px-0 text-xs font-medium text-[var(--dama-muted)]">
          {filterEntryLabel}
        </legend>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={entryFilter === f.id ? "gold" : "outline"}
              aria-pressed={entryFilter === f.id}
              onClick={() => onEntryFilterChange(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </fieldset>
      {/* p-1 + inset ring: focus chrome must not be cropped by sticky/expand overflow. */}
      <Field id={inputId} label={searchLabel} className="w-full min-w-0 max-w-full p-1">
        <Input
          id={inputId}
          value={searchValue}
          onChange={(e) => onSearchValueChange(e.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          type="search"
          enterKeyHint="search"
          className="min-w-0 max-w-full focus-visible:ring-inset"
        />
      </Field>
    </div>
  );

  const stickyTopClass = stickBelowChrome
    ? "top-[var(--dama-mobile-header-height,3.5rem)]"
    : "top-0";

  return (
    <div
      ref={barRef}
      className={cn(
        sticky &&
          cn(
            // Above in-card GalleryCarousel controls (z-10) so prev/next never paint over filters.
            "sticky z-40 isolate -mx-0.5 px-1",
            stickyTopClass,
            // Clip only while hidden so headroom works; visible when shown so focus ring is not cropped.
            scrolledAway ? "overflow-hidden" : "overflow-visible",
          ),
        !sticky && "py-1",
        className,
      )}
    >
      <div
        className={cn(
          sticky &&
            cn(
              "border-b border-[var(--dama-border)]/80 bg-[var(--dama-bg)] px-1 py-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35)]",
              "transition-transform duration-300 ease-out will-change-transform",
              // Hide on scroll down / show on scroll up (hook paused while Filters panel open).
              scrolledAway ? "-translate-y-full pointer-events-none" : "translate-y-0",
            ),
        )}
        aria-hidden={sticky && scrolledAway ? true : undefined}
      >
        {/* Tournament page only: Live tournaments / enroll blurb (and page title/blurb) - commented out.
        {title || blurb ? (
          <div className="mb-3">
            {title ? (
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                {title}
              </h2>
            ) : null}
            {blurb ? (
              <p className="mt-1 text-sm text-[var(--dama-muted)] sm:mt-2">{blurb}</p>
            ) : null}
          </div>
        ) : null}
        */}

        {/* Collapsible on all breakpoints (mobile / tablet / desktop parity). */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-between gap-2 sm:w-auto"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? filtersToggleHideAria : filtersToggleShowAria}
          onClick={toggleFiltersOpen}
        >
          <span className="inline-flex items-center gap-2">
            <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {filtersToggleLabel}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)] transition-transform duration-300",
              expanded && "rotate-180",
            )}
            aria-hidden
          >
            ▾
          </span>
        </Button>
        <div
          id={panelId}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          {/* Collapsed: clip height. Expanded: visible so search focus ring is not cropped. */}
          <div className={cn("min-h-0", expanded ? "overflow-visible" : "overflow-hidden")}>
            <div className="pt-3">{filterControls}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
