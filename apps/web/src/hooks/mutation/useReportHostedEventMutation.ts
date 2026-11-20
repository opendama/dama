import { eventsPlayerChromeQueryKey } from "@/hooks/query/useEventsPlayerChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { HostedEventReport, ReportHostedEventInput } from "@/types/events";
import type { EventsPlayerChrome } from "@/types/events-player-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useReportHostedEventMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string } & ReportHostedEventInput) => {
      const { eventId, ...body } = vars;
      const { data } = await restClient.post<HostedEventReport>(`/events/${eventId}/report`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<EventsPlayerChrome>(eventsPlayerChromeQueryKey());
      if (chrome?.report_toast_sent) toast.success(chrome.report_toast_sent);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsPlayerChrome>(eventsPlayerChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.report_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
