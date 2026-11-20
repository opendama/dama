"use client";

import { cn } from "@/lib/utils";

function ShimmerBlock({ className }: { className?: string }) {
  return <div className={cn("dama-shimmer", className)} aria-hidden />;
}

/**
 * Trim `ReceiptSkeletonChrome` parity - paint live section/col/totals labels
 * while values shimmer (letterhead topology matches PaymentReceiptDocument).
 */
export type ReceiptSkeletonChrome = {
  document_title?: string;
  brand_name?: string;
  merchant_via?: string;
  section_bill_to?: string;
  section_from?: string;
  section_details?: string;
  section_transaction?: string;
  section_tax_breakdown?: string;
  col_description?: string;
  col_product?: string;
  col_qty?: string;
  col_unit?: string;
  col_tax_rate?: string;
  col_amount?: string;
  label_subtotal?: string;
  label_tax?: string;
  label_total?: string;
  label_amount_paid?: string;
  label_tax_percent?: string;
  label_tax_total?: string;
  footer?: string;
};

function skLabel(v: string | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Receipt detail letterhead skeleton - Trim `ReceiptDetailSkeleton` 1:1 topology:
 * toolbar, muted header (title+badge+meta | mark lg=28 + brand + via), parties,
 * details, 5-col transaction with stacked product cell, max-w-[240px] totals
 * (Subtotal/VAT/Total/Amount paid), tax breakdown, footer mark sm=18.
 */
export function ReceiptDetailSkeleton({
  chrome,
  lineRows = 0,
}: {
  chrome?: ReceiptSkeletonChrome;
  /** Line count from receipt payload when known; 1 while unknown (Trim fidelity). */
  lineRows?: number;
} = {}) {
  const n = lineRows > 0 ? lineRows : 1;
  const billTo = skLabel(chrome?.section_bill_to);
  const from = skLabel(chrome?.section_from);
  const details = skLabel(chrome?.section_details);
  const txn = skLabel(chrome?.section_transaction);
  const taxSec = skLabel(chrome?.section_tax_breakdown);
  const productCol = skLabel(chrome?.col_product) || skLabel(chrome?.col_description);
  const colQ = skLabel(chrome?.col_qty);
  const colU = skLabel(chrome?.col_unit);
  const colT = skLabel(chrome?.col_tax_rate);
  const colA = skLabel(chrome?.col_amount);
  const sub = skLabel(chrome?.label_subtotal);
  const vat = skLabel(chrome?.label_tax);
  const tot = skLabel(chrome?.label_total);
  const paid = skLabel(chrome?.label_amount_paid);
  const taxPct = skLabel(chrome?.label_tax_percent);
  const taxTot = skLabel(chrome?.label_tax_total);
  const foot = skLabel(chrome?.footer);
  const title = skLabel(chrome?.document_title);
  const brand = skLabel(chrome?.brand_name);
  const via = skLabel(chrome?.merchant_via);
  const totals = [
    { label: sub, bold: false },
    { label: vat, bold: false },
    { label: tot, bold: false },
    { label: paid, bold: true },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[920px] px-3 py-6 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3" aria-hidden>
        <ShimmerBlock className="h-8 w-28" />
        <div className="flex gap-2">
          <ShimmerBlock className="h-8 w-28" />
          <ShimmerBlock className="h-8 w-16" />
        </div>
      </div>
      <article
        data-receipt-print
        className="overflow-hidden text-[var(--dama-text)]"
        style={{ backgroundColor: "var(--dama-bg, var(--dama-card))" }}
      >
        <header className="bg-[var(--dama-input)] px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                {title ? (
                  <h1 className="text-[1.35rem] font-bold tracking-tight sm:text-[1.5rem]">
                    {title}
                  </h1>
                ) : (
                  <ShimmerBlock className="h-7 w-36 sm:h-8 sm:w-40" />
                )}
                <ShimmerBlock className="h-5 w-12 rounded" />
              </div>
              <ShimmerBlock className="h-4 w-52" />
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              {/* Live DamaWordmark size lg = 28 (not company-logo h-8/sm:h-9). */}
              <ShimmerBlock className="h-[36px] w-[36px]" />
              {brand ? (
                <p className="text-[15px] font-bold tracking-tight">{brand}</p>
              ) : (
                <ShimmerBlock className="h-4 w-16" />
              )}
              {via ? (
                <p className="text-[11px] text-[var(--dama-muted)]">{via}</p>
              ) : (
                <ShimmerBlock className="h-3 w-24" />
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-10 px-5 py-8 sm:px-8 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            {billTo ? (
              <h2 className="text-[13px] font-bold">{billTo}</h2>
            ) : (
              <ShimmerBlock className="h-4 w-20" />
            )}
            <div className="space-y-1.5" aria-hidden>
              <ShimmerBlock className="h-4 w-40" />
              <ShimmerBlock className="h-4 w-56" />
              <ShimmerBlock className="h-4 w-36" />
              <ShimmerBlock className="h-4 w-28" />
              <ShimmerBlock className="mt-2 h-4 w-44" />
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            {from ? (
              <h2 className="text-[13px] font-bold">{from}</h2>
            ) : (
              <ShimmerBlock className="h-4 w-24" />
            )}
            <div className="space-y-1.5" aria-hidden>
              <ShimmerBlock className="h-4 w-28" />
              <ShimmerBlock className="h-4 w-48" />
              <ShimmerBlock className="h-4 w-40" />
              <ShimmerBlock className="h-4 w-20" />
            </div>
          </div>
        </section>

        <section className="px-5 pb-6 sm:px-8">
          {details ? (
            <h2 className="text-[13px] font-bold">{details}</h2>
          ) : (
            <ShimmerBlock className="h-4 w-28" />
          )}
          <div className="mt-3 space-y-2" aria-hidden>
            <ShimmerBlock className="h-4 w-64 max-w-full" />
            <ShimmerBlock className="h-4 w-72 max-w-full" />
            <ShimmerBlock className="h-4 w-80 max-w-full" />
            <ShimmerBlock className="h-4 w-56 max-w-full" />
            <ShimmerBlock className="h-4 w-48 max-w-full" />
            <ShimmerBlock className="h-4 w-40 max-w-full" />
          </div>
        </section>

        <div className="mx-5 border-t border-[var(--dama-border)] sm:mx-8" />

        <section className="px-5 py-6 sm:px-8">
          {txn ? (
            <h2 className="mb-4 text-[13px] font-bold">{txn}</h2>
          ) : (
            <ShimmerBlock className="mb-4 h-4 w-24" />
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--dama-border)]">
                  <th className="pb-2.5 pr-3 text-[12px] font-bold">
                    {productCol || <ShimmerBlock className="inline-block h-3 w-16" />}
                  </th>
                  <th className="px-2 pb-2.5 text-right text-[12px] font-bold">
                    {colQ || <ShimmerBlock className="ml-auto inline-block h-3 w-8" />}
                  </th>
                  <th className="px-2 pb-2.5 text-right text-[12px] font-bold">
                    {colU || <ShimmerBlock className="ml-auto inline-block h-3 w-14" />}
                  </th>
                  <th className="px-2 pb-2.5 text-right text-[12px] font-bold">
                    {colT || <ShimmerBlock className="ml-auto inline-block h-3 w-14" />}
                  </th>
                  <th className="pb-2.5 pl-2 text-right text-[12px] font-bold">
                    {colA || <ShimmerBlock className="ml-auto inline-block h-3 w-14" />}
                  </th>
                </tr>
              </thead>
              <tbody aria-hidden>
                {Array.from({ length: n }, (_, i) => `receipt-line-${i}`).map((key) => (
                  <tr key={key} className="border-b border-[var(--dama-border)]">
                    <td className="py-3.5 pr-3 align-top">
                      <ShimmerBlock className="h-4 w-28" />
                      <ShimmerBlock className="mt-1.5 h-3 w-48" />
                      <ShimmerBlock className="mt-1.5 h-3 w-24" />
                    </td>
                    <td className="px-2 py-3.5 text-right align-top">
                      <ShimmerBlock className="ml-auto h-4 w-6" />
                    </td>
                    <td className="px-2 py-3.5 text-right align-top">
                      <ShimmerBlock className="ml-auto h-4 w-12" />
                    </td>
                    <td className="px-2 py-3.5 text-right align-top">
                      <ShimmerBlock className="ml-auto h-4 w-8" />
                    </td>
                    <td className="py-3.5 pl-2 text-right align-top">
                      <ShimmerBlock className="ml-auto h-4 w-12" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trim totals: max-w-[240px] right - Subtotal / VAT / Total / Amount paid. */}
          <div className="mt-2 flex justify-end">
            <dl className="w-full max-w-[240px] space-y-0 text-[13px]">
              {totals.map((row, i) => (
                <div
                  key={row.label || i}
                  className={`flex items-center justify-between gap-8 border-b border-[var(--dama-border)] py-2 ${
                    row.bold ? "text-[15px] font-bold" : "text-[var(--dama-muted)]"
                  }`}
                >
                  <dt>
                    {row.label || <ShimmerBlock className={row.bold ? "h-4 w-24" : "h-4 w-16"} />}
                  </dt>
                  <dd aria-hidden>
                    <ShimmerBlock className={row.bold ? "h-4 w-14" : "h-4 w-12"} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-8 max-w-[240px]">
            {taxSec ? (
              <h2 className="text-[13px] font-bold">{taxSec}</h2>
            ) : (
              <ShimmerBlock className="h-4 w-28" />
            )}
            <table className="mt-2 w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--dama-border)]">
                  <th className="pb-2 text-left text-[12px] font-bold">
                    {taxPct || <ShimmerBlock className="inline-block h-3 w-12" />}
                  </th>
                  <th className="pb-2 text-right text-[12px] font-bold">
                    {vat || <ShimmerBlock className="ml-auto inline-block h-3 w-10" />}
                  </th>
                </tr>
              </thead>
              <tbody aria-hidden>
                <tr className="border-b border-[var(--dama-border)]">
                  <td className="py-2">
                    <ShimmerBlock className="h-4 w-8" />
                  </td>
                  <td className="py-2">
                    <ShimmerBlock className="ml-auto h-4 w-12" />
                  </td>
                </tr>
                <tr>
                  <td className="pt-2.5 font-bold">
                    {taxTot || <ShimmerBlock className="h-4 w-16" />}
                  </td>
                  <td className="pt-2.5">
                    <ShimmerBlock className="ml-auto h-4 w-12" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-4 bg-[var(--dama-input)] px-5 py-7 text-center sm:px-8">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
            {foot ? (
              <p className="text-[12px] leading-relaxed text-[var(--dama-muted)]">{foot}</p>
            ) : (
              <ShimmerBlock className="h-3 w-72 max-w-full" />
            )}
            {/* Live DamaWordmark size sm = 18 */}
            <ShimmerBlock className="h-[22px] w-[22px]" />
            <ShimmerBlock className="h-3 w-56 max-w-full" />
          </div>
        </footer>
      </article>
    </div>
  );
}
