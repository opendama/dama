"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useCheckoutMutation } from "@/hooks/mutation/useCheckoutMutation";
import {
  type JoinHostedEventError,
  useJoinHostedEventMutation,
} from "@/hooks/mutation/useJoinHostedEventMutation";
import { useCashEligibilityQuery } from "@/hooks/query/useCashEligibilityQuery";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useLegalChromeQuery } from "@/hooks/query/useLegalChromeQuery";
import { usePaymentModalChromeQuery } from "@/hooks/query/usePaymentModalChromeQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { cashJurisdictionLockMessage, isCashJurisdictionLocked } from "@/lib/cash-jurisdiction";
import {
  softCommunityJoinStatusMessage,
  softPaymentModalTitle,
} from "@/lib/community-player-chrome-soft";
import { eventJoinErrorChrome, isAlreadyJoinedEventError } from "@/lib/event-join-error";
import { softHostingCancelAction } from "@/lib/hosting-organizer-chrome-soft";
import { type PrizePoolCardLabels, hostedEventPrizePoolLines } from "@/lib/prize-pool-lines";
import { parsePositiveDecimal, sanitizeDecimalInput } from "@/lib/sanitize-decimal-input";
import { eventJoinPlayHref } from "@/lib/tournament-free-join";
import { withWalletFocusParam } from "@/lib/wallet-focus-href";
import { useAuthStore } from "@/store/auth";
import { isCashRmgChromeReady } from "@/types/cash-rmg";
import type { HostedEvent } from "@/types/events";
import { isLegalChromeReady } from "@/types/legal-chrome";
import { isPaymentModalChromeReady } from "@/types/payment-modal-chrome";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type PaymentEventJoinModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: HostedEvent | null;
  prizePoolLabels?: PrizePoolCardLabels;
  /** Fired after successful join so list cards flip to Join → play. */
  onJoined?: (eventId: string) => void;
  /** Events-player chrome strings for join success / errors (fail-closed via caller). */
  joinChrome: {
    pending_approval: string;
    approved_blurb: string;
    already_joined: string;
    insufficient_entry_fee: string;
    top_up_action: string;
    top_up_href: string;
  };
};

/**
 * Tournament PaymentEnrollModal parity for paid hosted events:
 * confirm fee from wallet → join → play lobby.
 */
