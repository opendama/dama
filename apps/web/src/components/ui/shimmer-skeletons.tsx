import {
  BoardAreaSkeleton,
  BoardColumnSkeleton,
  BoardPlaneLoading,
  BoardSeatBarSkeleton,
  PlayHubSkeleton,
  TournamentsPlayHubSkeleton,
} from "@/components/ui/BoardColumnSkeleton";
import {
  ReceiptDetailSkeleton,
  type ReceiptSkeletonChrome,
} from "@/components/wallet/ReceiptDetailSkeleton";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export {
  BoardAreaSkeleton,
  BoardColumnSkeleton,
  BoardPlaneLoading,
  BoardSeatBarSkeleton,
  PlayHubSkeleton,
  TournamentsPlayHubSkeleton,
  ReceiptDetailSkeleton,
};
export type { ReceiptSkeletonChrome };

type ShimmerBlockProps = {
  className?: string;
  style?: CSSProperties;
};

export function ShimmerBlock({ className, style }: ShimmerBlockProps) {
  return <div className={cn("dama-shimmer", className)} style={style} aria-hidden />;
}

export function ProfileCardSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
      <ShimmerBlock className="h-14 w-14 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-3 w-52 max-w-full" />
      </div>
    </div>
  );
}

/**
 * KPI tile shimmer matching `KpiCard` (p-4, gap-4 grids).
 * `count` = tile count; `cols` = responsive grid template (may differ when wrapping).
 */
export function StatGridSkeleton({
  count,
  cols,
  dense = false,
  showBody = false,
}: {
  count?: number;
  cols?: number;
  /** Ads analytics: `sm:grid-cols-3 lg:grid-cols-6`. */
  dense?: boolean;
  /** Ads publisher dash KPI cards include `publisher_stat_source_note` under the value. */
  showBody?: boolean;
}) {
  const n = Math.max(0, count ?? cols ?? 0);
  const tile = (key: number) => (
    <div
      key={key}
      className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)]"
    >
      {/* Live KpiCard: text-sm label, mt-2 text-2xl value, optional mt-1 text-xs body. */}
      <ShimmerBlock className="h-4 w-20 max-w-full" />
      <ShimmerBlock className="mt-2 h-8 w-16" />
      {showBody ? <ShimmerBlock className="mt-1 h-3 w-28 max-w-full" /> : null}
    </div>
  );
  if (n < 1) {
    return (
      <div
        className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))]"
        aria-hidden
      >
        {Array.from({ length: 6 }, (_, i) => tile(i))}
      </div>
    );
  }
  const gridClass =
    cols === 8
      ? // Ads publisher dash: up to 8 KPIs wrapping in a 6-col grid.
        "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      : cols === 7
        ? "sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        : cols === 5
          ? "sm:grid-cols-2 lg:grid-cols-5"
          : cols === 6
            ? dense
              ? "sm:grid-cols-3 lg:grid-cols-6"
              : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            : cols === 2
              ? "sm:grid-cols-2"
              : cols === 3
                ? "sm:grid-cols-2 lg:grid-cols-3"
                : cols === 4
                  ? "sm:grid-cols-2 xl:grid-cols-4"
                  : "[grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))]";
  return (
    <div className={cn("grid gap-4", gridClass)} aria-hidden>
      {Array.from({ length: n }, (_, i) => tile(i))}
    </div>
  );
}

/** Trim Usage chart card shimmer (title / subtitle / y-axis / plane / legend %). */
export function ActivityChartSkeleton({ embedded = false }: { embedded?: boolean }) {
  const plane = (
    <div className="space-y-4">
      <div className="space-y-2">
        <ShimmerBlock className="h-5 w-40 sm:h-6 sm:w-48" />
        <ShimmerBlock className="h-3 w-56 max-w-full" />
        <ShimmerBlock className="h-3 w-20" />
      </div>
      <ShimmerBlock className="h-52 w-full rounded-lg sm:h-64 md:h-72" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <ShimmerBlock className="h-2 w-2 shrink-0 rounded-full" />
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="ml-auto h-3 w-10" />
            <ShimmerBlock className="h-3 w-11" />
          </div>
        ))}
      </div>
    </div>
  );
  if (embedded) {
    return <div aria-hidden>{plane}</div>;
  }
  return (
    <div
      className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-[var(--dama-card-shadow)]"
      aria-hidden
    >
      {plane}
    </div>
  );
}

