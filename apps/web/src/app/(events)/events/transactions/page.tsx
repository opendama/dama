"use client";

import { SearchableListPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { TransactionsWorkspace } from "@/components/wallet/TransactionsWorkspace";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { softHostingChromeUnavailable } from "@/lib/hosting-organizer-chrome-soft";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { Suspense } from "react";

function EventsTransactionsBody() {
  const chromeQuery = useEventsOrganizerChromeQuery(true);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const base = moneyBasePathFromHref(
    (chrome?.portal_transactions_href || chrome?.portal_wallet_href || "").trim(),
  );
  if (chromeQuery.isLoading) {
    return <SearchableListPageSkeleton columns={7} showBlurb={false} />;
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
    ) : null;
  }
  return <TransactionsWorkspace moneyBasePath={base} />;
}

export default function EventsTransactionsPage() {
  return (
    <Suspense fallback={<SearchableListPageSkeleton columns={7} showBlurb={false} />}>
      <EventsTransactionsBody />
    </Suspense>
  );
}
