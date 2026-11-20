import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateMediaPool } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function requireToken(token: string | null | undefined): string {
  if (!token) throw new Error("");
  return token;
}

export function useUploadMediaPoolVideoMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      local_path?: string;
      async?: boolean;
    }) => {
      const t = requireToken(token);
      const { data } = await restClient.post(
        "/media/pool/upload",
        {
          title: payload.title.trim(),
          description: payload.description?.trim() || undefined,
          local_path: payload.local_path?.trim() || undefined,
          async: payload.async !== false,
        },
        { headers: authHeaders(t) },
      );
      return data as { video_id?: string };
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
