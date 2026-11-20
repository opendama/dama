"use client";

import { ReceiptsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { ManualTransferWorkspace } from "@/components/wallet/ManualTransferWorkspace";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { Suspense } from "react";

function AdsTransferBody() {
  const playbackQuery = useAdPlaybackQuery(true);
  const chrome = playbackQuery.data?.schedule_chrome;
  const base = moneyBasePathFromHref(
    (chrome?.publisher_portal_transfer_href || chrome?.publisher_portal_wallet_href || "").trim(),
  );
  if (playbackQuery.isLoading) {
    return <ReceiptsPageSkeleton columns={0} showBlurb={false} showManualForm />;
  }
  if (!chrome || !base) return null;
  return <ManualTransferWorkspace moneyBasePath={base} />;
}

export default function AdsTransferPage() {
  return (
    <Suspense fallback={<ReceiptsPageSkeleton columns={0} showBlurb={false} showManualForm />}>
      <AdsTransferBody />
    </Suspense>
  );
}
