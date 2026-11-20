"use client";

import { WalletPanelSkeleton } from "@/components/ui/shimmer-skeletons";
import { WalletWorkspace } from "@/components/wallet/WalletWorkspace";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { softHostingChromeUnavailable } from "@/lib/hosting-organizer-chrome-soft";
import { moneyBasePathFromHref } from "@/lib/money-base-path";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { Suspense } from "react";

function EventsWalletBody() {
  const chromeQuery = useEventsOrganizerChromeQuery(true);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const base = moneyBasePathFromHref((chrome?.portal_wallet_href || "").trim());
  if (chromeQuery.isLoading) return <WalletPanelSkeleton />;
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
  return <WalletWorkspace moneyBasePath={base} />;
}

/** Organizer money + payout (same APIs as player wallet, events shell). */
export default function EventsWalletPage() {
  return (
    <Suspense fallback={<WalletPanelSkeleton />}>
      <EventsWalletBody />
    </Suspense>
  );
}
