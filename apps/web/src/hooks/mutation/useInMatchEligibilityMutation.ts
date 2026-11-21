import { restClient } from "@/lib/api";
import type { InMatchEligibilityRequest, InMatchEligibilityResponse } from "@/types/ad-playback";
import { useMutation } from "@tanstack/react-query";

export type InMatchEligibilityBounds = {
  non_skippable_min: number;
  interval_min: number;
};

export function useInMatchEligibilityMutation() {
  return useMutation({
    mutationFn: async (vars: {
      body: InMatchEligibilityRequest;
      bounds: InMatchEligibilityBounds;
    }) => {
      const { body, bounds } = vars;
      if (bounds.non_skippable_min < 1 || bounds.interval_min < 1) {
        throw new Error("in-match eligibility unavailable");
      }
      const { data } = await restClient.post<InMatchEligibilityResponse>(
        "/ads/in-match/eligibility",
        body,
      );
      // show:false still carries timing bounds used for next_check scheduling.
      if (
        data == null ||
        typeof data.show !== "boolean" ||
        typeof data.non_skippable_seconds !== "number" ||
        typeof data.interval_seconds !== "number" ||
        data.non_skippable_seconds < bounds.non_skippable_min ||
        data.interval_seconds < bounds.interval_min
      ) {
        throw new Error("in-match eligibility unavailable");
      }
      return data;
    },
  });
}
