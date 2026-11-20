import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Clears Dama JWT + Supabase cookies + QueryClient (no zombie signed-in state). */
export function useSignOutMutation() {
  const qc = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  return useMutation({
    mutationFn: async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        /* env missing / already cleared - still wipe local Dama session */
      }
      clearSession();
      qc.clear();
    },
  });
}