/** Heatmap + cumulative + breakdown grid (Trim dashboard sections below Usage chart). */
export function ActivityDashboardSectionsSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-[var(--dama-card-shadow)]">
        <div className="space-y-4">
          {/* Live ActivityHeatmap: text-base/lg title, 11px total, text-3xl/4xl count, 7×11px cells */}
          <ShimmerBlock className="h-5 w-44 sm:h-6 sm:w-52" />
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="h-9 w-16 sm:h-10" />
          <ShimmerBlock className="h-[5.5rem] w-full max-w-md rounded-md" />
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--dama-border)] pt-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <ShimmerBlock className="h-3 w-20" />
                <ShimmerBlock className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-[var(--dama-card-shadow)]">
        <ShimmerBlock className="h-5 w-52 sm:h-6 sm:w-64" />
        <ShimmerBlock className="mt-4 h-52 w-full rounded-lg sm:h-64 md:h-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* modes pie | outcomes bar | entry pie - Trim dashboard grid parity */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-[var(--dama-card-shadow)]"
          >
            <ShimmerBlock className="h-4 w-32" />
            {i === 1 ? (
              <div className="mt-4 space-y-3">
                <ShimmerBlock className="h-3 w-48 max-w-full" />
                <ShimmerBlock className="h-36 w-full rounded-md" />
              </div>
            ) : (
              <ShimmerBlock className="mx-auto mt-4 h-36 w-36 rounded-full" />
            )}
            <div className="mt-4 space-y-2">
              {Array.from({ length: 2 }, (_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <ShimmerBlock className="h-2 w-2 rounded-full" />
                  <ShimmerBlock className="h-3 w-24" />
                  <ShimmerBlock className="ml-auto h-3 w-10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dedicated `/?view=status` page shimmer (matches PlatformStatsPage + Usage chart). */
export function PlatformStatsPageSkeleton() {
  return (
    <div className="relative w-full space-y-8" aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <ShimmerBlock className="h-7 w-40" />
          <ShimmerBlock className="h-4 w-full max-w-xl" />
        </div>
        <div className="w-full max-w-xs space-y-1.5">
          <ShimmerBlock className="h-3 w-16" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
      </div>
      {/* Live Status KPIs: auto-fill minmax(8rem) + KpiCard p-4 / text-2xl value. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [grid-template-columns:repeat(auto-fill,minmax(8rem,1fr))] lg:gap-4">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)]"
          >
            <ShimmerBlock className="h-4 w-20 max-w-full" />
            <ShimmerBlock className="mt-2 h-8 w-14" />
          </div>
        ))}
      </div>
      <ActivityChartSkeleton />
      <ActivityDashboardSectionsSkeleton />
    </div>
  );
}

/** @deprecated Prefer PlatformStatsPageSkeleton - strip no longer on play hub. */
export function PlatformStatsStripSkeleton() {
  return <PlatformStatsPageSkeleton />;
}

/** SkipPagination chrome: summary + first/prev/page/go/next/last. */
export function SkipPaginationSkeleton({
  className,
  padded = false,
}: {
  className?: string;
  /** Public browse / hub lists use `py-8` around the pager. */
  padded?: boolean;
} = {}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", padded && "py-8", className)}
      aria-hidden
    >
      <ShimmerBlock className="mr-auto h-5 min-w-[11rem] w-44 max-w-full" />
      <ShimmerBlock className="h-8 w-[4.5rem] rounded-md" />
      <ShimmerBlock className="h-8 w-[4.5rem] rounded-md" />
      <ShimmerBlock className="h-8 w-16 rounded-md" />
      <ShimmerBlock className="h-8 w-14 rounded-md" />
      <ShimmerBlock className="h-8 w-[4.5rem] rounded-md" />
      <ShimmerBlock className="h-8 w-[4.5rem] rounded-md" />
    </div>
  );
}

/** Publisher campaign / similar dense list rows (title + meta line). */
export function ListRowsSkeleton({
  count = 5,
  showPagination = false,
}: {
  count?: number;
  /** Ads dashboard campaigns always mount SkipPagination under the list. */
  showPagination?: boolean;
} = {}) {
  return (
    <div className={showPagination ? "space-y-3" : undefined} aria-hidden>
      <ul className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3"
          >
            <ShimmerBlock className="h-4 w-48 max-w-[70%]" />
            <ShimmerBlock className="mt-2 h-3 w-full max-w-xl" />
          </li>
        ))}
      </ul>
      {showPagination ? <SkipPaginationSkeleton /> : null}
    </div>
  );
}

/** Hall of Fame body: podium + rank rows + your-rank bar (tabs already painted when chrome ready). */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="rounded-2xl border border-[var(--dama-border)] bg-[color-mix(in_srgb,var(--dama-brand)_12%,var(--dama-card))] px-3 py-6 sm:px-6">
        <div className="flex items-end justify-center gap-2 sm:gap-4">
          {[
            { avatar: "h-16 w-16 sm:h-20 sm:w-20", block: "h-16 sm:h-20" },
            { avatar: "h-16 w-16 sm:h-20 sm:w-20", block: "h-24 sm:h-28" },
            { avatar: "h-16 w-16 sm:h-20 sm:w-20", block: "h-12 sm:h-16" },
          ].map((seat, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <ShimmerBlock className="h-7 w-7 rounded-md" />
              <ShimmerBlock className={cn("rounded-full", seat.avatar)} />
              <ShimmerBlock className="h-3.5 w-20 max-w-full" />
              <ShimmerBlock className="h-3 w-14" />
              <ShimmerBlock className={cn("mt-1 w-full max-w-[6.5rem] rounded-t-lg", seat.block)} />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-3.5 w-28" />
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--dama-gold)_40%,var(--dama-border))] bg-[color-mix(in_srgb,var(--dama-brand)_10%,var(--dama-card))] p-2.5 sm:p-3">
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--dama-gold)_28%,var(--dama-border))] bg-[var(--dama-card)] px-3 py-2.5"
              >
                <ShimmerBlock className="h-4 w-7" />
                <ShimmerBlock className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <ShimmerBlock className="h-3.5 w-[70%] max-w-full" />
                  <ShimmerBlock className="h-3 w-[55%] max-w-full" />
                </div>
                <div className="space-y-2 text-right">
                  <ShimmerBlock className="ml-auto h-3.5 w-10" />
                  <ShimmerBlock className="ml-auto h-2.5 w-8" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3">
        <ShimmerBlock className="h-4 w-44" />
        <ShimmerBlock className="h-4 w-36" />
      </div>
    </div>
  );
}

/** Spectator win-vote panel while tallies hydrate. */
export function MatchVoteSkeleton({ showCastButtons = true }: { showCastButtons?: boolean }) {
  return (
    <section
      className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2">
        <ShimmerBlock className="h-4 w-36" />
        <div className="flex">
          <ShimmerBlock className="h-8 w-8 rounded-full ring-2 ring-[var(--dama-card)]" />
          <ShimmerBlock className="-ml-4 h-8 w-8 rounded-full ring-2 ring-[var(--dama-card)]" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <ShimmerBlock className="h-3.5 w-24" />
            <ShimmerBlock className="h-3.5 w-16" />
          </div>
          <ShimmerBlock className="h-2 w-full rounded-full" />
          {showCastButtons ? <ShimmerBlock className="h-8 w-full rounded-md" /> : null}
        </div>
      ))}
    </section>
  );
}

