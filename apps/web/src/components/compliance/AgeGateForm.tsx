"use client";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { cashEligibilityQueryKey } from "@/hooks/query/useCashEligibilityQuery";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { detectBrowserCountry } from "@/hooks/query/useDetectBrowserCountryQuery";
import { apiRestUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useAuthStore } from "@/store/auth";
import { isCashRmgChromeReady } from "@/types/cash-rmg";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type AgeGateFormProps = {
  onVerified?: () => void;
};

/** Compact age-gate form for dialogs (settings panel still owns phone KYC). */
export function AgeGateForm({ onVerified }: AgeGateFormProps) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const chromeQuery = useCashRmgChromeQuery(Boolean(token));
  const ready = isCashRmgChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  if (!token) return null;

  if (chromeQuery.isLoading) {
    return (
      <div className="grid gap-3">
        <ShimmerBlock className="h-4 w-full max-w-sm rounded-md" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-10 w-28 rounded-md" />
      </div>
    );
  }

  if (!ready) {
    const unavailable = (
      chromeQuery.data?.chrome?.cash_rmg_unavailable ||
      (chromeQuery.error instanceof Error ? chromeQuery.error.message : "") ||
      ""
    ).trim();
    return unavailable ? (
      <p className="text-sm text-[var(--dama-danger)]" role="alert">
        {unavailable}
      </p>
    ) : null;
  }

  const chrome = ready.chrome;

  async function submit() {
    if (!token) return;
    setAttempted(true);
    if (!dob.trim()) {
      toast.error((chrome.age_required_error || chrome.age_gate_failed || "").trim());
      return;
    }
    setBusy(true);
    try {
      await detectBrowserCountry(token);
      const res = await fetch(`${apiRestUrl()}/me/age-gate`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date_of_birth: dob }),
      });
      if (res.status === 401) {
        clearSessionAndBounceToLogin();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const tooYoung = (chrome.age_gate_too_young || "").trim();
        const failed = (chrome.age_gate_failed || "").trim();
        const errBody = (json.error || "").trim();
        // Chrome-only: map known server chrome strings; never toast raw JSON envelopes.
        toast.error(tooYoung && errBody === tooYoung ? tooYoung : failed || tooYoung);
        return;
      }
      toast.success((chrome.age_gate_success || "").trim());
      setAttempted(false);
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: cashEligibilityQueryKey(token) });
      onVerified?.();
    } catch {
      toast.error((chrome.age_gate_failed || "").trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--dama-muted)]">{chrome.age_gate_blurb}</p>
      <Field
        id="wallet-age-gate-dob"
        label={chrome.age_gate_dob_label}
        className="overflow-visible"
        error={
          attempted && !dob.trim()
            ? (chrome.age_required_error || chrome.age_gate_failed || "").trim()
            : undefined
        }
      >
        <DateField
          id="wallet-age-gate-dob"
          value={dob}
          onChange={(v) => {
            setDob(v);
            if (attempted) setAttempted(false);
          }}
          placeholder={(chrome.age_gate_dob_placeholder || "").trim() || chrome.age_gate_dob_label}
          disabled={busy}
          invalid={attempted && !dob.trim()}
        />
      </Field>
      <Button
        type="button"
        variant="gold"
        isLoading={busy}
        pendingLabel={chrome.age_gate_submit_pending}
        onClick={() => void submit()}
      >
        {chrome.age_gate_submit_action}
      </Button>
    </div>
  );
}
