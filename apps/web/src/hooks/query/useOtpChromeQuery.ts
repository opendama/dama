import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type OtpChrome, isOtpChromeReady } from "@/types/otp-chrome";
import { useQuery } from "@tanstack/react-query";

export function otpChromeQueryKey() {
  return ["otp-chrome"] as const;
}

export function useOtpChromeQuery(enabled = true) {
  return useQuery({
    queryKey: otpChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<OtpChrome> => {
      const { data } = await restClient.get<OtpChrome>("/public/otp-chrome");
      if (!isOtpChromeReady(data)) {
        const msg = (data?.otp_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
