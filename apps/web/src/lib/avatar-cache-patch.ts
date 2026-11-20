import type { FriendRequestRow } from "@/hooks/query/useFriendsQuery";
import type { LiveGameRow } from "@/hooks/query/useLiveGamesQuery";
import type { PlayersSearchRow } from "@/hooks/query/usePlayersSearchQuery";
import type { PublicPlayerCardLite, PublicPlayerResponse } from "@/types/player";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

function patchLite(
  card: PublicPlayerCardLite | undefined,
  userId: string,
  thumb: string | null,
  full: string | null,
): { next: PublicPlayerCardLite | undefined; changed: boolean } {
  if (!card || card.id !== userId) return { next: card, changed: false };
  return {
    next: {
      ...card,
      avatar_thumb_url: thumb,
      avatar_full_url: full,
    },
    changed: true,
  };
}

function patchSearchRow(
  row: PlayersSearchRow | undefined,
  userId: string,
  thumb: string | null,
  full: string | null,
): { next: PlayersSearchRow | undefined; changed: boolean } {
  if (!row || row.id !== userId) return { next: row, changed: false };
  return {
    next: {
      ...row,
      avatar_thumb_url: thumb,
      avatar_full_url: full,
    },
    changed: true,
  };
}

function patchLiveGame(
  g: LiveGameRow,
  userId: string,
  thumb: string | null,
  full: string | null,
): { next: LiveGameRow; changed: boolean } {
  let changed = false;
  let next = g;
  if (g.player1_id === userId) {
    next = {
      ...next,
      player1_avatar_thumb_url: thumb,
      player1_avatar_full_url: full,
    };
    changed = true;
  }
  if (g.player2_id === userId) {
    next = {
      ...next,
      player2_avatar_thumb_url: thumb,
      player2_avatar_full_url: full,
    };
    changed = true;
  }
  if (g.viewers?.some((v) => v.id === userId)) {
    next = {
      ...next,
      viewers: g.viewers.map((v) =>
        v.id === userId ? { ...v, avatar_thumb_url: thumb, avatar_full_url: full } : v,
      ),
    };
    changed = true;
  }
  return { next, changed };
}

/**
 * Write-through every cached public-player payload for this user_id:
 * root player, friends_preview chips, and embedded match seat cards.
 */
export function patchAvatarAcrossPublicPlayers(
  qc: QueryClient,
  userId: string,
  thumb: string | null,
  full: string | null,
) {
  const uid = userId.trim();
  if (!uid) return;
  qc.setQueriesData<PublicPlayerResponse>({ queryKey: ["public-player"] }, (prev) => {
    if (!prev?.player) return prev;
    let changed = false;
    let player = prev.player;
    if (player.id === uid) {
      player = {
        ...player,
        avatar_thumb_url: thumb,
        avatar_full_url: full,
      };
      changed = true;
    }
    const friends_preview = prev.friends_preview?.map((f) => {
      const { next, changed: c } = patchLite(f, uid, thumb, full);
      if (c) changed = true;
      return next ?? f;
    });
    const matches = prev.matches?.map((m) => {
      const p1 = patchLite(m.player1, uid, thumb, full);
      const p2 = patchLite(m.player2, uid, thumb, full);
      if (!p1.changed && !p2.changed) return m;
      changed = true;
      return {
        ...m,
        player1: p1.next,
        player2: p2.next,
      };
    });
    if (!changed) return prev;
    return {
      ...prev,
      player,
      friends_preview: friends_preview ?? prev.friends_preview,
      matches: matches ?? prev.matches,
    };
  });
}

type LeaderboardCached = {
  players: Array<{
    id: string;
    avatarThumbUrl?: string | null;
    avatarFullUrl?: string | null;
  }>;
  meta?: unknown;
  period?: string;
  me?: unknown;
};

