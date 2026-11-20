import { restClient } from "@/lib/api";
import { invalidateAdPublisher } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useAdImpressionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      campaignId: string;
      viewerKey: string;
      placement: string;
    }) => {
      if (!vars.placement.trim()) {
        throw new Error("placement required");
      }
      await restClient.post(
        `/ads/campaigns/${vars.campaignId}/impression`,
        {
          viewer_key: vars.viewerKey,
          placement: vars.placement,
        },
        { headers: { "X-Device-Id": vars.viewerKey } },
      );
    },
    onSuccess: () => {
      void invalidateAdPublisher(qc);
    },
  });
}
