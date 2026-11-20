"use client";

import {
  PaymentReceiptDocument,
  type PaymentReceiptDocumentChrome,
} from "@/components/payments/PaymentReceiptDocument";
import { Button } from "@/components/ui/button";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { ReceiptDetailSkeleton } from "@/components/payments/ReceiptDetailSkeleton";
import { useDownloadPaymentReceiptPdfMutation } from "@/hooks/mutation/useDownloadPaymentReceiptPdfMutation";
import { useAdminConsoleChromeQuery } from "@/hooks/query/useAdminConsoleChromeQuery";
import { useAdminReceiptQuery } from "@/hooks/query/useAdminReceiptQuery";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { receiptDisplayStatusCode } from "@/lib/payment-status-display";
import { printReceiptArticle } from "@/lib/receipt-print";
import { receiptSkeletonChromeFromPayments } from "@/lib/receipt-skeleton-chrome";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function chromeOpt(chrome: Record<string, unknown>, key: string): string {
  const v = chrome[key];
  return typeof v === "string" ? v.trim() : "";
}

function adminReceiptDocumentChrome(
  chrome: Record<string, unknown>,
  statusLabel: string,
): PaymentReceiptDocumentChrome | null {
  const document_title =
    chromeOpt(chrome, "receipt_document_title") || chromeOpt(chrome, "receipt_detail_title");
  const brand_name = chromeOpt(chrome, "receipt_brand_name");
  if (!document_title || !brand_name) return null;
  const sepRaw = chrome.amount_currency_separator;
  const amount_currency_separator = typeof sepRaw === "string" ? sepRaw : "";
  const empty = chromeOpt(chrome, "empty_value");
  const opt = (key: string) => chromeOpt(chrome, key) || undefined;
  return {
    document_title,
    brand_name,
    status_label: statusLabel || undefined,
    amount_currency_separator,
    empty_value: empty,
    section_bill_to: opt("receipt_section_bill_to"),
    section_from: opt("receipt_section_from"),
    section_details: opt("receipt_section_details"),
    section_payment: opt("receipt_section_payment"),
    section_transaction: opt("receipt_section_transaction"),
    section_proof: opt("receipt_section_proof"),
    label_reference: opt("receipt_label_reference"),
    label_amount: opt("receipt_label_amount"),
    label_currency: opt("receipt_label_currency"),
    label_status: opt("receipt_label_status"),
    label_channel: opt("receipt_label_channel"),
    label_date: opt("receipt_label_date"),
    label_id: opt("receipt_label_id"),
    label_paid_at: opt("receipt_label_paid_at"),
    label_billing_period: opt("receipt_label_billing_period"),
    billing_period: opt("receipt_billing_period"),
    header_meta_separator:
      typeof chrome.receipt_header_meta_separator === "string"
        ? chrome.receipt_header_meta_separator
        : undefined,
    label_subtotal: opt("receipt_label_subtotal"),
    label_tax: opt("receipt_label_tax"),
    label_total: opt("receipt_label_total"),
    label_amount_paid: opt("receipt_label_amount_paid"),
    col_description: opt("receipt_col_description"),
    col_product: opt("receipt_col_product"),
    col_amount: opt("receipt_col_amount"),
    col_qty: opt("receipt_col_qty"),
    col_unit: opt("receipt_col_unit"),
    col_tax_rate: opt("receipt_col_tax_rate"),
    line_description: opt("receipt_line_description"),
    section_tax_breakdown: opt("receipt_section_tax_breakdown"),
    label_tax_percent: opt("receipt_label_tax_percent"),
    label_tax_total: opt("receipt_label_tax_total"),
    tax_rate_display: opt("receipt_tax_rate_display"),
    merchant_via: opt("receipt_merchant_via"),
    footer: opt("receipt_footer"),
    print_action: opt("receipt_print_action"),
    print_pending: opt("receipt_print_pending"),
    download_action: opt("receipt_download_action"),
    download_pending: opt("receipt_download_pending"),
    download_failed: opt("receipt_download_failed"),
    download_done: opt("receipt_download_done"),
    download_filename_fmt: opt("receipt_download_filename_fmt"),
    brand_mark_alt: opt("receipt_brand_mark_alt"),
    proof_caption: opt("receipt_proof_caption") || opt("receipt_proof_label") || undefined,
    support_email: opt("receipt_support_email"),
  };
}

