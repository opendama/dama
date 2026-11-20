import { restClient } from "@/lib/api";
import type { OtpStartResult } from "@/types/auth";
import { useMutation } from "@tanstack/react-query";

export function useOtpStartMutation(token: string | null | undefined) {
  return useMutation({
    mutationFn: async (channel: string) => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<OtpStartResult>(
        "/auth/otp/start",
        { channel },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
  });
}
