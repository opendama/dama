import { consoleAdCampaignsQueryKey } from "@/hooks/query/useConsoleAdCampaignsQuery";
import type { ConsoleAdCampaignsPayload } from "@/types/ad-runtime";
import type { QueryClient } from "@tanstack/react-query";

/** Read chrome from any cached skip/limit page of console campaigns. */
export function getConsoleAdCampaignsChrome(
  qc: QueryClient,
  token: string | null | undefined,
): ConsoleAdCampaignsPayload["chrome"] | undefined {
  const rows = qc.getQueriesData<ConsoleAdCampaignsPayload>({
    queryKey: consoleAdCampaignsQueryKey(token),
  });
  for (const [, data] of rows) {
    if (data?.chrome) return data.chrome;
  }
  return undefined;
}
