import { restClient } from "@/lib/api";
import { mapRestAuthUser } from "@/lib/map-rest-auth-user";
import type { AuthUser } from "@/types/auth";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export type OAuthExchangeResult = {
  accessToken: string;
  user: AuthUser;
};

export function useOAuthExchangeMutation() {
  return useMutation({
    mutationFn: async (accessToken: string): Promise<OAuthExchangeResult> => {
      try {
        const { data } = await restClient.post<{
          access_token: string;
          user: Record<string, unknown>;
        }>("/auth/oauth/supabase", { access_token: accessToken });
        return {
          accessToken: data.access_token,
          user: mapRestAuthUser(data.user),
        };
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const body = err.response?.data as { error?: string } | undefined;
          const apiErr = (body?.error || "").trim();
          if (apiErr) throw new Error(apiErr);
        }
        throw err;
      }
    },
  });
}
