import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type ConsoleTelegramOps = {
  enabled: boolean;
  bot_service_url: string;
  reviewer_user_id: string;
  notify_timeout_ms: number;
  notify_receipt_type: string;
  notify_payout_type: string;
  product_label: string;
  has_bot_api_key: boolean;
  ready: boolean;
};

export function consoleTelegramOpsQueryKey(token: string | null | undefined) {
  return ["console-telegram-ops-bot", token] as const;
}

export function useConsoleTelegramOpsQuery(token: string | null | undefined, enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleTelegramOpsQueryKey(token),
    enabled: enabled && Boolean(token),
    queryFn: async (): Promise<ConsoleTelegramOps> => {
      const { data } = await restClient.get<ConsoleTelegramOps>("/console/telegram-ops-bot", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
