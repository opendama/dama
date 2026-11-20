"use client";

import { WalletPanelSkeleton } from "@/components/ui/shimmer-skeletons";
import { WalletWorkspace } from "@/components/wallet/WalletWorkspace";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { Suspense } from "react";

function AdsWalletBody() {
  const playbackQuery = useAdPlaybackQuery(true);
  const chrome = playbackQuery.data?.schedule_chrome;
  const base = moneyBasePathFromHref((chrome?.publisher_portal_wallet_href || "").trim());
  if (playbackQuery.isLoading) return <WalletPanelSkeleton />;
  if (!chrome || !base) return null;
  return <WalletWorkspace moneyBasePath={base} />;
}

/** Publisher money + payout (same APIs as player wallet, ads shell). */
export default function AdsWalletPage() {
  return (
    <Suspense fallback={<WalletPanelSkeleton />}>
      <AdsWalletBody />
    </Suspense>
  );
}
