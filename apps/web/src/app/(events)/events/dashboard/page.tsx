"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { PortalDashboardSkeleton, StatGridSkeleton } from "@/components/ui/shimmer-skeletons";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useEventsDashboardQuery } from "@/hooks/query/useEventsDashboardQuery";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import {
  softHostingChromeUnavailable,
  softHostingDashboardBlurb,
  softHostingDashboardTitle,
  softHostingFeatureDisabled,
  softHostingPortalCreateLabel,
  softHostingPortalPublicListLabel,
} from "@/lib/hosting-organizer-chrome-soft";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { resolveEventInviteShareUrl } from "@/lib/event-invite-share-url";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import Link from "next/link";
import { toast } from "sonner";

export default function EventsDashboardPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const chromeQuery = useEventsOrganizerChromeQuery(Boolean(token) || !hydrated);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const catalogQuery = useEventsCatalogQuery(Boolean(token));
  const dashQuery = useEventsDashboardQuery(token);
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const walletQuery = useWalletQuery(token, Boolean(token) && geoQuery.isFetched);
  const walletChromeQuery = useWalletChromeQuery(Boolean(token));
  const walletChrome = isWalletChromeReady(walletChromeQuery.data)
    ? walletChromeQuery.data
    : undefined;

  if (!hydrated) {
    return (
      <PortalDashboardSkeleton
        kpiCols={7}
        kpiCount={8}
        showCreateCta
        showCampaignList={false}
        portalLinkCount={6}
        portalVariant="events"
      />
    );
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (chromeQuery.isLoading) {
    return (
      <PortalDashboardSkeleton
        kpiCols={7}
        kpiCount={8}
        showCreateCta
        showCampaignList={false}
        portalLinkCount={6}
        portalVariant="events"
      />
    );
  }

  if (chromeQuery.isError || !chrome) {
    const unavailable = softHostingChromeUnavailable(
      (chromeQuery.data?.events_organizer_chrome_unavailable || "").trim(),
    );
    return (
      <div className="w-full space-y-4">
        {unavailable ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert">
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  if (token && catalogQuery.isLoading) {
    return (
      <PortalDashboardSkeleton
        kpiCols={7}
        kpiCount={8}
        showCreateCta
        showCampaignList={false}
        portalLinkCount={6}
        portalVariant="events"
      />
    );
  }

  if (catalogQuery.data?.hosted_events_enabled === false) {
    return (
      <div className="w-full space-y-4">
        <h1 className="font-display text-3xl font-bold">
          {softHostingDashboardTitle(chrome.dashboard_title)}
        </h1>
        <output className="block text-sm text-[var(--dama-muted)]">
          {softHostingFeatureDisabled(chrome.feature_disabled)}
        </output>
      </div>
    );
  }

  const data = dashQuery.data;
  const portalLinks = [
    {
      href: (chrome.portal_wallet_href || "").trim(),
      label: chrome.portal_wallet_label,
    },
    {
      href: (chrome.portal_payout_href || "").trim(),
      label: chrome.portal_payout_label,
    },
    {
      href: (chrome.portal_receipts_href || "").trim(),
      label: chrome.portal_receipts_label,
    },
    {
      href: (chrome.portal_transactions_href || "").trim(),
      label: chrome.portal_transactions_label,
    },
    {
      href: (chrome.portal_overview_href || "").trim(),
      label: chrome.portal_overview_label,
    },
    {
      href: (chrome.portal_public_list_href || "").trim(),
      label: softHostingPortalPublicListLabel(chrome.portal_public_list_label),
    },
  ].filter((l) => Boolean(l.href && l.label));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold">
              {softHostingDashboardTitle(chrome.dashboard_title)}
            </h1>
            <HostTrustBadge
              label={data?.host_trust_badge}
              tier={data?.host_trust_tier}
              className="text-[10px]"
            />
          </div>
          {(() => {
            const rep = hostReputationLine({
              finished: data?.host_finished_paid_cups,
              cancelled: data?.host_cancelled_paid_cups,
              openReports: data?.host_open_reports,
              finishedLabel: chrome.host_rep_finished_label,
              cancelledLabel: chrome.host_rep_cancelled_label,
              reportsLabel: chrome.host_rep_reports_label,
              separator: chrome.host_rep_meta_separator,
            });
            return rep ? <p className="mt-1 text-[11px] text-[var(--dama-muted)]">{rep}</p> : null;
          })()}
          <p className="mt-2 text-[var(--dama-muted)]">
            {softHostingDashboardBlurb(chrome.dashboard_blurb)}
          </p>
        </div>
        <Button asChild variant="gold">
          <Link href={chrome.portal_create_href}>
            {softHostingPortalCreateLabel(chrome.portal_create_label)}
          </Link>
        </Button>
      </div>

      {dashQuery.error ? (
        <p className="text-sm text-[var(--dama-danger)]">
          {softHostingFeatureDisabled(chrome.feature_disabled)}
        </p>
      ) : null}

      {dashQuery.isLoading ? (
        <StatGridSkeleton cols={7} count={8} />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {(() => {
              const empty = (chrome.empty_value || "").trim();
              const sep = chromeSeparator(chrome.amount_currency_separator);
              const cell = (n: unknown) =>
                typeof n === "number" && Number.isFinite(n) ? String(n) : empty;
              const money = (n: unknown, currency: string | undefined) => {
                const cur = (currency || "").trim();
                if (
                  typeof n !== "number" ||
                  !Number.isFinite(n) ||
                  !cur ||
                  !chromeSeparatorPresent(sep)
                ) {
                  return empty;
                }
                return `${n}${sep}${cur}`;
              };
              const balLabel = (walletChrome?.balance_label || "").trim();
              const balSep = chromeSeparator(walletChrome?.amount_currency_separator);
              const balValue =
                walletQuery.isLoading || !country
                  ? empty
                  : walletQuery.data &&
                      typeof walletQuery.data.balance === "number" &&
                      (walletQuery.data.currency || "").trim() &&
                      chromeSeparatorPresent(balSep)
                    ? `${walletQuery.data.balance}${balSep}${walletQuery.data.currency}`
                    : (walletChrome?.wallet_unavailable || "").trim() ||
                      (walletChrome?.balance_pending || "").trim() ||
                      empty;
              return [
                { label: chrome.kpi_active_label, value: cell(data.active_count) },
                { label: chrome.kpi_upcoming_label, value: cell(data.upcoming_count) },
                {
                  label: chrome.kpi_players_week_label,
                  value: cell(data.players_joined_this_week),
                },
                {
                  label: chrome.kpi_paused_boards_label,
                  value: cell(data.officially_paused_count),
                },
                {
                  label: chrome.kpi_paused_avg_label,
                  value: cell(data.official_pause_avg_seconds),
                },
                {
                  label: chrome.kpi_host_fee_revenue_label,
                  value: money(data.host_fee_revenue_sum, data.host_fee_currency),
                },
                {
                  label: chrome.kpi_entry_fee_gross_label,
                  value: money(data.entry_fee_gross_sum, data.entry_fee_currency),
                },
                {
                  label: chrome.kpi_entry_fee_commission_label,
                  value: money(data.entry_fee_commission_sum, data.entry_fee_currency),
                },
                {
                  label: chrome.kpi_entry_fee_net_label,
                  value: money(data.entry_fee_net_sum, data.entry_fee_currency),
                },
                ...(balLabel ? [{ label: balLabel, value: balValue }] : []),
              ]
                .filter(
                  (stat) =>
                    Boolean((stat.label || "").trim()) && Boolean((stat.value || "").trim()),
                )
                .map((stat) => (
                  <KpiCard
                    key={stat.label}
                    label={stat.label}
                    value={<span className="font-mono text-[var(--dama-gold)]">{stat.value}</span>}
                  />
                ));
            })()}
          </div>
          {(() => {
            const lastShare = resolveEventInviteShareUrl({
              shareUrl: data.last_event_share_url,
              joinCode: data.last_event_join_code,
              sharePathTemplate: catalogQuery.data?.share_path_template,
              origin: typeof window !== "undefined" ? window.location.origin : "",
            });
            if (!lastShare) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--dama-muted)]">
                <span className="font-medium text-[var(--dama-text)]">
                  {chrome.kpi_last_share_label}
                </span>
                {chrome.meta_separator}
                <Link
                  href={lastShare}
                  className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
                >
                  {(data.last_event_join_code || "").trim() || lastShare}
                </Link>
                {(chrome.copy_link_action || "").trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(lastShare);
                        toast.success(chrome.copied_blurb);
                      } catch {
                        toast.error(chrome.toast_copy_failed);
                      }
                    }}
                  >
                    {chrome.copy_link_action}
                  </Button>
                ) : null}
              </div>
            );
          })()}
        </>
      ) : null}

      <section className="space-y-3">
        {(chrome.portal_money_section_title || "").trim() ? (
          <h2 className="font-semibold text-[var(--dama-gold)]">
            {chrome.portal_money_section_title}
          </h2>
        ) : null}
        {(chrome.portal_payout_blurb || "").trim() ? (
          <p className="text-sm text-[var(--dama-muted)]">{chrome.portal_payout_blurb}</p>
        ) : null}
        <ul className="flex flex-wrap gap-2">
          {portalLinks.map((link) => (
            <li key={`${link.href}-${link.label}`}>
              <Button asChild variant="outline" size="sm">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
