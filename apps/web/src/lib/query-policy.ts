/** TanStack Query freshness tiers (ms). Navigation reuses cache until stale. */
export const QueryStale = {
  /** Nav, enums, catalog, board rules, feature flags. */
  platform: 5 * 60_000,
  /** Profiles, lists, wallet, campaigns, tournaments. */
  session: 60_000,
  /** Geo / country resolve. */
  geo: 5 * 60_000,
  /** Matchmaking / live lists / polls (always refetch when mounted). Board hydrate uses session. */
  live: 0,
} as const;

/** Keep unused query data for back/forward and soft navigations. */
export const QueryGcTime = 30 * 60_000;
