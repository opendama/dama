"use client";

import { ReceiptDetailSkeleton } from "@/components/wallet/ReceiptDetailSkeleton";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { receiptSkeletonChromeFromWallet } from "@/lib/receipt-skeleton-chrome";
import { isWalletChromeReady } from "@/types/wallet-chrome";

/**
 * Trim `DashboardBootSkeleton` receipt branch parity:
 * hydrate wallet chrome then paint letterhead labels (Bill to / Transaction /
 * Subtotal / VAT / …) while the receipt payload is still loading.
 */
export function ReceiptDetailSkeletonBoot() {
  const chromeQuery = useWalletChromeQuery(true);
  const chrome = isWalletChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const sk = receiptSkeletonChromeFromWallet(
    chrome as unknown as Record<string, unknown> | undefined,
  );
  return <ReceiptDetailSkeleton chrome={sk} lineRows={0} />;
}
