"use client";

import { DamaWordmark } from "@/components/brand/dama-wordmark";
import { Button } from "@/components/ui/button";
import { useDownloadPaymentReceiptPdfMutation } from "@/hooks/mutation/useDownloadPaymentReceiptPdfMutation";
import { paidStatusBadgeClass, receiptDisplayStatusCode } from "@/lib/payment-status-display";
import { formatReceiptDay, paymentMethodDisplay } from "@/lib/receipt-date";
import { printReceiptArticle } from "@/lib/receipt-print";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthStore } from "@/store/auth";
import { useRef, useState } from "react";
import { toast } from "sonner";

export type PaymentReceiptRecord = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  display_status?: string;
  reference?: string;
  provider?: string;
  receipt_url?: string;
  created_at?: string;
  reviewed_at?: string;
  username?: string;
  email?: string;
};

export type PaymentReceiptDocumentChrome = {
  document_title: string;
  brand_name: string;
  status_label?: string;
  amount_currency_separator: string;
  empty_value: string;
  section_bill_to?: string;
  section_from?: string;
  section_details?: string;
  section_payment?: string;
  section_transaction?: string;
  section_proof?: string;
  label_reference?: string;
  label_amount?: string;
  label_currency?: string;
  label_status?: string;
  label_channel?: string;
  label_date?: string;
  label_id?: string;
  label_paid_at?: string;
  /** Trim "Billing period" - omit row when billing_period value empty. */
  label_billing_period?: string;
  billing_period?: string;
  /** Trim header meta joiner between date and amount (may be whitespace). */
  header_meta_separator?: string;
  label_subtotal?: string;
  label_tax?: string;
  label_total?: string;
  label_amount_paid?: string;
  col_description?: string;
  /** Trim `col_product` preferred over description when present. */
  col_product?: string;
  col_amount?: string;
  col_qty?: string;
  col_unit?: string;
  col_tax_rate?: string;
  line_description?: string;
  section_tax_breakdown?: string;
  label_tax_percent?: string;
  label_tax_total?: string;
  tax_rate_display?: string;
  merchant_via?: string;
  footer?: string;
  print_action?: string;
  print_pending?: string;
  download_action?: string;
  download_pending?: string;
  download_failed?: string;
  download_done?: string;
  download_filename_fmt?: string;
  brand_mark_alt?: string;
  proof_caption?: string;
  support_email?: string;
};

function labelPresent(v: string | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function localeDateDisplay(raw: string | undefined, empty: string): string {
  return formatReceiptDay(raw, empty);
}

function InlineDetail({ label, value }: { label?: string; value?: string }) {
  const l = (label || "").trim();
  const v = (value || "").trim();
  if (!l || !v) return null;
  return (
    <p className="text-[13px] leading-relaxed text-[var(--dama-text)] print:text-zinc-900">
      <span className="font-semibold">{l}:</span> {v}
    </p>
  );
}

function ReceiptProofImage({
  url,
  sectionLabel,
  caption,
}: {
  url: string;
  sectionLabel?: string;
  caption?: string;
}) {
  const [broken, setBroken] = useState(false);
  const cap = (caption || "").trim();
  const section = (sectionLabel || "").trim();
  if (!url) return null;

  return (
    <section className="px-5 py-6 sm:px-8 print:px-8 print:py-6">
      {section ? (
        <h2 className="mb-3 text-[13px] font-bold text-[var(--dama-text)] print:text-zinc-900">
          {section}
        </h2>
      ) : null}
      {cap ? (
        <p className="mb-2 text-[12px] text-[var(--dama-muted)] print:text-zinc-600">{cap}</p>
      ) : null}
      {broken ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[var(--dama-gold)] underline underline-offset-4"
        >
          {cap || url}
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-[var(--dama-border)] print:border-zinc-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-[min(60vh,28rem)] w-full bg-[var(--dama-surface)] object-contain print:bg-white"
            onError={() => setBroken(true)}
          />
        </a>
      )}
    </section>
  );
}

