import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import {
  type CashRmgPolicyConsole,
  cashRmgPolicyQueryKey,
} from "@/hooks/query/useCashRmgPolicyQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type HostTrustPolicyPayload = {
  host_paid_create_requires_phone_kyc: boolean;
  host_guarantee_requires_document_kyc: boolean;
  host_concurrent_open_paid_cap_phone_verified: number;
  host_concurrent_open_paid_cap_document_verified: number;
  host_concurrent_open_paid_cap_new_host: number;
  host_new_host_settled_paid_threshold: number;
  host_reputation_max_open_reports: number;
  host_reputation_cancel_rate_bps: number;
  host_reputation_cancel_rate_min_sample: number;
};

export function useSaveHostTrustPolicyMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: HostTrustPolicyPayload) => {
      const { data } = await restClient.put<CashRmgPolicyConsole>(
        "/console/cash-rmg/host-trust-policy",
        payload,
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(cashRmgPolicyQueryKey(token), data);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.payments?.host_trust_toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const fallback = (chrome?.payments?.host_trust_toast_failed || "").trim();
      const msg = apiToastMessage(err, fallback);
      if (msg) toast.error(msg);
    },
  });
}
