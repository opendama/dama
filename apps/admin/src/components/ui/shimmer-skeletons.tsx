import { cn } from "@/lib/utils";

type ShimmerBlockProps = {
  className?: string;
};

export function ShimmerBlock({ className }: ShimmerBlockProps) {
  return <div className={cn("dama-shimmer", className)} aria-hidden />;
}

export function ListRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2"
        >
          <ShimmerBlock className="h-3 w-16" />
          <ShimmerBlock className="ml-auto h-3 w-10" />
        </li>
      ))}
    </ul>
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

/** Trim MetricCardsSkeleton parity - KPI tile grid matching live KpiCard / Card layout. */
export function MetricCardsSkeleton({
  count,
  columns,
  showIcon = true,
}: {
  count: number;
  /** Explicit lg columns; otherwise derived from count (Trim grid rules). */
  columns?: 2 | 3 | 4 | 5;
  /** Live activity KpiCards have no icon - omit on activity skeletons. */
  showIcon?: boolean;
}) {
  const n = Math.max(0, count);
  if (n < 1) return null;
  const cols = columns ?? (n <= 2 ? 2 : n === 4 ? 4 : n <= 5 ? 3 : 4);
  const gridClass =
    cols === 2
      ? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
      : cols === 4
        ? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        : cols === 5
          ? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          : "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={gridClass} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className={
            showIcon
              ? "min-h-[7.5rem] rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6"
              : // Activity KpiCard live: p-4, text-sm label, text-2xl value (no icon).
                "rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)]"
          }
        >
          <div className={showIcon ? "flex items-center justify-between pb-2" : undefined}>
            <ShimmerBlock className={showIcon ? "h-3 w-24" : "h-4 w-20 max-w-full"} />
            {showIcon ? <ShimmerBlock className="h-4 w-4 rounded-sm" /> : null}
          </div>
          <ShimmerBlock className={showIcon ? "mt-2 h-8 w-16" : "mt-2 h-8 w-14"} />
        </div>
      ))}
    </div>
  );
}

/**
 * Trim ChartSkeleton `variant="usage"` parity - title/subtitle/y-axis + chart + legend.
 * `embedded`: inside an existing Card (no outer border).
 */
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
        {Array.from({ length: 4 }, (_, i) => (
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
      className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6"
      aria-hidden
    >
      {plane}
    </div>
  );
}

/** Heatmap + cumulative + breakdown grid below Usage chart on Activity / Status. */
export function ActivityDashboardSectionsSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6">
        <div className="space-y-4">
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
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6">
        <ShimmerBlock className="h-5 w-52 sm:h-6 sm:w-64" />
        <ShimmerBlock className="mt-4 h-52 w-full rounded-lg sm:h-64 md:h-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6"
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

/** Activity KPI sections + chart only (when page chrome header is already painted).
 * Section tile counts match API enrichLabeled contract (live/period/engagement).
 * Chart matches live page: Card shell + Usage-style header plane. */
export function ActivityBodySkeleton() {
  return (
    <div className="w-full space-y-8" aria-hidden>
      <section className="space-y-3">
        <ShimmerBlock className="h-4 w-24" />
        <MetricCardsSkeleton count={3} columns={3} showIcon={false} />
      </section>
      <section className="space-y-3">
        <ShimmerBlock className="h-4 w-32" />
        <MetricCardsSkeleton count={4} columns={4} showIcon={false} />
      </section>
      <section className="space-y-3">
        <ShimmerBlock className="h-4 w-28" />
        <MetricCardsSkeleton count={3} columns={3} showIcon={false} />
      </section>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6">
        <ActivityChartSkeleton embedded />
      </div>
      <ActivityDashboardSectionsSkeleton />
    </div>
  );
}

/**
 * Admin Activity page shimmer: title + period filter + 3 KPI sections + series card
 * (matches live `/activity` layout; Trim revenue analytics loading shape).
 */
export function ActivityPageSkeleton() {
  return (
    <div className="w-full space-y-8" aria-hidden>
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
      <ActivityBodySkeleton />
    </div>
  );
}

/** Trim OpsOverviewSkeleton parity - title + three KPI sections. */
export function DashboardCardsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-48" />
        <ShimmerBlock className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-4 w-28" />
        <MetricCardsSkeleton count={5} columns={5} />
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-4 w-36" />
        <MetricCardsSkeleton count={5} columns={5} />
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-4 w-24" />
        <MetricCardsSkeleton count={3} columns={3} />
      </div>
    </div>
  );
}

