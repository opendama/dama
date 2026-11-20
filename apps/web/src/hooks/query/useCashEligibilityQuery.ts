import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { CashEligibility } from "@/types/cash-rmg";
import { useQuery } from "@tanstack/react-query";

export function cashEligibilityQueryKey(token: string | null | undefined) {
  return ["cash-eligibility", token] as const;
}

export function useCashEligibilityQuery(token: string | null | undefined, enabled = true) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: cashEligibilityQueryKey(token),
    enabled: hydrated && enabled && Boolean(token),
    queryFn: async (): Promise<CashEligibility> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<CashEligibility>("/me/cash-eligibility", {
        headers: authHeaders(token),
      });
      return data;
    },
  });
}
