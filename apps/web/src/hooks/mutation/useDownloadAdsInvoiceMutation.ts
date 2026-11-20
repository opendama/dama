import { adPlaybackQueryKey } from "@/hooks/query/useAdPlaybackQuery";
import { apiRestUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import type { AdPlayback } from "@/types/ad-playback";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDownloadAdsInvoiceMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const failed = (chrome?.publisher_invoice_failed || "").trim();
      const filename = (chrome?.publisher_invoice_filename || "").trim();
      if (!token) throw new Error(failed);
      if (!filename) throw new Error(failed);
      // Server resolves invoice currency from request IP (no client country_code).
      const res = await fetch(`${apiRestUrl()}/ads/invoices/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        clearSessionAndBounceToLogin();
        throw new Error(failed);
      }
      if (!res.ok) {
        throw new Error(failed);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
