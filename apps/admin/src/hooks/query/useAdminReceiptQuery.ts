import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdminReceipt } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminReceiptDetail = AdminReceipt;

export function adminReceiptQueryKey(token: string | null | undefined, id: string) {
  return ["admin-receipt", token, id] as const;
}

/** Trim useAdminReceipt parity - GET /payments/console/receipts/{id}. */
export function useAdminReceiptQuery(
  token: string | null | undefined,
  receiptId: string,
  enabled = true,
) {
  const hydrated = useAuthHydrated();
  const id = (receiptId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminReceiptQueryKey(token, id),
    enabled: hydrated && Boolean(token) && Boolean(id) && enabled,
    queryFn: async (): Promise<AdminReceiptDetail> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<AdminReceiptDetail>(
        `/payments/console/receipts/${encodeURIComponent(id)}`,
        { headers: authHeaders(token) },
      );
      return data;
    },
  });
}
