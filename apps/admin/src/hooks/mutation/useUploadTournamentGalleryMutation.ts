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
  prize_image_url?: string;
  gallery?: string[];
  error?: string;
};

async function postGalleryFile(
  token: string,
  id: string,
  file: File,
  failedMsg: string,
): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${apiRestUrl()}/console/tournaments/${id}/gallery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = (await res.json()) as UploadResult;
  if (!res.ok) {
    throw new Error((json.error || failedMsg).trim());
  }
  return json;
}

export function useUploadTournamentGalleryMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file?: File; files?: File[] }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const failed = (chrome?.media_upload_failed || "").trim();
      const files = (vars.files?.length ? vars.files : vars.file ? [vars.file] : []).filter(
        Boolean,
      ) as File[];
      if (files.length === 0) throw new Error(failed);
      let last: UploadResult = {};
      for (const file of files) {
        last = await postGalleryFile(token, vars.id, file, failed);
      }
      return last;
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