/** Trim DataTableRowsSkeleton + PaginationBarSkeleton parity for OpsDataTable pages. */
export function OpsDataTableSkeleton({
  columns = 4,
  rows = 8,
  showPagination = true,
  showSelection = false,
}: {
  columns?: number;
  rows?: number;
  showPagination?: boolean;
  /** Checkbox column for bulk selection toolbars (users / RBAC / banks). */
  showSelection?: boolean;
}) {
  const colCount = Math.max(1, columns);
  const rowCount = Math.max(1, rows);
  return (
    <div className="space-y-4">
      {showSelection ? (
        <div className="flex flex-wrap items-center gap-2">
          <ShimmerBlock className="h-4 w-24" />
          <ShimmerBlock className="h-8 w-28 rounded-md" />
          <ShimmerBlock className="h-8 w-32 rounded-md" />
          <ShimmerBlock className="h-8 w-28 rounded-md" />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)]">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--dama-border)]">
              {showSelection ? (
                <th className="w-10 whitespace-nowrap px-4 py-3">
                  <ShimmerBlock className="h-4 w-4 rounded-sm" />
                </th>
              ) : null}
              {Array.from({ length: colCount }, (_, i) => (
                <th key={i} className="whitespace-nowrap px-4 py-3">
                  <ShimmerBlock className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r} className="border-b border-[var(--dama-border)] last:border-0">
                {showSelection ? (
                  <td className="px-4 py-3">
                    <ShimmerBlock className="h-4 w-4 rounded-sm" />
                  </td>
                ) : null}
                {Array.from({ length: colCount }, (_, c) => (
                  <td key={c} className="px-4 py-3">
                    {c === 0 && showSelection ? (
                      <div className="flex items-center gap-2">
                        <ShimmerBlock className="h-8 w-8 rounded-full" />
                        <ShimmerBlock className="h-4 w-28" />
                      </div>
                    ) : (
                      <ShimmerBlock className={c === 0 ? "h-4 w-28" : "h-4 w-16"} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination ? (
        <div className="flex flex-wrap items-center gap-2">
          <ShimmerBlock className="mr-auto h-3 w-24" />
          <ShimmerBlock className="h-8 w-12 rounded-md" />
          <ShimmerBlock className="h-8 w-14 rounded-md" />
          <ShimmerBlock className="h-8 w-16 rounded-md" />
          <ShimmerBlock className="h-8 w-10 rounded-md" />
          <ShimmerBlock className="h-8 w-14 rounded-md" />
          <ShimmerBlock className="h-8 w-12 rounded-md" />
        </div>
      ) : null}
    </div>
  );
}

/** Trim FilterBarSkeleton: search + enum select (+ optional date-range slot). */
export function FilterBarSkeleton({ count = 2 }: { count?: number }) {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 2;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex w-full flex-col gap-1.5 sm:min-w-[16rem] sm:flex-1 sm:max-w-md">
        <ShimmerBlock className="h-5 w-16" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-5 w-24" />
      </div>
      {Array.from({ length: Math.max(0, n - 1) }, (_, i) => (
        <div
          key={i}
          className={
            i === n - 2 && n >= 3
              ? "flex w-full flex-col gap-1.5 sm:w-56"
              : "flex w-full flex-col gap-1.5 sm:w-44"
          }
        >
          <ShimmerBlock className="h-5 w-14" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
          <ShimmerBlock className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Body-only users table (use after page title is already painted). */
export function UsersListBodySkeleton() {
  return (
    <div className="space-y-4">
      <FilterBarSkeleton count={3} />
      <OpsDataTableSkeleton columns={12} rows={8} showSelection />
    </div>
  );
}

export function UsersListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-36" />
        <ShimmerBlock className="h-4 w-full max-w-xl" />
      </div>
      <UsersListBodySkeleton />
    </div>
  );
}

/** Identity card only - for detail modal / under an already-rendered page header. */
export function UserIdentityBodySkeleton() {
  return (
    <div className="space-y-4">
      <ShimmerBlock className="h-48 w-full rounded-lg" />
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-8 w-8 rounded-full" />
        <ShimmerBlock className="h-5 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-[var(--dama-border)] pt-4">
        <ShimmerBlock className="h-3 w-32" />
        <ShimmerBlock className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function UserDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-7 w-48" />
          <ShimmerBlock className="h-4 w-full max-w-lg" />
        </div>
        <div className="flex gap-2">
          <ShimmerBlock className="h-9 w-40 rounded-md" />
          <ShimmerBlock className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
        <UserIdentityBodySkeleton />
      </div>
    </div>
  );
}

export function TabsShimmer({ count = 3 }: { count?: number }) {
  const n = Math.max(1, Math.floor(count));
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1">
      {Array.from({ length: n }, (_, i) => (
        <ShimmerBlock key={i} className="h-8 w-28 rounded-md" />
      ))}
    </div>
  );
}

function RbacTabsShimmer() {
  return <TabsShimmer count={3} />;
}

function TournamentListTabBody() {
  return (
    <div className="space-y-4">
      <FilterBarSkeleton />
      <OpsDataTableSkeleton columns={5} rows={5} showSelection />
    </div>
  );
}

function TournamentReportsTabBody() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <ShimmerBlock className="h-4 w-40" />
        <ShimmerBlock className="h-3 w-full max-w-lg" />
      </div>
      <FilterBarSkeleton count={1} />
      <OpsDataTableSkeleton columns={5} rows={5} showSelection />
    </div>
  );
}

export type TournamentBodyTab =
  | "list"
  | "live-boards"
  | "arena"
  | "standings"
  | "points-toast"
  | "payout-defaults"
  | "prize-settle"
  | "reports";

export function TournamentBodySkeleton({ tab = "list" }: { tab?: TournamentBodyTab }) {
  return (
    <div className="space-y-6">
      <TabsShimmer count={8} />
      {tab === "list" ? (
        <TournamentListTabBody />
      ) : tab === "live-boards" ? (
        <OpsDataTableSkeleton columns={6} rows={5} />
      ) : tab === "reports" ? (
        <TournamentReportsTabBody />
      ) : (
        <FormCardSkeleton />
      )}
    </div>
  );
}

export function TournamentListSkeleton({ tab = "list" }: { tab?: TournamentBodyTab } = {}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <ShimmerBlock className="h-7 w-40" />
          <ShimmerBlock className="h-4 w-full max-w-xl" />
        </div>
        {tab === "list" ? <ShimmerBlock className="h-10 w-36 rounded-md" /> : null}
      </div>
      <TournamentBodySkeleton tab={tab} />
    </div>
  );
}

/** Catalog tab: toolbar + search + selectable roles table (matches live Role catalog). */
export function RbacCatalogBodySkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShimmerBlock className="h-4 w-28" />
        <ShimmerBlock className="h-8 w-24 rounded-md" />
      </div>
      <FilterBarSkeleton count={1} />
      <OpsDataTableSkeleton columns={5} rows={8} showSelection />
    </div>
  );
}

/** Permissions tab: toolbar + search + selectable table. */
export function RbacPermissionsBodySkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-8 w-32 rounded-md" />
      </div>
      <FilterBarSkeleton count={1} />
      <OpsDataTableSkeleton columns={3} rows={8} showSelection />
    </div>
  );
}

