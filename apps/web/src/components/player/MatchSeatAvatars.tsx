"use client";

import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { MatchSeatRowSkeleton } from "@/components/ui/shimmer-skeletons";
import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import { useProfileInspectChromeQuery } from "@/hooks/query/useProfileInspectChromeQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { pieceSeatNames, usePiecePalette } from "@/lib/board-palette";
import { CountryFlag } from "@/lib/country-flag";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayChromeReady } from "@/types/play-chrome";
import type { MatchSeat, PublicPlayerCard } from "@/types/player";
import { isProfileInspectChromeReady } from "@/types/profile-inspect-chrome";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  player1Id?: string | null;
  player2Id?: string | null;
  /** Pieces remaining on board (backend game_state). */
  whitePieces?: number | null;
  blackPieces?: number | null;
  /** From platform_settings board_rules.pieces_per_side (no client invent). */
  piecesPerSide?: number | null;
  /** Match clock rendered adjacent to seat cards. */
  clock?: ReactNode;
};

function toCard(
  res: NonNullable<ReturnType<typeof usePublicPlayerQuery>["data"]>,
): PublicPlayerCard {
  const p = res.player;
  return {
    id: p.id,
    username: p.username,
    rating: p.rating,
    xp: p.xp,
    wins: p.wins,
    losses: p.losses,
    region: p.region,
    countryCode: p.country_code,
    avatarFullUrl: p.avatar_full_url,
    avatarThumbUrl: p.avatar_thumb_url,
    regionalRank: res.regional_rank,
    regionLabel: res.region_label,
    levelLabel: p.level_label,
    online: Boolean(p.online ?? res.online),
    playing: Boolean(p.playing ?? res.playing),
    playingGameId: p.playing_game_id ?? res.playing_game_id ?? null,
    hostTrustBadge: p.host_trust_badge ?? null,
    hostTrustTier: p.host_trust_tier ?? null,
  };
}