export function PaymentEventJoinModal({
  open,
  onOpenChange,
  event,
  prizePoolLabels,
  onJoined,
  joinChrome,
}: PaymentEventJoinModalProps) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const chromeQuery = usePaymentModalChromeQuery(open);
  const chrome = isPaymentModalChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const legalQuery = useLegalChromeQuery(open);
  const legal = isLegalChromeReady(legalQuery.data) ? legalQuery.data : undefined;
  const catalogQuery = useEventsCatalogQuery(open);

  const geoQuery = useDetectBrowserCountryQuery(open && Boolean(token));
  const eligibilityQuery = useCashEligibilityQuery(token, open && Boolean(token));
  const country = (eligibilityQuery.data?.country_code || geoQuery.data || "").trim();
  const geoSettled =
    open &&
    Boolean(token) &&
    !geoQuery.isLoading &&
    !geoQuery.isFetching &&
    !eligibilityQuery.isLoading;
  const countryMissing = geoSettled && !country;

  const walletQuery = useWalletQuery(token, open && Boolean(token) && Boolean(country));
  const routeQuery = usePaymentRouteQuery(open && Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const flagsQuery = useRestFeatureFlagsQuery();
  const cashChromeQuery = useCashRmgChromeQuery(open && Boolean(token));
  const cashChrome = isCashRmgChromeReady(cashChromeQuery.data)
    ? cashChromeQuery.data.chrome
    : undefined;
  const cashPolicy = isCashRmgChromeReady(cashChromeQuery.data)
    ? cashChromeQuery.data.policy
    : undefined;
  const flagsSettled = !flagsQuery.isLoading && (flagsQuery.isFetched || flagsQuery.isError);
  const cashEnabled = flagsQuery.data?.cash_rmg_enabled === true;
  const disabledCountries = flagsQuery.data?.cash_rmg_disabled_countries;
  const cashLocked = Boolean(
    event &&
      !event.is_free_entry &&
      isCashJurisdictionLocked({
        flagsSettled,
        cashEnabled,
        country,
        policy: cashPolicy,
        disabledCountryCodes: disabledCountries,
        eligibility: eligibilityQuery.data,
        eligibilityFetched: eligibilityQuery.isFetched,
      }),
  );
  const cashLockMessage = cashJurisdictionLockMessage(cashLocked, country, cashChrome, {
    cashEnabled,
    eligibility: eligibilityQuery.data,
  });

  const join = useJoinHostedEventMutation(token);
  const checkout = useCheckoutMutation(token);
  const [topUpAmount, setTopUpAmount] = useState("");
  const suggestedTopUpRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setTopUpAmount("");
      suggestedTopUpRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !event || event.is_free_entry) return;
    if (!walletQuery.data || suggestedTopUpRef.current) return;
    const fee = event.entry_fee_amount;
    const bal = walletQuery.data.balance;
    if (typeof bal !== "number" || typeof fee !== "number") return;
    if (bal >= fee) return;
    const shortfall = Math.max(fee - bal, fee > 0 ? fee : 0);
    if (shortfall > 0) {
      suggestedTopUpRef.current = true;
      setTopUpAmount(sanitizeDecimalInput(String(shortfall)));
    }
  }, [open, event, walletQuery.data]);

  if (!open) return null;

  if (chromeQuery.isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[230] bg-[var(--dama-overlay)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[231] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-xl focus:outline-none">
            <ShimmerBlock className="h-24 w-full rounded-md" />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!chrome) {
    const unavailable = (chromeQuery.data?.payment_modal_unavailable || "").trim();
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[230] bg-[var(--dama-overlay)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[231] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-xl focus:outline-none">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="sr-only">{unavailable}</Dialog.Title>
              <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p>
              <Dialog.Close className="rounded-md p-1 text-[var(--dama-muted)] hover:bg-[var(--dama-surface)]">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!event) return null;

  if (!token) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[230] bg-[var(--dama-overlay)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[231] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="font-display text-xl font-bold">
              {softPaymentModalTitle(chrome.title)}
            </Dialog.Title>
            <p className="mt-2 text-sm">
              <SignInLink className="text-[var(--dama-gold)] underline" />
            </p>
            <Dialog.Close asChild>
              <Button type="button" variant="outline" className="mt-4">
                {softHostingCancelAction(chrome.cancel_action)}
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  const fee = event.is_free_entry ? 0 : event.entry_fee_amount;
  const feeCurrency = event.entry_fee_currency;
  const balanceRaw = walletQuery.data?.balance;
  const balanceReady = typeof balanceRaw === "number";
  const balance = balanceReady ? balanceRaw : null;
  const balanceCurrency = (walletQuery.data?.currency || "").trim();
  const resolving =
    !event.is_free_entry &&
    (!flagsSettled ||
      !geoSettled ||
      (Boolean(country) && (walletQuery.isLoading || !balanceReady)));
  const canAfford = event.is_free_entry || (balanceReady && balance != null && balance >= fee);
  const topUpValid = parsePositiveDecimal(topUpAmount) != null;
  const goPlayAfterJoin = (eventId: string, pending: boolean) => {
    onJoined?.(eventId);
    onOpenChange(false);
    if (!pending) router.replace(eventJoinPlayHref(eventId));
  };

  const onConfirmJoin = () => {
    if (cashLocked) {
      if (cashLockMessage) toast.error(cashLockMessage);
      return;
    }
    const code = (event.join_code || "").trim();
    if (!code) return;
    join.mutate(
      { code, country_code: country || undefined },
      {
        onSuccess: (data) => {
          const pendingStatus = (catalogQuery.data?.hosted_event_entry_pending || "").trim();
          const isPending = Boolean(pendingStatus && data.entry?.status === pendingStatus);
          toast.success(
            softCommunityJoinStatusMessage(
              isPending ? joinChrome.pending_approval : joinChrome.approved_blurb,
            ),
          );
          const id = (data.event?.id || event.id || "").trim();
          if (id) goPlayAfterJoin(id, isPending);
          else onOpenChange(false);
        },
        onError: (err: unknown) => {
          if (isAlreadyJoinedEventError(err)) {
            const msg = softCommunityJoinStatusMessage(
              (joinChrome.already_joined || "").trim() || (joinChrome.approved_blurb || "").trim(),
            );
            if (msg) toast.success(msg);
            goPlayAfterJoin(event.id, false);
            return;
          }
          const payment = (err as JoinHostedEventError).paymentRequired;
          if (payment) {
            // Stay on modal; wallet shortfall UI already visible when !canAfford.
            const msg =
              softCommunityJoinStatusMessage(joinChrome.insufficient_entry_fee) ||
              eventJoinErrorChrome(err, joinChrome);
            if (msg) toast.error(msg);
            return;
          }
          const msg = eventJoinErrorChrome(err, joinChrome);
          if (msg) toast.error(msg);
        },
      },
    );
  };

  const onCheckout = () => {
    if (cashLocked) {
      if (cashLockMessage) toast.error(cashLockMessage);
      return;
    }
    const n = parsePositiveDecimal(topUpAmount);
    if (n == null || !country) return;
    checkout.mutate({
      amount: n,
      purpose: "wallet_topup",
      country_code: country,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[230] bg-[var(--dama-overlay)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[231] max-h-[90vh] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="font-display text-xl font-bold">
            {softPaymentModalTitle(chrome.title)}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--dama-muted)]">
            {cashLocked
              ? cashLockMessage || softCommunityJoinStatusMessage(chrome.blurb)
              : resolving
                ? chrome.balance_pending
                : countryMissing
                  ? chrome.country_required_hint
                  : canAfford
                    ? softCommunityJoinStatusMessage(chrome.blurb)
                    : softCommunityJoinStatusMessage(chrome.insufficient_blurb)}
          </Dialog.Description>

          {cashLocked ? (
            <p className="mt-4 text-sm text-[var(--dama-danger)]">
              {cashLockMessage || cashChrome?.cash_rmg_unavailable || ""}
            </p>
          ) : null}

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-[var(--dama-muted)]">{chrome.fee_label}</span>
              {prizePoolLabels?.metaSeparator ?? null}
              <span className="font-medium text-[var(--dama-gold)]">
                {(() => {
                  const sep = chrome.amount_currency_separator ?? "";
                  if (event.is_free_entry) return "";
                  if (typeof fee === "number" && feeCurrency && sep.length > 0) {
                    return `${fee}${sep}${feeCurrency}`;
                  }
                  return "";
                })()}
              </span>
            </p>
            {(() => {
              if (prizePoolLabels == null) return null;
              const poolLines = hostedEventPrizePoolLines(event, prizePoolLabels);
              if (poolLines.length === 0) return null;
              return (
                <p className="text-xs text-[var(--dama-muted)]">
                  {poolLines.join(prizePoolLabels.metaSeparator)}
                </p>
              );
            })()}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--dama-muted)]">{chrome.balance_label}</span>
              {prizePoolLabels?.metaSeparator != null &&
              prizePoolLabels.metaSeparator.length > 0 ? (
                <span className="text-[var(--dama-muted)]">{prizePoolLabels.metaSeparator}</span>
              ) : null}
              {resolving ? (
                <ShimmerBlock className="inline-block h-4 w-20 rounded" />
              ) : countryMissing ? (
                <span className="text-[var(--dama-muted)]">{chrome.balance_pending}</span>
              ) : balanceReady &&
                balanceCurrency &&
                (chrome.amount_currency_separator ?? "").length > 0 ? (
                <span className="font-medium">
                  {balance}
                  {chrome.amount_currency_separator}
                  {balanceCurrency}
                </span>
              ) : (
                <span className="text-[var(--dama-muted)]">{chrome.balance_pending}</span>
              )}
            </div>
          </div>

          {cashLocked ? (
            <div className="mt-6">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {softHostingCancelAction(chrome.cancel_action)}
                </Button>
              </Dialog.Close>
            </div>
          ) : resolving ? (
            <div className="mt-6 space-y-3">
              <ShimmerBlock className="h-10 w-full rounded-md" />
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {softHostingCancelAction(chrome.cancel_action)}
                </Button>
              </Dialog.Close>
            </div>
          ) : countryMissing ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-[var(--dama-danger)]">{chrome.country_required_hint}</p>
              <Button asChild variant="gold">
                <Link href={chrome.top_up_href}>{chrome.top_up_action}</Link>
              </Button>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {softHostingCancelAction(chrome.cancel_action)}
                </Button>
              </Dialog.Close>
            </div>
          ) : canAfford ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="gold"
                disabled={!event.is_free_entry && !country}
                isLoading={join.isPending}
                pendingLabel={chrome.confirm_pending}
                onClick={onConfirmJoin}
              >
                {chrome.confirm_action}
              </Button>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {softHostingCancelAction(chrome.cancel_action)}
                </Button>
              </Dialog.Close>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="font-medium text-[var(--dama-gold)]">{chrome.insufficient_title}</p>
              {isManual ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--dama-muted)]">{chrome.methods_blurb}</p>
                  {(chrome.top_up_href || "").trim() ? (
                    <Button asChild variant="gold">
                      <Link href={withWalletFocusParam(chrome.top_up_href, "topup")}>
                        {chrome.top_up_action}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{chrome.methods_title}</p>
                  <p className="text-sm text-[var(--dama-muted)]">{chrome.methods_blurb}</p>
                  <Field id="event-join-topup-amount" label={chrome.amount_label}>
                    <AmountInput
                      id="event-join-topup-amount"
                      value={topUpAmount}
                      onValueChange={setTopUpAmount}
                      placeholder={chrome.amount_placeholder}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="gold"
                      disabled={!country || !topUpValid}
                      isLoading={checkout.isPending}
                      pendingLabel={chrome.checkout_pending}
                      onClick={onCheckout}
                    >
                      {chrome.checkout_action}
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={chrome.top_up_href}>{chrome.top_up_action}</Link>
                    </Button>
                  </div>
                </div>
              )}
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {softHostingCancelAction(chrome.cancel_action)}
                </Button>
              </Dialog.Close>
            </div>
          )}

          {legal ? (
            <nav className="mt-6 flex flex-wrap gap-3 border-t border-[var(--dama-border)] pt-4 text-xs text-[var(--dama-muted)]">
              <Link
                href="/privacy"
                className="hover:text-[var(--dama-gold)] underline-offset-2 hover:underline"
              >
                {legal.privacy_nav_label}
              </Link>
              <Link
                href="/terms"
                className="hover:text-[var(--dama-gold)] underline-offset-2 hover:underline"
              >
                {legal.terms_nav_label}
              </Link>
              <Link
                href="/refunds"
                className="hover:text-[var(--dama-gold)] underline-offset-2 hover:underline"
              >
                {legal.refunds_nav_label}
              </Link>
            </nav>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
