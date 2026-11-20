"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { KpiCard } from "@/components/ui/kpi-card";
import { type OpsColumn, OpsDataTable } from "@/components/ui/ops-data-table";
import {
  AnalyticsPageSkeleton,
  OpsDataTableSkeleton,
  StatGridSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useEventsAnalyticsQuery } from "@/hooks/query/useEventsAnalyticsQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useEventsOrganizerChromeQuery } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import type { EventsAnalyticsRow } from "@/types/events";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import {
  softHostingAnalyticsBlurb,
  softHostingAnalyticsEmpty,
  softHostingAnalyticsTitle,
  softHostingChromeUnavailable,
  softHostingFeatureDisabled,
  softHostingListTitle,
} from "@/lib/hosting-organizer-chrome-soft";
import { isEventsOrganizerChromeReady } from "@/types/events-organizer-chrome";
import { useMemo } from "react";

export default function EventsAnalyticsPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const chromeQuery = useEventsOrganizerChromeQuery(Boolean(token) || !hydrated);
  const chrome = isEventsOrganizerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const catalogQuery = useEventsCatalogQuery(Boolean(token));
  const analyticsQuery = useEventsAnalyticsQuery(token);

  const columns = useMemo((): OpsColumn<EventsAnalyticsRow>[] => {
    if (!chrome) return [];
    const cols: OpsColumn<EventsAnalyticsRow>[] = [
      {
        id: "title",
        header: softHostingListTitle(chrome.list_title),
        cell: (row: EventsAnalyticsRow) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">
              {(row.status_label || "").trim() || (chrome.empty_value || "").trim()}
              {chrome.meta_separator}
              {row.join_code}
            </p>
          </div>
        ),
      },
      {
        id: "players",
        header: chrome.analytics_players_label,
        cell: (row: EventsAnalyticsRow) => {
          const empty = (chrome.empty_value || "").trim();
          return (
            <span className="tabular-nums text-sm">
              {typeof row.players_joined === "number" ? row.players_joined : empty}
            </span>
          );
        },
      },
      {
        id: "started",
        header: chrome.analytics_started_label,
        cell: (row: EventsAnalyticsRow) => (
          <span className="text-sm">
            {row.started ? chrome.analytics_started_label : (chrome.empty_value || "").trim()}
          </span>
        ),
      },
      {
        id: "finished",
        header: chrome.analytics_completion_label,
        cell: (row: EventsAnalyticsRow) => (
          <span className="text-sm">
            {row.finished ? chrome.analytics_completion_label : (chrome.empty_value || "").trim()}
          </span>
        ),
      },
      {
        id: "host_fee",
        header: chrome.analytics_host_fee_label,
        cell: (row: EventsAnalyticsRow) => {
          const empty = (chrome.empty_value || "").trim();
          const sep = chromeSeparator(chrome.amount_currency_separator);
          const cur = (row.host_fee_currency || "").trim();
          if (typeof row.host_fee !== "number" || !cur || !chromeSeparatorPresent(sep)) {
            return <span className="tabular-nums text-sm">{empty}</span>;
          }
          return (
            <span className="tabular-nums text-sm">
              {row.host_fee}
              {sep}
              {cur}
            </span>
          );
        },
      },
      {
        id: "entry_fees",
        header: chrome.analytics_entry_fees_label,
        cell: (row: EventsAnalyticsRow) => {
          const empty = (chrome.empty_value || "").trim();
          const sep = chromeSeparator(chrome.amount_currency_separator);
          const cur = (row.entry_fee_currency || "").trim();
          if (typeof row.entry_fees_sum !== "number" || !cur || !chromeSeparatorPresent(sep)) {
            return <span className="tabular-nums text-sm">{empty}</span>;
          }
          return (
            <span className="tabular-nums text-sm">
              {row.entry_fees_sum}
              {sep}
              {cur}
            </span>
          );
        },
      },
      {
        id: "entry_commission",
        header: chrome.analytics_commission_label,
        cell: (row: EventsAnalyticsRow) => {
          const empty = (chrome.empty_value || "").trim();
          const sep = chromeSeparator(chrome.amount_currency_separator);
          const cur = (row.entry_fee_currency || "").trim();
          if (
            typeof row.entry_commission_sum !== "number" ||
            !cur ||
            !chromeSeparatorPresent(sep)
          ) {
            return <span className="tabular-nums text-sm">{empty}</span>;
          }
          return (
            <span className="tabular-nums text-sm">
              {row.entry_commission_sum}
              {sep}
              {cur}
            </span>
          );
        },
      },
      {
        id: "entry_net",
        header: chrome.analytics_entry_net_label,
        cell: (row: EventsAnalyticsRow) => {
          const empty = (chrome.empty_value || "").trim();
          const sep = chromeSeparator(chrome.amount_currency_separator);
          const cur = (row.entry_fee_currency || "").trim();
          if (typeof row.entry_net_sum !== "number" || !cur || !chromeSeparatorPresent(sep)) {
            return <span className="tabular-nums text-sm">{empty}</span>;
          }
          return (
            <span className="tabular-nums text-sm">
              {row.entry_net_sum}
              {sep}
              {cur}
            </span>
          );
        },
      },
    ];
    return cols.filter((col) => Boolean((col.header || "").trim()));
  }, [chrome]);

  if (!hydrated) {
    return (
      <AnalyticsPageSkeleton kpiCols={7} tableColumns={8} tableRows={4} showMetricsNote wrapTable />
    );
  }

  if (!token) {
    return (
      <div className="w-full space-y-6">
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (chromeQuery.isLoading) {
    return (
      <AnalyticsPageSkeleton kpiCols={7} tableColumns={8} tableRows={4} showMetricsNote wrapTable />
    );
  }

  if (chromeQuery.isError || !chrome) {
    const unavailable = softHostingChromeUnavailable(
      (chromeQuery.data?.events_organizer_chrome_unavailable || "").trim(),
    );
    return (
      <div className="w-full space-y-6">
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
      <AnalyticsPageSkeleton kpiCols={7} tableColumns={8} tableRows={4} showMetricsNote wrapTable />
    );
  }

  if (catalogQuery.data?.hosted_events_enabled === false) {
    return (
      <div className="w-full space-y-6">
        <h1 className="font-display text-3xl font-bold">
          {softHostingAnalyticsTitle(chrome.analytics_title)}
        </h1>
        <output className="block text-sm text-[var(--dama-muted)]">
          {softHostingFeatureDisabled(chrome.feature_disabled)}
        </output>
      </div>
    );
  }

  const totals = analyticsQuery.data?.totals;
  const rows = analyticsQuery.data?.events ?? [];

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">
          {softHostingAnalyticsTitle(chrome.analytics_title)}
        </h1>
        <p className="mt-2 text-sm text-[var(--dama-muted)]">
          {softHostingAnalyticsBlurb(chrome.analytics_blurb)}
        </p>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">{chrome.analytics_metrics_note}</p>
      </div>

      {analyticsQuery.isLoading ? (
        <StatGridSkeleton cols={7} />
      ) : totals ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
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
            return [
              {
                label: chrome.analytics_players_label,
                value: cell(totals.players_joined),
              },
              {
                label: chrome.analytics_started_label,
                value: cell(totals.events_started),
              },
              {
                label: chrome.analytics_completion_label,
                value: cell(totals.events_finished),
              },
              {
                label: chrome.analytics_host_fee_label,
                value: money(totals.host_fee_sum, totals.host_fee_currency),
              },
              {
                label: chrome.analytics_entry_fees_label,
                value: money(totals.entry_fees_sum, totals.entry_fee_currency),
              },
              {
                label: chrome.analytics_commission_label,
                value: money(totals.entry_commission_sum, totals.entry_fee_currency),
              },
              {
                label: chrome.analytics_entry_net_label,
                value: money(totals.entry_net_sum, totals.entry_fee_currency),
              },
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
              ));
          })()}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        {analyticsQuery.isLoading ? (
          <div className="p-2">
            <OpsDataTableSkeleton columns={8} rows={4} embedded showPagination={false} />
          </div>
        ) : (
          <OpsDataTable
            className="rounded-none border-0"
            columns={columns}
            data={rows}
            getRowId={(r) => r.event_id}
            empty={<span>{softHostingAnalyticsEmpty(chrome.analytics_empty)}</span>}
          />
        )}
      </div>
    </div>
  );
}