export function PaymentReceiptDetail({ receiptId }: { receiptId: string }) {
  const id = (receiptId || "").trim();
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;
  const detailQuery = useAdminReceiptQuery(token, id, isAdmin && Boolean(id));
  const downloadPdf = useDownloadPaymentReceiptPdfMutation(token);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoDownloadOnce = useRef(false);
  const autoPrintOnce = useRef(false);
  const articleHostRef = useRef<HTMLDivElement | null>(null);
  const [printing, setPrinting] = useState(false);

  const c = (chrome || {}) as unknown as Record<string, unknown>;
  const empty = chromeOpt(c, "empty_value");
  const backHref = "/payments/receipts";
  const backLabel =
    chromeOpt(c, "receipt_detail_close") || chromeOpt(c, "receipt_detail_title") || "";
  const receipt = detailQuery.data;

  useEffect(() => {
    if (autoDownloadOnce.current) return;
    if (!receipt || detailQuery.isPending || !chrome) return;
    if (searchParams.get("download") !== "1") return;
    const failed = chromeOpt(c, "receipt_download_failed");
    autoDownloadOnce.current = true;
    downloadPdf.mutate(
      {
        receiptId: receipt.id,
        href: (receipt.first_party_pdf_href || "").trim() || undefined,
        failedMessage: failed,
        filenameFmt: chromeOpt(c, "receipt_download_filename_fmt") || undefined,
        console: true,
      },
      {
        onSuccess: () => {
          const done = chromeOpt(c, "receipt_download_done");
          if (done) toast.success(done);
          router.replace(pathname, { scroll: false });
        },
        onError: (e) => {
          toast.error((e instanceof Error ? e.message : "").trim() || failed);
          router.replace(pathname, { scroll: false });
        },
      },
    );
  }, [receipt, detailQuery.isPending, chrome, searchParams, router, pathname, downloadPdf, c]);

  useEffect(() => {
    if (autoPrintOnce.current) return;
    if (!receipt || detailQuery.isPending || !chrome) return;
    if (searchParams.get("print") !== "1") return;
    const title = chromeOpt(c, "receipt_document_title");
    const run = () => {
      const el = articleHostRef.current?.querySelector(
        "[data-receipt-print]",
      ) as HTMLElement | null;
      if (!el) return false;
      autoPrintOnce.current = true;
      printReceiptArticle(el, title || undefined, () => {
        router.replace(pathname, { scroll: false });
      });
      return true;
    };
    if (run()) return;
    const t = window.setTimeout(() => run(), 150);
    return () => window.clearTimeout(t);
  }, [receipt, detailQuery.isPending, chrome, searchParams, router, pathname, c]);

  const skeletonChrome = receiptSkeletonChromeFromPayments(c);

  if (roleLoading || chromeQuery.isLoading || (detailQuery.isPending && !receipt)) {
    return <ReceiptDetailSkeleton chrome={skeletonChrome} lineRows={1} />;
  }
  if (!isAdmin || !token) {
    return <ReceiptDetailSkeleton chrome={skeletonChrome} lineRows={1} />;
  }

  if (detailQuery.error || !receipt || !chrome) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-destructive">
          {chromeOpt(c, "receipt_not_found") ||
            (detailQuery.error instanceof Error ? detailQuery.error.message : "")}
        </p>
        {backLabel ? (
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const statusCode = receiptDisplayStatusCode(receipt);
  const statusLabel = chromeOpt(c, `receipt_status_${statusCode}`) || empty;
  const docChrome = adminReceiptDocumentChrome(c, statusLabel);
  if (!docChrome) {
    return <ReceiptDetailSkeleton chrome={skeletonChrome} lineRows={1} />;
  }

  return (
    <div className="relative mx-auto w-full max-w-[920px] px-3 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-0">
      <FetchProgressBar
        active={detailQuery.isFetching && !detailQuery.isPending}
        className="print:hidden"
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {docChrome.download_action ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={downloadPdf.isPending}
              pendingLabel={docChrome.download_pending || undefined}
              onClick={() => {
                const failed = (docChrome.download_failed || "").trim();
                downloadPdf.mutate(
                  {
                    receiptId: receipt.id,
                    href: (receipt.first_party_pdf_href || "").trim() || undefined,
                    failedMessage: failed,
                    filenameFmt: docChrome.download_filename_fmt,
                    console: true,
                  },
                  {
                    onSuccess: () => {
                      const done = (docChrome.download_done || "").trim();
                      if (done) toast.success(done);
                    },
                    onError: (e) => {
                      toast.error((e instanceof Error ? e.message : "").trim() || failed);
                    },
                  },
                );
              }}
            >
              {docChrome.download_action}
            </Button>
          ) : null}
          {docChrome.print_action ? (
            <Button
              type="button"
              size="sm"
              isLoading={printing}
              pendingLabel={docChrome.print_pending || undefined}
              onClick={() => {
                const el = articleHostRef.current?.querySelector(
                  "[data-receipt-print]",
                ) as HTMLElement | null;
                if (!el) return;
                setPrinting(true);
                printReceiptArticle(el, docChrome.document_title, () => setPrinting(false));
              }}
            >
              {docChrome.print_action}
            </Button>
          ) : null}
        </div>
      </div>

      <div ref={articleHostRef}>
        <PaymentReceiptDocument
          receipt={receipt}
          chrome={{
            ...docChrome,
            print_action: undefined,
            download_action: undefined,
          }}
          billToName={(receipt.username || "").trim() || undefined}
          billToEmail={(receipt.email || "").trim() || undefined}
          showPrint={false}
          consoleDownload
        />
      </div>
    </div>
  );
}
