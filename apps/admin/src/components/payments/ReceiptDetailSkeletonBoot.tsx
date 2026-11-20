"use client";

import { ReceiptDetailSkeleton } from "@/components/payments/ReceiptDetailSkeleton";
import { useAdminConsoleChromeQuery } from "@/hooks/query/useAdminConsoleChromeQuery";
import { receiptSkeletonChromeFromPayments } from "@/lib/receipt-skeleton-chrome";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";

/** Admin Suspense / boot - letterhead labels from admin_console_chrome.payments. */
export function ReceiptDetailSkeletonBoot() {
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const payments = isAdminConsoleChromeReady(chromeQuery.data)
    ? (chromeQuery.data.payments as unknown as Record<string, unknown>)
    : undefined;
  return (
    <ReceiptDetailSkeleton chrome={receiptSkeletonChromeFromPayments(payments)} lineRows={0} />
  );
}
