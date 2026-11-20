import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import { invalidateMediaPool } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function requireToken(token: string | null | undefined): string {
  if (!token) throw new Error("");
  return token;
}

type UploadFileResult = {
  video_id?: string;
  status?: string;
  job_id?: string;
  error?: string;
};

export function useUploadMediaPoolFileMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      file: File;
      title: string;
      description?: string;
      async?: boolean;
    }) => {
      const t = requireToken(token);
      const body = new FormData();
      body.append("file", payload.file);
      body.append("title", payload.title.trim());
      if (payload.description?.trim()) {
        body.append("description", payload.description.trim());
      }
      body.append("async", payload.async === false ? "false" : "true");
      const res = await fetch(`${apiRestUrl()}/media/pool/upload-file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
        body,
      });
      const json = (await res.json()) as UploadFileResult & { message?: string };
      if (!res.ok) {
        const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
        const fallback = (chrome?.media_pool?.toast_upload_failed || "").trim();
        throw new Error((json.error || json.message || fallback || "").trim());
      }
      return json;
    },
    onSuccess: (res) => {
      void invalidateMediaPool(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const base = (chrome?.media_pool?.toast_upload_complete || "").trim();
      const open = (chrome?.media_pool?.paren_open || "").trim();
      const close = (chrome?.media_pool?.paren_close || "").trim();
      if (!base) return;
      const vid = (res.video_id || "").trim();
      toast.success(vid && open && close ? `${base}${open}${vid}${close}` : base);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.media_pool?.toast_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
