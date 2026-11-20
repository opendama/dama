import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type WalletTransaction = {
  id: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  provider: string;
  created_at: string;
  /** Linked manual-transfer proof image when this top-up has a payment receipt. */
  receipt_url?: string;
  /** Payment receipt id for View receipt → /receipts/{id}. */
  receipt_id?: string;
};

export function myTransactionsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q: string,
) {
  return ["my-transactions", token, skip, limit, q] as const;
}

export function useMyTransactionsQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q: string,
  enabled = true,
) {
  return useQuery({
    queryKey: myTransactionsQueryKey(token, skip, limit, q),
    enabled: Boolean(token) && enabled,
    staleTime: QueryStale.session,
    queryFn: async (): Promise<{ transactions: WalletTransaction[]; meta: SkipPaginationMeta }> => {
      const { data } = await restClient.get<{
        transactions: WalletTransaction[];
        meta: SkipPaginationMeta;
      }>("/payments/transactions", {
        params: { skip, limit, q: q || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        transactions: data?.transactions ?? [],
        meta: data?.meta as SkipPaginationMeta,
      };
    },
  });
}
