import { restClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteAccountMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  return useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("");
      await restClient.delete("/me/account", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      clearSession();
      qc.clear();
    },
  });
}
