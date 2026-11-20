import { restClient } from "@/lib/api";
import type { DeviceFingerprintInput } from "@/types/auth";
import { useMutation } from "@tanstack/react-query";

export function useDeviceFingerprintMutation(token: string | null | undefined) {
  return useMutation({
    mutationFn: async (payload: DeviceFingerprintInput) => {
      if (!token) throw new Error("");
      await restClient.post("/devices/fingerprint", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  });
}
