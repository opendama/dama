"use client";

import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { parseListPageSize } from "@/lib/parse-list-page-size";

import { SignInLink } from "@/components/auth/SignInLink";
import { KpiCard } from "@/components/ui/kpi-card";
import { DashboardCardsSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useAdminActivityQuery,
  useAdminAvatarsQuery,
  useAdminConsoleChromeQuery,
  useAdminReceiptsQuery,
  useAdminTournamentsQuery,
  useAdminUsersQuery,
  useClientEnumsQuery,
  useConsoleFeatureFlagsQuery,
  useConsoleHostedEventsQuery,
  useConsoleNavQuery,
  useEventReportsQuery,
  useEventsAdminChromeQuery,
  useMyPermissionsQuery,
  useTournamentChromeQuery,
} from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { ConsoleNavModule } from "@/types/console";
import { isEventsAdminChromeReady } from "@/types/events-admin-chrome";
import { isTournamentChromeReady } from "@/types/tournament-chrome";
import {
  Activity,
  CalendarDays,
  Flag,
  Gamepad2,
  ImageIcon,
  LayoutGrid,
  Receipt,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

function consoleNavHref(modules: ConsoleNavModule[], path: string): string {
  const want = path.trim().replace(/\/$/, "");
  if (!want) return "";
  const hit = modules.find((m) => {
    const h = (m.href || "").trim().replace(/\/$/, "");
    return h === want || h.endsWith(want);
  });
  return (hit?.href || "").trim();
}

function OverviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const t = title.trim();
  if (!t) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--dama-text)]">{t}</h2>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {children}
      </div>
    </section>
  );
}

function emptyOrNumber(value: number | undefined, empty: string): string | number {
  return typeof value === "number" ? value : empty;
}

