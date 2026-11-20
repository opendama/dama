import type { CreateTournamentMutationVariables } from "@/gql/graphql";

/** Console tournament row from REST `/console/tournaments` (live pot is backend-attached). */
export type AdminTournament = {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  /** Absent when API omits fee (never invent 0). */
  entryFeeAmount: number | null;
  entryFeeCurrency: string;
  /** Declared guarantee floor from prize_pool.total when set; null when omitted. */
  prizePoolAmount: number | null;
  prizePoolCurrency: string | null;
  /** Optional place→amount from prize_pool jsonb keys "1","2","3". */
  prizePoolPlaces?: Record<string, number> | null;
  prizeImageUrl: string | null;
  gallery: string[];
  status: string;
  prizePoolDisplayEnabled?: boolean;
  prizePoolNow?: number | null;
  prizePoolIfFull?: number | null;
  prizePoolGuaranteeAmount?: number | null;
  prizePoolFrozen?: boolean;
  prizePoolCurrencyLive?: string | null;
  maxPlayers?: number | null;
  /** API seat_cap_unlimited: null Unlimited or high Arena safety ceiling. */
  seatCapUnlimited?: boolean;
  /** RFC3339 from REST `created_at` when present. */
  createdAt?: string | null;
  /** Set after POST /console/tournaments/{id}/start. */
  startedAt?: string | null;
  /** Set when arena/bracket cup completes. */
  finishedAt?: string | null;
  /** Set when pending prize escrow opens the dispute hold. */
  disputeWindowEndsAt?: string | null;
  /** Set when all competition prize payouts for this cup are settled. */
  prizeSettledAt?: string | null;
  formatId?: string | null;
  formatLabel?: string | null;
  /** RFC3339 arena clock end when started as Arena. */
  arenaEndsAt?: string | null;
  arenaDurationMinutes?: number | null;
  prizePayoutMode?: string | null;
  prizePlacePercents?: Record<string, number> | null;
};

/** GraphQL createTournament variables (codegen). */
export type CreateTournamentInput = CreateTournamentMutationVariables;
