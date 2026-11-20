import { restClient } from "@/lib/api";
import type { CompetitionPointsToastSettingsPayload } from "@/hooks/mutation/useSaveCompetitionPointsToastSettingsMutation";
import { useQuery } from "@tanstack/react-query";

export function competitionPointsToastSettingsQueryKey(token: string | null | undefined) {
  return ["competition-points-toast-settings", token ?? ""] as const;
}

export function useCompetitionPointsToastSettingsQuery(
  token: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: competitionPointsToastSettingsQueryKey(token),
    enabled: Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<CompetitionPointsToastSettingsPayload>(
        "/console/competition/points-toast-settings",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
  });
}
