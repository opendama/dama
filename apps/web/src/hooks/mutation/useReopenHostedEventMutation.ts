import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { restClient } from "@/lib/api";
import { isApiClientError } from "@/lib/api-client-error";
import { apiToastMessage } from "@/lib/api-toast-message";
import {
  softHostingToastReopenFailed,
  softHostingToastReopened,
} from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents } from "@/lib/invalidate";
import { withWalletFocusParam } from "@/lib/wallet-focus-href";
import type { HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function isWalletShortfallReopenError(err: unknown): boolean {
  if (!isApiClientError(err) || err.status !== 402) return false;
  const key = (err.errorKey || "").trim();
  return (
    key === "insufficient_prize_guarantee" ||
    key === "err_reopen_guarantee_hold_failed" ||
    key === "insufficient_host_fee"
  );
}

export function useReopenHostedEventMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data } = await restClient.post<HostedEvent>(
        `/events/${eventId}/reopen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      void invalidateEvents(qc, data.id);
      const msg = softHostingToastReopened(chrome?.toast_reopened);
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      // 402 wallet shortfall: DB insufficient chrome + Open wallet → focus top-up.
      if (isWalletShortfallReopenError(err)) {
        const key = (isApiClientError(err) ? err.errorKey || "" : "").trim();
        const guarantee =
          key === "insufficient_prize_guarantee" || key === "err_reopen_guarantee_hold_failed";
        const msg =
          (
            (guarantee ? chrome?.insufficient_prize_guarantee : chrome?.insufficient_host_fee) || ""
          ).trim() || softHostingToastReopenFailed(chrome?.toast_reopen_failed);
        const walletHref = withWalletFocusParam((chrome?.portal_wallet_href || "").trim(), "topup");
        const topUp = (chrome?.top_up_action || "").trim();
        if (msg && walletHref && topUp) {
          toast.error(msg, {
            action: {
              label: topUp,
              onClick: () => {
                window.location.assign(walletHref);
              },
            },
          });
          return;
        }
        if (msg) toast.error(msg);
        return;
      }
      const hostKey = (isApiClientError(err) ? err.errorKey || "" : "").trim();
      const hostTrustMsg =
        hostKey === "err_host_guarantee_requires_document_kyc"
          ? (chrome?.err_host_guarantee_requires_document_kyc || "").trim()
          : hostKey === "err_host_paid_requires_phone_kyc"
            ? (chrome?.err_host_paid_requires_phone_kyc || "").trim()
            : hostKey === "err_host_concurrent_open_paid_cap"
              ? (chrome?.err_host_concurrent_open_paid_cap || "").trim()
              : hostKey === "err_host_reputation_blocked"
                ? (chrome?.err_host_reputation_blocked || "").trim()
                : "";
      const msg =
        hostTrustMsg ||
        apiToastMessage(err, softHostingToastReopenFailed(chrome?.toast_reopen_failed));
      if (msg) toast.error(msg);
    },
  });
}
