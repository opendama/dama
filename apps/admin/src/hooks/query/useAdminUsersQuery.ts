import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdminUser } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminUsersListResponse = {
  users: AdminUser[];
  meta: SkipPaginationMeta;
};

export type AdminUsersListFilters = {
  q?: string;
  status?: string;
  createdFrom?: string | null;
  createdTo?: string | null;
};

export function adminUsersQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  filters: AdminUsersListFilters,
) {
  return [
    "admin-users",
    token,
    skip,
    limit,
    filters.q || "",
    filters.status || "",
    filters.createdFrom || "",
    filters.createdTo || "",
  ] as const;
}

export function useAdminUsersQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip: number,
  limit: number,
  filters: AdminUsersListFilters = {},
) {
  const hydrated = useAuthHydrated();
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  const createdFrom = (filters.createdFrom || "").trim();
  const createdTo = (filters.createdTo || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminUsersQueryKey(token, skip, limit, {
      q,
      status,
      createdFrom,
      createdTo,
    }),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<AdminUsersListResponse>("/console/users", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          skip,
          limit,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
          ...(createdFrom ? { created_from: createdFrom } : {}),
          ...(createdTo ? { created_to: createdTo } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
