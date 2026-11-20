import { restClient } from "@/lib/api";
import { invalidateEvents } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useEventCheckInMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string }) => {
      const id = vars.eventId.trim();
      await restClient.post(
        `/events/${id}/check-in`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: (_data, vars) => {
      void invalidateEvents(qc, vars.eventId);
    },
  });
}
