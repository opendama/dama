import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import type { PublicPlayerResponse } from "@/types/player";

/** Merge GET /players/{id} into a rail/hover card (presence + record). */
export function mergeRailPlayerFromPublic(
  base: RailPlayer,
  data: PublicPlayerResponse | undefined,
): RailPlayer {
  if (!data?.player) return base;
  const p = data.player;
  return {
    ...base,
    username: p.username || base.username,
    rating: typeof p.rating === "number" ? p.rating : base.rating,
    xp: typeof p.xp === "number" ? p.xp : base.xp,
    wins: typeof p.wins === "number" ? p.wins : base.wins,
    losses: typeof p.losses === "number" ? p.losses : base.losses,
    draws: typeof p.draws === "number" ? p.draws : base.draws,
    region: p.region ?? base.region,
    countryCode: p.country_code ?? base.countryCode,
    avatarThumbUrl: p.avatar_thumb_url ?? base.avatarThumbUrl,
    avatarFullUrl: p.avatar_full_url ?? base.avatarFullUrl,
    levelLabel: p.level_label ?? base.levelLabel,
    online: Boolean(p.online ?? data.online),
    playing: Boolean(p.playing ?? data.playing),
    playingGameId: p.playing_game_id ?? data.playing_game_id ?? base.playingGameId ?? null,
    hostTrustTier: p.host_trust_tier ?? base.hostTrustTier ?? null,
    hostTrustBadge: p.host_trust_badge ?? base.hostTrustBadge ?? null,
    hostFinishedPaidCups: p.host_finished_paid_cups ?? base.hostFinishedPaidCups ?? null,
    hostCancelledPaidCups: p.host_cancelled_paid_cups ?? base.hostCancelledPaidCups ?? null,
    hostOpenReports: p.host_open_reports ?? base.hostOpenReports ?? null,
  };
}
