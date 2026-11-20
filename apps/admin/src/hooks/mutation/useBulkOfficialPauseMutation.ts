"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authHeaders, restClient } from "@/lib/api";
import { officialPauseLiveQueryKey } from "@/hooks/query/useOfficialPauseLiveQuery";

export type BulkOfficialPauseInput = {
  eventId?: string;
  tournamentId?: string;
  roundIndex?: number;
  gameIds?: string[];
  reasonKey: string;
  note?: string;
};

export type BulkOfficialPauseResult = {
  paused?: string[];
  skipped?: string[];
  failed?: { game_id: string; error_key?: string }[];
  ok?: number;
  skipped_count?: number;
  failed_count?: number;
};

export function useBulkOfficialPauseMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkOfficialPauseInput): Promise<BulkOfficialPauseResult> => {
      if (!token) throw new Error("");
      const body: Record<string, unknown> = {
        reason_key: input.reasonKey,
      };
      if ((input.note || "").trim()) body.note = (input.note || "").trim();
      const ids = (input.gameIds || []).map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        body.game_ids = ids;
      } else {
        if (typeof input.roundIndex === "number") body.round_index = input.roundIndex;
        if ((input.eventId || "").trim()) body.event_id = (input.eventId || "").trim();
        if ((input.tournamentId || "").trim()) {
          body.tournament_id = (input.tournamentId || "").trim();
        }
      }
      const { data } = await restClient.post<BulkOfficialPauseResult>(
        "/games/official-pause/bulk",
        body,
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["console", "official-pause-live"] });
      void qc.invalidateQueries({ queryKey: officialPauseLiveQueryKey(false, "", 0, 25) });
    },
  });
}
