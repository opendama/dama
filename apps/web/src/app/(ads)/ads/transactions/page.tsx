"use client";

import { SearchableListPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { TransactionsWorkspace } from "@/components/wallet/TransactionsWorkspace";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { Suspense } from "react";

function AdsTransactionsBody() {
  const playbackQuery = useAdPlaybackQuery(true);
  const chrome = playbackQuery.data?.schedule_chrome;
  const base = moneyBasePathFromHref(
    (
      chrome?.publisher_portal_transactions_href ||
      chrome?.publisher_portal_wallet_href ||
      ""
    ).trim(),
  );
  if (playbackQuery.isLoading) {
    return <SearchableListPageSkeleton columns={7} showBlurb={false} />;
  }
  if (!chrome || !base) return null;
  return <TransactionsWorkspace moneyBasePath={base} />;
}

export default function AdsTransactionsPage() {
  return (
    <Suspense fallback={<SearchableListPageSkeleton columns={7} showBlurb={false} />}>
      <AdsTransactionsBody />
    </Suspense>
  );
}
