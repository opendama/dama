"use client";

import { ComposeMessageModal } from "@/components/chat/ComposeMessageModal";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { ProfilePageSkeleton } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { useAddFriendMutation } from "@/hooks/query/useFriendsQuery";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { useProfileInspectChromeQuery } from "@/hooks/query/useProfileInspectChromeQuery";
import {
  usePublicPlayerMatchesQuery,
  usePublicPlayerPlacementsQuery,
} from "@/hooks/query/usePublicPlayerListsQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { CountryFlag } from "@/lib/country-flag";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { playerProfileHref } from "@/lib/player-profile-href";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import type { PublicPlayerCardLite } from "@/types/player";
import { isProfileInspectChromeReady } from "@/types/profile-inspect-chrome";
import { Eye, Mail, Swords, Trophy, UserPlus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatJoined(iso: string | null | undefined): string {
  const raw = (iso || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMatchDate(iso: string | null | undefined): string {
  const raw = (iso || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MatchPlayerCell({
  card,
  nameMax,
  truncateSuffix,
}: {
  card: PublicPlayerCardLite | undefined;
  nameMax: number;
  truncateSuffix: string;
}) {
  if (!card?.id || !(card.username || "").trim()) {
    return <span className="text-xs text-[var(--dama-muted)]">-</span>;
  }
  const href = playerProfileHref(card.id);
  const name =
    card.username.length > nameMax && nameMax > 0
      ? `${card.username.slice(0, nameMax)}${truncateSuffix}`
      : card.username;
  const inner = (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <DamaUserAvatar
        src={card.avatar_thumb_url || card.avatar_full_url}
        className="h-6 w-6 shrink-0 rounded-md"
      />
      <span className="truncate text-sm font-semibold text-[var(--dama-text)] hover:underline">
        {name}
      </span>
      {typeof card.rating === "number" ? (
        <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
          ({card.rating})
        </span>
      ) : null}
      <CountryFlag code={card.country_code} />
      <HostTrustBadge
        label={card.host_trust_badge}
        tier={card.host_trust_tier}
        className="shrink-0 text-[9px]"
      />
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0">
      {inner}
    </a>
  );
}

/**
 * Dedicated public player profile (Chess.com-style overview).
 * All copy from profile_inspect_chrome + play_rail_chrome; stats from GET /players/{id}.
 * Matches/placements use the same SkipPagination + list_page_size flow as PlayerProfileModal.
 */
export default function PublicPlayerPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<"overview" | "games">("overview");
  const [messageOpen, setMessageOpen] = useState(false);
  const [matchesSkip, setMatchesSkip] = useUrlSkip("matches_skip");
  const [placementsSkip, setPlacementsSkip] = useUrlSkip("placements_skip");
  const addFriend = useAddFriendMutation(token);

  const chromeQuery = useProfileInspectChromeQuery(true);
  const railQuery = usePlayRailChromeQuery(true);
  const chrome = isProfileInspectChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const rail = isPlayRailChromeReady(railQuery.data) ? railQuery.data : undefined;
  const { data, isLoading, error } = usePublicPlayerQuery(id, Boolean(id));

  useResetSkipOnChange(setMatchesSkip, [id]);
  useResetSkipOnChange(setPlacementsSkip, [id]);

  const listPageSize = parseListPageSize(chrome?.list_page_size);
  const matchesQuery = usePublicPlayerMatchesQuery(
    id,
    matchesSkip,
    listPageSize,
    Boolean(id) && listPageSize > 0,
  );
  const placementsQuery = usePublicPlayerPlacementsQuery(
    id,
    placementsSkip,
    listPageSize,
    Boolean(id) && listPageSize > 0,
  );

  const player = data?.player;
  const presenceLabel = useMemo(() => {
    if (!chrome || !player) return "";
    if (player.playing) return chrome.playing_now_label;
    if (player.online) return chrome.online_now_label;
    return chrome.offline_now_label;
  }, [chrome, player]);

  if (chromeQuery.isLoading || railQuery.isLoading || isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (!chrome || !rail) {
    const unavailable =
      (chromeQuery.data?.profile_inspect_chrome_unavailable || "").trim() ||
      (railQuery.data?.play_rail_chrome_unavailable || "").trim();
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-[var(--dama-danger)]">{chrome.player_unavailable}</p>
      </div>
    );
  }

  const thumb = (player.avatar_full_url || player.avatar_thumb_url || "").trim();
  const friendsCount = typeof data.friends_count === "number" ? data.friends_count : null;
  const friendsPreview = data.friends_preview ?? [];
  const isSelf = Boolean(myId && myId === player.id);
  const matches = matchesQuery.data?.matches ?? [];
  const placements = placementsQuery.data?.placements ?? [];
  const matchesMeta = matchesQuery.data?.meta ?? null;
  const placementsMeta = placementsQuery.data?.meta ?? null;
  const matchesTotal = typeof matchesMeta?.total === "number" ? matchesMeta.total : matches.length;
  const drawsCell = typeof player.draws === "number" ? String(player.draws) : chrome.empty_value;
  const wld = `${player.wins}${chrome.stats_separator}${player.losses}${chrome.stats_separator}${drawsCell}`;
  const joined = formatJoined(player.created_at);
  // Fail closed: truncate only when DB chrome supplies both max + suffix (no invented 16 / …).
  const nameMaxRaw = Number.parseInt(String(rail.live_player_name_max_chars || "").trim(), 10);
  const nameMax = Number.isFinite(nameMaxRaw) && nameMaxRaw > 0 ? nameMaxRaw : 0;
  const trunc = (rail.name_truncate_suffix || "").trim();

  const statCards = [
    { label: chrome.label_rating, value: String(player.rating) },
    { label: chrome.label_xp, value: String(player.xp) },
    { label: chrome.wld_label, value: wld },
    {
      label: chrome.label_regional_rank,
      value:
        data.regional_rank > 0
          ? `${chrome.top_prefix}${chrome.rank_parts_separator}${data.regional_rank}`
          : chrome.empty_value,
    },
  ] as const;

  const historyTable = (
    <div className="overflow-x-auto rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--dama-border)] text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            <th className="px-3 py-2.5 font-semibold sm:px-4">{chrome.game_history_players_col}</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">{chrome.game_history_result_col}</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">{chrome.game_history_moves_col}</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">{chrome.game_history_date_col}</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const outcome = m.is_draw
              ? chrome.outcome_draw
              : m.winner_id === player.id
                ? chrome.outcome_win
                : chrome.outcome_loss;
            return (
              <tr
                key={m.id}
                className="border-b border-[var(--dama-border)]/60 last:border-0 odd:bg-[var(--dama-surface)]/30"
              >
                <td className="px-3 py-2.5 sm:px-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
                      {(m.mode || "").trim()}
                    </span>
                    <MatchPlayerCell card={m.player1} nameMax={nameMax} truncateSuffix={trunc} />
                    <MatchPlayerCell card={m.player2} nameMax={nameMax} truncateSuffix={trunc} />
                  </div>
                </td>
                <td className="px-3 py-2.5 align-middle sm:px-4">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-white",
                        m.is_draw
                          ? "bg-[var(--dama-muted)]"
                          : m.winner_id === player.id
                            ? "bg-[var(--dama-online)]"
                            : "bg-[var(--dama-danger)]",
                      )}
                      aria-hidden
                    >
                      {m.is_draw ? "=" : m.winner_id === player.id ? "+" : "−"}
                    </span>
                    <span
                      className={cn(
                        m.is_draw
                          ? "text-[var(--dama-muted)]"
                          : m.winner_id === player.id
                            ? "text-[var(--dama-online)]"
                            : "text-[var(--dama-danger)]",
                      )}
                    >
                      {outcome}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle tabular-nums text-[var(--dama-text)] sm:px-4">
                  {typeof m.move_count === "number" ? m.move_count : chrome.empty_value}
                </td>
                <td className="px-3 py-2.5 align-middle whitespace-nowrap text-[var(--dama-muted)] sm:px-4">
                  {formatMatchDate(m.finished_at) || chrome.empty_value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const matchesSection = (
    <section className="min-w-0 space-y-3">
      <h2 className="text-sm font-semibold text-[var(--dama-text)]">
        {chrome.recent_matches_title}
        {matchesTotal > 0 ? (
          <span className="ml-1 font-normal text-[var(--dama-muted)]">({matchesTotal})</span>
        ) : null}
      </h2>
      {matches.length === 0 && !matchesQuery.isFetching ? (
        <p className="text-sm text-[var(--dama-muted)]">{chrome.no_matches}</p>
      ) : (
        <>
          {historyTable}
          <SkipPagination
            className="mt-2"
            meta={matchesMeta}
            disabled={matchesQuery.isFetching}
            onPrev={setMatchesSkip}
            onNext={setMatchesSkip}
          />
        </>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <ComposeMessageModal
        chrome={rail}
        open={messageOpen}
        onOpenChange={setMessageOpen}
        target={{
          id: player.id,
          username: player.username,
          avatarThumbUrl: player.avatar_thumb_url,
          avatarFullUrl: player.avatar_full_url,
        }}
        onComposeStarted={() => {
          setMessageOpen(false);
          router.push("/?rail=players&sub=dms");
        }}
        onOpenedThread={({ threadId }) => {
          setMessageOpen(false);
          const tid = threadId.trim();
          if (!tid) return;
          router.push(`/?rail=players&sub=dms&thread=${encodeURIComponent(tid)}`);
        }}
      />
      <header className="flex flex-col gap-4 rounded-2xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)] sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="relative h-20 w-20 shrink-0 rounded-2xl border-2 border-[var(--dama-border)] sm:h-28 sm:w-28">
            <DamaUserAvatar src={thumb} className="h-full w-full rounded-[0.9rem]" />
            <OnlineStatusDot
              online={Boolean(player.online)}
              playing={Boolean(player.playing)}
              size="md"
              className="bottom-1 right-1 shadow-[0_0_0_2px_var(--dama-card)]"
            />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="flex min-w-0 flex-wrap items-center gap-2 font-display text-xl font-bold tracking-tight text-[var(--dama-text)] sm:text-3xl">
              <span className="min-w-0 truncate">{player.username}</span>
              <CountryFlag code={player.country_code} size="md" className="h-5 w-[1.7rem]" />
              <HostTrustBadge
                label={player.host_trust_badge}
                tier={player.host_trust_tier}
                className="shrink-0 text-[10px]"
              />
            </h1>
            {(() => {
              const rep = hostReputationLine({
                finished: player.host_finished_paid_cups,
                cancelled: player.host_cancelled_paid_cups,
                openReports: player.host_open_reports,
                finishedLabel: chrome.host_rep_finished_label,
                cancelledLabel: chrome.host_rep_cancelled_label,
                reportsLabel: chrome.host_rep_reports_label,
                separator: chrome.host_rep_meta_separator,
              });
              return rep ? <p className="text-[11px] text-[var(--dama-muted)]">{rep}</p> : null;
            })()}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--dama-muted)]">
              {joined ? (
                <span>
                  {joined}
                  {chrome.label_value_separator}
                  {chrome.joined_label}
                </span>
              ) : null}
              {friendsCount != null ? (
                <span>
                  {friendsCount}
                  {chrome.label_value_separator}
                  {chrome.friends_count_label}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    player.playing
                      ? "bg-[var(--dama-playing)]"
                      : player.online
                        ? "bg-[var(--dama-online)]"
                        : "bg-[var(--dama-offline)]",
                  )}
                  aria-hidden
                />
                {presenceLabel}
              </span>
            </p>
            {player.level_label ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-gold)]">
                {player.level_label}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {!isSelf && hydrated ? (
            <>
              <Button
                type="button"
                variant="play"
                size="sm"
                className="h-10 w-full gap-1.5 sm:h-9 sm:w-auto"
                isLoading={addFriend.isPending}
                pendingLabel={rail.sending_friend_request}
                disabled={!token}
                onClick={() => {
                  if (!token) return;
                  void (async () => {
                    try {
                      await addFriend.mutateAsync(player.id);
                      toast.success(rail.toast_friend_request_sent);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "";
                      toast.error(
                        msg.includes("already_friends")
                          ? rail.friend_request_already_friends
                          : rail.toast_friend_request_failed,
                      );
                    }
                  })();
                }}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{rail.send_friend_request_action}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full gap-1.5 sm:h-9 sm:w-auto"
                disabled={!token}
                onClick={() => setMessageOpen(true)}
              >
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{rail.message_action}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full gap-1.5 sm:h-9 sm:w-auto"
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "dama.create.opponent",
                      JSON.stringify({
                        id: player.id,
                        username: player.username,
                        rating: player.rating,
                        countryCode: player.country_code,
                        avatarThumbUrl: player.avatar_thumb_url,
                        online: player.online,
                        playing: player.playing,
                        hostTrustBadge: player.host_trust_badge ?? null,
                        hostTrustTier: player.host_trust_tier ?? null,
                      }),
                    );
                  } catch {
                    /* ignore */
                  }
                  router.push("/?rail=new&sub=challenge");
                }}
              >
                <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{rail.challenge_action}</span>
              </Button>
            </>
          ) : null}
          {player.playing && player.playing_game_id ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full gap-1.5 sm:h-9 sm:w-auto"
              onClick={() => {
                const gameId = player.playing_game_id;
                if (!gameId) return;
                router.push(`/?view=spectate&gameId=${encodeURIComponent(gameId)}`);
              }}
            >
              <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{rail.watch_game_action}</span>
            </Button>
          ) : null}
        </div>
      </header>

      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--dama-border)] px-1"
        role="tablist"
        aria-label={chrome.page_title}
      >
        {(
          [
            { id: "overview" as const, label: chrome.overview_tab },
            { id: "games" as const, label: chrome.games_tab },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-semibold transition-colors",
              tab === t.id
                ? "border-b-2 border-[var(--dama-brand)] text-[var(--dama-text)]"
                : "border-b-2 border-transparent text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,17rem)]">
          <div className="min-w-0 space-y-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="min-w-0 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-3 shadow-[var(--dama-card-shadow)]"
                >
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                    {card.label}
                  </p>
                  <p className="mt-1 truncate font-display text-lg font-bold tabular-nums text-[var(--dama-text)] sm:text-xl">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {matchesSection}
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-3 shadow-[var(--dama-card-shadow)] sm:p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--dama-text)]">
                <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--dama-gold)]" aria-hidden />
                <span className="min-w-0 truncate">{chrome.tournament_placements_title}</span>
              </h2>
              {placements.length === 0 && !placementsQuery.isFetching ? (
                <p className="mt-2 text-sm text-[var(--dama-muted)]">{chrome.no_placements}</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-2">
                    {placements.map((p) => (
                      <li key={`${p.tournament_id}-${p.joined_at}`} className="min-w-0 text-sm">
                        <p className="truncate font-medium text-[var(--dama-text)]">{p.title}</p>
                        <p className="truncate text-xs text-[var(--dama-muted)]">
                          {p.status}
                          {p.is_free ? chrome.free_suffix : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <SkipPagination
                    className="mt-2"
                    meta={placementsMeta}
                    disabled={placementsQuery.isFetching}
                    onPrev={setPlacementsSkip}
                    onNext={setPlacementsSkip}
                  />
                </>
              )}
            </section>

            {(player.region || data.region_label) && (
              <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-3 text-sm shadow-[var(--dama-card-shadow)] sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                  {chrome.label_region}
                </p>
                <p className="mt-1 break-words text-[var(--dama-text)]">
                  {data.region_label || player.region}
                </p>
              </section>
            )}

            <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-3 shadow-[var(--dama-card-shadow)] sm:p-4">
              <h2 className="text-sm font-semibold text-[var(--dama-text)]">
                {chrome.friends_section_title}
                {friendsCount != null ? (
                  <span className="ml-1 font-normal text-[var(--dama-muted)]">
                    ({friendsCount})
                  </span>
                ) : null}
              </h2>
              {friendsPreview.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--dama-muted)]">{chrome.no_friends}</p>
              ) : (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {friendsPreview.map((f) => {
                    const href = playerProfileHref(f.id);
                    const face = (
                      <span className="relative block aspect-square overflow-hidden rounded-md border border-[var(--dama-border)] transition hover:border-[var(--dama-brand)]">
                        <DamaUserAvatar
                          src={f.avatar_thumb_url || f.avatar_full_url}
                          className="h-full w-full rounded-md"
                        />
                        <OnlineStatusDot
                          online={Boolean(f.online)}
                          playing={Boolean(f.playing)}
                          size="sm"
                          className="shadow-[0_0_0_2px_var(--dama-card)]"
                        />
                      </span>
                    );
                    if (!href) return <span key={f.id}>{face}</span>;
                    return (
                      <a
                        key={f.id}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={f.username}
                        aria-label={f.username}
                      >
                        {face}
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      ) : (
        matchesSection
      )}
    </div>
  );
}
