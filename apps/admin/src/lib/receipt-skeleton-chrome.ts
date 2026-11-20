import type { ReceiptSkeletonChrome } from "@/components/payments/ReceiptDetailSkeleton";

function chromeOpt(chrome: Record<string, unknown> | undefined, key: string): string {
  const v = chrome?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Map admin_console_chrome.payments keys into letterhead skeleton labels. */
export function receiptSkeletonChromeFromPayments(
  chrome: Record<string, unknown> | undefined | null,
): ReceiptSkeletonChrome | undefined {
  if (!chrome) return undefined;
  const opt = (key: string) => chromeOpt(chrome, key) || undefined;
  return {
    document_title: opt("receipt_document_title") || opt("receipt_detail_title"),
    brand_name: opt("receipt_brand_name"),
    merchant_via: opt("receipt_merchant_via"),
    section_bill_to: opt("receipt_section_bill_to"),
    section_from: opt("receipt_section_from"),
    section_details: opt("receipt_section_details"),
    section_transaction: opt("receipt_section_transaction"),
    section_tax_breakdown: opt("receipt_section_tax_breakdown"),
    col_description: opt("receipt_col_description"),
    col_product: opt("receipt_col_product"),
    col_qty: opt("receipt_col_qty"),
    col_unit: opt("receipt_col_unit"),
    col_tax_rate: opt("receipt_col_tax_rate"),
    col_amount: opt("receipt_col_amount"),
    label_subtotal: opt("receipt_label_subtotal"),
    label_tax: opt("receipt_label_tax"),
    label_total: opt("receipt_label_total"),
    label_amount_paid: opt("receipt_label_amount_paid"),
    label_tax_percent: opt("receipt_label_tax_percent"),
    label_tax_total: opt("receipt_label_tax_total"),
    footer: opt("receipt_footer"),
  };
}
