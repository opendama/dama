"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ListRowsSkeleton,
  PortalDashboardSkeleton,
  ShimmerBlock,
  StatGridSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { useAdCampaignsQuery } from "@/hooks/query/useAdCampaignsQuery";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { usePublisherDashboardQuery } from "@/hooks/query/usePublisherDashboardQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { CountryFlag } from "@/lib/country-flag";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import Link from "next/link";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function AdsDashboardPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const playbackQuery = useAdPlaybackQuery(Boolean(token));
  const chrome = playbackQuery.data?.schedule_chrome;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const [skip, setSkip] = useUrlSkip("skip");

  const { data, isLoading, error } = usePublisherDashboardQuery(token);
  const campaignsQuery = useAdCampaignsQuery(token, skip, pageSize);
  const pageCampaigns = campaignsQuery.data?.campaigns ?? [];
  const campaignMeta = campaignsQuery.data?.meta;
  const emptyDash = (chrome?.empty_value || "").trim();
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const walletQuery = useWalletQuery(token, Boolean(token) && geoQuery.isFetched);
  const walletChromeQuery = useWalletChromeQuery(Boolean(token));
  const walletChrome = isWalletChromeReady(walletChromeQuery.data)
    ? walletChromeQuery.data
    : undefined;
  const impressions =
    data != null && typeof data.totalImpressions === "number"
      ? String(data.totalImpressions)
      : emptyDash;
  const clicks =
    data != null && typeof data.totalClicks === "number" ? String(data.totalClicks) : emptyDash;
  const reach =
    data != null && typeof data.totalUniqueReach === "number"
      ? String(data.totalUniqueReach)
      : emptyDash;
  const ctr =
    data != null && typeof data.ctrPercent === "number" ? data.ctrPercent.toFixed(2) : emptyDash;
  const balSep = chromeSeparator(walletChrome?.amount_currency_separator);
  const moneyCell = (amount: number | undefined, currency: string | undefined) => {
    const cur = (currency || "").trim();
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      !cur ||
      !chromeSeparatorPresent(balSep)
    ) {
      return emptyDash;
    }
    return `${amount}${balSep}${cur}`;
  };
  const cpc =
    data != null && typeof data.cpc === "number"
      ? moneyCell(Number(data.cpc.toFixed(4)), data.cpcCurrency)
      : emptyDash;
  const completionPct =
    data != null && typeof data.completionPercent === "number"
      ? data.completionPercent.toFixed(2)
      : emptyDash;
  const createFeeSpend =
    data != null && typeof data.createFeeSpendSum === "number"
      ? moneyCell(data.createFeeSpendSum, data.createFeeSpendCurrency)
      : emptyDash;
  const balLabel = (walletChrome?.balance_label || "").trim();
  const balValue =
    walletQuery.isLoading || !country
      ? emptyDash
      : walletQuery.data &&
          typeof walletQuery.data.balance === "number" &&
          (walletQuery.data.currency || "").trim() &&
          chromeSeparatorPresent(balSep)
        ? `${walletQuery.data.balance}${balSep}${walletQuery.data.currency}`
        : (walletChrome?.wallet_unavailable || "").trim() ||
          (walletChrome?.balance_pending || "").trim() ||
          emptyDash;

  if (!hydrated) {
    return (
      <PortalDashboardSkeleton
        kpiCols={8}
        kpiCount={8}
        showCampaignList
        listRows={3}
        portalLinkCount={5}
        portalVariant="ads"
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

  if (playbackQuery.isLoading) {
    return (
      <PortalDashboardSkeleton
        kpiCols={8}
        kpiCount={8}
        showCampaignList
        listRows={3}
        portalLinkCount={5}
        portalVariant="ads"
      />
    );
  }

  if (playbackQuery.isError || !chrome || pageSize < 1) {
    const unavailable = (playbackQuery.data?.schedule_chrome?.playback_unavailable || "").trim();
    return (
      <div className="w-full space-y-4">
        {unavailable ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert" data-error="ad_playback">
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{chrome.publisher_dash_title}</h1>
        <p className="mt-2 text-[var(--dama-muted)]">{chrome.publisher_dash_body}</p>
        {data?.me?.username ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--dama-muted)]">
            <span className="truncate">{data.me.username}</span>
            <CountryFlag code={data.me.countryCode} />
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--dama-danger)]">{chrome.publisher_dash_load_failed}</p>
      ) : null}

      {isLoading || campaignsQuery.isLoading ? (
        <>
          <StatGridSkeleton cols={8} count={8} showBody />
          <section className="space-y-2">
            <ShimmerBlock className="h-5 w-40" />
            <ListRowsSkeleton count={3} showPagination />
          </section>
        </>
      ) : (
        <>
          {data ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { label: chrome.publisher_stat_impressions, value: impressions },
                { label: chrome.publisher_stat_reach, value: reach },
                { label: chrome.publisher_stat_clicks, value: clicks },
                { label: chrome.publisher_stat_ctr, value: ctr },
                { label: chrome.publisher_stat_cpc, value: cpc },
                { label: chrome.publisher_stat_completion, value: completionPct },
                {
                  label: chrome.publisher_stat_create_fee,
                  value: createFeeSpend,
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
                    body={chrome.publisher_stat_source_note}
                  />
                ))}
            </div>
          ) : null}

          <section className="space-y-2">
            <h2 className="font-semibold text-[var(--dama-gold)]">
              {chrome.publisher_campaigns_heading}
              {chrome.paren_open}
              {typeof campaignMeta?.total === "number" ? campaignMeta.total : emptyDash}
              {chrome.paren_close}
            </h2>
            {pageCampaigns.length === 0 ? (
              <p className="text-sm text-[var(--dama-muted)]">{chrome.publisher_no_campaigns}</p>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {pageCampaigns.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3 text-sm"
                    >
                      <p className="font-medium">{c.title}</p>
                      <p className="text-[var(--dama-muted)]">
                        {(c.status_label || "").trim() || (chrome.empty_value || "").trim()}
                        {chrome.meta_separator}
                        {(c.creative_type_label || "").trim() || (chrome.empty_value || "").trim()}
                        {chrome.meta_separator}
                        {typeof c.impressions === "number" ? c.impressions : emptyDash}{" "}
                        {chrome.stats_impressions_suffix}
                        {chrome.meta_separator}
                        {typeof c.unique_reach === "number" ? c.unique_reach : emptyDash}{" "}
                        {chrome.stats_reach_suffix}
                        {chrome.meta_separator}
                        {typeof c.clicks === "number" ? c.clicks : emptyDash}{" "}
                        {chrome.stats_clicks_suffix}
                        {chrome.meta_separator}
                        {typeof c.video_completions === "number" ? c.video_completions : emptyDash}{" "}
                        {chrome.publisher_stat_completion}
                      </p>
                    </li>
                  ))}
                </ul>
                <SkipPagination
                  meta={campaignMeta}
                  onPrev={setSkip}
                  onNext={setSkip}
                  disabled={campaignsQuery.isFetching && !campaignsQuery.isLoading}
                  inputId="ads-dashboard-campaigns-skip"
                />
              </div>
            )}
          </section>
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-[var(--dama-gold)]">
          {chrome.publisher_portal_section_title}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={chrome.publisher_portal_create_href}
            className="inline-flex rounded-md bg-[var(--dama-gold)] px-3 py-2 text-sm font-medium text-[var(--dama-bg)]"
          >
            {chrome.publisher_portal_create_label}
          </Link>
          <Link
            href={chrome.publisher_manage_campaigns_href}
            className="inline-flex rounded-md border border-[var(--dama-border)] px-3 py-2 text-sm text-[var(--dama-text)]"
          >
            {chrome.publisher_manage_campaigns}
          </Link>
        </div>
        {(chrome.publisher_portal_payout_blurb || "").trim() ? (
          <p className="text-sm text-[var(--dama-muted)]">{chrome.publisher_portal_payout_blurb}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link
            href={chrome.publisher_portal_overview_href}
            className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
          >
            {chrome.publisher_portal_overview_label}
          </Link>
          {(chrome.publisher_portal_wallet_href || "").trim() ? (
            <Link
              href={chrome.publisher_portal_wallet_href}
              className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
            >
              {chrome.publisher_portal_wallet_label}
            </Link>
          ) : null}
          {(chrome.publisher_portal_payout_href || "").trim() &&
          (chrome.publisher_portal_payout_label || "").trim() ? (
            <Link
              href={chrome.publisher_portal_payout_href}
              className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
            >
              {chrome.publisher_portal_payout_label}
            </Link>
          ) : null}
          {(chrome.publisher_portal_receipts_href || "").trim() ? (
            <Link
              href={chrome.publisher_portal_receipts_href}
              className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
            >
              {chrome.publisher_portal_receipts_label}
            </Link>
          ) : null}
          {(chrome.publisher_portal_transactions_href || "").trim() ? (
            <Link
              href={chrome.publisher_portal_transactions_href}
              className="text-[var(--dama-gold)] underline-offset-4 hover:underline"
            >
              {chrome.publisher_portal_transactions_label}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
