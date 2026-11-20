import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { HostedStandingRow } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function tournamentStandingsQueryKey(tournamentId: string | null | undefined) {
  return ["tournament-standings", tournamentId] as const;
}

export type TournamentStandingsPayload = {
  standings: HostedStandingRow[];
  format_id: string;
};

export function useTournamentStandingsQuery(
  tournamentId: string | null | undefined,
  enabled = true,
  pollIntervalMs = 0,
) {
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 0;
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentStandingsQueryKey(tournamentId),
    enabled: enabled && Boolean(tournamentId),
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: async (): Promise<TournamentStandingsPayload> => {
      const { data } = await restClient.get<TournamentStandingsPayload>(
        `/tournaments/${tournamentId}/standings`,
      );
      return {
        standings: data.standings ?? [],
        format_id: (data.format_id || "").trim(),
      };
    },
  });
}
