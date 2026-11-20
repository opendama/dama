"use client";

import { Button } from "@/components/ui/button";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useDataExportMutation } from "@/hooks/mutation/useDataExportMutation";
import { useDeleteAccountMutation } from "@/hooks/mutation/useDeleteAccountMutation";
import { useStoreComplianceChromeQuery } from "@/hooks/query/useStoreComplianceChromeQuery";
import { isStoreComplianceChromeReady } from "@/types/store-compliance-chrome";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function AccountComplianceSection({ token }: { token: string }) {
  const chromeQuery = useStoreComplianceChromeQuery(true);
  const chrome = isStoreComplianceChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const [confirmToken, setConfirmToken] = useState("");
  const deleteAccount = useDeleteAccountMutation(token);
  const exportData = useDataExportMutation(token);

  if (chromeQuery.isLoading) {
    return (
      <div
        className="space-y-6 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5"
        aria-hidden
      >
        <ShimmerBlock className="h-5 w-40" />
        <ShimmerBlock className="h-4 w-56" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-24 w-full rounded-md" />
      </div>
    );
  }

  if (!chrome) {
    const unavailable =
      (chromeQuery.data?.store_compliance_unavailable || "").trim() ||
      (chromeQuery.error instanceof Error ? chromeQuery.error.message : "").trim();
    return unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null;
  }

  const tokenMatches = confirmToken.trim() === chrome.delete_account_confirm_token.trim();

  return (
    <section className="space-y-6 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
      <h2 className="font-display text-lg font-semibold text-[var(--dama-gold)]">
        {chrome.account_section_title}
      </h2>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/privacy" className="text-[var(--dama-gold)] underline underline-offset-2">
          {chrome.privacy_link_label}
        </Link>
        <Link href="/terms" className="text-[var(--dama-gold)] underline underline-offset-2">
          {chrome.terms_link_label}
        </Link>
        <Link href="/refunds" className="text-[var(--dama-gold)] underline underline-offset-2">
          {chrome.refunds_link_label}
        </Link>
      </div>

      <div className="space-y-2 border-t border-[var(--dama-border)] pt-4">
        <h3 className="text-sm font-semibold">{chrome.export_data_title}</h3>
        <p className="text-xs text-[var(--dama-muted)]">{chrome.export_data_blurb}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          isLoading={exportData.isPending}
          pendingLabel={chrome.export_data_pending}
          onClick={() =>
            exportData.mutate(undefined, {
              onError: () => {
                // Chrome-only (never Error.message / raw API JSON envelopes).
                toast.error((chrome.export_data_failed || "").trim());
              },
            })
          }
        >
          {chrome.export_data_action}
        </Button>
      </div>

      <div className="space-y-2 border-t border-[var(--dama-border)] pt-4">
        <h3 className="text-sm font-semibold text-[var(--dama-danger)]">
          {chrome.delete_account_title}
        </h3>
        <p className="text-xs text-[var(--dama-muted)]">{chrome.delete_account_blurb}</p>
        <label className="block text-xs text-[var(--dama-muted)]">
          {chrome.delete_account_confirm}
          <input
            type="text"
            className="mt-1 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] placeholder:text-[var(--dama-muted)]"
            value={confirmToken}
            onChange={(e) => setConfirmToken(e.target.value)}
            placeholder={(chrome.delete_account_confirm_token || "").trim() || undefined}
            autoComplete="off"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[var(--dama-danger)] text-[var(--dama-danger)]"
          disabled={!tokenMatches}
          isLoading={deleteAccount.isPending}
          pendingLabel={chrome.delete_account_pending}
          onClick={() =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => {
                toast.success(chrome.delete_account_success);
              },
              onError: () => {
                // Chrome-only (never Error.message / raw API JSON envelopes).
                toast.error((chrome.delete_account_failed || "").trim());
              },
            })
          }
        >
          {chrome.delete_account_action}
        </Button>
      </div>
    </section>
  );
}