/** Finished-match correct voters list (title + blurb + ranked rows). */
export function CorrectVotersSkeleton() {
  return (
    <section
      className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4"
      aria-hidden
    >
      <ShimmerBlock className="h-4 w-40" />
      <ShimmerBlock className="h-3 w-56 max-w-full" />
      <ul className="mt-1 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border border-[var(--dama-border)]/60 px-3 py-2"
          >
            <ShimmerBlock className="h-3.5 w-6" />
            <ShimmerBlock className="h-8 w-8 shrink-0 rounded-full" />
            <ShimmerBlock className="h-3.5 w-[45%] max-w-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Live-game Watch popover body: QR preview + Join/Download. */
export function LiveGameWatchSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <ShimmerBlock className="h-4 w-36" />
      <ShimmerBlock className="mx-auto h-36 w-36 rounded-lg" />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <ShimmerBlock className="h-9 w-full rounded-md" />
        <ShimmerBlock className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}

export function TournamentListSkeleton() {
  return <TournamentCardGridSkeleton count={4} />;
}

/** Sticky filter bar shimmer matching TournamentListFilters (chips then search below). */
export function TournamentFiltersSkeleton({
  sticky = false,
  stickBelowChrome = false,
}: {
  sticky?: boolean;
  stickBelowChrome?: boolean;
}) {
  return (
    <div
      className={cn(
        sticky &&
          cn(
            "sticky z-40 isolate border-b border-[var(--dama-border)]/80 bg-[var(--dama-bg)] py-3",
            stickBelowChrome ? "top-[var(--dama-mobile-header-height,3.5rem)]" : "top-0",
          ),
        "space-y-3",
      )}
      aria-hidden
    >
      {/* Collapsed Filters toggle only (panel opens on demand at all breakpoints). */}
      <ShimmerBlock className="h-9 w-full rounded-md sm:w-36" />
    </div>
  );
}

/** Airbnb-density tournament card skeleton (borderless, square media). */
export function TournamentCardGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="flex h-fit min-w-0 flex-col bg-transparent">
          <ShimmerBlock className="aspect-square w-full rounded-xl" />
          <div className="mt-2 space-y-1.5">
            <ShimmerBlock className="h-3.5 w-[85%] max-w-full rounded-md" />
            <ShimmerBlock className="h-3 w-[65%] rounded-md" />
          </div>
          <div className="mt-2">
            <ShimmerBlock className="h-8 w-full rounded-lg" />
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Home hub `/?view=tournaments` loading: title + sticky filters + card grid
 * (never the play board column).
 */
export function TournamentsHubSkeleton({
  count = 6,
  withTitle = true,
}: {
  count?: number;
  withTitle?: boolean;
}) {
  return (
    <div
      className="w-full min-h-0 space-y-3 self-start overflow-y-auto overscroll-contain"
      aria-hidden
    >
      {withTitle ? (
        <div className="space-y-2 pt-1">
          <ShimmerBlock className="h-7 w-48 max-w-full sm:h-8" />
          <ShimmerBlock className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      <TournamentFiltersSkeleton sticky />
      <TournamentCardGridSkeleton count={count} />
      <div className="flex flex-wrap items-center gap-2 py-8">
        <ShimmerBlock className="mr-auto h-3 w-28" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-16 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Community cups hub loading (embedded under Tournaments / legacy view=events):
 * join-code strip + sticky filters + card grid (tournaments parity - never
 * campaigns/data-table skeleton).
 */
export function EventsHubSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="w-full min-h-0 space-y-4 self-start overflow-y-auto overscroll-contain px-1 py-2 sm:px-2"
      aria-hidden
    >
      <div className="space-y-2 rounded-xl border border-[var(--dama-border)]/80 bg-[var(--dama-panel)]/40 px-3 py-3 sm:px-4">
        <ShimmerBlock className="h-4 w-28" />
        <ShimmerBlock className="h-3 w-56 max-w-full" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <ShimmerBlock className="h-10 min-w-0 flex-1 rounded-md" />
          <ShimmerBlock className="h-9 w-24 shrink-0 rounded-md" />
        </div>
      </div>
      <TournamentFiltersSkeleton sticky />
      <TournamentCardGridSkeleton count={count} />
      <div className="flex flex-wrap items-center gap-2 py-8">
        <ShimmerBlock className="mr-auto h-3 w-28" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-16 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
      </div>
    </div>
  );
}

/** Dedicated `/tournaments` page loading shell. */
export function TournamentsPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-8 w-48 max-w-full" />
        <ShimmerBlock className="h-4 w-72 max-w-full" />
      </div>
      <TournamentFiltersSkeleton sticky stickBelowChrome />
      <TournamentCardGridSkeleton count={8} />
      <div className="flex flex-wrap items-center gap-2 py-8">
        <ShimmerBlock className="mr-auto h-3 w-28" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-16 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
        <ShimmerBlock className="h-8 w-14 rounded-md" />
      </div>
    </div>
  );
}

/**
 * OpsDataTable shimmer. Pass `embedded` when already inside a card
 * (matches live `OpsDataTable className="rounded-none border-0"`).
 * Pagination matches SkipPagination chrome inside `border-t p-3`.
 */
export function OpsDataTableSkeleton({
  columns = 3,
  rows = 6,
  showPagination = true,
  embedded = false,
  /** `ops` matches TableHead/TableCell (px-2/p-2); `loose` matches player history table. */
  density = "ops",
}: {
  columns?: number;
  rows?: number;
  showPagination?: boolean;
  embedded?: boolean;
  density?: "ops" | "loose";
}) {
  const colCount = Math.max(1, columns);
  const rowCount = Math.max(1, rows);
  const thClass = density === "loose" ? "px-4 py-3" : "h-10 px-2";
  const tdClass = density === "loose" ? "px-4 py-3" : "p-2";
  const pagination = showPagination ? (
    <div className="border-t border-[var(--dama-border)] p-3">
      <SkipPaginationSkeleton />
    </div>
  ) : null;
  return (
    <div
      className={cn(
        "overflow-x-auto",
        embedded
          ? undefined
          : "rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)]",
      )}
      aria-hidden
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--dama-border)]">
            {Array.from({ length: colCount }, (_, i) => (
              <th key={i} className={thClass}>
                <ShimmerBlock className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, r) => (
            <tr key={r} className="border-b border-[var(--dama-border)] last:border-0">
              {Array.from({ length: colCount }, (_, c) => (
                <td key={c} className={tdClass}>
                  <ShimmerBlock className={c === 0 ? "h-4 w-36" : "h-4 w-16"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination}
    </div>
  );
}

/**
 * Searchable ops list pages (transactions, receipts, campaigns, my events):
 * title (+ optional blurb/create CTA) + search/filter toolbar + table.
 */
export function SearchableListPageSkeleton({
  columns = 5,
  showCreateCta = false,
  showStatusFilter = false,
  showEntryFilters = false,
  showBlurb = true,
  /** Ads campaigns / money lists: `sm:max-w-md`. Events my-events: full width. */
  constrainSearch = true,
  /** Ads status Field uses `sm:min-w-[12rem]`; events uses `sm:w-auto` only. */
  statusMinWidth = true,
}: {
  columns?: number;
  showCreateCta?: boolean;
  showStatusFilter?: boolean;
  showEntryFilters?: boolean;
  /** Portal money pages often have title only (empty blurb). */
  showBlurb?: boolean;
  constrainSearch?: boolean;
  statusMinWidth?: boolean;
}) {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <ShimmerBlock className="h-8 w-48 sm:h-9" />
          {showBlurb ? <ShimmerBlock className="mt-1 h-4 w-80 max-w-full" /> : null}
        </div>
        {/* Live create: Button + Plus + label (campaigns/my-events). */}
        {showCreateCta ? <ShimmerBlock className="h-10 w-40 rounded-md" /> : null}
      </div>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="flex flex-col gap-3 border-b border-[var(--dama-border)] p-4">
          {showEntryFilters ? (
            <div className="space-y-1">
              <ShimmerBlock className="h-3 w-20" />
              <div className="flex flex-wrap gap-2">
                <ShimmerBlock className="h-9 w-16 rounded-md" />
                <ShimmerBlock className="h-9 w-16 rounded-md" />
                <ShimmerBlock className="h-9 w-16 rounded-md" />
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {/* Field label + control (matches live `Field` space-y-1.5 + text-sm label). */}
            <div className={cn("w-full space-y-1.5", constrainSearch ? "sm:max-w-md" : undefined)}>
              <ShimmerBlock className="h-4 w-24" />
              <ShimmerBlock className="h-10 w-full rounded-md" />
            </div>
            {showStatusFilter ? (
              <div
                className={cn(
                  "w-full space-y-1.5 sm:shrink-0 sm:w-auto",
                  statusMinWidth && "sm:min-w-[12rem]",
                )}
              >
                <ShimmerBlock className="h-4 w-20" />
                <ShimmerBlock className="h-10 w-full rounded-md" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="p-2">
          <OpsDataTableSkeleton columns={columns} rows={6} embedded />
        </div>
      </div>
    </div>
  );
}

/** Ads campaigns: title + create CTA + search + status filter + table. */
export function CampaignListSkeleton({ columns = 5 }: { columns?: number } = {}) {
  return <SearchableListPageSkeleton columns={columns} showCreateCta showStatusFilter />;
}

/** Events my-events: title + create CTA + entry pills + full-width search + status + table. */
export function EventsListSkeleton({ columns = 5 }: { columns?: number } = {}) {
  return (
    <SearchableListPageSkeleton
      columns={columns}
      showCreateCta
      showStatusFilter
      showEntryFilters
      constrainSearch={false}
      statusMinWidth={false}
    />
  );
}

export function AnalyticsStatSkeleton({ cols = 6 }: { cols?: number } = {}) {
  return <StatGridSkeleton cols={cols} />;
}

/** Analytics pages: page header + KPI grid (+ invoice CTA) + metrics table. */
export function AnalyticsPageSkeleton({
  kpiCols = 6,
  kpiCount,
  tableColumns = 5,
  tableRows = 6,
  showMetricsNote = false,
  showInvoiceCta = false,
  wrapTable = true,
  denseKpis = false,
}: {
  kpiCols?: number;
  kpiCount?: number;
  tableColumns?: number;
  tableRows?: number;
  showMetricsNote?: boolean;
  showInvoiceCta?: boolean;
  /** Events wraps OpsDataTable in a card; ads renders the table bare. */
  wrapTable?: boolean;
  denseKpis?: boolean;
}) {
  const table = (
    <OpsDataTableSkeleton
      columns={tableColumns}
      rows={tableRows}
      embedded={wrapTable}
      showPagination={false}
    />
  );
  return (
    <div className="w-full space-y-6" aria-hidden>
      {/* Live ads/events analytics: font-display h1, blurb mt-2, optional note mt-1. */}
      <div>
        <ShimmerBlock className="h-9 w-56 max-w-full" />
        <ShimmerBlock className="mt-2 h-4 w-full max-w-xl" />
        {showMetricsNote ? <ShimmerBlock className="mt-1 h-3 w-64 max-w-full" /> : null}
      </div>
      <StatGridSkeleton cols={kpiCols} count={kpiCount ?? kpiCols} dense={denseKpis} />
      {showInvoiceCta ? <ShimmerBlock className="h-4 w-40" /> : null}
      {wrapTable ? (
        <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
          <div className="p-2">{table}</div>
        </div>
      ) : (
        table
      )}
    </div>
  );
}

/**
 * Ads/events portal dashboard: header (+ create) + KPI grid + optional campaign
 * list + portal money links.
 */
export function PortalDashboardSkeleton({
  kpiCols = 6,
  kpiCount,
  showCreateCta = false,
  showCampaignList = true,
  listRows = 3,
  portalLinkCount = 4,
  /** Ads: create+manage button row, then blurb, then text links. Events: outline button pills. */
  portalVariant = "events",
}: {
  kpiCols?: number;
  kpiCount?: number;
  showCreateCta?: boolean;
  showCampaignList?: boolean;
  listRows?: number;
  portalLinkCount?: number;
  portalVariant?: "ads" | "events";
}) {
  return (
    <div className="w-full space-y-8" aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        {/* Live portal dash: font-display h1 + blurb mt-2. */}
        <div className="min-w-0">
          <ShimmerBlock className="h-9 w-56 max-w-full" />
          <ShimmerBlock className="mt-2 h-4 w-full max-w-xl" />
        </div>
        {showCreateCta ? <ShimmerBlock className="h-10 w-36 rounded-md" /> : null}
      </div>
      <StatGridSkeleton
        cols={kpiCols}
        count={kpiCount ?? kpiCols}
        showBody={portalVariant === "ads"}
      />
      {showCampaignList ? (
        <section className="space-y-2">
          <ShimmerBlock className="h-5 w-40" />
          <ListRowsSkeleton count={listRows} showPagination />
        </section>
      ) : null}
      <section className="space-y-3">
        <ShimmerBlock className="h-5 w-36" />
        {portalVariant === "ads" ? (
          <>
            <div className="flex flex-wrap gap-3">
              <ShimmerBlock className="h-9 w-32 rounded-md" />
              <ShimmerBlock className="h-9 w-36 rounded-md" />
            </div>
            <ShimmerBlock className="h-3 w-72 max-w-full" />
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {Array.from({ length: Math.max(1, portalLinkCount) }, (_, i) => (
                <ShimmerBlock key={i} className="h-4 w-24" />
              ))}
            </div>
          </>
        ) : (
          <>
            <ShimmerBlock className="h-3 w-72 max-w-full" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.max(1, portalLinkCount) }, (_, i) => (
                <ShimmerBlock key={i} className="h-9 w-28 rounded-md" />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Player overview: brand/title + 2 CTAs + identity + 4+3 KPIs + history table. */
export function PlayerDashboardSkeleton() {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        {/* Live: brand eyebrow, h1 mt-1, blurb mt-1. */}
        <div className="min-w-0">
          <ShimmerBlock className="h-4 w-24" />
          <ShimmerBlock className="mt-1 h-8 w-44 sm:h-9" />
          <ShimmerBlock className="mt-1 h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShimmerBlock className="h-9 w-20 rounded-md" />
          <ShimmerBlock className="h-9 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3 shadow-[var(--dama-card-shadow)]">
        <ShimmerBlock className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBlock className="h-4 w-36" />
          <ShimmerBlock className="h-3 w-48 max-w-full" />
        </div>
      </div>
      <StatGridSkeleton cols={4} />
      <StatGridSkeleton cols={3} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <ShimmerBlock className="h-6 w-40" />
          <ShimmerBlock className="h-9 w-28 rounded-md" />
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
          <OpsDataTableSkeleton
            columns={4}
            rows={5}
            showPagination={false}
            embedded
            density="loose"
          />
        </div>
      </section>
    </div>
  );
}

/**
 * Hosted-cup join chrome load: title/blurb + full-width Field + join CTA +
 * Community tournaments link panel (no second public browse grid). Preview
 * card only appears after a code lookup - omit from chrome skeleton.
 */
export function EventsJoinSkeleton() {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <div className="min-w-0">
        <ShimmerBlock className="h-8 w-48 sm:h-9 sm:w-56 max-w-full" />
        <ShimmerBlock className="mt-1 h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-1.5">
        <ShimmerBlock className="h-4 w-24" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
      </div>
      {/* Live Join CTA is a short gold Button (label ~"Join"). */}
      <ShimmerBlock className="h-10 w-24 rounded-md" />
      {/* Live: Community link only (`/?view=tournaments&source=community`). */}
      <section className="rounded-xl border border-[var(--dama-border)]/80 bg-[var(--dama-panel)]/40 px-3 py-3 sm:px-4">
        <ShimmerBlock className="h-5 w-48" />
        <ShimmerBlock className="mt-0.5 h-3 w-72 max-w-full" />
        <ShimmerBlock className="mt-3 h-8 w-40 rounded-md" />
      </section>
    </div>
  );
}

export function DashboardPanelsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <section
          key={i}
          className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5"
        >
          <ShimmerBlock className="h-4 w-24" />
          <ShimmerBlock className="mt-3 h-3 w-full" />
          <ShimmerBlock className="mt-2 h-3 w-[80%]" />
          <ShimmerBlock className="mt-4 h-9 w-28 rounded-md" />
        </section>
      ))}
    </div>
  );
}

export function FormCardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
      ))}
      <ShimmerBlock className="h-10 w-full rounded-md" />
    </div>
  );
}