/** Trim/Smart Menu overview: live pulse + ops queues + platform KPIs. */
export default function AdminDashboardPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(Boolean(token) && isAdmin);
  const chromeReady = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const dash = chromeReady?.dashboard;
  const activityChrome = chromeReady?.activity;
  const navQuery = useConsoleNavQuery(isAdmin);
  const paymentsPageSize = parseListPageSize(chromeReady?.payments?.list_page_size);
  const avatarsPageSize = parseListPageSize(chromeReady?.avatars?.list_page_size);

  const eventsChromeQuery = useEventsAdminChromeQuery(isAdmin);
  const eventsChrome = isEventsAdminChromeReady(eventsChromeQuery.data)
    ? eventsChromeQuery.data
    : undefined;
  const eventsPageSize = parseListPageSize(eventsChrome?.list_page_size);
  const tournamentChromeQuery = useTournamentChromeQuery(isAdmin);
  const tournamentChrome = isTournamentChromeReady(tournamentChromeQuery.data)
    ? tournamentChromeQuery.data
    : undefined;
  const tournamentsPageSize = parseListPageSize(tournamentChrome?.list_page_size);

  const permsQuery = useMyPermissionsQuery(token, isAdmin);
  const enumsQuery = useClientEnumsQuery(isAdmin);
  const eventsPermissionKey = (eventsChrome?.permission_key || "").trim();
  const reportsPermissionKey = (eventsChrome?.reports_permission_key || "").trim();
  const canManageEvents =
    Boolean(eventsPermissionKey) &&
    permsQuery.data?.permissions?.includes(eventsPermissionKey) === true;
  const canManageReports =
    Boolean(reportsPermissionKey) &&
    permsQuery.data?.permissions?.includes(reportsPermissionKey) === true;
  const reportOpenStatus = (enumsQuery.data?.hosted_event_report_open_status || "").trim();

  const usersQuery = useAdminUsersQuery(token, isAdmin, 0, 1);
  const avatarsQuery = useAdminAvatarsQuery(
    token,
    isAdmin && avatarsPageSize > 0,
    0,
    avatarsPageSize,
  );
  const receiptsQuery = useAdminReceiptsQuery(
    token,
    isAdmin && paymentsPageSize > 0,
    0,
    paymentsPageSize,
    "",
    "pending",
  );
  const flagsQuery = useConsoleFeatureFlagsQuery(token);
  const activityQuery = useAdminActivityQuery(token, isAdmin && Boolean(activityChrome), "");
  const reportsQuery = useEventReportsQuery(
    token,
    isAdmin && canManageReports && Boolean(reportOpenStatus) && eventsPageSize > 0,
    reportOpenStatus,
    0,
    eventsPageSize,
  );
  const hostedQuery = useConsoleHostedEventsQuery(
    token,
    isAdmin && canManageEvents && eventsPageSize > 0,
    0,
    eventsPageSize,
  );
  const tournamentsQuery = useAdminTournamentsQuery(
    token,
    0,
    isAdmin && tournamentsPageSize > 0 ? tournamentsPageSize : 0,
  );

  const loading =
    Boolean(token) &&
    (roleLoading ||
      (isAdmin &&
        (chromeQuery.isLoading ||
          navQuery.isLoading ||
          usersQuery.isLoading ||
          avatarsQuery.isLoading ||
          receiptsQuery.isLoading ||
          flagsQuery.isLoading ||
          activityQuery.isLoading ||
          eventsChromeQuery.isLoading ||
          tournamentChromeQuery.isLoading ||
          permsQuery.isLoading ||
          enumsQuery.isLoading ||
          (canManageReports && reportOpenStatus && eventsPageSize > 0 && reportsQuery.isLoading) ||
          (canManageEvents && eventsPageSize > 0 && hostedQuery.isLoading) ||
          (tournamentsPageSize > 0 && tournamentsQuery.isLoading))));

  if (!hydrated || !token) {
    return (
      <div className="space-y-6">
        <DashboardCardsSkeleton />
      </div>
    );
  }

  if (roleLoading || loading) {
    return (
      <div className="space-y-6">
        <DashboardCardsSkeleton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <p className="text-sm">
        <SignInLink className="text-[var(--dama-gold)] underline" />
      </p>
    );
  }

  if (!dash || !chromeReady || !activityChrome) {
    const unavailable = adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error);
    return (
      <div className="p-6 text-sm text-[var(--dama-danger)]" role="alert">
        {unavailable}
      </div>
    );
  }

  const modules = navQuery.data?.modules ?? [];
  const usersHref = consoleNavHref(modules, "/users");
  const avatarsHref = consoleNavHref(modules, "/avatars");
  const paymentsHref = consoleNavHref(modules, "/payments");
  const flagsHref = consoleNavHref(modules, "/feature-flags");
  const activityHref = consoleNavHref(modules, "/activity");
  const eventsHref = consoleNavHref(modules, "/events");
  const tournamentsHref = consoleNavHref(modules, "/tournaments");

  const empty = (dash.empty_value || "").trim();
  const snap = activityQuery.data;
  const usersTotal = usersQuery.data?.meta?.total;
  const pendingAvatars =
    typeof avatarsQuery.data?.meta?.total === "number"
      ? avatarsQuery.data.meta.total
      : (avatarsQuery.data?.avatars?.length ?? 0);
  const pendingReceipts =
    typeof receiptsQuery.data?.meta?.total === "number" ? receiptsQuery.data.meta.total : undefined;
  const openReports =
    typeof reportsQuery.data?.meta?.total === "number" ? reportsQuery.data.meta.total : undefined;
  const hostedTotal =
    typeof hostedQuery.data?.meta?.total === "number" ? hostedQuery.data.meta.total : undefined;
  const tournamentsTotal =
    typeof tournamentsQuery.data?.meta?.total === "number"
      ? tournamentsQuery.data.meta.total
      : undefined;

  const flags = flagsQuery.data;
  const flagBools = flags
    ? (Object.values(flags as Record<string, unknown>).filter(
        (v) => typeof v === "boolean",
      ) as boolean[])
    : [];
  const flagsTotal = flagBools.length;
  const flagsOn = flagBools.filter(Boolean).length;

  const usersLabel = (chromeReady.users.page_title || "").trim();
  const avatarsLabel = (chromeReady.avatars.page_title || "").trim();
  const receiptsLabel = (chromeReady.payments.receipts_section_title || "").trim();
  const flagsLabel = (chromeReady.feature_flags.page_title || "").trim();
  const modulesLabel = (dash.kpi_modules_label || "").trim();
  const openReportsLabel = (dash.kpi_open_reports_label || "").trim();
  const hostedLabel = (dash.kpi_hosted_cups_label || "").trim();
  const tournamentsLabel = (dash.kpi_tournaments_label || "").trim();

  const liveTitle = (dash.section_live_title || "").trim();
  const opsTitle = (dash.section_ops_title || "").trim();
  const platformTitle = (dash.section_platform_title || "").trim();

  const showLive = Boolean(snap) && !activityQuery.isError;
  const showReports =
    canManageReports && Boolean(reportOpenStatus) && eventsPageSize > 0 && eventsHref;
  const showHosted = canManageEvents && eventsPageSize > 0 && eventsHref;
  const showTournaments = tournamentsPageSize > 0 && tournamentsHref;

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{dash.page_title}</h1>
        {(dash.page_blurb || "").trim() ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--dama-muted)]">{dash.page_blurb}</p>
        ) : null}
      </div>

      {navQuery.error ? (
        <p className="text-sm text-[var(--dama-danger)]">{dash.nav_unavailable}</p>
      ) : (
        <>
          {showLive && snap ? (
            <OverviewSection title={liveTitle}>
              <KpiCard
                label={(activityChrome.kpi_online_now || "").trim()}
                value={snap.online_now}
                href={activityHref || undefined}
                icon={Activity}
              />
              <KpiCard
                label={(activityChrome.kpi_playing_now || "").trim()}
                value={snap.playing_now}
                href={activityHref || undefined}
                icon={Gamepad2}
              />
              <KpiCard
                label={(activityChrome.kpi_dau || "").trim()}
                value={snap.dau}
                href={activityHref || undefined}
                icon={Users}
              />
              <KpiCard
                label={(activityChrome.kpi_wau || "").trim()}
                value={snap.wau}
                href={activityHref || undefined}
                icon={Users}
              />
              <KpiCard
                label={(activityChrome.kpi_mau || "").trim()}
                value={snap.mau}
                href={activityHref || undefined}
                icon={Users}
              />
            </OverviewSection>
          ) : null}

          <OverviewSection title={opsTitle}>
            {avatarsLabel && avatarsHref ? (
              <KpiCard
                label={avatarsLabel}
                value={pendingAvatars}
                href={avatarsHref}
                icon={ImageIcon}
              />
            ) : null}
            {receiptsLabel && paymentsHref && paymentsPageSize > 0 ? (
              <KpiCard
                label={receiptsLabel}
                value={emptyOrNumber(pendingReceipts, empty)}
                href={paymentsHref}
                icon={Receipt}
              />
            ) : null}
            {showReports && openReportsLabel ? (
              <KpiCard
                label={openReportsLabel}
                value={emptyOrNumber(openReports, empty)}
                href={eventsHref}
                icon={ShieldAlert}
              />
            ) : null}
            {showHosted && hostedLabel ? (
              <KpiCard
                label={hostedLabel}
                value={emptyOrNumber(hostedTotal, empty)}
                href={eventsHref}
                icon={CalendarDays}
              />
            ) : null}
            {showTournaments && tournamentsLabel ? (
              <KpiCard
                label={tournamentsLabel}
                value={emptyOrNumber(tournamentsTotal, empty)}
                href={tournamentsHref}
                icon={Trophy}
              />
            ) : null}
          </OverviewSection>

          <OverviewSection title={platformTitle}>
            {modulesLabel ? (
              <KpiCard label={modulesLabel} value={modules.length} icon={LayoutGrid} />
            ) : null}
            {usersLabel && usersHref ? (
              <KpiCard
                label={usersLabel}
                value={emptyOrNumber(usersTotal, empty)}
                href={usersHref}
                icon={Users}
              />
            ) : null}
            {flagsLabel && flagsTotal > 0 && flagsHref ? (
              <KpiCard
                label={flagsLabel}
                value={`${flagsOn}/${flagsTotal}`}
                href={flagsHref}
                icon={Flag}
              />
            ) : null}
          </OverviewSection>
        </>
      )}
    </div>
  );
}
