import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ModerationSettings } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function moderationSettingsQueryKey(token: string | null | undefined) {
  return ["admin-moderation", token] as const;
}

export function useModerationSettingsQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: moderationSettingsQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<ModerationSettings>("/console/moderation", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
