import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type CashRmgPolicyConsole = {
  allowed_country_codes: string[];
  min_age_years: number;
  require_locate_for_cash: boolean;
  host_paid_create_requires_phone_kyc?: boolean;
  host_guarantee_requires_document_kyc?: boolean;
  host_concurrent_open_paid_cap_phone_verified?: number;
  host_concurrent_open_paid_cap_document_verified?: number;
  host_concurrent_open_paid_cap_new_host?: number;
  host_new_host_settled_paid_threshold?: number;
  host_reputation_max_open_reports?: number;
  host_reputation_cancel_rate_bps?: number;
  host_reputation_cancel_rate_min_sample?: number;
};

export function cashRmgPolicyQueryKey(token?: string | null) {
  return ["console-cash-rmg-policy", token] as const;
}

export function useCashRmgPolicyQuery(token: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: cashRmgPolicyQueryKey(token),
    enabled: Boolean(token) && enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<CashRmgPolicyConsole>("/console/cash-rmg/policy", {
        headers: authHeaders(token),
      });
      return data;
    },
  });
}
