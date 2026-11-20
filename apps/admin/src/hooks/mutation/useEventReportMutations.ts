import { eventsAdminChromeQueryKey } from "@/hooks/query/useEventsAdminChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { HostedEventReport } from "@/types/event-reports";
import type { EventsAdminChrome } from "@/types/events-admin-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDismissEventReportMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<HostedEventReport> => {
      const { data } = await restClient.post<HostedEventReport>(
        `/console/events/reports/${encodeURIComponent(reportId)}/dismiss`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["console-event-reports"] });
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = (chrome?.toast_dismissed || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.load_failed || "");
      if (msg) toast.error(msg);
    },
  });
}

export function useDeactivateEventReportMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<{ report: HostedEventReport }> => {
      const { data } = await restClient.post<{ report: HostedEventReport }>(
        `/console/events/reports/${encodeURIComponent(reportId)}/deactivate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["console-event-reports"] });
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = (chrome?.toast_deactivated || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsAdminChrome>(eventsAdminChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.load_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