/** Legal doc: tab row + title + section heading/body blocks (matches LegalPageShell). */
export function LegalDocumentSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12" aria-hidden>
      <div className="flex flex-wrap gap-2 border-b border-[var(--dama-border)] pb-3">
        <ShimmerBlock className="h-9 w-20 rounded-md" />
        <ShimmerBlock className="h-9 w-16 rounded-md" />
        <ShimmerBlock className="h-9 w-20 rounded-md" />
      </div>
      <ShimmerBlock className="h-9 w-56 max-w-full" />
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="space-y-3">
          <ShimmerBlock className="h-6 w-40" />
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="h-3 w-[92%]" />
          <ShimmerBlock className="h-3 w-[78%]" />
        </div>
      ))}
    </div>
  );
}

/** Google-only auth login: title + subtitle + one CTA (not a multi-field form). */
export function AuthLoginSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <ShimmerBlock className="mx-auto h-8 w-56" />
        <ShimmerBlock className="mx-auto h-4 w-full max-w-sm" />
        <ShimmerBlock className="mx-auto h-4 w-2/3 max-w-xs" />
      </div>
      <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
        <ShimmerBlock className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

export function PlayerInspectSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ShimmerBlock className="mx-auto aspect-square w-36 shrink-0 rounded-lg sm:mx-0 sm:w-44" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <ShimmerBlock className="h-10 w-full rounded-md sm:flex-1" />
            <ShimmerBlock className="h-10 w-full rounded-md sm:flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ShimmerBlock key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <ShimmerBlock className="h-4 w-36" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Matchmaking page: 2-col title/self/CTAs | queue + invite (matches page layout). */
