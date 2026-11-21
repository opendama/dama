"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { AgeGateForm } from "@/components/compliance/AgeGateForm";
import { DocumentKycPanel } from "@/components/compliance/DocumentKycPanel";
import { PhoneKycForm } from "@/components/compliance/PhoneKycForm";
import { PortalPageShell } from "@/components/portal/PortalPageShell";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MediaDropzone } from "@/components/ui/media-dropzone";
import { type OpsColumn, OpsDataTable } from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  OpsDataTableSkeleton,
  ShimmerBlock,
  WalletPanelSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { ManualBankAccounts } from "@/components/wallet/ManualBankAccounts";
import { useCheckoutMutation } from "@/hooks/mutation/useCheckoutMutation";
import { useCreatePayoutRequestMutation } from "@/hooks/mutation/useCreatePayoutRequestMutation";
import { usePaymentReceiptMutation } from "@/hooks/mutation/usePaymentReceiptMutation";
import {
  useCreatePayoutMethodMutation,
  useDeletePayoutMethodMutation,
  useUpdatePayoutMethodMutation,
} from "@/hooks/mutation/usePayoutMethodMutations";
import { useUploadReceiptMutation } from "@/hooks/mutation/useUploadReceiptMutation";
import { useBanksQuery } from "@/hooks/query/useBanksQuery";
import {
  cashEligibilityQueryKey,
  useCashEligibilityQuery,
} from "@/hooks/query/useCashEligibilityQuery";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { type MyPayoutRequest, useMyPayoutsQuery } from "@/hooks/query/useMyPayoutsQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { usePayoutMethodsQuery } from "@/hooks/query/usePayoutMethodsQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { useDeferredDialogSelection } from "@/hooks/use-deferred-dialog-selection";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { apiToastMessage } from "@/lib/api-toast-message";
import { isAgeRequiredError, isPhoneKycRequiredError } from "@/lib/cash-gate-error";
import { cashJurisdictionLockMessage, isCashJurisdictionLocked } from "@/lib/cash-jurisdiction";
import { paidStatusTextClass } from "@/lib/payment-status-display";
import { parsePositiveDecimal } from "@/lib/sanitize-decimal-input";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isCashRmgChromeReady } from "@/types/cash-rmg";
import { isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { type PayoutMethod, isManualCheckoutResult } from "@/types/payments";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { HandCoins, IdCard, Phone, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function parsePageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function chromeOpt(chrome: Record<string, unknown> | undefined, key: string): string {
  const v = chrome?.[key];
  return typeof v === "string" ? v : "";
}

export type WalletWorkspaceProps = {
  /** Prefix for sibling money routes, e.g. "/events" or "/ads". Empty = player portal. */
  moneyBasePath?: string;
};

function moneyHref(base: string, path: string): string {
  const b = (base || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return b ? `${b}${p}` : p;
}

type WalletFormKind =
  | "topup"
  | "payout_request"
  | "receipt"
  | "kyc"
  | "age"
  | "phone"
  | "method_create"
  | "method_edit"
  | "method_delete";

function cashGateFormKind(ageBlocked: boolean, phoneBlocked: boolean): "age" | "phone" | null {
  if (ageBlocked) return "age";
  if (phoneBlocked) return "phone";
  return null;
}

/** Full wallet + payout workspace (shared by player, events organizer, ads publisher). */
export function WalletWorkspace({ moneyBasePath = "" }: WalletWorkspaceProps) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusPayoutHistoryId = (searchParams.get("id") || "").trim();
  const focusParam = (searchParams.get("focus") || "").trim().toLowerCase();
  const focusPayoutForm = focusParam === "payout" && !focusPayoutHistoryId;
  const focusReceiptForm = focusParam === "receipt" && !focusPayoutHistoryId;
  const focusTopUpForm = focusParam === "topup" && !focusPayoutHistoryId;

  const formDialog = useDeferredDialogSelection();
  const openForm = useCallback(
    (kind: WalletFormKind) => formDialog.openWith(kind),
    [formDialog.openWith],
  );

  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [provider, setProvider] = useState("");
  const [accountName, setAccountName] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  /** Smart Menu-style top-up step: stay on formKind=topup, flip content (no Radix remount dismiss). */
  const [topupStep, setTopupStep] = useState<"amount" | "manual_instructions">("amount");
  /** After submit attempt - highlight empty required fields (chrome errors only). */
  const [formAttempted, setFormAttempted] = useState(false);
  const queryClient = useQueryClient();
  const [payoutHistorySkip, setPayoutHistorySkip] = useUrlSkip("payouts_skip");
  const [methodsSkip, setMethodsSkip] = useUrlSkip("methods_skip");
  const [activeMethod, setActiveMethod] = useState<PayoutMethod | null>(null);

  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const geoCountry = (geoQuery.data ?? "").trim().toUpperCase();
  const geoReady = geoQuery.isFetched;

  const walletQuery = useWalletQuery(token, Boolean(token) && geoReady);
  const country = (
    geoCountry || (walletQuery.data?.country_code || "").trim().toUpperCase()
  ).trim();
  const routeQuery = usePaymentRouteQuery(Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const banksQuery = useBanksQuery(Boolean(country) && isManual);
  const walletChromeQuery = useWalletChromeQuery(Boolean(token));
  const chrome = isWalletChromeReady(walletChromeQuery.data) ? walletChromeQuery.data : undefined;
  const payoutHistoryPageSize = parsePageSize(chrome?.payout_history_page_size);
  const payoutMethodsPageSize = parsePageSize(chrome?.payout_methods_page_size);
  const payoutHistoryQuery = useMyPayoutsQuery(
    token,
    payoutHistorySkip,
    payoutHistoryPageSize,
    Boolean(token) && Boolean(chrome) && payoutHistoryPageSize > 0,
    focusPayoutHistoryId || undefined,
  );
  const payoutMethodsQuery = usePayoutMethodsQuery(
    token,
    methodsSkip,
    payoutMethodsPageSize,
    Boolean(token) && Boolean(chrome) && payoutMethodsPageSize > 0,
  );
  const eligibilityQuery = useCashEligibilityQuery(token, Boolean(token) && Boolean(chrome));
  // Server-authoritative: do not wait for DocumentKycPanel mount (payout dialog alone).
  const docKycApproved = eligibilityQuery.data?.document_kyc_approved === true;
  const flagsQuery = useRestFeatureFlagsQuery();
  const cashChromeQuery = useCashRmgChromeQuery(Boolean(token));
  const mediaChromeQuery = useMediaUploadChromeQuery(Boolean(token));
  const cashChrome = isCashRmgChromeReady(cashChromeQuery.data)
    ? cashChromeQuery.data.chrome
    : undefined;
  const mediaChrome = isMediaUploadChromeReady(mediaChromeQuery.data)
    ? mediaChromeQuery.data
    : undefined;
  const flagsSettled = !flagsQuery.isLoading && (flagsQuery.isFetched || flagsQuery.isError);
  const cashEnabled = flagsQuery.data?.cash_rmg_enabled === true;
  const disabledCountries = flagsQuery.data?.cash_rmg_disabled_countries;
  const cashPolicy = isCashRmgChromeReady(cashChromeQuery.data)
    ? cashChromeQuery.data.policy
    : undefined;
  const eligibilityCountry = (eligibilityQuery.data?.country_code || "").trim();
  const gateCountry = eligibilityCountry || country;
  const cashLocked = isCashJurisdictionLocked({
    flagsSettled,
    cashEnabled,
    country: gateCountry,
    policy: cashPolicy,
    disabledCountryCodes: disabledCountries,
    eligibility: eligibilityQuery.data,
    eligibilityFetched: eligibilityQuery.isFetched,
  });
  const cashLockMessage = cashJurisdictionLockMessage(cashLocked, gateCountry, cashChrome, {
    cashEnabled,
    eligibility: eligibilityQuery.data,
  });
  const eligibilityKey = (eligibilityQuery.data?.error_key || "").trim();
  const ageBlocked = eligibilityQuery.isFetched && eligibilityKey === "age_required";
  const phoneBlocked = eligibilityQuery.isFetched && eligibilityKey === "phone_kyc";
  const cashActionBlocked = cashLocked || ageBlocked || phoneBlocked;
  const ageRequiredMessage = (cashChrome?.age_required_error || "").trim();
  const phoneRequiredMessage = (cashChrome?.phone_kyc_required_error || "").trim();
  const ageGateOpenLabel = (chrome?.age_gate_open_action || "").trim();
  const phoneGateOpenLabel = (
    chrome?.phone_kyc_open_action ||
    cashChrome?.phone_kyc_title ||
    ""
  ).trim();

  const checkout = useCheckoutMutation(token);
  const receipt = usePaymentReceiptMutation(token);
  const uploadReceipt = useUploadReceiptMutation(token);
  const createPayoutMethod = useCreatePayoutMethodMutation(token);
  const updatePayoutMethod = useUpdatePayoutMethodMutation(token);
  const deletePayoutMethod = useDeletePayoutMethodMutation(token);
  const createPayoutRequest = useCreatePayoutRequestMutation(token);

  const walletCurrency = walletQuery.data?.currency ?? routeQuery.data?.currency ?? "";
  const listedMethods = payoutMethodsQuery.data?.methods ?? [];
  const firstListedMethod = listedMethods[0];
  const hasPayoutMethod = Boolean(firstListedMethod?.id);

  useEffect(() => {
    const kind = formDialog.selectedId as WalletFormKind | "";
    if (kind === "method_edit" && activeMethod) {
      setProvider(activeMethod.provider ?? "");
      setAccountName(activeMethod.account_name ?? "");
      setPayoutPhone(activeMethod.phone ?? "");
      return;
    }
    if (kind === "method_create") {
      setProvider("");
      setAccountName("");
      setPayoutPhone("");
    }
  }, [formDialog.selectedId, activeMethod]);

  const focusOpened = useRef(false);
  useEffect(() => {
    if (!chrome || focusOpened.current || ageBlocked || phoneBlocked) return;
    if (focusPayoutForm) {
      focusOpened.current = true;
      openForm("payout_request");
      return;
    }
    // Standalone receipt/transfer lives on Manual Transfer page (ET geo only).
    if (focusReceiptForm && isManual) {
      const hrefRaw = chromeOpt(
        chrome as unknown as Record<string, unknown>,
        "link_manual_transfer_href",
      ).trim();
      if (!hrefRaw) return;
      focusOpened.current = true;
      router.push(moneyHref(moneyBasePath, hrefRaw));
      return;
    }
    if (focusTopUpForm) {
      focusOpened.current = true;
      setTopupStep("amount");
      openForm("topup");
    }
  }, [
    focusPayoutForm,
    focusReceiptForm,
    focusTopUpForm,
    isManual,
    chrome,
    ageBlocked,
    phoneBlocked,
    openForm,
    router,
    moneyBasePath,
  ]);

  // Age / phone required: open verify dialog once (never toast raw API JSON bodies).
  const agePromptOpened = useRef(false);
  useEffect(() => {
    if (!ageBlocked || !chrome || !cashChrome || agePromptOpened.current) return;
    agePromptOpened.current = true;
    openForm("age");
  }, [ageBlocked, chrome, cashChrome, openForm]);

  const phonePromptOpened = useRef(false);
  useEffect(() => {
    if (!phoneBlocked || !chrome || !cashChrome || phonePromptOpened.current) return;
    phonePromptOpened.current = true;
    openForm("phone");
  }, [phoneBlocked, chrome, cashChrome, openForm]);

  useEffect(() => {
    if (
      isAgeRequiredError(checkout.error) ||
      isAgeRequiredError(createPayoutRequest.error) ||
      isAgeRequiredError(receipt.error)
    ) {
      openForm("age");
      return;
    }
    if (
      isPhoneKycRequiredError(checkout.error) ||
      isPhoneKycRequiredError(createPayoutRequest.error) ||
      isPhoneKycRequiredError(receipt.error)
    ) {
      openForm("phone");
    }
  }, [checkout.error, createPayoutRequest.error, receipt.error, openForm]);

  useEffect(() => {
    if (!focusPayoutHistoryId || !chrome) return;
    if (payoutHistoryQuery.isLoading) return;
    const el = document.getElementById(`ops-row-${focusPayoutHistoryId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusPayoutHistoryId, chrome, payoutHistoryQuery.isLoading]);

  const historySeekApplied = useRef(false);
  useEffect(() => {
    if (!focusPayoutHistoryId) {
      historySeekApplied.current = false;
      return;
    }
    if (historySeekApplied.current) return;
    if (payoutHistorySkip !== 0) return;
    const metaSkip = payoutHistoryQuery.data?.meta?.skip;
    if (typeof metaSkip === "number" && Number.isFinite(metaSkip) && metaSkip > 0) {
      historySeekApplied.current = true;
      setPayoutHistorySkip(metaSkip);
    } else if (typeof metaSkip === "number" && metaSkip === 0) {
      historySeekApplied.current = true;
    }
  }, [
    focusPayoutHistoryId,
    payoutHistoryQuery.data?.meta?.skip,
    payoutHistorySkip,
    setPayoutHistorySkip,
  ]);

  const panelLoading =
    !flagsSettled ||
    !geoReady ||
    geoQuery.isLoading ||
    (Boolean(token) && eligibilityQuery.isLoading) ||
    (Boolean(country) && (walletQuery.isLoading || routeQuery.isLoading));

  const chromeRecord = chrome as unknown as Record<string, unknown> | undefined;
  const emptyVal = chromeOpt(chromeRecord, "empty_value").trim();
  const sep = chromeOpt(chromeRecord, "amount_currency_separator");
  const closeLabel = (chrome?.dialog_close_label || "").trim();
  const cancelLabel = (chrome?.cancel_action || "").trim();

  const methodColumns = useMemo((): OpsColumn<PayoutMethod>[] => {
    if (!chrome) return [];
    const providerLabel = (chrome.payout_provider_label || "").trim();
    const accountLabel = (chrome.payout_account_label || "").trim();
    const phoneLabel = (chrome.payout_phone_label || "").trim();
    const actionsLabel = (chrome.payout_methods_actions_label || "").trim();
    const editLabel = (chrome.payout_method_edit_action || "").trim();
    const deleteLabel = (chrome.payout_method_delete_action || "").trim();
    if (!providerLabel || !accountLabel || !phoneLabel || !actionsLabel) return [];

    const cols: OpsColumn<PayoutMethod>[] = [
      {
        id: "provider",
        header: providerLabel,
        cell: (m) => (m.provider || "").trim() || emptyVal,
      },
      {
        id: "account_name",
        header: accountLabel,
        cell: (m) => (m.account_name || "").trim() || emptyVal,
      },
      {
        id: "phone",
        header: phoneLabel,
        cell: (m) => (m.phone || "").trim() || emptyVal,
      },
    ];

    if (editLabel || deleteLabel) {
      cols.push({
        id: "actions",
        header: actionsLabel,
        className: "w-12",
        cell: (m) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              ...(editLabel
                ? [
                    {
                      id: "edit",
                      label: editLabel,
                      onSelect: () => {
                        setActiveMethod(m);
                        openForm("method_edit");
                      },
                    },
                  ]
                : []),
              ...(deleteLabel
                ? [
                    {
                      id: "delete",
                      label: deleteLabel,
                      destructive: true,
                      isLoading:
                        deletePayoutMethod.isPending && deletePayoutMethod.variables === m.id,
                      pendingLabel: deleteLabel,
                      onSelect: () => {
                        setActiveMethod(m);
                        openForm("method_delete");
                      },
                    },
                  ]
                : []),
            ]}
          />
        ),
      });
    }

    return cols;
  }, [chrome, deletePayoutMethod.isPending, deletePayoutMethod.variables, emptyVal, openForm]);

  const payoutColumns = useMemo((): OpsColumn<MyPayoutRequest>[] => {
    if (!chrome) return [];
    const histAmount = chromeOpt(chromeRecord, "payout_history_amount_label").trim();
    const histStatus = chromeOpt(chromeRecord, "payout_history_status_label").trim();
    const histDate = chromeOpt(chromeRecord, "payout_history_date_label").trim();
    const histProvider = chromeOpt(chromeRecord, "payout_provider_label").trim();
    const histPhone = chromeOpt(chromeRecord, "payout_phone_label").trim();
    const histNote = chromeOpt(chromeRecord, "payout_history_note_label").trim();
    if (!histAmount || !histStatus || !histDate || !histProvider || !histPhone) return [];

    const statusLabel = (p: MyPayoutRequest) => {
      const stamped = (p.status_label || "").trim();
      if (stamped) return stamped;
      const code = (p.status || "").trim().toLowerCase();
      const labeled = code ? chromeOpt(chromeRecord, `list_status_${code}`).trim() : "";
      return labeled || emptyVal;
    };

    return [
      {
        id: "amount",
        header: histAmount,
        cell: (p) =>
          typeof p.amount === "number" && (p.currency || "").trim() ? (
            <span className="font-mono text-[var(--dama-gold)]">
              {p.amount}
              {sep}
              {p.currency}
            </span>
          ) : (
            emptyVal
          ),
      },
      {
        id: "status",
        header: histStatus,
        cell: (p) => (
          <span className={paidStatusTextClass((p.status || "").trim())}>{statusLabel(p)}</span>
        ),
      },
      {
        id: "date",
        header: histDate,
        cell: (p) => (p.created_at || "").trim() || emptyVal,
      },
      {
        id: "provider",
        header: histProvider,
        cell: (p) => (p.provider || "").trim() || emptyVal,
      },
      {
        id: "phone",
        header: histPhone,
        cell: (p) => (p.phone || "").trim() || emptyVal,
      },
      {
        id: "note",
        header: histNote,
        cell: (p) => (p.review_note || "").trim() || emptyVal,
        className: "max-w-[14rem] truncate",
      },
    ];
  }, [chrome, chromeRecord, emptyVal, sep]);

  if (!hydrated || walletChromeQuery.isLoading || !flagsSettled) {
    return (
      <div className="w-full space-y-4">
        <WalletPanelSkeleton />
      </div>
    );
  }

  if (!chrome) {
    const unavailable = (
      walletChromeQuery.data?.wallet_chrome_unavailable ||
      (walletChromeQuery.error instanceof Error ? walletChromeQuery.error.message : "") ||
      ""
    ).trim();
    return (
      <div className="w-full space-y-4">
        {unavailable ? (
          <p className="text-sm text-[var(--dama-muted)]" role="alert">
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  if (!token) {
    return (
      <PortalPageShell title={chrome.page_title}>
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </PortalPageShell>
    );
  }

  const transactionsHrefRaw = chromeOpt(chromeRecord, "link_transactions_href").trim();
  const receiptsHrefRaw = chromeOpt(chromeRecord, "link_receipts_href").trim();
  const transferHrefRaw = chromeOpt(chromeRecord, "link_manual_transfer_href").trim();
  const transactionsHref = transactionsHrefRaw ? moneyHref(moneyBasePath, transactionsHrefRaw) : "";
  const receiptsHref = receiptsHrefRaw ? moneyHref(moneyBasePath, receiptsHrefRaw) : "";
  const transferHref = transferHrefRaw ? moneyHref(moneyBasePath, transferHrefRaw) : "";
  const transactionsLabel = (chrome.link_transactions_label || "").trim();
  const receiptsLabel = (chrome.link_receipts_label || "").trim();
  const transferLabel = chromeOpt(chromeRecord, "link_manual_transfer_label").trim();
  const histTitle = chromeOpt(chromeRecord, "payout_history_title").trim();
  const histEmpty = chromeOpt(chromeRecord, "payout_history_empty").trim();
  const histFailed = chromeOpt(chromeRecord, "payout_history_load_failed").trim();
  const methodsEmpty = (chrome.payout_methods_empty || "").trim();
  const methodsFailed = (chrome.payout_methods_load_failed || "").trim();
  const methodsSectionTitle = (chrome.payout_method_section || "").trim();
  const methodsAddLabel = (chrome.payout_method_add_action || "").trim();
  const kycTitle = (cashChrome?.doc_kyc_title || "").trim();
  const ageGateTitle = (cashChrome?.age_gate_title || "").trim();
  const phoneGateTitle = (cashChrome?.phone_kyc_title || "").trim();
  const softHistoryFetching = payoutHistoryQuery.isFetching && !payoutHistoryQuery.isLoading;
  const softMethodsFetching = payoutMethodsQuery.isFetching && !payoutMethodsQuery.isLoading;
  const formKind = formDialog.selectedId as WalletFormKind | "";

  const formTitle =
    formKind === "topup" && topupStep === "manual_instructions"
      ? (chrome.submit_receipt_title || "").trim()
      : formKind === "topup"
        ? (chrome.top_up_action || "").trim()
        : formKind === "payout_request"
          ? (chrome.payout_request_section || "").trim()
          : formKind === "receipt"
            ? (chrome.submit_receipt_title || "").trim()
            : formKind === "kyc"
              ? kycTitle
              : formKind === "age"
                ? ageGateTitle
                : formKind === "phone"
                  ? phoneGateTitle
                  : formKind === "method_create"
                    ? methodsAddLabel
                    : formKind === "method_edit"
                      ? (chrome.payout_method_edit_action || "").trim()
                      : formKind === "method_delete"
                        ? (chrome.payout_method_delete_action || "").trim()
                        : "";

  const closeFormDialog = () => {
    formDialog.close();
    setActiveMethod(null);
    setFormAttempted(false);
    setTopupStep("amount");
    setAmount("");
    setReceiptUrl("");
    setPayoutAmount("");
    setProvider("");
    setAccountName("");
    setPayoutPhone("");
  };

  const submitManualReceipt = () => {
    if (cashActionBlocked) {
      if (cashLockMessage && cashLocked) toast.error(cashLockMessage);
      return;
    }
    const n = Number(amount);
    const amountBad = !Number.isFinite(n) || n <= 0;
    const imageBad = !receiptUrl.trim();
    if (amountBad || imageBad || !country) {
      setFormAttempted(true);
      return;
    }
    receipt.mutate(
      {
        amount: n,
        currency: routeQuery.data?.currency,
        receipt_url: receiptUrl,
        country_code: country,
      },
      { onSuccess: () => closeFormDialog() },
    );
  };

  const manualBanksBlock = (
    <ManualBankAccounts
      chrome={chrome}
      banks={banksQuery.data ?? []}
      loading={banksQuery.isLoading}
    />
  );

  const manualReceiptFields = (
    <>
      <Field
        id="wallet-receipt-amount"
        label={chrome.top_up_amount_label}
        error={
          formAttempted && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
            ? (chrome.invalid_top_up_amount || "").trim()
            : undefined
        }
      >
        <AmountInput
          id="wallet-receipt-amount"
          value={amount}
          onValueChange={setAmount}
          placeholder={chrome.top_up_amount_placeholder}
          disabled={cashActionBlocked}
          aria-invalid={
            formAttempted && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
              ? true
              : undefined
          }
        />
      </Field>
      {mediaChrome ? (
        <MediaDropzone
          id="wallet-receipt-file"
          label={chrome.receipt_image_label || ""}
          chrome={mediaChrome}
          disabled={cashActionBlocked}
          busy={uploadReceipt.isPending}
          invalid={formAttempted && !receiptUrl.trim()}
          error={
            formAttempted && !receiptUrl.trim()
              ? (chrome.receipt_upload_failed || "").trim()
              : undefined
          }
          previewUrl={receiptUrl}
          onClear={() => setReceiptUrl("")}
          onFile={async (file) => {
            await new Promise<void>((resolve, reject) => {
              uploadReceipt.mutate(file, {
                onSuccess: (url) => {
                  setReceiptUrl(url);
                  resolve();
                },
                onError: (err) => {
                  const msg = apiToastMessage(err, chrome.receipt_upload_failed);
                  if (msg) toast.error(msg);
                  reject(err);
                },
              });
            });
          }}
        />
      ) : (
        <p className="text-sm text-[var(--dama-danger)]" role="alert">
          {(mediaChromeQuery.data?.media_upload_unavailable || "").trim()}
        </p>
      )}
    </>
  );

  return (
    <PortalPageShell
      title={chrome.page_title}
      actions={
        <>
          {transactionsLabel && transactionsHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={transactionsHref}>{transactionsLabel}</Link>
            </Button>
          ) : null}
          {receiptsLabel && receiptsHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={receiptsHref}>{receiptsLabel}</Link>
            </Button>
          ) : null}
          {isManual && transferLabel && transferHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={transferHref}>{transferLabel}</Link>
            </Button>
          ) : null}
        </>
      }
    >
      {panelLoading ? <WalletPanelSkeleton embedded /> : null}

      {!panelLoading && ageBlocked ? (
        <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)]">
          {ageRequiredMessage ? (
            <p className="text-sm text-[var(--dama-danger)]">{ageRequiredMessage}</p>
          ) : null}
          {ageGateOpenLabel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={ageRequiredMessage ? "mt-3" : undefined}
              onClick={() => openForm("age")}
            >
              {ageGateOpenLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!panelLoading && phoneBlocked ? (
        <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)]">
          {phoneRequiredMessage ? (
            <p className="text-sm text-[var(--dama-danger)]">{phoneRequiredMessage}</p>
          ) : null}
          {phoneGateOpenLabel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={phoneRequiredMessage ? "mt-3" : undefined}
              onClick={() => openForm("phone")}
            >
              {phoneGateOpenLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!panelLoading && country ? (
        <>
          <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
            <p className="text-sm text-[var(--dama-muted)]">{chrome.balance_label}</p>
            {walletQuery.data &&
            typeof walletQuery.data.balance === "number" &&
            (walletQuery.data.currency || "").trim() ? (
              <p className="mt-1 font-display text-2xl font-bold text-[var(--dama-gold)]">
                {walletQuery.data.balance}
                {chrome.amount_currency_separator}
                {walletQuery.data.currency}
              </p>
            ) : walletQuery.isError ? (
              <p className="mt-1 text-sm text-[var(--dama-danger)]">{chrome.wallet_load_failed}</p>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-sm text-[var(--dama-muted)]">{chrome.balance_pending}</p>
                <ShimmerBlock className="h-8 w-32 rounded-md" />
              </div>
            )}
            {routeQuery.data ? (
              <p className="mt-2 text-xs text-[var(--dama-muted)]">
                {chrome.payment_route_prefix}
                {chrome.payment_route_separator}
                {routeQuery.data.provider}
                {chrome.payment_route_separator}
                {routeQuery.data.currency}
                {chrome.payment_route_separator}
                {country}
              </p>
            ) : null}
            {cashLocked ? (
              <p className="mt-3 text-sm text-[var(--dama-danger)]">
                {cashLockMessage || cashChrome?.cash_rmg_unavailable || ""}
              </p>
            ) : null}
            {ageBlocked && ageGateOpenLabel ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                className="mt-3"
                onClick={() => openForm("age")}
              >
                {ageGateOpenLabel}
              </Button>
            ) : null}
            {phoneBlocked && phoneGateOpenLabel ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                className="mt-3"
                onClick={() => openForm("phone")}
              >
                <Phone className="mr-1.5 h-4 w-4" aria-hidden />
                {phoneGateOpenLabel}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(chrome.top_up_action || "").trim() ? (
              <Button
                type="button"
                variant="gold"
                className="gap-2"
                disabled={cashLocked}
                onClick={() => {
                  const gate = cashGateFormKind(ageBlocked, phoneBlocked);
                  if (!gate) setTopupStep("amount");
                  openForm(gate ?? "topup");
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {chrome.top_up_action}
              </Button>
            ) : null}
            {(chrome.payout_request_action || "").trim() ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={cashLocked}
                onClick={() =>
                  openForm(cashGateFormKind(ageBlocked, phoneBlocked) ?? "payout_request")
                }
              >
                <HandCoins className="h-4 w-4" aria-hidden />
                {chrome.payout_request_action}
              </Button>
            ) : null}
            {isManual && (chrome.submit_receipt_action || "").trim() && transferHref ? (
              cashLocked ? (
                <Button type="button" variant="outline" className="gap-2" disabled>
                  <Receipt className="h-4 w-4" aria-hidden />
                  {chrome.submit_receipt_action}
                </Button>
              ) : (
                <Button asChild variant="outline" className="gap-2">
                  <Link href={transferHref}>
                    <Receipt className="h-4 w-4" aria-hidden />
                    {chrome.submit_receipt_action}
                  </Link>
                </Button>
              )
            ) : null}
            {kycTitle ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => openForm("kyc")}
              >
                <IdCard className="h-4 w-4" aria-hidden />
                {kycTitle}
              </Button>
            ) : null}
          </div>

          {methodsSectionTitle &&
          methodsEmpty &&
          methodsFailed &&
          payoutMethodsPageSize > 0 &&
          methodColumns.length > 0 ? (
            <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
              <div className="flex flex-col gap-3 border-b border-[var(--dama-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">{methodsSectionTitle}</p>
                {methodsAddLabel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setActiveMethod(null);
                      openForm("method_create");
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {methodsAddLabel}
                  </Button>
                ) : null}
              </div>
              {payoutMethodsQuery.isLoading ? (
                <div className="p-2">
                  <OpsDataTableSkeleton columns={methodColumns.length} rows={6} embedded />
                </div>
              ) : payoutMethodsQuery.isError ? (
                <p className="p-4 text-sm text-[var(--dama-danger)]">{methodsFailed}</p>
              ) : (
                <OpsDataTable
                  className="rounded-none border-0"
                  columns={methodColumns}
                  data={listedMethods}
                  getRowId={(m) => m.id}
                  isFetching={softMethodsFetching}
                  meta={payoutMethodsQuery.data?.meta}
                  onPage={setMethodsSkip}
                  pageDisabled={softMethodsFetching}
                  pageInputId="wallet-payout-methods-skip"
                  empty={<span>{methodsEmpty}</span>}
                />
              )}
            </div>
          ) : null}

          {histTitle && histEmpty && payoutHistoryPageSize > 0 && payoutColumns.length > 0 ? (
            <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
              <div className="border-b border-[var(--dama-border)] p-4">
                <p className="text-sm font-medium">{histTitle}</p>
              </div>
              {payoutHistoryQuery.isLoading ? (
                <div className="p-2">
                  <OpsDataTableSkeleton columns={payoutColumns.length} rows={6} embedded />
                </div>
              ) : payoutHistoryQuery.isError ? (
                <p className="p-4 text-sm text-[var(--dama-danger)]">{histFailed}</p>
              ) : (
                <OpsDataTable
                  className="rounded-none border-0"
                  columns={payoutColumns}
                  data={payoutHistoryQuery.data?.payouts ?? []}
                  getRowId={(p) => p.id}
                  focusedRowId={focusPayoutHistoryId || undefined}
                  isFetching={softHistoryFetching}
                  meta={payoutHistoryQuery.data?.meta}
                  onPage={setPayoutHistorySkip}
                  pageDisabled={softHistoryFetching}
                  pageInputId="wallet-payout-history-skip"
                  empty={<span>{histEmpty}</span>}
                />
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {!panelLoading && !country ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--dama-danger)]">{chrome.location_currency_unresolved}</p>
          {(chrome.detect_location_action || "").trim() ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={geoQuery.isFetching}
              pendingLabel={(chrome.detect_location_pending || "").trim() || undefined}
              onClick={() => {
                void geoQuery.refetch();
              }}
            >
              {chrome.detect_location_action}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={formDialog.open}
        onOpenChange={(next) => {
          if (!next) {
            closeFormDialog();
            return;
          }
          formDialog.onOpenChange(next);
        }}
      >
        <DialogContent
          className={
            formKind === "kyc" || formKind === "topup" || formKind === "receipt"
              ? "max-w-lg sm:max-w-xl"
              : formKind === "age" || formKind === "phone"
                ? "max-w-lg sm:max-w-md"
                : "max-w-lg sm:max-w-lg"
          }
          closeLabel={closeLabel || undefined}
        >
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription className="sr-only">{formTitle}</DialogDescription>
          </DialogHeader>

          {formKind === "topup" && topupStep === "amount" ? (
            <form
              id="wallet-topup-form"
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (cashActionBlocked) {
                  if (cashLockMessage && cashLocked) toast.error(cashLockMessage);
                  return;
                }
                const n = parsePositiveDecimal(amount);
                if (n == null) {
                  setFormAttempted(true);
                  return;
                }
                checkout.mutate(
                  {
                    amount: n,
                    purpose: "wallet_topup",
                    country_code: country,
                  },
                  {
                    onSuccess: (res) => {
                      // Manual route: finish on dedicated Manual Transfer page (banks + receipt).
                      if (isManualCheckoutResult(res)) {
                        closeFormDialog();
                        if (transferHref) {
                          const paid =
                            typeof res.intent?.amount === "number" && res.intent.amount > 0
                              ? String(res.intent.amount)
                              : amount.trim();
                          const params = new URLSearchParams();
                          if (paid) params.set("amount", paid);
                          const intentId = (res.intent?.id || "").trim();
                          if (intentId) params.set("intent_id", intentId);
                          const q = params.toString();
                          router.push(q ? `${transferHref}?${q}` : transferHref);
                        }
                        return;
                      }
                      // Gateway URL: mutation assigns location; clear amount dialog.
                      closeFormDialog();
                    },
                  },
                );
              }}
            >
              <Field
                id="wallet-topup-amount"
                label={chrome.top_up_amount_label}
                error={
                  formAttempted && parsePositiveDecimal(amount) == null
                    ? (chrome.invalid_top_up_amount || "").trim()
                    : undefined
                }
              >
                <AmountInput
                  id="wallet-topup-amount"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder={chrome.top_up_amount_placeholder}
                  disabled={cashActionBlocked}
                  aria-invalid={
                    formAttempted && parsePositiveDecimal(amount) == null ? true : undefined
                  }
                />
              </Field>
            </form>
          ) : null}
          {formKind === "topup" && topupStep === "amount" ? (
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => closeFormDialog()}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                form="wallet-topup-form"
                variant="gold"
                isLoading={checkout.isPending}
                pendingLabel={chrome.top_up_pending}
                disabled={cashActionBlocked || !country}
              >
                {chrome.top_up_action}
              </Button>
            </DialogFooter>
          ) : null}

          {formKind === "topup" && topupStep === "manual_instructions" ? (
            <div className="grid gap-4">
              {manualBanksBlock}
              <form
                id="wallet-receipt-form"
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitManualReceipt();
                }}
              >
                {manualReceiptFields}
              </form>
            </div>
          ) : null}
          {formKind === "topup" && topupStep === "manual_instructions" ? (
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => closeFormDialog()}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                form="wallet-receipt-form"
                variant="gold"
                isLoading={receipt.isPending || uploadReceipt.isPending}
                pendingLabel={chrome.submit_receipt_pending}
                disabled={cashActionBlocked || !country}
              >
                {chrome.submit_receipt_action}
              </Button>
            </DialogFooter>
          ) : null}

          {formKind === "payout_request" ? (
            <form
              id="wallet-payout-form"
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (cashActionBlocked) {
                  if (cashLockMessage && cashLocked) toast.error(cashLockMessage);
                  return;
                }
                const requireDoc =
                  cashChromeQuery.data?.policy?.require_document_kyc_for_payout === true;
                if (requireDoc && !docKycApproved) {
                  const msg = (chrome.document_kyc_required || "").trim();
                  if (msg) toast.error(msg);
                  return;
                }
                const methodId = (firstListedMethod?.id || "").trim();
                if (!methodId || !walletCurrency) return;
                const n = Number(payoutAmount);
                if (!Number.isFinite(n) || n <= 0) {
                  setFormAttempted(true);
                  return;
                }
                createPayoutRequest.mutate(
                  {
                    amount: n,
                    currency: walletCurrency,
                    country_code: country,
                    method_id: methodId,
                  },
                  { onSuccess: () => closeFormDialog() },
                );
              }}
            >
              {!hasPayoutMethod ? (
                <p className="text-sm text-[var(--dama-muted)]">{methodsEmpty}</p>
              ) : firstListedMethod ? (
                <p className="text-xs text-[var(--dama-muted)]">
                  {(firstListedMethod.phone || "").trim()}
                  {firstListedMethod.provider
                    ? `${chrome.paren_open}${firstListedMethod.provider}${chrome.paren_close}`
                    : ""}
                </p>
              ) : null}
              {cashChromeQuery.data?.policy?.require_document_kyc_for_payout === true &&
              !docKycApproved ? (
                <p className="text-sm text-[var(--dama-muted)]">{chrome.document_kyc_required}</p>
              ) : null}
              <Field
                id="wallet-payout-amount"
                label={`${chrome.payout_amount_label}${
                  walletCurrency ? `${chrome.paren_open}${walletCurrency}${chrome.paren_close}` : ""
                }`}
                error={
                  formAttempted &&
                  (!Number.isFinite(Number(payoutAmount)) || Number(payoutAmount) <= 0)
                    ? (
                        chrome.payout_amount_currency_required ||
                        chrome.invalid_top_up_amount ||
                        ""
                      ).trim()
                    : undefined
                }
              >
                <AmountInput
                  id="wallet-payout-amount"
                  value={payoutAmount}
                  onValueChange={setPayoutAmount}
                  placeholder={chrome.payout_amount_placeholder}
                  disabled={
                    !hasPayoutMethod ||
                    (cashChromeQuery.data?.policy?.require_document_kyc_for_payout === true &&
                      !docKycApproved)
                  }
                  aria-invalid={
                    formAttempted &&
                    (!Number.isFinite(Number(payoutAmount)) || Number(payoutAmount) <= 0)
                      ? true
                      : undefined
                  }
                />
              </Field>
            </form>
          ) : null}
          {formKind === "payout_request" ? (
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => closeFormDialog()}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                form="wallet-payout-form"
                variant="gold"
                isLoading={createPayoutRequest.isPending}
                pendingLabel={chrome.payout_request_pending}
                disabled={
                  cashActionBlocked ||
                  !hasPayoutMethod ||
                  (cashChromeQuery.data?.policy?.require_document_kyc_for_payout === true &&
                    !docKycApproved) ||
                  !walletCurrency ||
                  payoutMethodsQuery.isLoading
                }
              >
                {chrome.payout_request_action}
              </Button>
            </DialogFooter>
          ) : null}

          {formKind === "receipt" ? (
            <div className="grid gap-4">
              {manualBanksBlock}
              <form
                id="wallet-receipt-standalone-form"
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitManualReceipt();
                }}
              >
                {manualReceiptFields}
              </form>
            </div>
          ) : null}
          {formKind === "receipt" ? (
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => closeFormDialog()}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                form="wallet-receipt-standalone-form"
                variant="gold"
                isLoading={receipt.isPending || uploadReceipt.isPending}
                pendingLabel={chrome.submit_receipt_pending}
                disabled={cashActionBlocked || !country}
              >
                {chrome.submit_receipt_action}
              </Button>
            </DialogFooter>
          ) : null}

          {formKind === "kyc" ? (
            <div className="max-h-[min(70dvh,36rem)] overflow-y-auto overscroll-contain">
              <DocumentKycPanel
                embedded
                onApprovedChange={() => {
                  void queryClient.invalidateQueries({
                    queryKey: cashEligibilityQueryKey(token),
                  });
                }}
              />
            </div>
          ) : null}

          {formKind === "age" ? <AgeGateForm onVerified={() => closeFormDialog()} /> : null}

          {formKind === "phone" ? <PhoneKycForm onVerified={() => closeFormDialog()} /> : null}

          {formKind === "method_create" || formKind === "method_edit" ? (
            <form
              id="wallet-method-form"
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const phone = payoutPhone.trim();
                if (!provider.trim() || !accountName.trim() || phone.length < 8) {
                  setFormAttempted(true);
                  return;
                }
                const payload = {
                  provider: provider.trim(),
                  account_name: accountName.trim(),
                  phone,
                };
                if (formKind === "method_edit" && activeMethod?.id) {
                  updatePayoutMethod.mutate(
                    { id: activeMethod.id, ...payload },
                    { onSuccess: () => closeFormDialog() },
                  );
                  return;
                }
                createPayoutMethod.mutate(payload, { onSuccess: () => closeFormDialog() });
              }}
            >
              {(chrome.organizer_payout_section_blurb || "").trim() && moneyBasePath ? (
                <p className="text-sm text-[var(--dama-muted)]">
                  {chrome.organizer_payout_section_blurb}
                </p>
              ) : null}
              <Field
                id="wallet-payout-provider"
                label={chrome.payout_provider_label}
                error={
                  formAttempted && !provider.trim()
                    ? (chrome.payout_provider_label || "").trim()
                    : undefined
                }
              >
                <Input
                  id="wallet-payout-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder={chrome.payout_provider_label}
                  aria-invalid={formAttempted && !provider.trim() ? true : undefined}
                />
              </Field>
              <Field
                id="wallet-payout-account"
                label={chrome.payout_account_label}
                error={
                  formAttempted && !accountName.trim()
                    ? (chrome.payout_account_label || "").trim()
                    : undefined
                }
              >
                <Input
                  id="wallet-payout-account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={chrome.payout_account_label}
                  aria-invalid={formAttempted && !accountName.trim() ? true : undefined}
                />
              </Field>
              <Field
                id="wallet-payout-phone"
                label={`${chrome.payout_phone_label} ${chrome.payout_required_marker}`}
                description={chrome.payout_phone_hint}
                error={
                  formAttempted && payoutPhone.trim().length < 8
                    ? (chrome.payout_phone_required || "").trim()
                    : undefined
                }
              >
                <Input
                  id="wallet-payout-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={payoutPhone}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  placeholder={chrome.payout_phone_label}
                  aria-invalid={formAttempted && payoutPhone.trim().length < 8 ? true : undefined}
                />
              </Field>
            </form>
          ) : null}
          {formKind === "method_create" || formKind === "method_edit" ? (
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => closeFormDialog()}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                form="wallet-method-form"
                variant="gold"
                isLoading={createPayoutMethod.isPending || updatePayoutMethod.isPending}
                pendingLabel={chrome.payout_save_pending}
              >
                {chrome.payout_save_action}
              </Button>
            </DialogFooter>
          ) : null}

          {formKind === "method_delete" && activeMethod ? (
            <p className="text-sm text-[var(--dama-muted)]">
              {(chrome.payout_method_delete_confirm || "").trim()}
            </p>
          ) : null}
          {formKind === "method_delete" && activeMethod ? (
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => closeFormDialog()}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                isLoading={deletePayoutMethod.isPending}
                pendingLabel={chrome.payout_method_delete_action}
                onClick={() => {
                  deletePayoutMethod.mutate(activeMethod.id, {
                    onSuccess: () => closeFormDialog(),
                  });
                }}
              >
                {chrome.payout_method_delete_action}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </PortalPageShell>
  );
}
