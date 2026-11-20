"use client";

import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { LeaderboardPageSkeleton, LeaderboardSkeleton } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { useLeaderboardChromeQuery } from "@/hooks/query/useLeaderboardChromeQuery";
import {
  type LeaderboardPeriod,
  type LeaderboardRailPlayer,
  parseLeaderboardPageSize,
  parseLeaderboardPeriod,
  useLeaderboardQuery,
} from "@/hooks/query/useLeaderboardQuery";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { CountryFlag } from "@/lib/country-flag";
import { hrefWithQueryPatch } from "@/lib/url-skip";
import { cn } from "@/lib/utils";
import { type LeaderboardChrome, isLeaderboardChromeReady } from "@/types/leaderboard-chrome";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

function PodiumSeat({
  place,
  player,
  chrome,
  period,
  aria,
  onSelect,
}: {
  place: 1 | 2 | 3;
  player: LeaderboardRailPlayer | undefined;
  chrome: Required<import("@/types/leaderboard-chrome").LeaderboardChrome>;
  period: LeaderboardPeriod;
  aria: string;
  onSelect: (p: LeaderboardRailPlayer) => void;
}) {
  if (!player) return <div className="flex-1" />;
  const blockH = place === 1 ? "h-24 sm:h-28" : place === 2 ? "h-16 sm:h-20" : "h-12 sm:h-16";
  const ring =
    place === 1
      ? "border-[var(--dama-gold)] shadow-[0_0_20px_color-mix(in_srgb,var(--dama-gold)_35%,transparent)]"
      : place === 2
        ? "border-[color-mix(in_srgb,var(--dama-muted)_40%,var(--dama-gold))]"
        : "border-[color-mix(in_srgb,var(--dama-brand)_70%,var(--dama-gold))]";
  const placeMark =
    place === 1
      ? chrome.podium_first_crown
      : place === 2
        ? chrome.podium_second_crown
        : chrome.podium_third_crown;
  const scoreRaw = period === "all" ? player.rating : player.points;
  const score = typeof scoreRaw === "number" ? Number(scoreRaw).toLocaleString() : "";
  const scoreSuffix =
    period === "all" || typeof scoreRaw !== "number" ? "" : ` ${chrome.pts_suffix}`;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className="flex h-7 items-center justify-center text-sm font-bold tabular-nums text-[var(--dama-gold)]">
        {placeMark}
      </span>
      {/* Profile: avatar + name (not the whole podium seat). */}
      <button
        type="button"
        className={cn(
          "relative h-16 w-16 rounded-full border-2 bg-[var(--dama-bg)] sm:h-20 sm:w-20",
          ring,
        )}
        onClick={() => onSelect(player)}
        aria-label={`${aria} ${player.username}`}
      >
        <DamaUserAvatar
          src={player.avatarThumbUrl}
          className="absolute inset-0 h-full w-full rounded-full"
        />
        <OnlineStatusDot
          online={player.online}
          playing={player.playing}
          size="md"
          className="shadow-[0_0_0_2px_var(--dama-bg)]"
        />
      </button>
      {place === 1 ? (
        <span className="font-display text-xl font-bold tabular-nums text-[var(--dama-gold)]">
          {placeMark}
        </span>
      ) : null}
      {/* Name stack: username alone (truncate), rating + flag below - mobile-safe in 3-col podium. */}
      <div className="flex w-full min-w-0 max-w-[9rem] flex-col items-center gap-0.5 px-0.5 sm:max-w-[11rem]">
        <button
          type="button"
          className="max-w-full truncate text-sm font-semibold text-[var(--dama-text)] hover:underline"
          onClick={() => onSelect(player)}
          aria-label={`${aria} ${player.username}`}
        >
          {player.username}
        </button>
        <span className="flex max-w-full items-center justify-center gap-1 text-xs tabular-nums text-[var(--dama-muted)]">
          <span className="truncate">({player.rating})</span>
          <CountryFlag code={player.countryCode} />
        </span>
        {(player.hostTrustBadge || "").trim() ? (
          <HostTrustBadge
            label={player.hostTrustBadge}
            tier={player.hostTrustTier}
            className="max-w-full text-[9px]"
          />
        ) : null}
      </div>
      <span className="font-mono text-xs text-[var(--dama-gold)]">
        {score}
        {scoreSuffix}
      </span>
      <span
        className={cn(
          "mt-1 w-full max-w-[6.5rem] rounded-t-lg border border-b-0 border-[var(--dama-border)] bg-[color-mix(in_srgb,var(--dama-brand)_22%,var(--dama-card))]",
          blockH,
        )}
        aria-hidden
      />
    </div>
  );
}

