import { cashRmgChromeQueryKey } from "@/hooks/query/useCashRmgChromeQuery";
import { eventsCatalogQueryKey } from "@/hooks/query/useEventsCatalogQuery";
import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { ApiClientError } from "@/lib/api-client-error";
import { apiToastMessage } from "@/lib/api-toast-message";
import { cashGateChromeMessage, isPhoneKycRequiredError } from "@/lib/cash-gate-error";
import { apiRestUrl } from "@/lib/env";
import {
  softHostingPortalPublicListLabel,
  softHostingToastCreateFailed,
  softHostingToastCreated,
} from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents, invalidateWallet } from "@/lib/invalidate";
import { withWalletFocusParam } from "@/lib/wallet-focus-href";
import type { CashRmgPayload } from "@/types/cash-rmg";
import type { CreateHostedEventInput, EventsCatalog, HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CreateHostedEventError = ApiClientError & {
  paymentRequired?: boolean;
  /** DB chrome key from 402/settle body when present. */
  paymentErrorKey?: string;
};

export function useCreateHostedEventMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHostedEventInput) => {
      const res = await fetch(`${apiRestUrl()}/events/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as HostedEvent & {
        error?: string;
        error_key?: string;
      };
      if (!res.ok) {
        // Never put API English / JSON into Error.message - toast maps error_key → DB chrome.
        const errorKey = (typeof json.error_key === "string" ? json.error_key : "").trim();
        const e = new ApiClientError("", {
          status: res.status,
          errorKey,
        }) as CreateHostedEventError;
        e.paymentRequired = res.status === 402;
        e.paymentErrorKey = errorKey || undefined;
        throw e;
      }
      return json as HostedEvent;
    },
    onSuccess: (created, input) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const catalog = qc.getQueryData<EventsCatalog>(eventsCatalogQueryKey());
      void invalidateEvents(qc);
      void invalidateWallet(qc);
      const msg = softHostingToastCreated(chrome?.toast_created || "").trim();
      if (!msg) return;
      // Public cups list under Tournaments → Community (chrome href/label only).
      const vis = (input.visibility || created.visibility || "").trim();
      const pubCode = (catalog?.hosted_event_public_visibility || "public").trim();
      const isPublic = Boolean(pubCode) && vis === pubCode;
      const communityHref = (chrome?.portal_public_list_href || "").trim();
      const communityLabel = softHostingPortalPublicListLabel(
        chrome?.portal_public_list_label || "",
      ).trim();
      if (isPublic && communityHref.startsWith("/") && communityLabel) {
        toast.success(msg, {
          action: {
            label: communityLabel,
            onClick: () => {
              window.location.assign(communityHref);
            },
          },
        });
        return;
      }
      toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const payErr = err as CreateHostedEventError;
      if (payErr.paymentRequired) {
        // DB chrome only: host fee vs prize guarantee shortfall + Open wallet → focus top-up.
        const key = (payErr.paymentErrorKey || payErr.errorKey || "").trim();
        const guarantee =
          key === "insufficient_prize_guarantee" || key === "err_reopen_guarantee_hold_failed";
        const msg = (
          (guarantee ? chrome?.insufficient_prize_guarantee : chrome?.insufficient_host_fee) || ""
        ).trim();
        const topUp = (chrome?.top_up_action || "").trim();
        const walletHref = withWalletFocusParam((chrome?.portal_wallet_href || "").trim(), "topup");
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
        // Caller also reveals inline top-up in the create dialog.
        return;
      }
      const cashPayload = qc.getQueryData<CashRmgPayload>(cashRmgChromeQueryKey());
      const fallback = apiToastMessage(
        err,
        softHostingToastCreateFailed(chrome?.toast_create_failed || "").trim(),
      );
      const hostKey = ((err as CreateHostedEventError).errorKey || "").trim();
      // Host-trust create gates: organizer chrome only (never invent English).
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
      // phone_kyc / age / jurisdiction / … → cash chrome only (never raw API bodies).
      const msg = hostTrustMsg || cashGateChromeMessage(err, cashPayload?.chrome, fallback);
      if (!msg) return;
      if (
        isPhoneKycRequiredError(err) ||
        hostKey === "err_host_paid_requires_phone_kyc" ||
        hostKey === "err_host_guarantee_requires_document_kyc"
      ) {
        const walletHref = (chrome?.portal_wallet_href || "").trim();
        const actionLabel =
          hostKey === "err_host_guarantee_requires_document_kyc"
            ? (cashPayload?.chrome?.doc_kyc_title || "").trim() ||
              (chrome?.portal_wallet_label || "").trim()
            : (cashPayload?.chrome?.phone_kyc_title || "").trim() ||
              (chrome?.portal_wallet_label || "").trim() ||
              (chrome?.top_up_action || "").trim();
        if (walletHref && actionLabel) {
          toast.error(msg, {
            action: {
              label: actionLabel,
              onClick: () => {
                window.location.assign(walletHref);
              },
            },
          });
          return;
        }
      }
      toast.error(msg);
    },
  });
}
