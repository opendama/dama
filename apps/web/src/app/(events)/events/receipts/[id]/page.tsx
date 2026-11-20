"use client";

import { ReceiptDetailSkeletonBoot } from "@/components/wallet/ReceiptDetailSkeletonBoot";
import { PaymentReceiptDetail } from "@/components/wallet/PaymentReceiptDetail";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { softHostingChromeUnavailable } from "@/lib/hosting-organizer-chrome-soft";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { useParams } from "next/navigation";
import { Suspense } from "react";

function EventsReceiptDetailInner() {
  const params = useParams<{ id: string }>();
  const chromeQuery = useEventsOrganizerChromeQuery(true);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const base = moneyBasePathFromHref(
    (chrome?.portal_receipts_href || chrome?.portal_wallet_href || "").trim(),
  );
  if (chromeQuery.isLoading) {
    return <ReceiptDetailSkeletonBoot />;
  }
  if (!chrome || !base) {
    const unavailable = softHostingChromeUnavailable(
      chromeQuery.error instanceof Error
        ? chromeQuery.error.message
        : (chromeQuery.data?.events_organizer_chrome_unavailable || "").trim(),
    );
    return unavailable ? (
      <p className="text-sm text-[var(--dama-danger)]" role="alert">
        {unavailable}
      </p>
    ) : (
      <ReceiptDetailSkeletonBoot />
    );
  }
  return <PaymentReceiptDetail receiptId={params.id || ""} backHref={`${base}/receipts`} />;
}

export default function EventsReceiptDetailPage() {
  return (
    <Suspense fallback={<ReceiptDetailSkeletonBoot />}>
      <EventsReceiptDetailInner />
    </Suspense>
  );
}
