import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";

/** Console tournament report row from GET /console/tournaments/reports. */
export type TournamentReport = {
  id: string;
  tournament_id: string;
  reporter_id: string;
  reason_code: string;
  reason_label?: string;
  note: string;
  status: string;
  created_at?: string;
  tournament_title?: string;
  reporter_username?: string;
};

export type TournamentReportsListResponse = {
  reports: TournamentReport[];
  meta?: SkipPaginationMeta;
};
