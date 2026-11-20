"use client";

import { ReceiptDetailSkeletonBoot } from "@/components/wallet/ReceiptDetailSkeletonBoot";
import { PaymentReceiptDetail } from "@/components/wallet/PaymentReceiptDetail";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function AdsReceiptDetailInner() {
  const params = useParams<{ id: string }>();
  const playbackQuery = useAdPlaybackQuery(true);
  const chrome = playbackQuery.data?.schedule_chrome;
  const base = moneyBasePathFromHref(
    (chrome?.publisher_portal_receipts_href || chrome?.publisher_portal_wallet_href || "").trim(),
  );
  if (playbackQuery.isLoading || !chrome || !base) {
    return <ReceiptDetailSkeletonBoot />;
  }
  return <PaymentReceiptDetail receiptId={params.id || ""} backHref={`${base}/receipts`} />;
}

export default function AdsReceiptDetailPage() {
  return (
    <Suspense fallback={<ReceiptDetailSkeletonBoot />}>
      <AdsReceiptDetailInner />
    </Suspense>
  );
}
