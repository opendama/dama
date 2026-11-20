import { restClient } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export function usePresenceHeartbeatMutation(token: string | null | undefined) {
  return useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("");
      await restClient.post(
        "/presence/heartbeat",
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
  });
}
