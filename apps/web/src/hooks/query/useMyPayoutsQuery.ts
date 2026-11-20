import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type MyPayoutRequest = {
  id: string;
  user_id: string;
  username?: string;
  amount: number;
  currency: string;
  phone: string;
  provider: string;
  status: string;
  /** DB wallet_chrome list_status_* stamped by API (fail closed empty). */
  status_label?: string;
  /** Admin review note from payout_requests.review_note. */
  review_note?: string;
  created_at: string;
  /** Set when admin completes review. */
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

export function myPayoutsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  focusId?: string,
) {
  return ["my-payouts", token, skip, limit, focusId || ""] as const;
}

export function useMyPayoutsQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  enabled = true,
  focusId?: string,
) {
  const id = (focusId || "").trim();
  return useQuery({
    queryKey: myPayoutsQueryKey(token, skip, limit, id),
    enabled: Boolean(token) && enabled && limit > 0,
    staleTime: QueryStale.session,
    queryFn: async (): Promise<{ payouts: MyPayoutRequest[]; meta: SkipPaginationMeta }> => {
      const { data } = await restClient.get<{
        payouts: MyPayoutRequest[];
        meta: SkipPaginationMeta;
      }>("/payouts/mine", {
        params: { skip, limit, ...(id ? { id } : {}) },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        payouts: data?.payouts ?? [],
        meta: data?.meta as SkipPaginationMeta,
      };
    },
  });
}
