import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { EntryFeeQuote } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function entryFeeQuoteQueryKey(token: string | null | undefined, amount: string) {
  return ["events-entry-fee-quote", token, amount] as const;
}

export function useEntryFeeQuoteQuery(
  token: string | null | undefined,
  amount: string,
  enabled = true,
) {
  const trimmed = String(amount || "").trim();
  const feeNum = Number(trimmed);
  const canQuote = Boolean(token) && trimmed !== "" && Number.isFinite(feeNum) && feeNum > 0;
  return useQuery({
    queryKey: entryFeeQuoteQueryKey(token, trimmed),
    enabled: enabled && canQuote,
    staleTime: QueryStale.session,
    queryFn: async () => {
      const { data } = await restClient.get<EntryFeeQuote>("/events/entry-fee-quote", {
        params: { amount: trimmed },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return data;
    },
  });
}
