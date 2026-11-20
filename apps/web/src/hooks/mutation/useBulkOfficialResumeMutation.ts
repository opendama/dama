"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authHeaders, restClient } from "@/lib/api";

export type BulkOfficialResumeInput = {
  gameIds: string[];
  note?: string;
};

export type BulkOfficialResumeResult = {
  resumed?: string[];
  skipped?: string[];
  failed?: { game_id: string; error_key?: string }[];
  ok?: number;
  skipped_count?: number;
  failed_count?: number;
};

export function useBulkOfficialResumeMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkOfficialResumeInput): Promise<BulkOfficialResumeResult> => {
      if (!token) throw new Error("");
      const ids = (input.gameIds || []).map((id) => id.trim()).filter(Boolean);
      const body: Record<string, unknown> = { game_ids: ids };
      if ((input.note || "").trim()) body.note = (input.note || "").trim();
      const { data } = await restClient.post<BulkOfficialResumeResult>(
        "/games/official-resume/bulk",
        body,
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hosted-event"] });
      void qc.invalidateQueries({ queryKey: ["game-state"] });
      void qc.invalidateQueries({ queryKey: ["event-live-boards"] });
    },
  });
}
