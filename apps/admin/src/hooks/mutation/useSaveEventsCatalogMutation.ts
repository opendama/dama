import { eventsAdminChromeQueryKey } from "@/hooks/query/useEventsAdminChromeQuery";
import { eventsCatalogQueryKey } from "@/hooks/query/useEventsCatalogQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { EventsAdminChrome } from "@/types/events-admin-chrome";
import type { EventsCatalogConfig } from "@/types/events-catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveEventsCatalogMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EventsCatalogConfig) => {
      const { data } = await restClient.put<EventsCatalogConfig>(
        "/console/events/catalog",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (payload) => {
      qc.setQueryData(eventsCatalogQueryKey(token), payload);
      void qc.invalidateQueries({ queryKey: ["console-events-catalog"] });
      const chrome = qc.getQueryData<Required<EventsAdminChrome>>(eventsAdminChromeQueryKey());
      const msg = (chrome?.toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<Required<EventsAdminChrome>>(eventsAdminChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.toast_save_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