function SeatButton({
  seat,
  playerId,
  captured,
  remaining,
  seatLabel,
  inspectTitle,
  piecesLeftSuffix,
  capturedSuffix,
  seatMetaSeparator,
  onInspect,
}: {
  seat: "white" | "black";
  playerId: string;
  captured: number | null;
  remaining: number | null | undefined;
  seatLabel: string;
  inspectTitle: string;
  piecesLeftSuffix: string;
  capturedSuffix: string;
  seatMetaSeparator: string;
  onInspect: (card: PublicPlayerCard) => void;
}) {
  const query = usePublicPlayerQuery(playerId, Boolean(playerId));
  const card = query.data ? toCard(query.data) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2 text-left">
      {/* Inspect: avatar + name (not the whole seat chip). */}
      <button
        type="button"
        className="relative h-11 w-11 shrink-0 rounded-full border-2 disabled:cursor-default"
        style={{
          // White seat → black disc; black seat → white disc.
          background: seat === "white" ? "var(--dama-piece-dark)" : "var(--dama-piece-light)",
          borderColor: seat === "white" ? "var(--dama-piece-dark)" : "var(--dama-piece-light)",
        }}
        disabled={!card}
        title={inspectTitle}
        aria-label={card?.username || seatLabel}
        onClick={() => {
          if (card) onInspect(card);
        }}
      >
        {card ? (
          <DamaUserAvatar
            src={card.avatarThumbUrl}
            pieceSide={seat === "white" ? "dark" : "light"}
            showMarkPlate={false}
            className="absolute inset-0 h-full w-full rounded-full"
          />
        ) : null}
        {card ? (
          <OnlineStatusDot
            online={card.online}
            playing={card.playing}
            className="shadow-[0_0_0_2px_var(--dama-card)]"
          />
        ) : null}
      </button>
      <span>
        <span className="flex items-center gap-1.5 text-xs text-[var(--dama-muted)]">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15"
            style={{
              background: seat === "white" ? "var(--dama-piece-dark)" : "var(--dama-piece-light)",
            }}
            aria-hidden
          />
          {seatLabel}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <button
            type="button"
            className="min-w-0 truncate text-left hover:underline disabled:cursor-default disabled:no-underline"
            disabled={!card}
            title={inspectTitle}
            onClick={() => {
              if (card) onInspect(card);
            }}
          >
            {card?.username ?? ""}
          </button>
          {typeof card?.rating === "number" ? (
            <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
              ({card.rating})
            </span>
          ) : null}
          <CountryFlag code={card?.countryCode} />
        </span>
        <HostTrustBadge
          label={card?.hostTrustBadge}
          tier={card?.hostTrustTier}
          className="mt-0.5 text-[9px]"
        />
        {captured != null || remaining != null ? (
          <span className="block text-xs text-[var(--dama-muted)]">
            {remaining != null ? `${remaining} ${piecesLeftSuffix}` : null}
            {captured != null
              ? `${remaining != null ? seatMetaSeparator : ""}${captured} ${capturedSuffix}`
              : null}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function MatchSeatAvatars({
  player1Id,
  player2Id,
  whitePieces,
  blackPieces,
  piecesPerSide,
  clock,
}: Props) {
  const router = useRouter();
  const [inspect, setInspect] = useState<PublicPlayerCard | null>(null);
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const isAccount = hydrated && Boolean(token);
  const [piecePalette] = usePiecePalette();
  const guestSeats = pieceSeatNames(piecePalette);
  const p1Query = usePublicPlayerQuery(player1Id, Boolean(player1Id));
  const p2Query = usePublicPlayerQuery(player2Id, Boolean(player2Id));
  const playChromeQuery = usePlayChromeQuery(true);
  const profileChromeQuery = useProfileInspectChromeQuery(true);
  const playChrome = isPlayChromeReady(playChromeQuery.data) ? playChromeQuery.data : undefined;
  const profileChrome = isProfileInspectChromeReady(profileChromeQuery.data)
    ? profileChromeQuery.data
    : undefined;

  const seats: MatchSeat[] = [];
  if (player1Id) seats.push({ seat: "white", playerId: player1Id });
  if (player2Id) seats.push({ seat: "black", playerId: player2Id });
  if (seats.length === 0) return null;

  const seatsHydrating =
    (Boolean(player1Id) && p1Query.isLoading) ||
    (Boolean(player2Id) && p2Query.isLoading) ||
    playChromeQuery.isLoading ||
    profileChromeQuery.isLoading;

  if (!playChrome || !profileChrome) {
    if (seatsHydrating) {
      return (
        <div className="mb-4 space-y-3">
          <MatchSeatRowSkeleton />
        </div>
      );
    }
    return null;
  }

  const capturedFor = (remaining: number | null | undefined) => {
    if (piecesPerSide == null || piecesPerSide <= 0 || remaining == null) return null;
    return Math.max(0, piecesPerSide - remaining);
  };
  const whiteCaptured = capturedFor(whitePieces);
  const blackCaptured = capturedFor(blackPieces);

  return (
    <>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {seatsHydrating ? (
            <MatchSeatRowSkeleton />
          ) : (
            seats.map(({ seat, playerId }) => (
              <SeatButton
                key={playerId}
                seat={seat}
                playerId={playerId}
                captured={seat === "white" ? whiteCaptured : blackCaptured}
                remaining={seat === "white" ? whitePieces : blackPieces}
                seatLabel={
                  seat === "white"
                    ? isAccount
                      ? playChrome.label_white
                      : guestSeats.light
                    : isAccount
                      ? playChrome.label_black
                      : guestSeats.dark
                }
                inspectTitle={profileChrome.inspect_action}
                piecesLeftSuffix={profileChrome.pieces_left_suffix}
                capturedSuffix={profileChrome.captured_suffix}
                seatMetaSeparator={profileChrome.seat_meta_separator}
                onInspect={setInspect}
              />
            ))
          )}
          {clock}
        </div>
      </div>
      <PlayerProfileModal
        open={Boolean(inspect)}
        onOpenChange={(open) => {
          if (!open) setInspect(null);
        }}
        player={inspect}
        onChallenge={(p) => {
          const q = new URLSearchParams({ opponent: p.username });
          if (p.id) q.set("opponentId", p.id);
          if (p.rating != null) q.set("opponentRating", String(p.rating));
          router.push(`/?${q.toString()}`);
        }}
      />
    </>
  );
}
