import { authHeaders, restClient } from "@/lib/api";
import { invalidateEvents } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useEventArenaQueueMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string }) => {
      const id = vars.eventId.trim();
      if (!token) throw new Error("");
      await restClient.post(
        `/events/${encodeURIComponent(id)}/arena/queue`,
        {},
        { headers: authHeaders(token) },
      );
    },
    onSuccess: (_data, vars) => {
      void invalidateEvents(qc, vars.eventId);
      void qc.invalidateQueries({ queryKey: ["event-arena-standings", vars.eventId] });
    },
  });
}

export function useEventArenaLeaveQueueMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string }) => {
      const id = vars.eventId.trim();
      if (!token) throw new Error("");
      await restClient.post(
        `/events/${encodeURIComponent(id)}/arena/queue/leave`,
        {},
        { headers: authHeaders(token) },
      );
    },
    onSuccess: (_data, vars) => {
      void invalidateEvents(qc, vars.eventId);
      void qc.invalidateQueries({ queryKey: ["event-arena-standings", vars.eventId] });
    },
  });
}
