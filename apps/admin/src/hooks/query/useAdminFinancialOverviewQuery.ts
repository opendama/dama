import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";

export type FinancialCurrencyAmount = {
  currency: string;
  amount: number;
};

export type FinancialOverviewPeriodDays = 7 | 30 | 90;

export type AdminFinancialOverview = {
  pending_receipts: number;
  pending_payouts: number;
  pending_kyc: number;
  period_days: number;
  topup_volume: FinancialCurrencyAmount[];
  payout_volume: FinancialCurrencyAmount[];
  host_fee_volume: FinancialCurrencyAmount[];
  entry_commission: FinancialCurrencyAmount[];
  platform_revenue?: FinancialCurrencyAmount[];
  net_profit?: FinancialCurrencyAmount[];
  net_cashflow?: FinancialCurrencyAmount[];
  wallet_balances: FinancialCurrencyAmount[];
  generated_at?: string;
};

export function adminFinancialOverviewQueryKey(
  token: string | null | undefined,
  days: FinancialOverviewPeriodDays,
) {
  return ["admin-financial-overview", token, days] as const;
}

export function useAdminFinancialOverviewQuery(
  token: string | null | undefined,
  enabled: boolean,
  days: FinancialOverviewPeriodDays = 7,
) {
  const hydrated = useAuthHydrated();
  const period = days === 30 || days === 90 ? days : 7;
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminFinancialOverviewQueryKey(token, period),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async (): Promise<AdminFinancialOverview> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<AdminFinancialOverview>(
        `/console/financial-overview?days=${period}`,
        { headers: authHeaders(token) },
      );
      return data;
    },
  });
}