/** Grants tab: role select + permission checkbox grid. */
export function RbacGrantsBodySkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
      <ShimmerBlock className="h-5 w-40" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <ShimmerBlock className="h-3 w-28" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-[var(--dama-border)] p-2"
          >
            <ShimmerBlock className="h-4 w-4 rounded" />
            <ShimmerBlock className="h-4 w-full" />
          </div>
        ))}
      </div>
      <ShimmerBlock className="h-10 w-36 rounded-md" />
    </div>
  );
}

/** Body after RBAC page title - default tab is Role catalog (OpsDataTable). */
export function RbacBodySkeleton({
  tab = "catalog",
}: {
  tab?: "catalog" | "permissions" | "grants";
}) {
  return (
    <div className="space-y-6">
      <RbacTabsShimmer />
      {tab === "permissions" ? (
        <RbacPermissionsBodySkeleton />
      ) : tab === "grants" ? (
        <RbacGrantsBodySkeleton />
      ) : (
        <RbacCatalogBodySkeleton />
      )}
    </div>
  );
}

export function RbacPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-28" />
        <ShimmerBlock className="h-4 w-full max-w-xl" />
      </div>
      <RbacBodySkeleton />
    </div>
  );
}

function EventsFlagsTabBody() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5"
        >
          <div className="min-w-0 flex-1 basis-48 space-y-2">
            <ShimmerBlock className="h-4 w-40" />
            <ShimmerBlock className="h-3 w-full max-w-md" />
          </div>
          <ShimmerBlock className="h-9 w-14 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EventsHostedTabBody() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-3 w-full max-w-lg" />
      </div>
      <FilterBarSkeleton count={2} />
      <OpsDataTableSkeleton columns={9} rows={5} showSelection />
    </div>
  );
}

