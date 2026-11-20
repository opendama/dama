import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";

/** Console hosted event report row from GET /console/events/reports. */
export type HostedEventReport = {
  id: string;
  event_id: string;
  reporter_id: string;
  reason_code: string;
  reason_label?: string;
  note: string;
  status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  event_title?: string;
  event_join_code?: string;
  reporter_username?: string;
};

export type EventReportsListResponse = {
  reports: HostedEventReport[];
  meta?: SkipPaginationMeta;
};
