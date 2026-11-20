"use client";

import { ReceiptsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { ReceiptsWorkspace } from "@/components/wallet/ReceiptsWorkspace";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { softHostingChromeUnavailable } from "@/lib/hosting-organizer-chrome-soft";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { Suspense } from "react";

function EventsReceiptsBody() {
  const chromeQuery = useEventsOrganizerChromeQuery(true);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const base = moneyBasePathFromHref(
    (chrome?.portal_receipts_href || chrome?.portal_wallet_href || "").trim(),
  );
  if (chromeQuery.isLoading) {
    return <ReceiptsPageSkeleton columns={6} showBlurb={false} showManualForm={false} />;
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
  return <ReceiptsWorkspace moneyBasePath={base} />;
}

export default function EventsReceiptsPage() {
  return (
    <Suspense
      fallback={<ReceiptsPageSkeleton columns={6} showBlurb={false} showManualForm={false} />}
    >
      <EventsReceiptsBody />
    </Suspense>
  );
}