function EventsReportsTabBody() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-3 w-full max-w-lg" />
      </div>
      <OpsDataTableSkeleton columns={5} rows={5} showSelection />
    </div>
  );
}

function EventsCatalogTabBody() {
  return (
    <div className="space-y-4">
      <FormCardSkeleton />
      <FormCardSkeleton />
    </div>
  );
}

function EventsSizesTabBody() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-3 w-full max-w-lg" />
        </div>
        <ShimmerBlock className="h-10 w-28 rounded-md" />
      </div>
      <FilterBarSkeleton count={2} />
      <OpsDataTableSkeleton columns={5} rows={5} showSelection />
    </div>
  );
}

export type EventsBodyTab = "hosted" | "flags" | "reports" | "catalog" | "sizes";

/** Hosted events / reports console (not progression form). */
export function EventsPageSkeleton({ tab = "hosted" }: { tab?: EventsBodyTab }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-36" />
        <ShimmerBlock className="h-4 w-full max-w-xl" />
      </div>
      <EventsBodySkeleton tab={tab} />
    </div>
  );
}

export function EventsBodySkeleton({ tab = "hosted" }: { tab?: EventsBodyTab }) {
  return (
    <div className="space-y-6">
      <TabsShimmer count={5} />
      {tab === "flags" ? (
        <EventsFlagsTabBody />
      ) : tab === "reports" ? (
        <EventsReportsTabBody />
      ) : tab === "catalog" ? (
        <EventsCatalogTabBody />
      ) : tab === "sizes" ? (
        <EventsSizesTabBody />
      ) : (
        <EventsHostedTabBody />
      )}
    </div>
  );
}

export function TournamentListBodySkeleton() {
  return <TournamentListTabBody />;
}

export function BanksListBodySkeleton() {
  return (
    <div className="space-y-4">
      <FilterBarSkeleton count={2} />
      <OpsDataTableSkeleton columns={4} rows={6} showSelection />
    </div>
  );
}

function AdsCampaignsTabBody() {
  return (
    <div className="space-y-4">
      <FilterBarSkeleton count={2} />
      <OpsDataTableSkeleton columns={4} rows={6} showSelection />
    </div>
  );
}

export type AdsBodyTab = "runtime" | "campaigns";

export function AdsBodySkeleton({ tab = "runtime" }: { tab?: AdsBodyTab }) {
  return (
    <div className="space-y-6">
      <TabsShimmer count={2} />
      {tab === "campaigns" ? <AdsCampaignsTabBody /> : <FormCardSkeleton />}
    </div>
  );
}

export function AdsPageSkeleton({ tab = "runtime" }: { tab?: AdsBodyTab }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-36" />
        <ShimmerBlock className="h-4 w-full max-w-lg" />
      </div>
      <AdsBodySkeleton tab={tab} />
    </div>
  );
}

export function FeatureFlagsFormSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
      {Array.from({ length: 2 }, (_, i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-4 border-b border-[var(--dama-border)] pb-4"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-36" />
            <ShimmerBlock className="h-3 w-full max-w-md" />
          </div>
          <ShimmerBlock className="h-9 w-14 rounded-md" />
        </div>
      ))}
      <div className="space-y-3 border-t border-[var(--dama-border)] pt-4">
        <ShimmerBlock className="h-4 w-40" />
        <ShimmerBlock className="h-3 w-48" />
        <div className="flex gap-2">
          <ShimmerBlock className="h-9 w-28 rounded-md" />
          <ShimmerBlock className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <div className="space-y-3 border-t border-[var(--dama-border)] pt-4">
        <ShimmerBlock className="h-4 w-36" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

function MediaPoolChannelsTabBody() {
  return (
    <div className="space-y-4">
      <FilterBarSkeleton />
      <OpsDataTableSkeleton columns={3} rows={6} showSelection />
    </div>
  );
}

export type MediaPoolBodyTab = "test_upload" | "channels";

