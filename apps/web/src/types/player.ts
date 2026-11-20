import type { LeaderboardQuery, MeQuery } from "@/gql/graphql";

/** GraphQL `me` selection (codegen). */
export type MeProfile = NonNullable<MeQuery["me"]>;

/** GraphQL MatchSummary fields from `me.recentMatches`. */
export type RecentMatch = NonNullable<MeProfile["recentMatches"]>[number];

export type MeSummary = Pick<
  MeProfile,
  "id" | "username" | "rating" | "xp" | "wins" | "losses" | "avatarThumbUrl"
>;

/** GraphQL `leaderboard` row (codegen). */
export type LeaderboardPlayer = LeaderboardQuery["leaderboard"][number];

export type PublicPlayerCard = {
  id: string;
  username: string;
  rating: number;
  xp: number;
  wins: number;
  losses: number;
  draws?: number;
  region?: string | null;
  countryCode?: string | null;
  avatarFullUrl?: string | null;
  avatarThumbUrl?: string | null;
  online?: boolean;
  /** Active PvP game - red “Playing” badge (backend PlayingGameID). */
  playing?: boolean;
  playingGameId?: string | null;
  regionalRank?: number | null;
  regionLabel?: string | null;
  levelLabel?: string | null;
  phoneKycVerified?: boolean;
  documentKycVerified?: boolean;
  hostTrustTier?: string | null;
  hostTrustBadge?: string | null;
  hostFinishedPaidCups?: number | null;
  hostCancelledPaidCups?: number | null;
  hostOpenReports?: number | null;
};

/** Live board seat side from game_state player slots. */
export type MatchSeatSide = "white" | "black";

export type MatchSeat = {
  seat: MatchSeatSide;
  playerId: string;
};

/** Queue/matchmaking REST self profile (snake_case from API). */
export type MatchmakingSelfCard = {
  id: string;
  username: string;
  rating: number;
  avatar_thumb_url?: string | null;
  country_code?: string | null;
  host_trust_tier?: string | null;
  host_trust_badge?: string | null;
};

export type MatchmakingStatus = {
  /** Omitted until the backend sends an explicit size. */
  size?: number;
  queued: boolean;
};

export type MatchmakingJoinResult = {
  queued: boolean;
  match?: { game_id: string; player1_id?: string; player2_id?: string };
  queue_size?: number;
  self?: MatchmakingSelfCard;
};

export type MatchmakingLeaveResult = {
  queue_size?: number;
};

export type AvatarUploadResult = {
  user?: {
    id?: string;
    avatar_thumb_url?: string | null;
    avatar_full_url?: string | null;
  };
  avatar?: {
    thumb_url?: string | null;
    full_url?: string | null;
  };
};

/** Incoming match invite payload from matchmaking WebSocket. */
export type MatchInviteIncoming = {
  id: string;
  from_username?: string;
  from_user_id?: string;
  from_rating?: number;
  from_country_code?: string | null;
  from_host_trust_tier?: string | null;
  from_host_trust_badge?: string | null;
  rated?: boolean;
  preferred_color?: string;
  time_control_seconds?: number;
  expires_at?: string;
};

/** Raw Go WebSocket matchmaking envelope (not GraphQL). */
export type MatchmakingWsMessage = {
  type?: string;
  game_id?: string;
  size?: number;
  player1_id?: string;
  player2_id?: string;
  invite_id?: string;
  invite?: MatchInviteIncoming;
  [k: string]: unknown;
};

export type PublicPlayerCardLite = {
  id: string;
  username: string;
  rating?: number;
  xp?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  country_code?: string | null;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
  level_label?: string | null;
  online?: boolean;
  playing?: boolean;
  playing_game_id?: string | null;
  created_at?: string | null;
  phone_kyc_verified?: boolean;
  document_kyc_verified?: boolean;
  host_trust_tier?: string | null;
  host_trust_badge?: string | null;
  host_finished_paid_cups?: number | null;
  host_cancelled_paid_cups?: number | null;
  host_open_reports?: number | null;
};

export type PublicPlayerResponse = {
  player: PublicPlayerCardLite & {
    rating: number;
    xp: number;
    wins: number;
    losses: number;
    region?: string | null;
  };
  matches: Array<{
    id: string;
    mode?: string;
    is_draw?: boolean;
    winner_id?: string | null;
    finished_at?: string | null;
    move_count?: number;
    game_id?: string;
    player1_id?: string;
    player2_id?: string;
    player1?: PublicPlayerCardLite;
    player2?: PublicPlayerCardLite;
  }>;
  tournament_placements?: Array<{
    tournament_id: string;
    title: string;
    status: string;
    is_free: boolean;
    entry_status: string;
    joined_at: string;
  }>;
  regional_rank: number;
  region_label: string;
  online?: boolean;
  playing?: boolean;
  playing_game_id?: string | null;
  /** Mutual friends count from player_friends. */
  friends_count?: number;
  /** Up to 24 friend public cards for profile sidebar grid. */
  friends_preview?: PublicPlayerCardLite[];
};
