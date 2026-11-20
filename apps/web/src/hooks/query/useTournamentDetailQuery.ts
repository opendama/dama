import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { TournamentDetailResponse } from "@/types/tournament";
import { useQuery } from "@tanstack/react-query";

export function tournamentDetailQueryKey(
  token: string | null | undefined,
  tournamentId: string | null | undefined,
) {
  return ["tournament", token ?? "", tournamentId] as const;
}

export function useTournamentDetailQuery(
  token: string | null | undefined,
  tournamentId: string | null | undefined,
  enabled = true,
) {
  const hydrated = useAuthHydrated();
  const auth = (token || "").trim();
  const id = (tournamentId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentDetailQueryKey(auth || null, id),
    enabled: hydrated && enabled && Boolean(id),
    queryFn: async () => {
      const { data } = await restClient.get<TournamentDetailResponse>(`/tournaments/${id}`, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : undefined,
      });
      return data.tournament;
    },
  });
}
