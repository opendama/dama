import { eventsPlayerChromeQueryKey } from "@/hooks/query/useEventsPlayerChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { ApiClientError, isApiClientError } from "@/lib/api-client-error";
import { joinHostedEventClientError } from "@/lib/event-join-error";
import { invalidateEvents, invalidateMe, invalidateWallet } from "@/lib/invalidate";
import type { JoinHostedEventInput, JoinHostedEventResult } from "@/types/events";
import type { EventsPlayerChrome } from "@/types/events-player-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type JoinHostedEventError = Error & { status?: number; paymentRequired?: boolean };

export function useJoinHostedEventMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: JoinHostedEventInput) => {
      const chrome = qc.getQueryData<EventsPlayerChrome>(eventsPlayerChromeQueryKey());
      try {
        const { data } = await restClient.post<JoinHostedEventResult>("/events/join", input, {
          headers: authHeaders(token),
        });
        return data;
      } catch (err) {
        if (isApiClientError(err)) {
          const e = err as JoinHostedEventError;
          e.paymentRequired = err.status === 402;
          if (!e.message.trim() && err.status === 402) {
            throw new ApiClientError((chrome?.insufficient_entry_fee || "").trim(), {
              status: 402,
              errorKey: "insufficient_entry_fee",
            });
          }
          throw err;
        }
        // Non-Axios fallback (should be rare with restClient).
        const status =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { status?: number; data?: { error?: string } } }).response
                ?.status
            : undefined;
        const data =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { error?: string; error_key?: string } } }).response
                ?.data
            : undefined;
        throw joinHostedEventClientError(status || 500, data || {});
      }
    },
    onSuccess: (data) => {
      void invalidateEvents(qc, data.event?.id);
      void invalidateWallet(qc);
      void invalidateMe(qc, token);
    },
  });
}
