import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthStore } from "@/store/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MatchVotePlayer = {
  player_id: string;
  username?: string;
  avatar_thumb_url?: string | null;
  count: number;
  percent: number;
};

export type MatchVotesPayload = {
  game_id: string;
  total: number;
  players: MatchVotePlayer[];
  my_vote?: string | null;
  has_my_vote?: boolean;
};

export type CorrectVoter = {
  id: string;
  username: string;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  avatar_thumb_url?: string | null;
  country_code?: string | null;
  host_trust_badge?: string | null;
  host_trust_tier?: string | null;
};

/** Identity-scoped so anon / signed-in / account-switch never share my_vote. */
export function matchVotesQueryKey(gameId: string, authKey = "") {
  return ["games", gameId, "votes", authKey || "anon"] as const;
}

export function useMatchVotesQuery(gameId: string | null | undefined, enabled = true) {
  const id = (gameId || "").trim();
  const token = useAuthStore((s) => s.token);
  const authKey = (token || "").trim();
  return useQuery({
    queryKey: matchVotesQueryKey(id, authKey),
    enabled: enabled && Boolean(id),
    staleTime: QueryStale.live,
    refetchInterval: 8_000,
    // Never soft-paint tallies / my_vote from a prior gameId.
    placeholderData: () => undefined,
    queryFn: async () => {
      const { data } = await restClient.get<MatchVotesPayload>(
        `/games/${encodeURIComponent(id)}/votes`,
        { headers: authHeaders(token) },
      );
      return data;
    },
  });
}

export function useCastMatchVoteMutation(gameId: string) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const authKey = (token || "").trim();
  return useMutation({
    mutationFn: async (votedPlayerId: string) => {
      const { data } = await restClient.post<MatchVotesPayload>(
        `/games/${encodeURIComponent(gameId)}/votes`,
        { voted_player_id: votedPlayerId },
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(matchVotesQueryKey(gameId, authKey), data);
    },
  });
}

export function useCorrectVotersQuery(gameId: string | null | undefined, enabled = true) {
  const id = (gameId || "").trim();
  return useQuery({
    queryKey: ["games", id, "votes", "correct"] as const,
    enabled: enabled && Boolean(id),
    staleTime: QueryStale.session,
    // Never soft-paint correct voters from a prior gameId.
    placeholderData: () => undefined,
    queryFn: async () => {
      const { data } = await restClient.get<{ voters?: CorrectVoter[]; winner_id?: string }>(
        `/games/${encodeURIComponent(id)}/votes/correct`,
      );
      return {
        voters: Array.isArray(data.voters) ? data.voters : [],
        winnerId: typeof data.winner_id === "string" ? data.winner_id : null,
      };
    },
  });
}
