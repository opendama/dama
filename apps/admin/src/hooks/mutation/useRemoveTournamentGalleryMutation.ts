import { consoleNavQueryKey } from "@/hooks/query/useConsoleNavQuery";
import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import type { ConsoleNavPayload } from "@/types/console";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UploadResult = {
  gallery?: string[];
  error?: string;
};

export function useRemoveTournamentGalleryMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; index: number }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const res = await fetch(
        `${apiRestUrl()}/console/tournaments/${vars.id}/gallery/${vars.index}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const json = (await res.json()) as UploadResult;
      if (!res.ok) {
        throw new Error((json.error || chrome?.media_upload_failed || "").trim());
      }
      return json;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      void invalidateAdminTournaments(qc);
      const msg = (chrome?.toast_gallery_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const empty = (
        qc.getQueryData<ConsoleNavPayload>(consoleNavQueryKey())?.graphql_empty || ""
      ).trim();
      const msg = apiToastMessage(err, (chrome?.media_upload_failed || "").trim() || empty);
      if (msg) toast.error(msg);
    },
  });
}
