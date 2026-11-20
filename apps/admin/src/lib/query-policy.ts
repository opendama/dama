/** TanStack Query freshness tiers (ms). Navigation reuses cache until stale. */
export const QueryStale = {
  /** Nav, enums, catalog, board rules, feature flags. */
  platform: 5 * 60_000,
  /** Console lists, me, receipts, banks, users. */
  session: 60_000,
  /** Currency / payment matrix. */
  geo: 5 * 60_000,
  /** Telemetry snapshots. */
  live: 0,
} as const;

/** Keep unused query data for back/forward and soft navigations. */
export const QueryGcTime = 30 * 60_000;