export function MediaPoolBodySkeleton({ tab = "channels" }: { tab?: MediaPoolBodyTab }) {
  return (
    <div className="space-y-6">
      <TabsShimmer count={2} />
      {tab === "test_upload" ? <FormCardSkeleton /> : <MediaPoolChannelsTabBody />}
    </div>
  );
}

export function MediaPoolPageSkeleton({ tab = "test_upload" }: { tab?: MediaPoolBodyTab }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <ShimmerBlock className="h-7 w-40" />
          <ShimmerBlock className="h-4 w-full max-w-xl" />
        </div>
        <ShimmerBlock className="h-10 w-32 rounded-md" />
      </div>
      <MediaPoolBodySkeleton tab={tab} />
    </div>
  );
}

/** Channels tab table body (tabs already painted). */
export function MediaPoolListSkeleton() {
  return <MediaPoolChannelsTabBody />;
}

export function BanksListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-28" />
        <ShimmerBlock className="h-4 w-full max-w-lg" />
      </div>
      <div className="flex justify-end">
        <ShimmerBlock className="h-9 w-32 rounded-md" />
      </div>
      <FilterBarSkeleton />
      <OpsDataTableSkeleton columns={5} rows={6} showSelection />
    </div>
  );
}

/** Financial overview: title + KPI grids (queues + volume). */
export function PaymentsOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-48" />
        <ShimmerBlock className="h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-4 w-28" />
        <DashboardCardsSkeleton />
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-4 w-28" />
        <DashboardCardsSkeleton />
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-4 w-36" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Currency / geo payment settings form page. */
export function PaymentsCurrencySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-40" />
        <ShimmerBlock className="h-4 w-72 max-w-full" />
      </div>
      <FormCardSkeleton />
    </div>
  );
}

export function PaymentsGeoSkeleton() {
  return <PaymentsCurrencySkeleton />;
}

/** Host trust policy: tabs + search + OpsDataTable. */
export function PaymentsHostTrustBodySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] p-1">
        <ShimmerBlock className="h-8 w-20" />
        <ShimmerBlock className="h-8 w-16" />
        <ShimmerBlock className="h-8 w-28" />
      </div>
      <FilterBarSkeleton count={1} />
      <OpsDataTableSkeleton columns={3} rows={4} />
    </div>
  );
}

export function PaymentsHostTrustSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-48" />
        <ShimmerBlock className="h-4 w-96 max-w-full" />
      </div>
      <PaymentsHostTrustBodySkeleton />
    </div>
  );
}

/** Re-export Trim-parity receipt letterhead skeleton (owned by payments/). */
export type { ReceiptSkeletonChrome } from "@/components/payments/ReceiptDetailSkeleton";
export { ReceiptDetailSkeleton } from "@/components/payments/ReceiptDetailSkeleton";

/** Receipts ops queue: title + search + multi-column table. */

export function PaymentsReceiptsBodySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <FilterBarSkeleton count={1} />
      <OpsDataTableSkeleton columns={6} rows={6} showSelection />
    </div>
  );
}

export function PaymentsReceiptsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-40" />
        <ShimmerBlock className="h-4 w-72 max-w-full" />
      </div>
      <PaymentsReceiptsBodySkeleton />
    </div>
  );
}

/** Document KYC review: filters + multi-column table. */
export function PaymentsKycBodySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <FilterBarSkeleton count={2} />
      <OpsDataTableSkeleton columns={5} rows={6} showSelection />
    </div>
  );
}

export function PaymentsKycSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-44" />
        <ShimmerBlock className="h-4 w-80 max-w-full" />
      </div>
      <PaymentsKycBodySkeleton />
    </div>
  );
}

/** Payouts review: filters + multi-column table (review note lives in detail modal). */
export function PaymentsPayoutsBodySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <FilterBarSkeleton count={2} />
      <OpsDataTableSkeleton columns={7} rows={6} showSelection />
    </div>
  );
}

export function PaymentsPayoutsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-36" />
        <ShimmerBlock className="h-4 w-72 max-w-full" />
      </div>
      <PaymentsPayoutsBodySkeleton />
    </div>
  );
}

/** Platform transactions ledger. */
export function PaymentsTransactionsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-44" />
        <ShimmerBlock className="h-4 w-80 max-w-full" />
      </div>
      <FilterBarSkeleton count={1} />
      <OpsDataTableSkeleton columns={8} rows={6} showSelection />
    </div>
  );
}

