"use client";

import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";

import { SignInLink } from "@/components/auth/SignInLink";
import { ActivityDashboardSections } from "@/components/ui/activity-dashboard-sections";
import { ActivityStackedChart } from "@/components/ui/activity-stacked-chart";
import { Card, CardContent } from "@/components/ui/card";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityBodySkeleton, ActivityPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAdminConsoleChromeQuery } from "@/hooks/query";
import { useAdminActivityQuery } from "@/hooks/query/useAdminActivityQuery";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useRef, useState } from "react";

export default function AdminActivityPage() {
  const queryClient = useQueryClient();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(Boolean(token) && isAdmin);
  const chromeReady = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const chrome = chromeReady?.activity;

  // "" until first snapshot - then aligned to API period without a second network hop.
  const [period, setPeriod] = useState("");
  const seededPeriodKey = useRef(false);
  const activityQuery = useAdminActivityQuery(token, isAdmin && Boolean(chrome), period);

  const periodOptions = activityQuery.data?.period_options ?? [];
  const selectPeriod =
    (period && periodOptions.some((o) => o.id === period) && period) ||
    (activityQuery.data?.period || "").trim() ||
    undefined;

  useEffect(() => {
    if (seededPeriodKey.current || period) return;
    const snap = activityQuery.data;
    if (!snap || activityQuery.isPlaceholderData) return;
    const apiPeriod = (snap.period || "").trim();
    if (!apiPeriod) return;
    seededPeriodKey.current = true;
    queryClient.setQueryData(["console", "activity", apiPeriod], snap);
    setPeriod(apiPeriod);
  }, [period, queryClient, activityQuery.data, activityQuery.isPlaceholderData]);

  if (!hydrated || !token) {
    return <ActivityPageSkeleton />;
  }

  if (roleLoading || (isAdmin && chromeQuery.isLoading)) {
    return <ActivityPageSkeleton />;
  }

  if (!isAdmin) {
    return (
      <p className="text-sm">
        <SignInLink className="text-[var(--dama-gold)] underline" />
      </p>
    );
  }

  if (!chrome || !chromeReady) {
    return (
      <div className="p-6 text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </div>
    );
  }

  const data = activityQuery.data;
  // First load only - period changes keep prior paint (keepPreviousData).
  const initialBodyPending = activityQuery.isPending && !data;
  // Progress only on period key change, not background refetch.
  const softFetching = activityQuery.isFetching && activityQuery.isPlaceholderData;
  const sections = data?.kpi_sections ?? [];
  const seriesTitle = (data?.series_title || "").trim();
  const seriesSubtitle = (data?.series_subtitle || "").trim();
  const seriesYAxis = (data?.series_y_axis || "").trim();
  const seriesEmpty = (data?.series_empty || "").trim();
  const seriesLegendAria = (data?.series_legend_aria || "").trim();
  const seriesToday = (data?.series_today_label || "").trim();
  const todayDay = (data?.today_day || "").trim();

  return (
    <div className="relative w-full space-y-8">
      <FetchProgressBar active={softFetching} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{chrome.page_title}</h1>
          {(chrome.page_blurb || "").trim() ? (
            <p className="mt-1 max-w-3xl text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
          ) : null}
        </div>
        {periodOptions.length ? (
          <div className="w-full max-w-xs space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
              {chrome.period_label}
            </p>
            <Select
              value={selectPeriod}
              onValueChange={(next) => {
                startTransition(() => setPeriod(next));
              }}
            >
              <SelectTrigger aria-label={chrome.period_label}>
                <SelectValue placeholder={chrome.period_label} />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {activityQuery.isError && !data ? (
        <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
      ) : null}

      {initialBodyPending ? <ActivityBodySkeleton /> : null}

      {!initialBodyPending && data && sections.length ? (
        <>
          {sections.map((sec) => (
            <section key={sec.id} className="space-y-3" aria-busy={softFetching || undefined}>
              <h2 className="text-sm font-semibold text-[var(--dama-text)]">{sec.title}</h2>
              <div
                className={
                  sec.items.length >= 4
                    ? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    : "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                }
              >
                {sec.items.map((item) => (
                  <KpiCard key={item.id} label={item.label} value={item.value} />
                ))}
              </div>
            </section>
          ))}

          {seriesTitle && seriesEmpty && seriesLegendAria && (data.series_meta?.length ?? 0) > 0 ? (
            <Card className="relative min-w-0">
              <CardContent className="min-w-0 overflow-visible pt-6">
                <ActivityStackedChart
                  title={seriesTitle}
                  subtitle={seriesSubtitle}
                  yAxisLabel={seriesYAxis}
                  series={data.series ?? []}
                  seriesMeta={data.series_meta}
                  emptyLabel={seriesEmpty}
                  legendAria={seriesLegendAria}
                  todayDay={todayDay}
                  todayLabel={seriesToday}
                  isFetching={softFetching}
                />
              </CardContent>
            </Card>
          ) : null}

          <ActivityDashboardSections data={data} isFetching={softFetching} />
        </>
      ) : null}
    </div>
  );
}
