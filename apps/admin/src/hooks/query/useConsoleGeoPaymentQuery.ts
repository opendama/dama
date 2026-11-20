import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type ConsoleGeoPayment = {
  ethiopia_country: string;
  private_default_city: string;
  private_default_region: string;
};

export function consoleGeoPaymentQueryKey(token: string | null | undefined) {
  return ["console-geo-payment", token] as const;
}

export function useConsoleGeoPaymentQuery(token: string | null | undefined, enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleGeoPaymentQueryKey(token),
    enabled: enabled && Boolean(token),
    queryFn: async (): Promise<ConsoleGeoPayment> => {
      const { data } = await restClient.get<ConsoleGeoPayment>("/console/geo-payment", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
