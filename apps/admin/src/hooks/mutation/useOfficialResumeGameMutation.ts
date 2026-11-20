import { authHeaders, restClient } from "@/lib/api";
import { officialPauseChromeQueryKey } from "@/hooks/query/useOfficialPauseChromeQuery";
import { adminGameStateQueryKey } from "@/hooks/query/useAdminGameStateQuery";
import { officialPauseEventsQueryKey } from "@/hooks/query/useOfficialPauseEventsQuery";
import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { officialPauseChromeApiToast } from "@/lib/api-toast-message";
import type { GamePayload } from "@/types/game";
import type { OfficialPauseChrome } from "@/types/official-pause-chrome";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useOfficialResumeGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string; note?: string }) => {
      if (!token) throw new Error("");
      const gid = vars.gameId.trim();
      if (!gid) throw new Error("");
      const body: { note?: string } = {};
      const note = (vars.note || "").trim();
      if (note) body.note = note;
      const { data } = await restClient.post<GamePayload>(
        `/games/${encodeURIComponent(gid)}/official-resume`,
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
      const tour = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const ops = qc.getQueryData<OfficialPauseChrome>(officialPauseChromeQueryKey());
      const msg = (tour?.toast_official_resumed || "").trim() || (ops?.toast_resumed || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const tour = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const ops = qc.getQueryData<OfficialPauseChrome>(officialPauseChromeQueryKey());
      const fallback =
        (tour?.toast_official_resume_failed || "").trim() ||
        (ops?.toast_resume_failed || "").trim();
      const msg = officialPauseChromeApiToast(
        err,
        ops as Record<string, unknown> | undefined,
        fallback,
      );
      if (msg) toast.error(msg);
    },
  });
}
