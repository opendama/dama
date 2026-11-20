import { authHeaders, restClient } from "@/lib/api";
import { officialPauseChromeQueryKey } from "@/hooks/query/useOfficialPauseChromeQuery";
import { adminGameStateQueryKey } from "@/hooks/query/useAdminGameStateQuery";
import { officialPauseEventsQueryKey } from "@/hooks/query/useOfficialPauseEventsQuery";
import { officialPauseChromeApiToast } from "@/lib/api-toast-message";
import type { GamePayload } from "@/types/game";
import type { OfficialPauseChrome } from "@/types/official-pause-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useOfficialPauseMetaMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string; reasonKey: string; note?: string }) => {
      if (!token) throw new Error("");
      const gid = vars.gameId.trim();
      const reasonKey = vars.reasonKey.trim();
      if (!gid || !reasonKey) throw new Error("");
      const body: { reason_key: string; note: string } = {
        reason_key: reasonKey,
        note: (vars.note || "").trim(),
      };
      const { data } = await restClient.post<GamePayload>(
        `/games/${encodeURIComponent(gid)}/official-pause-meta`,
        body,
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      const gid = vars.gameId.trim();
      void qc.invalidateQueries({ queryKey: adminGameStateQueryKey(gid) });
      void qc.invalidateQueries({ queryKey: officialPauseEventsQueryKey(gid) });
      void qc.invalidateQueries({ queryKey: ["console", "official-pause-live"] });
      const ops = qc.getQueryData<OfficialPauseChrome>(officialPauseChromeQueryKey());
      const msg = (ops?.toast_meta_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const ops = qc.getQueryData<OfficialPauseChrome>(officialPauseChromeQueryKey());
      const fallback = (ops?.toast_meta_failed || "").trim();
      const msg = officialPauseChromeApiToast(
        err,
        ops as Record<string, unknown> | undefined,
        fallback,
      );
      if (msg) toast.error(msg);
    },
  });
}
