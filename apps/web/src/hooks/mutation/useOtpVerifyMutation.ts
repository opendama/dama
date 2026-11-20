import { restClient } from "@/lib/api";
import type { OtpVerifyInput } from "@/types/auth";
import { useMutation } from "@tanstack/react-query";

export function useOtpVerifyMutation(token: string | null | undefined) {
  return useMutation({
    mutationFn: async (vars: OtpVerifyInput) => {
      if (!token) throw new Error("");
      await restClient.post(
        "/auth/otp/verify",
        { challenge_id: vars.challenge_id, code: vars.code },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
  });
}
