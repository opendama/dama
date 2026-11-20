import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ClientEnums } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export function clientEnumsQueryKey() {
  return ["client-enums"] as const;
}

export type ClientEnumsQueryOpts = {
  /** When true, fail closed if hosted_event_default_status is missing (events manage). */
  requireHostedEventDefault?: boolean;
};

export function useClientEnumsQuery(enabled = true, opts?: ClientEnumsQueryOpts) {
  const requireHostedDefault = opts?.requireHostedEventDefault === true;
  return useQuery({
    queryKey: [...clientEnumsQueryKey(), requireHostedDefault ? "events" : "core"],
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<ClientEnums>("/platform/enums");
      const unavailable = (data?.unavailable || "").trim();
      if (
        !unavailable ||
        !data?.campaign_statuses?.length ||
        !data.creative_types?.length ||
        !data.default_creative_type ||
        !data.video_creative_type ||
        !data.creative_types.includes(data.default_creative_type) ||
        !data.creative_types.includes(data.video_creative_type) ||
        !(data.archived_campaign_status || "").trim() ||
        !(data.reopen_campaign_status || "").trim() ||
        !data.campaign_statuses.includes(data.archived_campaign_status) ||
        !data.campaign_statuses.includes(data.reopen_campaign_status) ||
        (requireHostedDefault && !(data.hosted_event_default_status || "").trim())
      ) {
        throw new Error(unavailable);
      }
      return data;
    },
  });
}
