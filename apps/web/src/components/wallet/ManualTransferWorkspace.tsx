"use client";

import { PortalPageShell } from "@/components/portal/PortalPageShell";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MediaDropzone } from "@/components/ui/media-dropzone";
import { ReceiptsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { ManualBankAccounts } from "@/components/wallet/ManualBankAccounts";
import { usePaymentReceiptMutation } from "@/hooks/mutation/usePaymentReceiptMutation";
import { useUploadReceiptMutation } from "@/hooks/mutation/useUploadReceiptMutation";
import { useBanksQuery } from "@/hooks/query/useBanksQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function chromeOpt(chrome: Record<string, unknown> | undefined, key: string): string {
  const v = chrome?.[key];
  return typeof v === "string" ? v.trim() : "";
}

export type ManualTransferWorkspaceProps = {
  /** Prefix for sibling money routes, e.g. "/events" or "/ads". Empty = player portal. */
  moneyBasePath?: string;
};

/**
 * Domestic manual-transfer top-up (banks + receipt proof).
 * Visible only when payment route resolves to manual_transfer (Ethiopia geo).
 */
export function ManualTransferWorkspace({ moneyBasePath = "" }: ManualTransferWorkspaceProps) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const searchParams = useSearchParams();
  const chromeQuery = useWalletChromeQuery(Boolean(token));
  const mediaChromeQuery = useMediaUploadChromeQuery(Boolean(token));
  const chrome = isWalletChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const mediaChrome = isMediaUploadChromeReady(mediaChromeQuery.data)
    ? mediaChromeQuery.data
    : undefined;
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const routeQuery = usePaymentRouteQuery(Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const banksQuery = useBanksQuery(Boolean(country) && isManual);
  const receipt = usePaymentReceiptMutation(token);
  const uploadReceipt = useUploadReceiptMutation(token);

  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [formAttempted, setFormAttempted] = useState(false);
  const amountPrefill = (searchParams.get("amount") || "").trim();
  const intentIdPrefill = (searchParams.get("intent_id") || "").trim();

  useEffect(() => {
    if (!amountPrefill) return;
    const n = Number(amountPrefill);
    if (!Number.isFinite(n) || n <= 0) return;
    setAmount((prev) => (prev.trim() ? prev : amountPrefill));
  }, [amountPrefill]);

  if (!hydrated || chromeQuery.isLoading || geoQuery.isLoading || routeQuery.isLoading) {
    return <ReceiptsPageSkeleton columns={0} showBlurb showManualForm />;
  }
  if (!token || !chrome) return null;

  const c = chrome as unknown as Record<string, unknown>;
  const title =
    chromeOpt(c, "manual_transfer_page_title") || chromeOpt(c, "link_manual_transfer_label");
  const blurb = chromeOpt(c, "manual_transfer_page_blurb");
  const unavailable = chromeOpt(c, "manual_transfer_unavailable");
  const walletHrefRaw = chromeOpt(c, "link_wallet_href");
  const receiptsHrefRaw = chromeOpt(c, "link_receipts_href");
  const receiptsLabel = (chrome.link_receipts_label || "").trim();
  const walletLabel = (chrome.page_title || "").trim();
  const base = (moneyBasePath || "").replace(/\/$/, "");
  const moneyHref = (path: string) => {
    if (!path) return "";
    const p = path.startsWith("/") ? path : `/${path}`;
    return base ? `${base}${p}` : p;
  };
  const walletHref = moneyHref(walletHrefRaw);
  const receiptsHref = moneyHref(receiptsHrefRaw);

  if (!title) return null;

  if (!isManual) {
    return (
      <PortalPageShell title={title} blurb={blurb}>
        {unavailable ? (
          <output className="block text-sm text-[var(--dama-muted)]">{unavailable}</output>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {walletHref && walletLabel ? (
            <Button asChild variant="outline" size="sm">
              <Link href={walletHref}>{walletLabel}</Link>
            </Button>
          ) : null}
          {receiptsHref && receiptsLabel ? (
            <Button asChild variant="outline" size="sm">
              <Link href={receiptsHref}>{receiptsLabel}</Link>
            </Button>
          ) : null}
        </div>
      </PortalPageShell>
    );
  }

  return (
    <PortalPageShell
      title={title}
      blurb={blurb}
      actions={
        <>
          {receiptsHref && receiptsLabel ? (
            <Button asChild variant="outline" size="sm">
              <Link href={receiptsHref}>{receiptsLabel}</Link>
            </Button>
          ) : null}
          {walletHref && walletLabel ? (
            <Button asChild variant="outline" size="sm">
              <Link href={walletHref}>{walletLabel}</Link>
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]"
          onSubmit={(e) => {
            e.preventDefault();
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
                ...(intentIdPrefill ? { intent_id: intentIdPrefill } : {}),
              },
              {
                onSuccess: () => {
                  setFormAttempted(false);
                  setAmount("");
                  setReceiptUrl("");
                },
              },
            );
          }}
        >
          <p className="text-sm font-medium">{chrome.submit_receipt_title}</p>
          <Field
            id="manual-transfer-amount"
            label={chrome.top_up_amount_label}
            error={
              formAttempted && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
                ? (chrome.invalid_top_up_amount || "").trim()
                : undefined
            }
          >
            <AmountInput
              id="manual-transfer-amount"
              value={amount}
              onValueChange={setAmount}
              placeholder={chrome.top_up_amount_placeholder}
              aria-invalid={
                formAttempted && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
                  ? true
                  : undefined
              }
            />
          </Field>
          {mediaChrome ? (
            <MediaDropzone
              id="manual-transfer-file"
              label={chrome.receipt_image_label || ""}
              chrome={mediaChrome}
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
          <Button
            type="submit"
            variant="gold"
            isLoading={receipt.isPending || uploadReceipt.isPending}
            pendingLabel={chrome.submit_receipt_pending}
          >
            {chrome.submit_receipt_action}
          </Button>
        </form>

        <div className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
          <ManualBankAccounts
            chrome={chrome}
            banks={banksQuery.data ?? []}
            loading={banksQuery.isLoading}
          />
        </div>
      </div>
    </PortalPageShell>
  );
}
