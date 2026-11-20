import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type MyPaymentReceipt = {
  id: string;
  user_id?: string;
  amount: number;
  currency: string;
  provider: string;
  reference: string;
  receipt_url: string;
  status: string;
  /** Settled approved proofs stamp as paid for UI/PDF. */
  display_status?: string;
  intent_id?: string;
  created_at: string;
  reviewed_at?: string;
};

export function myReceiptsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q: string,
) {
  return ["my-receipts", token, skip, limit, q] as const;
}

export function useMyReceiptsQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q: string,
  enabled = true,
) {
  return useQuery({
    queryKey: myReceiptsQueryKey(token, skip, limit, q),
    enabled: Boolean(token) && enabled,
    staleTime: QueryStale.session,
    queryFn: async (): Promise<{ receipts: MyPaymentReceipt[]; meta: SkipPaginationMeta }> => {
      const { data } = await restClient.get<{
        receipts: MyPaymentReceipt[];
        meta: SkipPaginationMeta;
      }>("/payments/receipts/mine", {
        params: { skip, limit, q: q || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        receipts: data?.receipts ?? [],
        meta: data?.meta as SkipPaginationMeta,
      };
    },
  });
}