export default function LeaderboardPage() {
  const chromeQuery = useLeaderboardChromeQuery(true);
  const chrome = isLeaderboardChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;

  if (chromeQuery.isLoading) {
    return <LeaderboardPageSkeleton />;
  }

  if (!chrome) {
    const unavailable = (chromeQuery.data?.leaderboard_chrome_unavailable || "").trim();
    return (
      <div className="w-full space-y-6">
        <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p>
      </div>
    );
  }

  const initialPeriod = parseLeaderboardPeriod(chrome.default_period);
  const pageSize = parseLeaderboardPageSize(chrome.list_page_size);
  if (!initialPeriod || pageSize <= 0) {
    return (
      <div className="w-full space-y-6">
        <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
      </div>
    );
  }

  return <LeaderboardBody chrome={chrome} initialPeriod={initialPeriod} pageSize={pageSize} />;
}

function LeaderboardBody({
  chrome,
  initialPeriod,
  pageSize,
}: {
  chrome: Required<LeaderboardChrome>;
  initialPeriod: LeaderboardPeriod;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<LeaderboardRailPlayer | null>(null);
  const [skip, setSkip] = useUrlSkip("skip");
  // Period + skip live in the URL so refresh keeps the navigated page.
  const period = useMemo(() => {
    const fromUrl = parseLeaderboardPeriod(searchParams.get("period"));
    return fromUrl ?? initialPeriod;
  }, [searchParams, initialPeriod]);

  function setPeriod(next: LeaderboardPeriod) {
    const href = hrefWithQueryPatch(pathname || "/leaderboard", searchParams, {
      period: next === initialPeriod ? null : next,
      skip: null,
    });
    router.replace(href, { scroll: false });
  }
  const { data, isLoading, isFetching, error, isPlaceholderData } = useLeaderboardQuery(
    skip,
    pageSize,
    period,
  );

  // First paint only - never swap podium/list for shimmer on period refetch (Status parity).
  const showBodySkeleton = isLoading && !data;
  // Period-key placeholder only - never the background session poll.
  const softPeriodSwitch = isFetching && isPlaceholderData;
  const paintedPeriod: LeaderboardPeriod =
    data?.period === "week" ||
    data?.period === "month" ||
    data?.period === "year" ||
    data?.period === "all"
      ? data.period
      : period;
  const rows = data?.players ?? [];
  const meta = data?.meta;
  const me = data?.me ?? undefined;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const periods: { id: LeaderboardPeriod; label: string }[] = [
    { id: "all", label: chrome.period_all },
    { id: "week", label: chrome.period_week },
    { id: "month", label: chrome.period_month },
    { id: "year", label: chrome.period_year },
  ];

  return (
    <div className="relative w-full space-y-6">
      <FetchProgressBar active={softPeriodSwitch} />
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--dama-text)]">
          {chrome.hall_of_fame_title}
        </h1>
        <p className="mt-2 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={chrome.hall_of_fame_title}>
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              period === p.id
                ? "bg-[var(--dama-brand)] text-white"
                : "border border-[var(--dama-border)] bg-[var(--dama-card)] text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
            )}
            onClick={() => {
              startTransition(() => {
                setPeriod(p.id);
              });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showBodySkeleton ? (
        <LeaderboardSkeleton />
      ) : error && !data ? (
        <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
      ) : (
        <>
          <div
            className={cn("space-y-6 transition-opacity", softPeriodSwitch && "opacity-70")}
            aria-busy={softPeriodSwitch || undefined}
          >
            {!rows.length ? (
              <p className="text-sm text-[var(--dama-muted)]">{chrome.empty}</p>
            ) : null}

            {rows.length > 0 && skip === 0 && top3.length > 0 ? (
              <div className="rounded-2xl border border-[var(--dama-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--dama-brand)_18%,var(--dama-card)),var(--dama-card))] px-3 py-6 sm:px-6">
                <div className="flex items-end justify-center gap-2 sm:gap-4">
                  <PodiumSeat
                    place={2}
                    player={top3[1]}
                    chrome={chrome}
                    period={paintedPeriod}
                    aria={chrome.podium_second_aria}
                    onSelect={setSelected}
                  />
                  <PodiumSeat
                    place={1}
                    player={top3[0]}
                    chrome={chrome}
                    period={paintedPeriod}
                    aria={chrome.podium_first_aria}
                    onSelect={setSelected}
                  />
                  <PodiumSeat
                    place={3}
                    player={top3[2]}
                    chrome={chrome}
                    period={paintedPeriod}
                    aria={chrome.podium_third_aria}
                    onSelect={setSelected}
                  />
                </div>
              </div>
            ) : null}

            {rows.length > 0 && (skip > 0 || rest.length > 0) ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                  {chrome.rank_list_title}
                </h2>
                {/* Two-column ranks panel (screenshot parity) on sm+; single column on narrow. */}
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--dama-gold)_40%,var(--dama-border))] bg-[color-mix(in_srgb,var(--dama-brand)_10%,var(--dama-card))] p-2.5 sm:p-3">
                  <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(skip === 0 ? rest : rows).map((p, idx) => {
                      const rank = skip === 0 ? skip + idx + 4 : (meta?.skip ?? skip) + idx + 1;
                      const rowScore = paintedPeriod === "all" ? p.rating : p.points;
                      return (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--dama-gold)_28%,var(--dama-border))] bg-[var(--dama-card)] px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3"
                        >
                          <span className="w-7 shrink-0 font-mono text-sm font-semibold text-[var(--dama-gold)] sm:w-8">
                            {rank}
                          </span>
                          <button
                            type="button"
                            className="relative h-9 w-9 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--dama-gold)_35%,var(--dama-border))] bg-[var(--dama-bg)] sm:h-10 sm:w-10"
                            onClick={() => setSelected(p)}
                            aria-label={`${chrome.inspect_aria_prefix} ${p.username}`}
                            title={
                              p.playing
                                ? chrome.playing_label
                                : p.online
                                  ? chrome.online_label
                                  : chrome.offline_label
                            }
                          >
                            <DamaUserAvatar
                              src={p.avatarThumbUrl}
                              className="absolute inset-0 h-full w-full rounded-full"
                            />
                            <OnlineStatusDot
                              online={p.online}
                              playing={p.playing}
                              className="shadow-[0_0_0_2px_var(--dama-card)]"
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-1 truncate text-sm font-medium uppercase tracking-wide text-[var(--dama-text)]">
                              <button
                                type="button"
                                className="min-w-0 truncate text-left hover:underline"
                                onClick={() => setSelected(p)}
                                aria-label={`${chrome.inspect_aria_prefix} ${p.username}`}
                              >
                                {p.username}
                              </button>
                              <span className="shrink-0 text-xs tabular-nums normal-case text-[var(--dama-muted)]">
                                ({p.rating})
                              </span>
                              <CountryFlag code={p.countryCode} />
                            </p>
                            {(p.hostTrustBadge || "").trim() ? (
                              <HostTrustBadge
                                label={p.hostTrustBadge}
                                tier={p.hostTrustTier}
                                className="mt-0.5 text-[9px]"
                              />
                            ) : null}
                            <p className="truncate text-xs text-[var(--dama-muted)]">
                              {p.wins}
                              {chrome.wins_abbr}
                              {chrome.stats_separator}
                              {p.losses}
                              {chrome.losses_abbr}
                              {chrome.stats_separator}
                              {p.draws}
                              {chrome.draws_abbr}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm text-[var(--dama-gold)]">
                              {typeof rowScore === "number"
                                ? Number(rowScore).toLocaleString()
                                : ""}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-[var(--dama-muted)] sm:text-xs">
                              {paintedPeriod === "all"
                                ? `${Number(p.xp).toLocaleString()} ${chrome.xp_suffix}`
                                : chrome.pts_suffix}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] px-4 py-3">
              <p className="text-sm text-[var(--dama-text)]">
                {chrome.your_rank_prefix}{" "}
                {me?.rank ? (
                  <span className="font-semibold text-[var(--dama-gold)]">
                    #{me.rank}
                    {chrome.meta_separator}
                    {Number(me.points).toLocaleString()}
                    {paintedPeriod === "all" ? "" : ` ${chrome.pts_suffix}`}
                  </span>
                ) : (
                  <span className="text-[var(--dama-muted)]">{chrome.unranked_label}</span>
                )}
              </p>
              {period !== "all" ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--dama-brand)] underline-offset-2 hover:underline"
                  onClick={() => {
                    startTransition(() => {
                      setPeriod("all");
                    });
                  }}
                >
                  {chrome.view_full_leaderboard}
                </button>
              ) : null}
            </div>
          </div>
          <div className="pt-4">
            <SkipPagination
              meta={meta}
              onPrev={(s) => startTransition(() => setSkip(s))}
              onNext={(s) => startTransition(() => setSkip(s))}
              disabled={isFetching && !isLoading}
              inputId="player-leaderboard-skip"
            />
          </div>
        </>
      )}

      <PlayerProfileModal
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        player={
          selected
            ? {
                id: selected.id,
                username: selected.username,
                rating: selected.rating,
                xp: selected.xp,
                wins: selected.wins,
                losses: selected.losses,
                region: selected.region,
                avatarThumbUrl: selected.avatarThumbUrl,
                avatarFullUrl: selected.avatarFullUrl,
                online: selected.online,
                playing: selected.playing,
                regionalRank: selected.regionalRank,
                levelLabel: selected.levelLabel,
              }
            : null
        }
        onChallenge={(p) => {
          const q = new URLSearchParams({ opponent: p.username });
          if (p.id) q.set("opponentId", p.id);
          if (p.rating != null) q.set("opponentRating", String(p.rating));
          router.push(`/?${q.toString()}`);
        }}
      />
    </div>
  );
}