/** @deprecated Prefer PaymentsKycSkeleton / PaymentsPayoutsSkeleton. */
export function PaymentsReviewSkeleton() {
  return <PaymentsKycSkeleton />;
}

export function AvatarsModerationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
        <ShimmerBlock className="h-4 w-48" />
        <ShimmerBlock className="h-3 w-full max-w-md" />
        <div className="flex flex-wrap gap-2">
          <ShimmerBlock className="h-9 w-28 rounded-md" />
          <ShimmerBlock className="h-9 w-36 rounded-md" />
        </div>
      </div>
      <FilterBarSkeleton />
      <OpsDataTableSkeleton columns={4} rows={6} showSelection />
    </div>
  );
}

function TelemetryFingerprintsTabBody() {
  return (
    <div className="space-y-4">
      <ShimmerBlock className="h-5 w-44" />
      <FilterBarSkeleton />
      <OpsDataTableSkeleton columns={3} rows={4} showSelection />
    </div>
  );
}

function TelemetryGeoTabBody() {
  return (
    <div className="space-y-4">
      <ShimmerBlock className="h-5 w-32" />
      <FilterBarSkeleton />
      <ShimmerBlock className="h-48 w-full rounded-lg sm:h-56" />
      <OpsDataTableSkeleton columns={3} rows={4} showSelection />
    </div>
  );
}

function TelemetryAuditTabBody() {
  return (
    <div className="space-y-4">
      <ShimmerBlock className="h-5 w-36" />
      <FilterBarSkeleton />
      <OpsDataTableSkeleton columns={3} rows={4} showSelection />
    </div>
  );
}

export type TelemetryBodyTab = "fingerprints" | "geo" | "audit";

export function TelemetryBodySkeleton({ tab = "fingerprints" }: { tab?: TelemetryBodyTab }) {
  return (
    <div className="space-y-6">
      <TabsShimmer count={3} />
      {tab === "geo" ? (
        <TelemetryGeoTabBody />
      ) : tab === "audit" ? (
        <TelemetryAuditTabBody />
      ) : (
        <TelemetryFingerprintsTabBody />
      )}
    </div>
  );
}

export function TelemetryPageSkeleton({ tab = "fingerprints" }: { tab?: TelemetryBodyTab }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-36" />
        <ShimmerBlock className="h-4 w-full max-w-xl" />
      </div>
      <TelemetryBodySkeleton tab={tab} />
    </div>
  );
}

/** @deprecated Use TelemetryPageSkeleton or TelemetryBodySkeleton. */
export function TelemetryTableSkeleton(props: { tab?: TelemetryBodyTab } = {}) {
  return <TelemetryPageSkeleton tab={props.tab} />;
}

export function ProgressionPlatformBodySkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShimmerBlock className="h-4 w-40" />
        <ShimmerBlock className="h-9 w-28 rounded-md" />
      </div>
      <OpsDataTableSkeleton columns={3} rows={6} showPagination={false} showSelection />
      <ShimmerBlock className="h-4 w-40" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerBlock className="h-3 w-28" />
          <ShimmerBlock className="h-10 w-full rounded-md" />
        </div>
      ))}
      <ShimmerBlock className="h-10 w-36 rounded-md" />
    </div>
  );
}

export type ProgressionBodyTab = "platform" | "board";

export function ProgressionBoardBodySkeleton() {
  return <FormCardSkeleton />;
}

export function ProgressionBodySkeleton({ tab = "platform" }: { tab?: ProgressionBodyTab }) {
  return (
    <div className="space-y-6">
      <TabsShimmer count={2} />
      {tab === "board" ? <ProgressionBoardBodySkeleton /> : <ProgressionPlatformBodySkeleton />}
    </div>
  );
}

export function ProgressionPageSkeleton({ tab = "platform" }: { tab?: ProgressionBodyTab }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ShimmerBlock className="h-7 w-40" />
        <ShimmerBlock className="h-4 w-full max-w-xl" />
      </div>
      <ProgressionBodySkeleton tab={tab} />
    </div>
  );
}

export function ProgressionFormSkeleton(props: { tab?: ProgressionBodyTab } = {}) {
  return <ProgressionPageSkeleton tab={props.tab} />;
}

/** Matches ConsoleNav link row layout (title width + spacing). */
export function NavLinksSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <ShimmerBlock key={i} className="h-9 w-full rounded-md" />
      ))}
    </div>
  );
}
