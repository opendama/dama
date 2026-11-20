import { restClient } from "@/lib/api";
import { mapRestAuthUser } from "@/lib/map-rest-auth-user";
import type { AuthUser } from "@/types/auth";
import { useMutation } from "@tanstack/react-query";

export type OAuthExchangeResult = {
  accessToken: string;
  user: AuthUser;
};

export function useOAuthExchangeMutation() {
  return useMutation({
    mutationFn: async (accessToken: string): Promise<OAuthExchangeResult> => {
      const { data } = await restClient.post<{
        access_token: string;
        user: Record<string, unknown>;
      }>("/auth/oauth/supabase", { access_token: accessToken });
      return {
        accessToken: data.access_token,
        user: mapRestAuthUser(data.user),
      };
    },
  });
}
