export type MyCampaign = {
  id: string;
  title: string;
  status: string;
  impressions: number;
  clicks: number;
  creativeUrl?: string | null;
};
