import { restClient } from "@/lib/api";
import { invalidateAdPublisher } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useAdVideoCompleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      await restClient.post(`/ads/campaigns/${campaignId}/video-complete`);
    },
    onSuccess: () => {
      void invalidateAdPublisher(qc);
    },
  });
}