export function MatchmakingQueueSkeleton() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-2" aria-hidden>
      <div className="space-y-4">
        <ShimmerBlock className="h-9 w-48 max-w-full" />
        <ShimmerBlock className="h-4 w-full max-w-md" />
        <ProfileCardSkeleton />
        <div className="flex flex-wrap gap-2">
          <ShimmerBlock className="h-10 w-32 rounded-md" />
          <ShimmerBlock className="h-10 w-28 rounded-md" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="mt-3 h-12 w-20" />
          <ShimmerBlock className="mt-2 h-3 w-40" />
        </div>
        <div className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-3 w-full max-w-md" />
          <div className="flex gap-2">
            <ShimmerBlock className="h-10 flex-1 rounded-md" />
            <ShimmerBlock className="h-10 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Right-rail Games / Players list rows (Chess.com-style density). */
export function PlayRailListSkeleton({
  rows = 6,
  variant = "player",
}: {
  rows?: number;
  variant?: "player" | "game";
}) {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: rows }, (_, i) =>
        variant === "game" ? (
          <div
            key={i}
            className="flex flex-col gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5"
          >
            <div className="flex items-start gap-2">
              <div className="flex shrink-0">
                <ShimmerBlock className="h-9 w-9 rounded-full ring-2 ring-[var(--dama-panel)]" />
                <ShimmerBlock className="-ml-[1.125rem] h-9 w-9 rounded-full ring-2 ring-[var(--dama-panel)]" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* players label + vs + TC | viewers | game id */}
                <ShimmerBlock className="h-2.5 w-14" />
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <ShimmerBlock className="h-3.5 w-[75%] max-w-[11rem]" />
                  </div>
                  <ShimmerBlock className="h-3 w-10 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5">
                  <ShimmerBlock className="h-2.5 w-12" />
                  <div className="flex">
                    <ShimmerBlock className="h-5 w-5 rounded-full ring-1 ring-[var(--dama-panel)]" />
                    <ShimmerBlock className="-ml-2.5 h-5 w-5 rounded-full ring-1 ring-[var(--dama-panel)]" />
                    <ShimmerBlock className="-ml-2.5 h-5 w-5 rounded-full ring-1 ring-[var(--dama-panel)]" />
                  </div>
                </div>
                <ShimmerBlock className="h-2.5 w-24" />
              </div>
            </div>
          </div>
        ) : (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5"
          >
            <ShimmerBlock className="h-8 w-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <ShimmerBlock className="h-3.5 w-[55%] max-w-[9rem]" />
              <ShimmerBlock className="h-3 w-16" />
            </div>
            <ShimmerBlock className="h-3.5 w-10 shrink-0" />
          </div>
        ),
      )}
    </div>
  );
}

