import { CreateTournamentDocument } from "@/gql/graphql";
import { consoleNavQueryKey } from "@/hooks/query/useConsoleNavQuery";
import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { tournamentChromeApiToast } from "@/lib/api-toast-message";
import { graphqlRequest } from "@/lib/graphql";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import type { CreateTournamentInput } from "@/types";
import type { ConsoleNavPayload } from "@/types/console";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateTournamentMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTournamentInput) => {
      const empty = (
        qc.getQueryData<ConsoleNavPayload>(consoleNavQueryKey())?.graphql_empty || ""
      ).trim();
      return graphqlRequest(CreateTournamentDocument, input, token, empty);
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = (chrome?.toast_created || "").trim();
      if (msg) toast.success(msg);
      void invalidateAdminTournaments(qc);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = tournamentChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        chrome?.toast_create_failed || "",
        ["err_unlimited_arena_only", "err_max_players_required"],
      );
      if (msg) toast.error(msg);
    },
  });
}
