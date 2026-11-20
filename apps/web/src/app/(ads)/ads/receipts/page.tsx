"use client";

import { ReceiptsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { ReceiptsWorkspace } from "@/components/wallet/ReceiptsWorkspace";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { Suspense } from "react";

function AdsReceiptsBody() {
  const playbackQuery = useAdPlaybackQuery(true);
  const chrome = playbackQuery.data?.schedule_chrome;
  const base = moneyBasePathFromHref(
    (chrome?.publisher_portal_receipts_href || chrome?.publisher_portal_wallet_href || "").trim(),
  );
  if (playbackQuery.isLoading) {
    return <ReceiptsPageSkeleton columns={6} showBlurb={false} showManualForm={false} />;
  }
  if (!chrome || !base) return null;
  return <ReceiptsWorkspace moneyBasePath={base} />;
}

export default function AdsReceiptsPage() {
  return (
    <Suspense
      fallback={<ReceiptsPageSkeleton columns={6} showBlurb={false} showManualForm={false} />}
    >
      <AdsReceiptsBody />
    </Suspense>
  );
}