/** Spectate hub: same Play shell as home (seats + board + panel). */
export function SpectatePageSkeleton() {
  return <PlayHubSkeleton />;
}

/** Profile page: title + Settings CTA + identity card | recent matches list. */
export function ProfilePageSkeleton() {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <ShimmerBlock className="h-8 w-40 sm:h-9" />
          <ShimmerBlock className="mt-1 h-4 w-72 max-w-full" />
        </div>
        <ShimmerBlock className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
          <div className="flex items-center gap-4">
            <ShimmerBlock className="h-20 w-20 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-4 w-36" />
              <ShimmerBlock className="h-3 w-48 max-w-full" />
              <ShimmerBlock className="h-3 w-28" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <ShimmerBlock className="h-16 w-full rounded-md" />
            <ShimmerBlock className="h-16 w-full rounded-md" />
            <ShimmerBlock className="h-16 w-full rounded-md" />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
          <ShimmerBlock className="h-4 w-32" />
          <ul className="mt-3 max-h-[220px] space-y-2 overflow-hidden">
            {["m0", "m1", "m2", "m3"].map((id) => (
              <li
                key={id}
                className="flex items-center justify-between rounded-md border border-[var(--dama-border)] px-3 py-2"
              >
                <ShimmerBlock className="h-3.5 w-24" />
                <ShimmerBlock className="h-3.5 w-20" />
              </li>
            ))}
          </ul>
          <SkipPaginationSkeleton className="mt-3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Settings: title + Profile CTA + Identity (doc KYC + cash/age/phone) |
 * Account (export/delete + session).
 */
export function SettingsPageSkeleton() {
  /**
   * Document KYC: `space-y-3 p-4` no shadow.
   * Cash: `space-y-4 p-5` no shadow.
   * Account: `space-y-6 p-5` no shadow.
   * Session: `p-5` + card shadow.
   */
  const panel = (lines: number, variant: "doc" | "cash" | "account" = "cash") => (
    <div
      className={cn(
        "rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)]",
        variant === "doc" && "space-y-3 p-4",
        variant === "cash" && "space-y-4 p-5",
        variant === "account" && "space-y-6 p-5",
      )}
    >
      <ShimmerBlock className="h-5 w-48" />
      <ShimmerBlock className="h-4 w-full max-w-md" />
      {Array.from({ length: lines }, (_, i) => (
        <ShimmerBlock key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
  return (
    <div className="w-full space-y-6" aria-hidden>
      {/* PortalPageShell: h1 mt-1, blurb mt-1. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <ShimmerBlock className="mt-1 h-8 w-36 sm:h-9" />
          <ShimmerBlock className="mt-1 h-4 w-80 max-w-full" />
        </div>
        <ShimmerBlock className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          {panel(4, "doc")}
          {panel(3, "cash")}
        </div>
        <div className="space-y-6">
          {panel(5, "account")}
          <div className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <ShimmerBlock className="h-4 w-28" />
            <ShimmerBlock className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Portal/ads main column while auth rehydrates - layouts already paint rail/header.
 * Never the centered login-card shimmer.
 */
export function PortalMainSkeleton() {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-8 w-44" />
        <ShimmerBlock className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <ShimmerBlock key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <ShimmerBlock className="h-48 w-full rounded-lg" />
    </div>
  );
}

/**
 * Route-aware portal content skeleton for RequireAuth hydrate - matches the
 * destination page skeleton so auth→page does not flash a generic layout.
 */
export function portalRouteSkeleton(pathname: string) {
  const p = (pathname || "/").split("?")[0] || "/";
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return <PlayerDashboardSkeleton />;
  if (p === "/profile" || p.startsWith("/profile/")) return <ProfilePageSkeleton />;
  if (p === "/settings" || p.startsWith("/settings/")) return <SettingsPageSkeleton />;
  if (p === "/wallet" || p.startsWith("/wallet/")) return <WalletPanelSkeleton />;
  if (p === "/transactions" || p.startsWith("/transactions/")) {
    return <SearchableListPageSkeleton columns={7} showBlurb />;
  }
  // Receipt detail boot is owned by RequireAuth (ReceiptDetailSkeletonBoot).
  // Keep letterhead topology if this helper is called directly.
  if (p.startsWith("/receipts/") && p !== "/receipts/") {
    return <ReceiptDetailSkeleton lineRows={0} />;
  }
  if (p === "/receipts") {
    return <ReceiptsPageSkeleton columns={6} showBlurb showManualForm={false} />;
  }
  if (p === "/ads" || p === "/ads/dashboard" || p.startsWith("/ads/dashboard/")) {
    return (
      <PortalDashboardSkeleton
        kpiCols={8}
        kpiCount={8}
        showCampaignList
        listRows={3}
        portalLinkCount={5}
        portalVariant="ads"
      />
    );
  }
  if (p === "/ads/campaigns" || p.startsWith("/ads/campaigns/")) {
    return <CampaignListSkeleton />;
  }
  if (p === "/ads/analytics" || p.startsWith("/ads/analytics/")) {
    return (
      <AnalyticsPageSkeleton
        kpiCols={6}
        tableColumns={5}
        showInvoiceCta
        wrapTable={false}
        denseKpis
      />
    );
  }
  if (p === "/ads/wallet" || p.startsWith("/ads/wallet/")) return <WalletPanelSkeleton />;
  if (p === "/ads/transactions" || p.startsWith("/ads/transactions/")) {
    return <SearchableListPageSkeleton columns={7} showBlurb={false} />;
  }
  if (p.startsWith("/ads/receipts/") && p !== "/ads/receipts/") {
    return <ReceiptDetailSkeleton lineRows={0} />;
  }
  if (p === "/ads/receipts") {
    return <ReceiptsPageSkeleton columns={6} showBlurb={false} showManualForm={false} />;
  }
  if (p === "/ads/transfer" || p.startsWith("/ads/transfer/")) {
    return <ReceiptsPageSkeleton columns={0} showBlurb={false} showManualForm />;
  }
  if (p === "/events" || p === "/events/dashboard" || p.startsWith("/events/dashboard/")) {
    return (
      <PortalDashboardSkeleton
        kpiCols={7}
        kpiCount={8}
        showCreateCta
        showCampaignList={false}
        portalLinkCount={6}
        portalVariant="events"
      />
    );
  }
  if (p === "/events/events" || p.startsWith("/events/events/")) return <EventsListSkeleton />;
  if (p === "/events/join" || p.startsWith("/events/join/")) return <EventsJoinSkeleton />;
  if (p === "/events/analytics" || p.startsWith("/events/analytics/")) {
    return (
      <AnalyticsPageSkeleton kpiCols={7} tableColumns={8} tableRows={4} showMetricsNote wrapTable />
    );
  }
  if (p === "/events/wallet" || p.startsWith("/events/wallet/")) return <WalletPanelSkeleton />;
  if (p === "/events/transactions" || p.startsWith("/events/transactions/")) {
    return <SearchableListPageSkeleton columns={7} showBlurb={false} />;
  }
  if (p.startsWith("/events/receipts/") && p !== "/events/receipts/") {
    return <ReceiptDetailSkeleton lineRows={0} />;
  }
  if (p === "/events/receipts") {
    return <ReceiptsPageSkeleton columns={6} showBlurb={false} showManualForm={false} />;
  }
  if (p === "/events/transfer" || p.startsWith("/events/transfer/")) {
    return <ReceiptsPageSkeleton columns={0} showBlurb={false} showManualForm />;
  }
  if (p === "/transfer" || p.startsWith("/transfer/")) {
    return <ReceiptsPageSkeleton columns={0} showBlurb showManualForm />;
  }
  return <PortalMainSkeleton />;
}

/** @deprecated Prefer PortalMainSkeleton inside layouts that already paint the shell. */
export function PortalShellSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--dama-bg)] md:flex" aria-hidden>
      <aside className="hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-[var(--dama-border)] bg-[var(--dama-panel)] md:flex">
        <div className="flex h-14 items-center border-b border-[var(--dama-border)] px-4">
          <ShimmerBlock className="h-6 w-24" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 7 }, (_, i) => (
            <ShimmerBlock key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-end gap-3 border-b border-[var(--dama-border)] px-4 sm:px-6">
          <ShimmerBlock className="h-9 w-9 rounded-md" />
          <ShimmerBlock className="h-9 w-28 rounded-md" />
        </div>
        <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-4 md:p-6">
          <PortalMainSkeleton />
        </div>
      </div>
    </div>
  );
}

/** Leaderboard page: Hall of Fame title/blurb + period tabs + podium/list. */
export function LeaderboardPageSkeleton() {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-9 w-52 max-w-full" />
        <ShimmerBlock className="h-4 w-full max-w-md" />
      </div>
      <div className="flex flex-wrap gap-2">
        <ShimmerBlock className="h-9 w-24 rounded-lg" />
        <ShimmerBlock className="h-9 w-28 rounded-lg" />
        <ShimmerBlock className="h-9 w-24 rounded-lg" />
        <ShimmerBlock className="h-9 w-20 rounded-lg" />
      </div>
      <LeaderboardSkeleton />
    </div>
  );
}

/** Auth gate while hydrate/redirect - not a multi-field form. */
export function AuthGateSkeleton() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4" aria-hidden>
      <AuthLoginSkeleton />
    </div>
  );
}