/** Instant patch for every React Query surface that embeds avatar URLs. */
export function patchAvatarEverywhere(
  qc: QueryClient,
  userId: string,
  thumb: string | null,
  full: string | null,
) {
  const uid = userId.trim();
  if (!uid) return;

  patchAvatarAcrossPublicPlayers(qc, uid, thumb, full);

  qc.setQueriesData<LeaderboardCached>({ queryKey: ["leaderboard"] }, (prev) => {
    if (!prev?.players?.length) return prev;
    let changed = false;
    const players = prev.players.map((p) => {
      if (p.id !== uid) return p;
      changed = true;
      return {
        ...p,
        avatarThumbUrl: thumb ?? undefined,
        avatarFullUrl: full ?? undefined,
      };
    });
    return changed ? { ...prev, players } : prev;
  });

  qc.setQueriesData<LiveGameRow[]>({ queryKey: ["games", "live"] }, (prev) => {
    if (!Array.isArray(prev)) return prev;
    let changed = false;
    const next = prev.map((g) => {
      const { next: row, changed: c } = patchLiveGame(g, uid, thumb, full);
      if (c) changed = true;
      return row;
    });
    return changed ? next : prev;
  });

  qc.setQueriesData<InfiniteData<{ games?: LiveGameRow[]; meta?: unknown }>>(
    { queryKey: ["games", "live", "infinite"] },
    (prev) => {
      if (!prev?.pages?.length) return prev;
      let changed = false;
      const pages = prev.pages.map((page) => {
        const games = (page.games ?? []).map((g) => {
          const { next: row, changed: c } = patchLiveGame(g, uid, thumb, full);
          if (c) changed = true;
          return row;
        });
        return { ...page, games };
      });
      return changed ? { ...prev, pages } : prev;
    },
  );

  qc.setQueriesData<PlayersSearchRow[]>({ queryKey: ["friends"] }, (prev) => {
    if (!Array.isArray(prev)) return prev;
    let changed = false;
    const next = prev.map((row) => {
      const { next: r, changed: c } = patchSearchRow(row, uid, thumb, full);
      if (c) changed = true;
      return r ?? row;
    });
    return changed ? next : prev;
  });

  qc.setQueriesData<InfiniteData<{ friends?: PlayersSearchRow[]; meta?: unknown }>>(
    { queryKey: ["friends", "infinite"] },
    (prev) => {
      if (!prev?.pages?.length) return prev;
      let changed = false;
      const pages = prev.pages.map((page) => {
        const friends = (page.friends ?? []).map((row) => {
          const { next: r, changed: c } = patchSearchRow(row, uid, thumb, full);
          if (c) changed = true;
          return r ?? row;
        });
        return { ...page, friends };
      });
      return changed ? { ...prev, pages } : prev;
    },
  );

  qc.setQueriesData<{
    incoming?: FriendRequestRow[];
    outgoing?: FriendRequestRow[];
  }>({ queryKey: ["friends", "requests"] }, (prev) => {
    if (!prev) return prev;
    let changed = false;
    const mapReq = (rows: FriendRequestRow[] | undefined) =>
      (rows ?? []).map((r) => {
        if (!r.player || r.player.id !== uid) return r;
        changed = true;
        return {
          ...r,
          player: {
            ...r.player,
            avatar_thumb_url: thumb,
            avatar_full_url: full,
          },
        };
      });
    const incoming = mapReq(prev.incoming);
    const outgoing = mapReq(prev.outgoing);
    return changed ? { ...prev, incoming, outgoing } : prev;
  });

  qc.setQueriesData<InfiniteData<{ requests?: FriendRequestRow[]; meta?: unknown }>>(
    { queryKey: ["friends", "requests", "infinite"] },
    (prev) => {
      if (!prev?.pages?.length) return prev;
      let changed = false;
      const pages = prev.pages.map((page) => {
        const requests = (page.requests ?? []).map((r) => {
          if (!r.player || r.player.id !== uid) return r;
          changed = true;
          return {
            ...r,
            player: {
              ...r.player,
              avatar_thumb_url: thumb,
              avatar_full_url: full,
            },
          };
        });
        return { ...page, requests };
      });
      return changed ? { ...prev, pages } : prev;
    },
  );

  qc.setQueriesData<{ players?: PlayersSearchRow[]; meta?: unknown }>(
    { queryKey: ["players", "search"] },
    (prev) => {
      if (!prev?.players?.length) return prev;
      let changed = false;
      const players = prev.players.map((row) => {
        const { next: r, changed: c } = patchSearchRow(row, uid, thumb, full);
        if (c) changed = true;
        return r ?? row;
      });
      return changed ? { ...prev, players } : prev;
    },
  );

  qc.setQueriesData<InfiniteData<{ players?: PlayersSearchRow[]; meta?: unknown }>>(
    { queryKey: ["players", "search", "infinite"] },
    (prev) => {
      if (!prev?.pages?.length) return prev;
      let changed = false;
      const pages = prev.pages.map((page) => {
        const players = (page.players ?? []).map((row) => {
          const { next: r, changed: c } = patchSearchRow(row, uid, thumb, full);
          if (c) changed = true;
          return r ?? row;
        });
        return { ...page, players };
      });
      return changed ? { ...prev, pages } : prev;
    },
  );

  qc.setQueriesData<{
    spectator_count?: number;
    viewers?: PlayersSearchRow[];
  }>({ queryKey: ["games", "spectators"] }, (prev) => {
    if (!prev?.viewers?.length) return prev;
    let changed = false;
    const viewers = prev.viewers.map((row) => {
      const { next: r, changed: c } = patchSearchRow(row, uid, thumb, full);
      if (c) changed = true;
      return r ?? row;
    });
    return changed ? { ...prev, viewers } : prev;
  });

  qc.setQueriesData<
    InfiniteData<{ viewers?: PlayersSearchRow[]; spectator_count?: number; meta?: unknown }>
  >({ queryKey: ["games", "spectators", "infinite"] }, (prev) => {
    if (!prev?.pages?.length) return prev;
    let changed = false;
    const pages = prev.pages.map((page) => {
      const viewers = (page.viewers ?? []).map((row) => {
        const { next: r, changed: c } = patchSearchRow(row, uid, thumb, full);
        if (c) changed = true;
        return r ?? row;
      });
      return { ...page, viewers };
    });
    return changed ? { ...prev, pages } : prev;
  });

  // DM request rows embed player cards (incoming/outgoing + infinite pages).
  qc.setQueriesData<{
    incoming?: Array<{ player?: PlayersSearchRow }>;
    outgoing?: Array<{ player?: PlayersSearchRow }>;
  }>({ queryKey: ["dms", "requests"] }, (prev) => {
    if (!prev) return prev;
    let changed = false;
    const mapReq = (rows: Array<{ player?: PlayersSearchRow }> | undefined) =>
      (rows ?? []).map((r) => {
        if (!r.player || r.player.id !== uid) return r;
        changed = true;
        return {
          ...r,
          player: {
            ...r.player,
            avatar_thumb_url: thumb,
            avatar_full_url: full,
          },
        };
      });
    const incoming = mapReq(prev.incoming);
    const outgoing = mapReq(prev.outgoing);
    return changed ? { ...prev, incoming, outgoing } : prev;
  });

  qc.setQueriesData<
    InfiniteData<{ requests?: Array<{ player?: PlayersSearchRow }>; meta?: unknown }>
  >({ queryKey: ["dms", "requests", "infinite"] }, (prev) => {
    if (!prev?.pages?.length) return prev;
    let changed = false;
    const pages = prev.pages.map((page) => {
      const requests = (page.requests ?? []).map((r) => {
        if (!r.player || r.player.id !== uid) return r;
        changed = true;
        return {
          ...r,
          player: {
            ...r.player,
            avatar_thumb_url: thumb,
            avatar_full_url: full,
          },
        };
      });
      return { ...page, requests };
    });
    return changed ? { ...prev, pages } : prev;
  });

  // Game chat messages stamped with sender avatars.
  qc.setQueriesData<{
    messages?: Array<{ user_id?: string; avatar_thumb_url?: string | null }>;
  }>({ queryKey: ["game-chat"] }, (prev) => {
    if (!prev?.messages?.length) return prev;
    let changed = false;
    const messages = prev.messages.map((m) => {
      if ((m.user_id || "").trim() !== uid) return m;
      changed = true;
      return { ...m, avatar_thumb_url: thumb };
    });
    return changed ? { ...prev, messages } : prev;
  });

  // Match votes tallies (player_id) + correct-voter rows (id).
  qc.setQueriesData<{
    players?: Array<{ player_id?: string; avatar_thumb_url?: string | null }>;
    voters?: Array<{ id?: string; avatar_thumb_url?: string | null }>;
  }>({ predicate: (q) => q.queryKey[0] === "games" && q.queryKey.includes("votes") }, (prev) => {
    if (!prev || typeof prev !== "object") return prev;
    let changed = false;
    const players = prev.players?.map((p) => {
      if ((p.player_id || "").trim() !== uid) return p;
      changed = true;
      return { ...p, avatar_thumb_url: thumb };
    });
    const voters = prev.voters?.map((v) => {
      if ((v.id || "").trim() !== uid) return v;
      changed = true;
      return { ...v, avatar_thumb_url: thumb };
    });
    if (!changed) return prev;
    return {
      ...prev,
      ...(players ? { players } : {}),
      ...(voters ? { voters } : {}),
    };
  });
}
