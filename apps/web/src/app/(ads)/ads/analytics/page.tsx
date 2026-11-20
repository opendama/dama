"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { type OpsColumn, OpsDataTable } from "@/components/ui/ops-data-table";
import {
  AnalyticsPageSkeleton,
  OpsDataTableSkeleton,
  ShimmerBlock,
  StatGridSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useDownloadAdsInvoiceMutation } from "@/hooks/mutation/useDownloadAdsInvoiceMutation";
import { useAdAnalyticsQuery } from "@/hooks/query/useAdAnalyticsQuery";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { usePublisherDashboardQuery } from "@/hooks/query/usePublisherDashboardQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import type { AdCampaignAnalyticsRow } from "@/types/ads";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import { useMemo } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function AdsAnalyticsPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const playbackQuery = useAdPlaybackQuery(Boolean(token));
  const chrome = playbackQuery.data?.schedule_chrome;
  const pageSize = parseListPageSize(chrome?.list_page_size);

  const { data, isLoading } = useAdAnalyticsQuery(token, pageSize);
  const dashQuery = usePublisherDashboardQuery(token);
  const walletChromeQuery = useWalletChromeQuery(Boolean(token));
  const walletChrome = isWalletChromeReady(walletChromeQuery.data)
    ? walletChromeQuery.data
    : undefined;
  const downloadInvoice = useDownloadAdsInvoiceMutation(token);

  const campaignColumns = useMemo((): OpsColumn<AdCampaignAnalyticsRow>[] => {
    if (!chrome) return [];
    const sep = chrome.meta_separator;
    const cols: OpsColumn<AdCampaignAnalyticsRow>[] = [
      {
        id: "title",
        header: chrome.publisher_campaigns_heading,
        cell: (c) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{c.title}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">
              {(c.status_label || "").trim() || (chrome.empty_value || "").trim()}
              {c.auto_closed && (chrome.auto_closed_badge || "").trim()
                ? `${sep}${chrome.auto_closed_badge}`
                : ""}
            </p>
          </div>
        ),
      },
      {
        id: "impressions",
        header: chrome.publisher_stat_impressions,
        cell: (c) => (
          <span className="tabular-nums text-sm">
            {typeof c.impressions === "number" ? c.impressions : (chrome.empty_value || "").trim()}
          </span>
        ),
      },
      {
        id: "reach",
        header: chrome.publisher_stat_reach,
        cell: (c) => (
          <span className="tabular-nums text-sm">
            {typeof c.unique_reach === "number"
              ? c.unique_reach
              : (chrome.empty_value || "").trim()}
          </span>
        ),
      },
      {
        id: "clicks",
        header: chrome.publisher_stat_clicks,
        cell: (c) => (
          <span className="tabular-nums text-sm">
            {typeof c.clicks === "number" ? c.clicks : (chrome.empty_value || "").trim()}
          </span>
        ),
      },
      {
        id: "completions",
        header: chrome.publisher_stat_completion,
        cell: (c) => (
          <span className="tabular-nums text-sm">
            {typeof c.video_completions === "number"
              ? c.video_completions
              : (chrome.empty_value || "").trim()}
          </span>
        ),
      },
    ];
    return cols.filter((col) => Boolean((col.header || "").trim()));
  }, [chrome]);

  const dash = dashQuery.data;
  const empty = (chrome?.empty_value || "").trim();
  const impressions =
    dash != null && typeof dash.totalImpressions === "number"
      ? String(dash.totalImpressions)
      : empty;
  const clicks =
    dash != null && typeof dash.totalClicks === "number" ? String(dash.totalClicks) : empty;
  const uniqueReach =
    dash != null && typeof dash.totalUniqueReach === "number"
      ? String(dash.totalUniqueReach)
      : empty;
  const ctr =
    dash != null && typeof dash.ctrPercent === "number" ? dash.ctrPercent.toFixed(2) : empty;
  const moneySep = chromeSeparator(walletChrome?.amount_currency_separator);
  const moneyCell = (amount: number | undefined, currency: string | undefined) => {
    const cur = (currency || "").trim();
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      !cur ||
      !chromeSeparatorPresent(moneySep)
    ) {
      return empty;
    }
    return `${amount}${moneySep}${cur}`;
  };
  const cpc =
    dash != null && typeof dash.cpc === "number"
      ? moneyCell(Number(dash.cpc.toFixed(4)), dash.cpcCurrency)
      : empty;
  const completionRate =
    dash != null && typeof dash.completionPercent === "number"
      ? dash.completionPercent.toFixed(2)
      : empty;

  if (!hydrated) {
    return (
      <AnalyticsPageSkeleton
        kpiCols={6}
        tableColumns={5}
        showInvoiceCta
        wrapTable={false}
        denseKpis
      />
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (playbackQuery.isLoading) {
    return (
      <AnalyticsPageSkeleton
        kpiCols={6}
        tableColumns={5}
        showInvoiceCta
        wrapTable={false}
        denseKpis
      />
    );
  }

  if (playbackQuery.isError || !chrome) {
    const unavailable = (playbackQuery.data?.schedule_chrome?.playback_unavailable || "").trim();
    return (
      <div className="w-full space-y-6">
        {unavailable ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert" data-error="ad_playback">
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{chrome.publisher_analytics_title}</h1>
        <p className="mt-2 text-sm text-[var(--dama-muted)]">{chrome.publisher_analytics_body}</p>
      </div>

      {isLoading || dashQuery.isLoading ? (
        <>
          <StatGridSkeleton cols={6} dense />
          <ShimmerBlock className="h-4 w-40" />
          <OpsDataTableSkeleton columns={5} rows={6} showPagination={false} />
        </>
      ) : dashQuery.isError || dash == null ? (
        <p className="text-sm text-[var(--dama-danger)]">{chrome.publisher_dash_load_failed}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: chrome.publisher_stat_impressions, value: String(impressions) },
              { label: chrome.publisher_stat_reach, value: String(uniqueReach) },
              { label: chrome.publisher_stat_clicks, value: String(clicks) },
              { label: chrome.publisher_stat_ctr, value: ctr },
              { label: chrome.publisher_stat_cpc, value: cpc },
              { label: chrome.publisher_stat_completion, value: completionRate },
            ]
              .filter(
                (stat) => Boolean((stat.label || "").trim()) && Boolean((stat.value || "").trim()),
              )
              .map((stat) => (
                <KpiCard
                  key={stat.label}
                  label={stat.label}
                  value={<span className="font-mono text-[var(--dama-gold)]">{stat.value}</span>}
                />
              ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-sm text-[var(--dama-gold)] underline hover:bg-transparent"
            isLoading={downloadInvoice.isPending}
            pendingLabel={chrome.publisher_invoice_pending}
            onClick={() => {
              downloadInvoice.mutate(undefined, {
                onError: () => {
                  const msg = (chrome.publisher_invoice_failed || "").trim();
                  if (msg) toast.error(msg);
                },
              });
            }}
          >
            {chrome.publisher_invoice_action}
          </Button>
          {campaignColumns.length > 0 ? (
            <OpsDataTable
              columns={campaignColumns}
              data={data ?? []}
              getRowId={(c) => c.id}
              empty={<span>{chrome.publisher_no_campaigns}</span>}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