/** Landing / marketing CTA row while client_nav.marketing hydrates. */
export function HeroCtaSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {Array.from({ length: count }, (_, i) => (
        <ShimmerBlock key={i} className="h-11 w-36 rounded-md" />
      ))}
    </div>
  );
}

/** Header nav link row while client_nav surface hydrates. */
export function NavLinksSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <ShimmerBlock key={i} className="h-4 w-16" />
      ))}
    </>
  );
}

/** Geo-served sponsored ad card while locate + serve hydrate. */
export function GeoAdSlotSkeleton() {
  return (
    <aside
      className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4"
      aria-hidden
    >
      <ShimmerBlock className="h-3 w-20" />
      <ShimmerBlock className="mt-3 h-24 w-full rounded-md" />
      <ShimmerBlock className="mt-2 h-3 w-32" />
    </aside>
  );
}

/**
 * Wallet workspace: balance, action row, payout methods (4 cols + add) +
 * payout history (6 cols). Pass `embedded` when PortalPageShell already paints title/actions.
 */
export function WalletPanelSkeleton({
  embedded = false,
  /** Top-up + payout always; receipt/KYC appear conditionally in live UI. */
  actionCount = 2,
}: {
  embedded?: boolean;
  actionCount?: number;
} = {}) {
  const actions = Math.min(4, Math.max(2, actionCount));
  return (
    <div className="w-full space-y-6" aria-hidden>
      {!embedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <ShimmerBlock className="mt-1 h-8 w-40 sm:h-9" />
          </div>
          <div className="flex gap-2">
            <ShimmerBlock className="h-9 w-28 rounded-md" />
            <ShimmerBlock className="h-9 w-24 rounded-md" />
          </div>
        </div>
      ) : null}
      <section className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
        {/* Live: text-sm label, mt-1 text-2xl balance, mt-2 text-xs route. */}
        <ShimmerBlock className="h-4 w-16" />
        <ShimmerBlock className="mt-1 h-8 w-40" />
        <ShimmerBlock className="mt-2 h-3 w-48" />
      </section>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <ShimmerBlock
            key={i}
            className={cn(
              "h-10 rounded-md",
              /* Top up+Plus ~w-28; Request payout+icon ~w-40; optional receipt/KYC. */
              i === 0 ? "w-28" : i === 1 ? "w-40" : "w-36",
            )}
          />
        ))}
      </div>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="flex flex-col gap-3 border-b border-[var(--dama-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <ShimmerBlock className="h-4 w-36" />
          {/* Live Add method: Button size="sm" (h-9) + Plus icon. */}
          <ShimmerBlock className="h-9 w-32 rounded-md" />
        </div>
        <div className="p-2">
          <OpsDataTableSkeleton columns={4} rows={6} embedded />
        </div>
      </div>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="border-b border-[var(--dama-border)] p-4">
          <ShimmerBlock className="h-4 w-40" />
        </div>
        <div className="p-2">
          <OpsDataTableSkeleton columns={6} rows={6} embedded />
        </div>
      </div>
    </div>
  );
}

