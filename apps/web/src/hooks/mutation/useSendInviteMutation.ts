import { restClient } from "@/lib/api";
import { invalidateMatchmaking } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type SendInviteInput = {
  toUser?: string;
  rated: boolean;
  preferredColor?: "white" | "black" | "random";
  /** Must match platform match_clock.presets (server fail-closed). */
  timeControlSeconds: number;
  openLink?: boolean;
};

export type SendInviteResult = {
  invite: {
    id: string;
    to_user_id?: string;
    share_token?: string;
    rated?: boolean;
    preferred_color?: string;
    time_control_seconds?: number;
    expires_at?: string;
  };
};

export function useSendInviteMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendInviteInput): Promise<SendInviteResult> => {
      if (!token) throw new Error("");
      if (!(input.timeControlSeconds > 0)) {
        throw new Error("");
      }
      const { data } = await restClient.post<SendInviteResult>(
        "/invites/",
        {
          to_user: input.toUser,
          rated: input.rated,
          preferred_color: input.preferredColor,
          time_control_seconds: input.timeControlSeconds,
          open_link: input.openLink,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data;
    },
    onSuccess: () => {
      void invalidateMatchmaking(qc, token);
    },
  });
}
