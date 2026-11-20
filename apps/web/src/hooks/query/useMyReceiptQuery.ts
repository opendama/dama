import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { MyPaymentReceipt } from "@/hooks/query/useMyReceiptsQuery";
import { useQuery } from "@tanstack/react-query";

export type MyPaymentReceiptDetail = MyPaymentReceipt & {
  username?: string;
  email?: string;
  first_party_pdf_href?: string;
};

export function myReceiptQueryKey(token: string | null | undefined, id: string) {
  return ["my-receipt", token, id] as const;
}

/** Trim useReceipt parity - GET /payments/receipts/{id}. */
export function useMyReceiptQuery(
  token: string | null | undefined,
  receiptId: string,
  enabled = true,
) {
  const id = (receiptId || "").trim();
  return useQuery({
    queryKey: myReceiptQueryKey(token, id),
    enabled: Boolean(token) && Boolean(id) && enabled,
    staleTime: QueryStale.session,
    queryFn: async (): Promise<MyPaymentReceiptDetail> => {
      const { data } = await restClient.get<MyPaymentReceiptDetail>(
        `/payments/receipts/${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
  });
}