export type PaymentReceiptDocumentProps = {
  receipt: PaymentReceiptRecord;
  chrome: PaymentReceiptDocumentChrome;
  billToName?: string;
  billToEmail?: string;
  showPrint?: boolean;
  /** Console reviewer PDF path uses the same route under payments.review. */
  consoleDownload?: boolean;
};

export function PaymentReceiptDocument({
  receipt,
  chrome,
  billToName,
  billToEmail,
  showPrint = true,
  consoleDownload = false,
}: PaymentReceiptDocumentProps) {
  const [printing, setPrinting] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const token = useAuthStore((s) => s.token);
  const downloadPdf = useDownloadPaymentReceiptPdfMutation(token);

  const documentTitle = (chrome.document_title || "").trim();
  const brand = (chrome.brand_name || "").trim();
  if (!documentTitle || !brand) return null;

  const sep = chrome.amount_currency_separator;
  const empty = (chrome.empty_value || "").trim();
  // Trim formatMoney uses fixed decimals; keep currency code (ETB) for Dama branding.
  const formatMoney = (n: number) => {
    const cur = (receipt.currency || "").trim();
    if (!cur || sep.length === 0 || !Number.isFinite(n)) return empty;
    return `${n.toFixed(2)}${sep}${cur}`;
  };
  const amountFmt = typeof receipt.amount === "number" ? formatMoney(receipt.amount) : empty;
  // Dama has no tax yet - Trim VAT row shows 0.00 until real tax exists.
  const taxFmt = formatMoney(0);

  const name = (billToName || receipt.username || "").trim();
  const email = (billToEmail || receipt.email || "").trim();
  const reference = (receipt.reference || "").trim() || empty;
  const provider = (receipt.provider || "").trim();
  const payMethod = paymentMethodDisplay(provider);
  const statusCode = receiptDisplayStatusCode(receipt);
  const statusDisplay = (chrome.status_label || "").trim() || statusCode || empty;
  const createdDisplay = localeDateDisplay(receipt.created_at, empty);
  const paidDisplay = localeDateDisplay(receipt.reviewed_at, empty);
  // Trim header meta: paid_at (else submitted) + separator + amount (no "Amount:" prefix).
  const headerMetaDate = paidDisplay !== empty ? paidDisplay : createdDisplay;
  const headerMetaSep =
    typeof chrome.header_meta_separator === "string" ? chrome.header_meta_separator : " - ";
  const currencyCode = (receipt.currency || "").trim().toUpperCase() || empty;
  const productCol = labelPresent(chrome.col_product)
    ? chrome.col_product
    : labelPresent(chrome.col_description)
      ? chrome.col_description
      : empty;
  const proofUrl = resolvePublicMediaUrl(receipt.receipt_url);

  const printAction = (chrome.print_action || "").trim();
  const downloadAction = (chrome.download_action || "").trim();
  const canPrint = showPrint && Boolean(printAction);
  const canDownload = showPrint && Boolean(downloadAction);
  const markAlt = (chrome.brand_mark_alt || brand).trim() || brand;

  return (
    <div className="mx-auto w-full max-w-[920px]">
      {canPrint || canDownload ? (
        <div className="mb-5 flex flex-wrap items-center justify-end gap-2 print:hidden">
          {canDownload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={downloadPdf.isPending}
              pendingLabel={(chrome.download_pending || "").trim() || undefined}
              onClick={() => {
                const failed = (chrome.download_failed || "").trim();
                downloadPdf.mutate(
                  {
                    receiptId: receipt.id,
                    failedMessage: failed,
                    filenameFmt: chrome.download_filename_fmt,
                    console: consoleDownload,
                  },
                  {
                    onSuccess: () => {
                      const done = (chrome.download_done || "").trim();
                      if (done) toast.success(done);
                    },
                    onError: (e) => {
                      toast.error((e instanceof Error ? e.message : "").trim() || failed);
                    },
                  },
                );
              }}
            >
              {downloadAction}
            </Button>
          ) : null}
          {canPrint ? (
            <Button
              type="button"
              size="sm"
              isLoading={printing}
              pendingLabel={(chrome.print_pending || "").trim() || undefined}
              onClick={() => {
                const el = articleRef.current;
                if (!el) return;
                setPrinting(true);
                printReceiptArticle(el, documentTitle, () => setPrinting(false));
              }}
            >
              {printAction}
            </Button>
          ) : null}
        </div>
      ) : null}

      <article
        ref={articleRef}
        data-receipt-print
        className="overflow-hidden text-[var(--dama-text)] print:rounded-none print:border-0 print:bg-white print:text-zinc-900"
        style={{ backgroundColor: "var(--dama-bg, var(--dama-card))" }}
      >
        <header className="bg-[var(--dama-input)] px-5 py-6 sm:px-8 sm:py-7 print:bg-zinc-100 print:px-8 print:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[1.35rem] font-bold tracking-tight sm:text-[1.5rem] print:text-zinc-900">
                  {documentTitle}
                </h1>
                {labelPresent(chrome.status_label) || statusCode ? (
                  <span className={paidStatusBadgeClass(statusCode)}>{statusDisplay}</span>
                ) : null}
              </div>
              {headerMetaDate !== empty || amountFmt !== empty ? (
                <p className="text-[13px] text-[var(--dama-muted)] print:text-zinc-600">
                  {headerMetaDate !== empty ? <span>{headerMetaDate}</span> : null}
                  {headerMetaDate !== empty && amountFmt !== empty ? headerMetaSep : null}
                  {amountFmt !== empty ? (
                    <span className="font-semibold text-[var(--dama-text)] print:text-zinc-800">
                      {amountFmt}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              {/* Receipt letterhead mark: xl=36 (visual Trim parity after tight crop). */}
              <span className="print:hidden">
                <DamaWordmark size="xl" alt={markAlt} priority />
              </span>
              <span className="hidden print:inline-flex">
                <DamaWordmark size="xl" alt={markAlt} ink="print" priority />
              </span>
              <p className="text-[15px] font-bold tracking-tight print:text-zinc-900">{brand}</p>
              {labelPresent(chrome.merchant_via) ? (
                <p className="text-[11px] text-[var(--dama-muted)] print:text-zinc-500">
                  {chrome.merchant_via}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {labelPresent(chrome.section_bill_to) || labelPresent(chrome.section_from) ? (
          <section className="grid gap-10 px-5 py-8 sm:px-8 md:grid-cols-2 print:grid-cols-2 print:gap-10 print:px-8 print:py-8">
            {labelPresent(chrome.section_bill_to) ? (
              <div className="min-w-0 space-y-2">
                <h2 className="text-[13px] font-bold print:text-zinc-900">
                  {chrome.section_bill_to}
                </h2>
                <div className="space-y-0.5 text-[13px] leading-relaxed text-[var(--dama-muted)] print:text-zinc-800">
                  {/* Trim Invoice to: email (name only when email missing). */}
                  {email ? (
                    <p className="break-all text-[var(--dama-text)] print:text-zinc-900">{email}</p>
                  ) : name ? (
                    <p className="text-[var(--dama-text)] print:text-zinc-900">{name}</p>
                  ) : null}
                </div>
                {labelPresent(chrome.section_payment) && payMethod ? (
                  <p className="pt-2 text-[13px] text-[var(--dama-muted)] print:text-zinc-800">
                    <span className="font-semibold text-[var(--dama-text)] print:text-zinc-900">
                      {chrome.section_payment}:
                    </span>{" "}
                    {payMethod}
                  </p>
                ) : null}
              </div>
            ) : null}

            {labelPresent(chrome.section_from) ? (
              <div className="min-w-0 space-y-2">
                <h2 className="text-[13px] font-bold print:text-zinc-900">{chrome.section_from}</h2>
                <div className="space-y-0.5 text-[13px] leading-relaxed text-[var(--dama-muted)] print:text-zinc-800">
                  {/* Trim Invoice from: brand only (support in footer). */}
                  <p className="text-[var(--dama-text)] print:text-zinc-900">{brand}</p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {labelPresent(chrome.section_details) ? (
          <section className="px-5 pb-6 sm:px-8 print:px-8 print:pb-6">
            <h2 className="text-[13px] font-bold print:text-zinc-900">{chrome.section_details}</h2>
            <div className="mt-3 space-y-1">
              {/* Trim order: Invoice reference, Billing period?, Transaction, Currency code. */}
              <InlineDetail label={chrome.label_reference} value={reference} />
              <InlineDetail
                label={chrome.label_billing_period}
                value={(chrome.billing_period || "").trim() || undefined}
              />
              <InlineDetail label={chrome.label_id} value={(receipt.id || "").trim()} />
              <InlineDetail label={chrome.label_currency} value={currencyCode} />
            </div>
          </section>
        ) : null}

        {/* Trim receipt-view always paints transaction + Subtotal/VAT/Total/Amount paid. */}
        <>
          <div className="mx-5 border-t border-[var(--dama-border)] sm:mx-8 print:mx-8 print:border-zinc-200" />
          <section className="px-5 py-6 sm:px-8 print:px-8 print:py-6">
            <h2 className="mb-4 text-[13px] font-bold print:text-zinc-900">
              {labelPresent(chrome.section_transaction) ? chrome.section_transaction : empty}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[13px] print:min-w-0">
                <thead>
                  <tr className="border-b border-[var(--dama-border)] print:border-zinc-200">
                    <th className="pb-2.5 pr-3 text-[12px] font-bold print:text-zinc-900">
                      {productCol}
                    </th>
                    <th className="px-2 pb-2.5 text-right text-[12px] font-bold print:text-zinc-900">
                      {labelPresent(chrome.col_qty) ? chrome.col_qty : empty}
                    </th>
                    <th className="px-2 pb-2.5 text-right text-[12px] font-bold print:text-zinc-900">
                      {labelPresent(chrome.col_unit) ? chrome.col_unit : empty}
                    </th>
                    <th className="px-2 pb-2.5 text-right text-[12px] font-bold print:text-zinc-900">
                      {labelPresent(chrome.col_tax_rate) ? chrome.col_tax_rate : empty}
                    </th>
                    <th className="pb-2.5 pl-2 text-right text-[12px] font-bold print:text-zinc-900">
                      {labelPresent(chrome.col_amount) ? chrome.col_amount : empty}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--dama-border)] print:border-zinc-200">
                    <td className="py-3.5 pr-3 align-top font-bold print:text-zinc-900">
                      {labelPresent(chrome.line_description) ? chrome.line_description : empty}
                    </td>
                    <td className="px-2 py-3.5 text-right align-top tabular-nums text-[var(--dama-muted)] print:text-zinc-700">
                      1
                    </td>
                    <td className="px-2 py-3.5 text-right align-top tabular-nums text-[var(--dama-muted)] print:text-zinc-700">
                      {amountFmt}
                    </td>
                    <td className="px-2 py-3.5 text-right align-top tabular-nums text-[var(--dama-muted)] print:text-zinc-700">
                      {labelPresent(chrome.tax_rate_display) ? chrome.tax_rate_display : empty}
                    </td>
                    <td className="py-3.5 pl-2 text-right align-top font-bold tabular-nums print:text-zinc-900">
                      {amountFmt}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Trim always renders totals after the line table (max-w-[240px] right). */}
            <div className="mt-2 flex justify-end">
              <dl className="w-full max-w-[240px] text-[13px]">
                <div className="flex items-center justify-between gap-8 border-b border-[var(--dama-border)] py-2 text-[var(--dama-muted)] print:border-zinc-200 print:text-zinc-700">
                  <dt>{labelPresent(chrome.label_subtotal) ? chrome.label_subtotal : empty}</dt>
                  <dd className="tabular-nums">{amountFmt}</dd>
                </div>
                <div className="flex items-center justify-between gap-8 border-b border-[var(--dama-border)] py-2 text-[var(--dama-muted)] print:border-zinc-200 print:text-zinc-700">
                  <dt>{labelPresent(chrome.label_tax) ? chrome.label_tax : empty}</dt>
                  <dd className="tabular-nums">{taxFmt}</dd>
                </div>
                <div className="flex items-center justify-between gap-8 border-b border-[var(--dama-border)] py-2 text-[var(--dama-text)] print:border-zinc-200 print:text-zinc-900">
                  <dt>{labelPresent(chrome.label_total) ? chrome.label_total : empty}</dt>
                  <dd className="tabular-nums">{amountFmt}</dd>
                </div>
                <div className="flex items-center justify-between gap-8 border-b border-[var(--dama-border)] py-2 text-[15px] font-bold text-[var(--dama-text)] print:border-zinc-200 print:text-zinc-900">
                  <dt>
                    {labelPresent(chrome.label_amount_paid) ? chrome.label_amount_paid : empty}
                  </dt>
                  <dd className="tabular-nums">{amountFmt}</dd>
                </div>
              </dl>
            </div>

            {/* Trim always paints tax breakdown (VAT 0.00 until real tax). */}
            <div className="mt-8 max-w-[240px]">
              <h2 className="text-[13px] font-bold print:text-zinc-900">
                {labelPresent(chrome.section_tax_breakdown) ? chrome.section_tax_breakdown : empty}
              </h2>
              <table className="mt-2 w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--dama-border)] print:border-zinc-200">
                    <th className="pb-2 text-left text-[12px] font-bold print:text-zinc-900">
                      {labelPresent(chrome.label_tax_percent) ? chrome.label_tax_percent : empty}
                    </th>
                    <th className="pb-2 text-right text-[12px] font-bold print:text-zinc-900">
                      {labelPresent(chrome.label_tax) ? chrome.label_tax : empty}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--dama-border)] print:border-zinc-200">
                    <td className="py-2 tabular-nums text-[var(--dama-muted)] print:text-zinc-800">
                      {labelPresent(chrome.tax_rate_display) ? chrome.tax_rate_display : empty}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--dama-muted)] print:text-zinc-800">
                      {taxFmt}
                    </td>
                  </tr>
                  <tr>
                    <td className="pt-2.5 font-bold print:text-zinc-900">
                      {labelPresent(chrome.label_tax_total) ? chrome.label_tax_total : empty}
                    </td>
                    <td className="pt-2.5 text-right font-bold tabular-nums print:text-zinc-900">
                      {taxFmt}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>

        {proofUrl ? (
          <ReceiptProofImage
            url={proofUrl}
            sectionLabel={chrome.section_proof}
            caption={chrome.proof_caption}
          />
        ) : null}

        {labelPresent(chrome.footer) ? (
          <footer className="mt-4 bg-[var(--dama-input)] px-5 py-7 text-center sm:px-8 print:mt-4 print:bg-zinc-100 print:px-8 print:py-7">
            {/* Trim footer order: copy → sm mark (18px) → brand locality line. */}
            <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
              <p className="text-[12px] leading-relaxed text-[var(--dama-muted)] print:text-zinc-600">
                {chrome.footer}
              </p>
              <span className="print:hidden opacity-70">
                <DamaWordmark size="md" alt={brand} priority />
              </span>
              <span className="hidden print:inline-flex">
                <DamaWordmark size="md" alt={brand} ink="print" priority />
              </span>
              {/* Trim footer locality under the mark is brand-only (support sits in Invoice from). */}
              <p className="text-[11px] leading-relaxed text-[var(--dama-muted)] print:text-zinc-500">
                {brand}
              </p>
            </div>
          </footer>
        ) : null}
      </article>
    </div>
  );
}
