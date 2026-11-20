import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateMediaPool } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import type { MediaPoolChannel } from "@/types/console";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function requireToken(token: string | null | undefined): string {
  if (!token) throw new Error("");
  return token;
}

export type UpdateMediaPoolChannelInput = {
  id: string;
  label?: string;
  channel_id?: string;
  sort_order?: number;
  daily_quota_limit?: number;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  api_key?: string;
  active?: boolean;
};

export function useUpdateMediaPoolChannelMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateMediaPoolChannelInput) => {
      const t = requireToken(token);
      const body: Record<string, unknown> = {};
      if (payload.label !== undefined) body.label = payload.label;
      if (payload.channel_id !== undefined) body.channel_id = payload.channel_id;
      if (payload.sort_order !== undefined) body.sort_order = payload.sort_order;
      if (payload.daily_quota_limit !== undefined)
        body.daily_quota_limit = payload.daily_quota_limit;
      if (payload.active !== undefined) body.active = payload.active;
      if (payload.client_id?.trim()) body.client_id = payload.client_id.trim();
      if (payload.client_secret?.trim()) body.client_secret = payload.client_secret.trim();
      if (payload.refresh_token?.trim()) body.refresh_token = payload.refresh_token.trim();
      if (payload.api_key?.trim()) body.api_key = payload.api_key.trim();
      const { data } = await restClient.put<MediaPoolChannel>(`/media/pool/channels/${id}`, body, {
        headers: authHeaders(t),
      });
      return data;
    },
    onSuccess: () => {
      void invalidateMediaPool(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.media_pool?.toast_channel_updated || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(
        err,
        (chrome?.media_pool?.toast_channel_update_failed || "").trim(),
      );
      if (msg) toast.error(msg);
    },
  });
}
