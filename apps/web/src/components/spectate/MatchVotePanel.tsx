"use client";

import { AvatarStack } from "@/components/play-rail/AvatarStack";
import { PlayerHoverCard } from "@/components/play-rail/PlayerHoverCard";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import type { StackHoverPlayer } from "@/components/play-rail/StackPlayerHover";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { CorrectVotersSkeleton, MatchVoteSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useCastMatchVoteMutation,
  useCorrectVotersQuery,
  useMatchVotesQuery,
} from "@/hooks/query/useMatchVotesQuery";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import type { SpectateChrome } from "@/types/spectate-chrome";
import { toast } from "sonner";

type Seat = StackHoverPlayer;

type Props = {
  chrome: Required<SpectateChrome>;
  gameId: string;
  player1: Seat | null;
  player2: Seat | null;
  /** When true, show correct-voters list instead of live casting. */
  finished: boolean;
  /** When true, cast buttons stay hidden (server also rejects while paused). */
  paused?: boolean;
  /** Optional play-rail chrome so seat faces get the same bio hover as live games. */
  railChrome?: PlayRailChromeReady;
  /**
   * Focus mode: one-line strip under Game ID (title · scores).
   * No cast controls - overview restores the full panel via Back.
   */
  compact?: boolean;
};

export function MatchVotePanel({
  chrome,
  gameId,
  player1,
  player2,
  finished,
  paused = false,
  railChrome,
  compact = false,
}: Props) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);
  const signedIn = hydrated && Boolean(token);
  const votesQuery = useMatchVotesQuery(gameId, Boolean(gameId) && !finished);
  const cast = useCastMatchVoteMutation(gameId);
  const correctQuery = useCorrectVotersQuery(gameId, finished && Boolean(gameId));

  const seats = [player1, player2].filter(Boolean) as Seat[];
  const seatIds = new Set(seats.map((s) => s.id.trim()).filter(Boolean));
  const viewerIsSeated = Boolean(myId && seatIds.has(myId.trim()));
  const canCast = signedIn && !viewerIsSeated && !paused;
  const tallies = votesQuery.data?.players ?? [];
  const myVote = votesQuery.data?.my_vote ?? null;
  const total = votesQuery.data?.total ?? 0;

  function percentFor(playerId: string): { count: number; percent: number } {
    const row = tallies.find((t) => t.player_id === playerId);
    return { count: row?.count ?? 0, percent: row?.percent ?? 0 };
  }

  if (finished) {
    if (correctQuery.isLoading || correctQuery.isPlaceholderData) {
      if (compact) {
        return (
          <div className="rounded-lg border border-[var(--dama-border)]/60 bg-[var(--dama-card)] px-3 py-2">
            <p className="truncate text-xs font-medium text-[var(--dama-muted)]">
              {chrome.vote_correct_title}
            </p>
          </div>
        );
      }
      return <CorrectVotersSkeleton />;
    }
    if (correctQuery.isError) {
      return (
        <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
          <p className="text-sm text-[var(--dama-danger)]">{chrome.vote_unavailable}</p>
        </section>
      );
    }
    const voters = correctQuery.data?.voters ?? [];
    if (compact) {
      return (
        <div
          className="rounded-lg border border-[var(--dama-border)]/60 bg-[var(--dama-card)] px-3 py-2"
          title={`${chrome.vote_correct_title}${chrome.vote_meta_separator}${voters.length}`}
        >
          <p className="truncate text-xs font-medium tabular-nums text-[var(--dama-text)]">
            {chrome.vote_correct_title}
            {chrome.vote_meta_separator}
            {voters.length}
          </p>
        </div>
      );
    }
    return (
      <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--dama-text)]">
          {chrome.vote_correct_title}
        </h3>
        <p className="mt-1 text-xs text-[var(--dama-muted)]">{chrome.vote_correct_blurb}</p>
        {voters.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--dama-muted)]">{chrome.vote_correct_empty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {voters.map((v, i) => {
              const displayName = railChrome
                ? formatPlayerNameDisplay(
                    v.username,
                    railChrome.live_player_name_max_chars,
                    railChrome.name_truncate_suffix,
                  )
                : v.username;
              const rail: RailPlayer | null =
                railChrome && v.id && v.username
                  ? {
                      id: v.id,
                      username: v.username,
                      rating: typeof v.rating === "number" ? v.rating : 0,
                      xp: 0,
                      wins: typeof v.wins === "number" ? v.wins : 0,
                      losses: typeof v.losses === "number" ? v.losses : 0,
                      draws: typeof v.draws === "number" ? v.draws : 0,
                      countryCode: v.country_code,
                      avatarThumbUrl: v.avatar_thumb_url,
                      avatarFullUrl: null,
                      hostTrustBadge: v.host_trust_badge ?? null,
                      hostTrustTier: v.host_trust_tier ?? null,
                    }
                  : null;
              const identity = (
                <button
                  type="button"
                  className="inline-flex min-w-0 max-w-full items-center gap-3 text-left"
                  aria-label={v.username}
                >
                  <DamaUserAvatar
                    src={v.avatar_thumb_url}
                    className="h-8 w-8 shrink-0 rounded-full"
                  />
                  <span className="min-w-0">
                    <span className="block min-w-0 truncate text-sm font-medium hover:underline">
                      {displayName}
                    </span>
                    <HostTrustBadge
                      label={v.host_trust_badge}
                      tier={v.host_trust_tier}
                      className="mt-0.5 text-[9px]"
                    />
                  </span>
                </button>
              );
              return (
                <li
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--dama-border)]/60 px-3 py-2"
                >
                  <span className="w-6 font-mono text-xs text-[var(--dama-gold)]">{i + 1}</span>
                  {railChrome && rail ? (
                    <PlayerHoverCard
                      chrome={railChrome}
                      player={rail}
                      signedIn={signedIn}
                      contentSide="left"
                      contentAlign="start"
                    >
                      {identity}
                    </PlayerHoverCard>
                  ) : (
                    identity
                  )}
                  {typeof v.rating === "number" ? (
                    <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
                      ({v.rating})
                    </span>
                  ) : null}
                  <CountryFlag code={v.country_code} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  if (seats.length < 2) return null;

  if (votesQuery.isLoading || votesQuery.isPlaceholderData) {
    if (compact) {
      return (
        <div className="rounded-lg border border-[var(--dama-border)]/60 bg-[var(--dama-card)] px-3 py-2">
          <p className="truncate text-xs font-medium text-[var(--dama-muted)]">
            {chrome.vote_section_title}
          </p>
        </div>
      );
    }
    return <MatchVoteSkeleton showCastButtons={canCast} />;
  }

  if (votesQuery.isError) {
    return (
      <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
        <p className="text-sm text-[var(--dama-danger)]">{chrome.vote_unavailable}</p>
      </section>
    );
  }

  if (compact) {
    const seatA = seats[0];
    const seatB = seats[1];
    if (!seatA || !seatB) return null;
    const c1 = percentFor(seatA.id).count;
    const c2 = percentFor(seatB.id).count;
    const line = `${chrome.vote_section_title}${chrome.vote_meta_separator}${c1}${chrome.vote_score_separator}${c2}`;
    return (
      <div
        className="rounded-lg border border-[var(--dama-border)]/60 bg-[var(--dama-card)] px-3 py-2"
        title={line}
      >
        <p className="truncate text-xs font-medium tabular-nums text-[var(--dama-text)]">{line}</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--dama-text)]">
          {chrome.vote_section_title}
        </h3>
        <AvatarStack
          people={seats.map((s) => ({
            id: s.id,
            username: s.username,
            avatarThumbUrl: s.avatarThumbUrl,
            avatarFullUrl: s.avatarFullUrl,
            online: s.online,
            playing: s.playing ?? true,
          }))}
          max={2}
          faceShape="rounded"
          overflowPrefix={chrome.viewers_overflow_prefix}
          renderFace={
            railChrome
              ? (person, face) => {
                  const seat = seats.find((s) => s.id === person.id);
                  const rail: RailPlayer = {
                    id: person.id,
                    username: person.username,
                    rating: typeof seat?.rating === "number" ? seat.rating : 0,
                    xp: 0,
                    wins: typeof seat?.wins === "number" ? seat.wins : 0,
                    losses: typeof seat?.losses === "number" ? seat.losses : 0,
                    draws: typeof seat?.draws === "number" ? seat.draws : 0,
                    countryCode: seat?.countryCode,
                    avatarThumbUrl: person.avatarThumbUrl,
                    avatarFullUrl: person.avatarFullUrl,
                    online: person.online,
                    playing: person.playing ?? true,
                    playingGameId: gameId,
                    hostTrustBadge: seat?.hostTrustBadge ?? null,
                    hostTrustTier: seat?.hostTrustTier ?? null,
                  };
                  return (
                    <PlayerHoverCard
                      chrome={railChrome}
                      player={rail}
                      signedIn={signedIn}
                      contentSide="left"
                      contentAlign="start"
                    >
                      <span className="inline-flex cursor-pointer overflow-visible rounded-md">
                        {face}
                      </span>
                    </PlayerHoverCard>
                  );
                }
              : undefined
          }
        />
      </div>

      <div className="mt-3 space-y-3">
        {seats.map((seat) => {
          const { count, percent } = percentFor(seat.id);
          const selected = myVote === seat.id;
          const railSeat: RailPlayer | null = railChrome
            ? {
                id: seat.id,
                username: seat.username,
                rating: typeof seat.rating === "number" ? seat.rating : 0,
                xp: 0,
                wins: typeof seat.wins === "number" ? seat.wins : 0,
                losses: typeof seat.losses === "number" ? seat.losses : 0,
                draws: typeof seat.draws === "number" ? seat.draws : 0,
                countryCode: seat.countryCode,
                avatarThumbUrl: seat.avatarThumbUrl,
                avatarFullUrl: seat.avatarFullUrl,
                online: seat.online,
                playing: true,
                playingGameId: gameId,
                hostTrustBadge: seat.hostTrustBadge ?? null,
                hostTrustTier: seat.hostTrustTier ?? null,
              }
            : null;
          const nameInner = (
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-[var(--dama-text)]">
                <span className="truncate">
                  {railChrome
                    ? formatPlayerNameDisplay(
                        seat.username,
                        railChrome.live_player_name_max_chars,
                        railChrome.name_truncate_suffix,
                      )
                    : seat.username}
                </span>
                {typeof seat.rating === "number" ? (
                  <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
                    {railChrome
                      ? `${railChrome.rating_paren_open}${seat.rating}${railChrome.rating_paren_close}`
                      : `(${seat.rating})`}
                  </span>
                ) : null}
                <CountryFlag code={seat.countryCode} />
              </span>
              <HostTrustBadge
                label={seat.hostTrustBadge}
                tier={seat.hostTrustTier}
                className="mt-0.5 text-[9px]"
              />
            </span>
          );
          return (
            <div key={seat.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                {railChrome && railSeat ? (
                  <PlayerHoverCard
                    chrome={railChrome}
                    player={railSeat}
                    signedIn={signedIn}
                    contentSide="left"
                    contentAlign="start"
                  >
                    <button type="button" className="min-w-0 max-w-full text-left">
                      {nameInner}
                    </button>
                  </PlayerHoverCard>
                ) : (
                  nameInner
                )}
                <span className="shrink-0 tabular-nums text-[var(--dama-muted)]">
                  {Math.round(percent)}
                  {chrome.vote_percent_suffix}
                  {chrome.vote_meta_separator}
                  {count} {chrome.vote_count_suffix}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--dama-surface)]">
                <div
                  className="h-full rounded-full bg-[var(--dama-brand)] transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
              </div>
              {canCast ? (
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? "play" : "outline"}
                  className={cn("h-8 w-full text-xs", selected && "pointer-events-none")}
                  disabled={Boolean(myVote) || cast.isPending}
                  isLoading={cast.isPending && cast.variables === seat.id}
                  pendingLabel={chrome.vote_casting_pending}
                  onClick={async () => {
                    try {
                      await cast.mutateAsync(seat.id);
                    } catch {
                      toast.error(chrome.vote_cast_failed);
                    }
                  }}
                >
                  {selected ? chrome.vote_locked_label : chrome.vote_pick_action}
                </Button>
              ) : null}
            </div>
          );
        })}
        {viewerIsSeated ? (
          <p className="text-sm text-[var(--dama-muted)]">{chrome.vote_players_cannot}</p>
        ) : !signedIn ? (
          <p className="text-sm text-[var(--dama-muted)]">{chrome.vote_sign_in}</p>
        ) : null}
        {total > 0 ? (
          <p className="text-center text-xs text-[var(--dama-muted)]">
            {total} {chrome.vote_count_suffix}
          </p>
        ) : null}
      </div>
    </section>
  );
}
