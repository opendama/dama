import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import {
  type ProfileInspectChrome,
  isProfileInspectChromeReady,
} from "@/types/profile-inspect-chrome";
import { useQuery } from "@tanstack/react-query";

export function profileInspectChromeQueryKey() {
  return ["profile-inspect-chrome"] as const;
}

export function useProfileInspectChromeQuery(enabled = true) {
  return useQuery({
    queryKey: profileInspectChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<ProfileInspectChrome> => {
      const { data } = await restClient.get<ProfileInspectChrome>("/public/profile-inspect-chrome");
      if (!isProfileInspectChromeReady(data)) {
        const msg = (data?.profile_inspect_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
