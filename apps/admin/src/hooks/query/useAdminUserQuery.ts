import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdminUserDetail } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function adminUserQueryKey(token: string | null | undefined, id: string) {
  return ["admin-user", token, id] as const;
}

export function useAdminUserQuery(
  token: string | null | undefined,
  id: string | null | undefined,
  enabled: boolean,
) {
  const hydrated = useAuthHydrated();
  const userId = (id || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminUserQueryKey(token, userId),
    enabled: hydrated && Boolean(token) && Boolean(userId) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<AdminUserDetail>(`/console/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
