import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type AvatarChrome, isAvatarChromeReady } from "@/types/avatar-chrome";
import { useQuery } from "@tanstack/react-query";

export function avatarChromeQueryKey() {
  return ["avatar-chrome"] as const;
}

export function useAvatarChromeQuery(enabled = true) {
  return useQuery({
    queryKey: avatarChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<AvatarChrome> => {
      const { data } = await restClient.get<AvatarChrome>("/public/avatar-chrome");
      if (!isAvatarChromeReady(data)) {
        const msg = (data?.avatar_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