/**
 * Receipts list. Manual submit+banks only when payment route is manual_transfer -
 * chrome load defaults `showManualForm={false}` to avoid over-paint.
 */
export function ReceiptsPageSkeleton({
  columns = 6,
  showManualForm = false,
  showBlurb = true,
}: {
  columns?: number;
  showManualForm?: boolean;
  showBlurb?: boolean;
} = {}) {
  return (
    <div className="w-full space-y-6" aria-hidden>
      <SearchableListPageSkeleton columns={columns} showBlurb={showBlurb} />
      {showManualForm ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <ShimmerBlock className="h-4 w-40" />
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-10 w-full rounded-md" />
            <ShimmerBlock className="h-3 w-28" />
            <ShimmerBlock className="h-10 w-full rounded-md" />
            <ShimmerBlock className="h-28 w-full rounded-md" />
            <ShimmerBlock className="h-10 w-36 rounded-md" />
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <ShimmerBlock className="h-4 w-44" />
            <ShimmerBlock className="h-16 w-full rounded-md" />
            <ShimmerBlock className="h-16 w-full rounded-md" />
            <ShimmerBlock className="h-16 w-full rounded-md" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Compact banks list while wallet banks query hydrates. */
export function WalletBanksSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="mt-3 space-y-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="space-y-1 rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2"
        >
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-3 w-40" />
          <ShimmerBlock className="h-3 w-36" />
        </li>
      ))}
    </ul>
  );
}

export function MatchSeatRowSkeleton() {
  return (
    <div className="flex flex-wrap gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
        >
          <ShimmerBlock className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <ShimmerBlock className="h-3 w-14" />
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
