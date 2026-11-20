"use client";

import { ProfileMyTournaments } from "@/components/profile/ProfileMyTournaments";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  OpsDataTableSkeleton,
  PlayerDashboardSkeleton,
  ShimmerBlock,
  StatGridSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useMeQuery } from "@/hooks/query/useMeQuery";
import { useMyMatchesQuery } from "@/hooks/query/useMyMatchesQuery";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { useProfileInspectChromeQuery } from "@/hooks/query/useProfileInspectChromeQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { useWalletQuery } from "@/hooks/query/useWalletQuery";
import { CountryFlag } from "@/lib/country-flag";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import { isProfileInspectChromeReady } from "@/types/profile-inspect-chrome";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import Link from "next/link";

export default function PlayerDashboardPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const authAvatarThumb = useAuthStore((s) => s.user?.avatarThumbUrl);
  const authAvatarFull = useAuthStore((s) => s.user?.avatarFullUrl);

  const meQuery = useMeQuery(token);
  const navQuery = useClientNavFullQuery(true);
  const inspectChromeQuery = useProfileInspectChromeQuery(true);
  const railChromeQuery = usePlayRailChromeQuery(true);
  const matchesPageSize = (() => {
    const raw = isPlayRailChromeReady(railChromeQuery.data)
      ? railChromeQuery.data.list_page_size
      : "";
    const n = Number.parseInt(String(raw || "").trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const matchesQuery = useMyMatchesQuery(token, matchesPageSize);
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const walletQuery = useWalletQuery(token, Boolean(token) && geoQuery.isFetched);
  const walletChromeQuery = useWalletChromeQuery(Boolean(token));
  const walletChrome = isWalletChromeReady(walletChromeQuery.data)
    ? walletChromeQuery.data
    : undefined;

  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const inspectChrome = isProfileInspectChromeReady(inspectChromeQuery.data)
    ? inspectChromeQuery.data
    : undefined;

  if (navQuery.isLoading || inspectChromeQuery.isLoading) {
    return <PlayerDashboardSkeleton />;
  }

  if (!nav || !inspectChrome) {
    const unavailable = (navQuery.data?.dashboard_unavailable || "").trim();
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

  if (!hydrated || !token) {
    return <PlayerDashboardSkeleton />;
  }

  const historyTitle = (nav.dashboard_history_title || "").trim();
  const historyEmpty = (nav.dashboard_history_empty || "").trim();
  const historyUnavailable = (nav.dashboard_history_unavailable || "").trim();
  const me = meQuery.data;
  const outcomeWin = (inspectChrome.outcome_win || inspectChrome.label_wins || "").trim();
  const outcomeLoss = (inspectChrome.outcome_loss || inspectChrome.label_losses || "").trim();
  const outcomeDraw = (inspectChrome.outcome_draw || inspectChrome.label_draws || "").trim();

  const emptyValue = (inspectChrome.empty_value || "").trim();
  const winsN = typeof me?.wins === "number" ? me.wins : null;
  const lossesN = typeof me?.losses === "number" ? me.losses : null;
  const drawsN =
    me && "draws" in me && typeof (me as { draws?: number }).draws === "number"
      ? ((me as { draws?: number }).draws as number)
      : null;
  const kpiReady = winsN !== null && lossesN !== null && drawsN !== null;
  const played = kpiReady ? winsN + lossesN + drawsN : 0;
  const percentSuffix = (nav.dashboard_percent_suffix || "").trim();
  const winRate =
    kpiReady && played > 0 && percentSuffix
      ? `${Math.round((winsN / played) * 1000) / 10}${percentSuffix}`
      : emptyValue;
  const winsDisplay = winsN !== null ? String(winsN) : emptyValue;
  const lossesDisplay = lossesN !== null ? String(lossesN) : emptyValue;
  const drawsDisplay = drawsN !== null ? String(drawsN) : emptyValue;
  const matches = matchesQuery.data ?? [];
  const recentPlayed = matches.length;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          {(nav.brand_name || "").trim() ? (
            <p className="text-sm text-[var(--dama-muted)]">{(nav.brand_name || "").trim()}</p>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {(nav.dashboard_page_title || "").trim()}
          </h1>
          {(nav.dashboard_page_blurb || "").trim() ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--dama-muted)]">
              {(nav.dashboard_page_blurb || "").trim()}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={(nav.dashboard_profile_href || "").trim()}>
              {(nav.dashboard_profile_action || "").trim()}
            </Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href={(nav.dashboard_play_href || "").trim()}>
              {(nav.dashboard_play_action || "").trim()}
            </Link>
          </Button>
        </div>
      </div>

      {meQuery.isLoading ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3 shadow-[var(--dama-card-shadow)]"
          aria-hidden
        >
          <ShimmerBlock className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-36" />
            <ShimmerBlock className="h-3 w-48 max-w-full" />
          </div>
        </div>
      ) : me ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3 shadow-[var(--dama-card-shadow)]">
          <DamaUserAvatar
            src={
              (authAvatarThumb || "").trim() ||
              (authAvatarFull || "").trim() ||
              me.avatarThumbUrl ||
              ""
            }
            className="h-10 w-10 rounded-full ring-1 ring-[var(--dama-border)]"
          />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{me.username}</span>
              <CountryFlag code={me.countryCode} />
              <HostTrustBadge
                label={me.hostTrustBadge}
                tier={me.hostTrustTier}
                className="shrink-0 text-[10px]"
              />
            </p>
            <p className="truncate text-xs text-[var(--dama-muted)]">
              {inspectChrome.label_rating}{" "}
              {typeof me.rating === "number" ? me.rating : (inspectChrome.empty_value || "").trim()}
              {inspectChrome.seat_meta_separator}
              {inspectChrome.label_xp}{" "}
              {typeof me.xp === "number" ? me.xp : (inspectChrome.empty_value || "").trim()}
            </p>
          </div>
        </div>
      ) : null}

      {meQuery.isLoading ? (
        <>
          <StatGridSkeleton cols={4} />
          <StatGridSkeleton cols={3} />
        </>
      ) : me ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={inspectChrome.label_rating}
              value={
                typeof me.rating === "number" ? me.rating : (inspectChrome.empty_value || "").trim()
              }
            />
            <KpiCard
              label={inspectChrome.label_xp}
              value={typeof me.xp === "number" ? me.xp : (inspectChrome.empty_value || "").trim()}
            />
            <KpiCard label={inspectChrome.label_wins} value={winsDisplay} />
            <KpiCard label={inspectChrome.label_losses} value={lossesDisplay} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label={(inspectChrome.label_draws || "").trim()} value={drawsDisplay} />
            <KpiCard
              label={(nav.dashboard_win_rate_label || "").trim()}
              value={winRate}
              body={
                kpiReady &&
                played > 0 &&
                (nav.dashboard_matches_joiner || "").length > 0 &&
                (nav.dashboard_matches_suffix || "").trim()
                  ? `${played}${nav.dashboard_matches_joiner}${(nav.dashboard_matches_suffix || "").trim()}`
                  : undefined
              }
            />
            {walletChrome && (walletChrome.balance_label || "").trim() ? (
              <KpiCard
                label={(walletChrome.balance_label || "").trim()}
                value={
                  walletQuery.isLoading || !country ? (
                    <ShimmerBlock className="mt-1 h-8 w-28 rounded-md" />
                  ) : walletQuery.data &&
                    typeof walletQuery.data.balance === "number" &&
                    (walletQuery.data.currency || "").trim() ? (
                    `${walletQuery.data.balance}${walletChrome.amount_currency_separator}${walletQuery.data.currency}`
                  ) : (walletChrome.wallet_unavailable || "").trim() ? (
                    (walletChrome.wallet_unavailable || "").trim()
                  ) : (walletChrome.balance_pending || "").trim() ? (
                    (walletChrome.balance_pending || "").trim()
                  ) : (
                    <ShimmerBlock className="mt-1 h-8 w-28 rounded-md" />
                  )
                }
                href={(nav.dashboard_wallet_href || "").trim() || undefined}
              />
            ) : (
              <KpiCard
                label={(nav.dashboard_recent_results_title || "").trim()}
                value={
                  matchesQuery.isLoading ? (
                    <ShimmerBlock className="mt-1 h-8 w-16 rounded-md" />
                  ) : (
                    recentPlayed
                  )
                }
              />
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--dama-danger)]">{nav.profile_load_failed}</p>
      )}

      <ProfileMyTournaments />

      <section className="space-y-3">
        {historyTitle ? (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{historyTitle}</h2>
            <Button asChild variant="outline" size="sm">
              <Link href={(nav.dashboard_transactions_href || "").trim()}>
                {(nav.dashboard_transactions_action || "").trim()}
              </Link>
            </Button>
          </div>
        ) : null}
        {matchesQuery.isLoading ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
            <OpsDataTableSkeleton
              columns={4}
              rows={5}
              showPagination={false}
              embedded
              density="loose"
            />
          </div>
        ) : matchesQuery.isError ? (
          <p className="text-sm text-[var(--dama-danger)]">{historyUnavailable}</p>
        ) : matches.length === 0 ? (
          <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-8 text-center shadow-[var(--dama-card-shadow)]">
            <p className="text-sm text-[var(--dama-muted)]">{historyEmpty}</p>
            <Button asChild variant="gold" size="sm" className="mt-4">
              <Link href={(nav.dashboard_play_href || "").trim()}>
                {(nav.dashboard_find_match_action || "").trim()}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-[var(--dama-border)] text-xs uppercase tracking-wide text-[var(--dama-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {(nav.dashboard_col_result || "").trim()}
                  </th>
                  <th className="px-4 py-3 font-medium">{(nav.dashboard_col_mode || "").trim()}</th>
                  <th className="px-4 py-3 font-medium">
                    {(nav.dashboard_col_moves || "").trim()}
                  </th>
                  <th className="px-4 py-3 font-medium">{(nav.dashboard_col_date || "").trim()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dama-border)]">
                {matches.map((m) => {
                  const draw = Boolean(m.is_draw);
                  const won = !draw && m.winner_id && userId && m.winner_id === userId;
                  const lost = !draw && m.winner_id && userId && m.winner_id !== userId;
                  const outcome = draw
                    ? outcomeDraw || emptyValue
                    : won
                      ? outcomeWin || emptyValue
                      : lost
                        ? outcomeLoss || emptyValue
                        : emptyValue;
                  const when = (m.finished_at || "").trim();
                  return (
                    <tr key={m.id} className="hover:bg-[var(--dama-surface)]/60">
                      <td className="px-4 py-3 font-medium text-[var(--dama-text)]">{outcome}</td>
                      <td className="px-4 py-3 text-[var(--dama-muted)]">
                        {(m.mode || "").trim() || emptyValue}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--dama-muted)]">
                        {typeof m.move_count === "number" ? m.move_count : emptyValue}
                      </td>
                      <td className="px-4 py-3 text-[var(--dama-muted)]">
                        {when ? when.slice(0, 10) : emptyValue}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
