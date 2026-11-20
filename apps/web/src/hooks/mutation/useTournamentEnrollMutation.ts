import { restClient } from "@/lib/api";
import { invalidateMe, invalidateTournaments, invalidateWallet } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTournamentEnrollMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; countryCode?: string }) => {
      const countryCode = vars.countryCode?.trim();
      const body = countryCode ? { country_code: countryCode.toUpperCase() } : {};
      const { data } = await restClient.post(`/tournaments/${vars.id}/enroll`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data as { is_free?: boolean; charged?: number };
    },
    onSuccess: () => {
      void invalidateTournaments(qc);
      void invalidateWallet(qc);
      void invalidateMe(qc, token);
    },
  });
}
