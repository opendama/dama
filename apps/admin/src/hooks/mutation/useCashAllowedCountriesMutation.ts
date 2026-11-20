import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import {
  type CashRmgPolicyConsole,
  cashRmgPolicyQueryKey,
} from "@/hooks/query/useCashRmgPolicyQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function chromeMsg(chrome: AdminConsoleChrome | undefined, key: string) {
  const ff = chrome?.feature_flags as Record<string, string> | undefined;
  return (ff?.[key] || "").trim();
}

export function useCashAllowedCountriesMutation(token: string | null | undefined) {
  const qc = useQueryClient();

  const onOk = (data: CashRmgPolicyConsole) => {
    qc.setQueryData(cashRmgPolicyQueryKey(token), data);
    const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
    const msg = chromeMsg(chrome, "cash_allowed_countries_saved");
    if (msg) toast.success(msg);
  };

  const onFail = (_err: unknown) => {
    const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
    // Chrome-only (never invent API / transport English bodies).
    const msg = chromeMsg(chrome, "cash_allowed_countries_failed");
    if (msg) toast.error(msg);
  };

  const replace = useMutation({
    mutationFn: async (countryCodes: string[]) => {
      const { data } = await restClient.put<CashRmgPolicyConsole>(
        "/console/cash-rmg/allowed-countries",
        { country_codes: countryCodes },
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: onOk,
    onError: onFail,
  });

  const add = useMutation({
    mutationFn: async (countryCode: string) => {
      const { data } = await restClient.post<CashRmgPolicyConsole>(
        "/console/cash-rmg/allowed-countries",
        { country_code: countryCode },
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: onOk,
    onError: onFail,
  });

  const remove = useMutation({
    mutationFn: async (countryCode: string) => {
      const { data } = await restClient.delete<CashRmgPolicyConsole>(
        `/console/cash-rmg/allowed-countries/${encodeURIComponent(countryCode)}`,
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: onOk,
    onError: onFail,
  });

  return { replace, add, remove };
}
