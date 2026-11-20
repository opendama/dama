import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdminTournament } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type RestTournamentRow = {
  id: string;
  title: string;
  description?: string;
  is_free: boolean;
  entry_fee_amount: number;
  entry_fee_currency: string;
  prize_pool?: Record<string, unknown> | null;
  prize_image_url?: string | null;
  gallery?: string[];
  status: string;
  prize_pool_display_enabled?: boolean;
  prize_pool_now?: number;
  prize_pool_if_full?: number;
  prize_pool_guarantee_amount?: number;
  prize_pool_frozen?: boolean;
  prize_pool_currency?: string;
  max_players?: number;
  seat_cap_unlimited?: boolean;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  dispute_window_ends_at?: string;
  prize_settled_at?: string;
  format_id?: string;
  format_label?: string;
  arena_ends_at?: string;
  arena_duration_minutes?: number;
  prize_payout_mode?: string;
  prize_place_percents?: Record<string, unknown>;
};

export type AdminTournamentEntryFilter = "all" | "free" | "paid";

export type AdminTournamentsListResponse = {
  tournaments: AdminTournament[];
  meta: SkipPaginationMeta;
};

function parsePlacePercents(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> | null {
  if (!raw) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function prizePlacesFromPool(
  pool: Record<string, unknown> | null | undefined,
): Record<string, number> | null {
  if (!pool) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pool)) {
    if (k === "total" || k === "currency") continue;
    const place = Number.parseInt(k, 10);
    if (!Number.isFinite(place) || place < 1) continue;
    const amt = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    out[String(place)] = amt;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function mapRestTournament(row: RestTournamentRow): AdminTournament {
  const pool = row.prize_pool ?? null;
  const totalRaw = pool?.total;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw)
      ? totalRaw
      : typeof totalRaw === "string" && Number.isFinite(Number(totalRaw))
        ? Number(totalRaw)
        : null;
  const currency =
    typeof pool?.currency === "string" && pool.currency.trim() ? pool.currency.trim() : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    isFree: Boolean(row.is_free),
    entryFeeAmount:
      typeof row.entry_fee_amount === "number" && Number.isFinite(row.entry_fee_amount)
        ? row.entry_fee_amount
        : null,
    entryFeeCurrency: row.entry_fee_currency || "",
    prizePoolAmount: total,
    prizePoolCurrency: currency,
    prizePoolPlaces: prizePlacesFromPool(pool),
    prizeImageUrl: row.prize_image_url ?? null,
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    status: row.status,
    prizePoolDisplayEnabled: row.prize_pool_display_enabled === true,
    prizePoolNow: typeof row.prize_pool_now === "number" ? row.prize_pool_now : null,
    prizePoolIfFull: typeof row.prize_pool_if_full === "number" ? row.prize_pool_if_full : null,
    prizePoolGuaranteeAmount:
      typeof row.prize_pool_guarantee_amount === "number" ? row.prize_pool_guarantee_amount : null,
    prizePoolFrozen: row.prize_pool_frozen === true,
    prizePoolCurrencyLive: row.prize_pool_currency ?? null,
    maxPlayers: typeof row.max_players === "number" ? row.max_players : null,
    seatCapUnlimited: row.seat_cap_unlimited === true,
    createdAt: (row.created_at || "").trim() || null,
    startedAt: (row.started_at || "").trim() || null,
    finishedAt: (row.finished_at || "").trim() || null,
    disputeWindowEndsAt: (row.dispute_window_ends_at || "").trim() || null,
    prizeSettledAt: (row.prize_settled_at || "").trim() || null,
    formatId: (row.format_id || "").trim() || null,
    formatLabel: (row.format_label || "").trim() || null,
    arenaEndsAt: (row.arena_ends_at || "").trim() || null,
    arenaDurationMinutes:
      typeof row.arena_duration_minutes === "number" &&
      Number.isFinite(row.arena_duration_minutes) &&
      row.arena_duration_minutes > 0
        ? row.arena_duration_minutes
        : null,
    prizePayoutMode: (row.prize_payout_mode || "").trim() || null,
    prizePlacePercents: parsePlacePercents(row.prize_place_percents),
  };
}

export function adminTournamentsQueryKey(
  token?: string | null,
  skip = 0,
  limit = 0,
  entry: AdminTournamentEntryFilter = "all",
  q = "",
) {
  return ["tournaments", token, skip, limit, entry, q] as const;
}

export function useAdminTournamentsQuery(
  token: string | null | undefined,
  skip = 0,
  limit = 0,
  entry: AdminTournamentEntryFilter = "all",
  q = "",
) {
  const hydrated = useAuthHydrated();
  const qTrim = q.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminTournamentsQueryKey(token, skip, limit, entry, qTrim),
    enabled: hydrated && Boolean(token) && limit > 0,
    queryFn: async (): Promise<AdminTournamentsListResponse> => {
      const params: Record<string, string | number> = { skip, limit };
      if (entry === "free") params.is_free = "true";
      if (entry === "paid") params.is_free = "false";
      if (qTrim) params.q = qTrim;
      const { data } = await restClient.get<{
        tournaments: RestTournamentRow[];
        meta: SkipPaginationMeta;
      }>("/console/tournaments", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return {
        tournaments: (data.tournaments ?? []).map(mapRestTournament),
        meta: data.meta,
      };
    },
    placeholderData: (prev) => prev,
  });
}
