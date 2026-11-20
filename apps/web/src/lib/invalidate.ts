import type { QueryClient } from "@tanstack/react-query";

/** Drop account-scoped cache on login/logout without wiping platform enums/nav. */
export function removeAccountScopedQueries(qc: QueryClient) {
  const roots = [
    "me",
    "wallet",
    "payment-route",
    "player-geo",
    "detect-browser-country",
    "ads-serve",
    "ad-campaigns",
    "ad-analytics",
    "publisher-dashboard",
    "matchmaking-status",
    "game-state",
    "public-player",
    "tournaments",
    "leaderboard",
    "events-dashboard",
    "events-analytics",
    "events-list",
    "events-joined",
    "event",
    "event-by-code",
    "event-entries",
    "event-entries-paged",
    "event-live-boards",
    "event-bracket",
    "event-share",
  ] as const;
  for (const root of roots) {
    void qc.removeQueries({ queryKey: [root] });
  }
}

/** Prefix-matched invalidation helpers used by mutations. */
export function invalidateWallet(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["wallet"] }),
    qc.invalidateQueries({ queryKey: ["my-transactions"] }),
    qc.invalidateQueries({ queryKey: ["my-receipts"] }),
    qc.invalidateQueries({ queryKey: ["my-receipt"] }),
  ]);
}

export function invalidatePaymentRoute(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["payment-route"] });
}

export function invalidateMatchmaking(qc: QueryClient, token?: string | null) {
  return token
    ? qc.invalidateQueries({ queryKey: ["matchmaking-status", token] })
    : qc.invalidateQueries({ queryKey: ["matchmaking-status"] });
}

export function invalidateTournaments(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["tournaments"] });
}

export function invalidateTournamentCup(qc: QueryClient, tournamentId?: string | null) {
  const id = (tournamentId || "").trim();
  return Promise.all([
    invalidateTournaments(qc),
    id
      ? qc.invalidateQueries({ queryKey: ["tournament", id] })
      : qc.invalidateQueries({ queryKey: ["tournament"] }),
    id
      ? qc.invalidateQueries({ queryKey: ["tournament-bracket", id] })
      : qc.invalidateQueries({ queryKey: ["tournament-bracket"] }),
    id
      ? qc.invalidateQueries({ queryKey: ["tournament-entries", id] })
      : qc.invalidateQueries({ queryKey: ["tournament-entries"] }),
  ]);
}

export function invalidateMe(qc: QueryClient, token?: string | null) {
  return token
    ? qc.invalidateQueries({ queryKey: ["me", token] })
    : qc.invalidateQueries({ queryKey: ["me"] });
}

export function invalidateLeaderboard(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["leaderboard"] });
}

export function invalidateAdPublisher(qc: QueryClient, token?: string | null) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["ad-campaigns"] }),
    qc.invalidateQueries({ queryKey: ["ad-analytics"] }),
    qc.invalidateQueries({ queryKey: ["publisher-dashboard"] }),
    qc.invalidateQueries({ queryKey: ["ads-serve"] }),
  ]);
}

export function invalidateEvents(qc: QueryClient, eventId?: string | null) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["events-dashboard"] }),
    qc.invalidateQueries({ queryKey: ["events-analytics"] }),
    qc.invalidateQueries({ queryKey: ["events-list"] }),
    qc.invalidateQueries({ queryKey: ["events-public-list"] }),
    qc.invalidateQueries({ queryKey: ["events-joined"] }),
    qc.invalidateQueries({ queryKey: ["event-entries"] }),
    qc.invalidateQueries({ queryKey: ["event-entries-paged"] }),
    qc.invalidateQueries({ queryKey: ["event-live-boards"] }),
    qc.invalidateQueries({ queryKey: ["event-by-code"] }),
    eventId
      ? qc.invalidateQueries({ queryKey: ["event", eventId] })
      : qc.invalidateQueries({ queryKey: ["event"] }),
    eventId
      ? qc.invalidateQueries({ queryKey: ["event-bracket", eventId] })
      : qc.invalidateQueries({ queryKey: ["event-bracket"] }),
    eventId
      ? qc.invalidateQueries({ queryKey: ["event-share", eventId] })
      : qc.invalidateQueries({ queryKey: ["event-share"] }),
  ]);
}

export function invalidateFeatureFlags(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["feature-flags"] }),
    qc.invalidateQueries({ queryKey: ["rest-feature-flags"] }),
    // Community list + Host Public seed read public_events_enabled from catalog.
    qc.invalidateQueries({ queryKey: ["events-catalog"] }),
    qc.invalidateQueries({ queryKey: ["events-public-list"] }),
  ]);
}

export function invalidatePublicPlayer(qc: QueryClient, playerId?: string | null) {
  return playerId
    ? qc.invalidateQueries({ queryKey: ["public-player", playerId] })
    : qc.invalidateQueries({ queryKey: ["public-player"] });
}

/** Surfaces that embed avatar URLs (lists, seats, friends, chat) after upload or WS. */
export function invalidateAvatarSurfaces(qc: QueryClient, playerId?: string | null) {
  return Promise.all([
    // Always invalidate the whole public-player family so nested friends_preview
    // on other profiles refetch (write-through patches first; this is backup).
    invalidatePublicPlayer(qc),
    invalidateLeaderboard(qc),
    invalidateMe(qc),
    qc.invalidateQueries({ queryKey: ["friends"] }),
    qc.invalidateQueries({ queryKey: ["players"] }),
    qc.invalidateQueries({ queryKey: ["games", "live"] }),
    qc.invalidateQueries({ queryKey: ["games", "spectators"] }),
    qc.invalidateQueries({ queryKey: ["dms"] }),
    qc.invalidateQueries({ queryKey: ["game-chat"] }),
    qc.invalidateQueries({ queryKey: ["games"], predicate: (q) => q.queryKey.includes("votes") }),
    playerId
      ? qc.invalidateQueries({ queryKey: ["public-player-matches", playerId] })
      : Promise.resolve(),
  ]);
}
