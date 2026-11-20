"use client";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  cashEligibilityQueryKey,
  useCashEligibilityQuery,
} from "@/hooks/query/useCashEligibilityQuery";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { detectBrowserCountry } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { apiRestUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useAuthStore } from "@/store/auth";
import { isCashRmgChromeReady } from "@/types/cash-rmg";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Age gate + phone KYC for cash features (DB chrome only). OTP optional via flag. */
export function CashCompliancePanel() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const chromeQuery = useCashRmgChromeQuery(Boolean(token));
  const flagsQuery = useRestFeatureFlagsQuery();
  const eligibilityQuery = useCashEligibilityQuery(token, Boolean(token));
  const ready = isCashRmgChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const otpRequired = flagsQuery.data?.cash_phone_otp_required === true;
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ageAttempted, setAgeAttempted] = useState(false);
  const [phoneAttempted, setPhoneAttempted] = useState(false);
  const [codeAttempted, setCodeAttempted] = useState(false);

  useEffect(() => {
    const existing = (eligibilityQuery.data?.primary_phone || "").trim();
    if (!existing) return;
    setPhone((prev) => (prev.trim() ? prev : existing));
  }, [eligibilityQuery.data?.primary_phone]);

  if (!token) return null;
  if (chromeQuery.isLoading || flagsQuery.isLoading || eligibilityQuery.isLoading) {
    return (
      <div
        className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5"
        aria-hidden
      >
        <ShimmerBlock className="h-5 w-40" />
        <ShimmerBlock className="h-4 w-full max-w-sm" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-10 w-32 rounded-md" />
      </div>
    );
  }
  if (!ready) {
    const unavailable = (chromeQuery.data?.chrome?.cash_rmg_unavailable || "").trim();
    return unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null;
  }
  const chrome = ready.chrome;
  const ageVerified = eligibilityQuery.data?.age_verified === true;
  const phoneVerified = eligibilityQuery.data?.phone_kyc_verified === true;
  const verifiedDob = (eligibilityQuery.data?.date_of_birth || "").trim();
  const verifiedPhone = (eligibilityQuery.data?.primary_phone || "").trim();

  async function authFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${apiRestUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    if (res.status === 401 && token) {
      clearSessionAndBounceToLogin();
    }
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      challenge_id?: string;
      status?: string;
      channel?: string;
      debug_code?: string;
    };
    // Catch sites toast DB chrome only - never put API bodies on Error.message.
    if (!res.ok) throw new Error("");
    return json;
  }

  async function finishPhoneVerified() {
    toast.success((chrome.phone_kyc_success || "").trim());
    setChallengeId(null);
    setCode("");
    await qc.invalidateQueries({ queryKey: ["me"] });
    await qc.invalidateQueries({ queryKey: cashEligibilityQueryKey(token) });
  }

  return (
    <section className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
      <div>
        <h2 className="font-semibold">{chrome.age_gate_title}</h2>
        {ageVerified ? (
          <>
            <p className="mt-1 text-sm text-[var(--dama-muted)]">
              {(chrome.age_gate_success || "").trim()}
            </p>
            {verifiedDob ? (
              <p className="mt-2 text-sm tabular-nums text-[var(--dama-fg)]">{verifiedDob}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.age_gate_blurb}</p>
        )}
      </div>
      {!ageVerified ? (
        <>
          <Field
            id="cash-age-gate-dob"
            label={chrome.age_gate_dob_label}
            className="overflow-visible"
            error={
              ageAttempted && !dob.trim()
                ? (chrome.age_required_error || chrome.age_gate_failed || "").trim()
                : undefined
            }
          >
            <DateField
              id="cash-age-gate-dob"
              value={dob}
              onChange={(v) => {
                setDob(v);
                if (ageAttempted) setAgeAttempted(false);
              }}
              placeholder={
                (chrome.age_gate_dob_placeholder || "").trim() || chrome.age_gate_dob_label
              }
              disabled={busy}
              invalid={ageAttempted && !dob.trim()}
            />
          </Field>
          <Button
            type="button"
            variant="gold"
            isLoading={busy}
            pendingLabel={chrome.age_gate_submit_pending}
            onClick={async () => {
              setAgeAttempted(true);
              if (!dob.trim()) {
                toast.error((chrome.age_required_error || chrome.age_gate_failed || "").trim());
                return;
              }
              setBusy(true);
              try {
                await detectBrowserCountry(token);
                await authFetch("/me/age-gate", {
                  method: "PUT",
                  body: JSON.stringify({ date_of_birth: dob }),
                });
                toast.success((chrome.age_gate_success || "").trim());
                setAgeAttempted(false);
                await qc.invalidateQueries({ queryKey: ["me"] });
                await qc.invalidateQueries({ queryKey: cashEligibilityQueryKey(token) });
              } catch {
                toast.error((chrome.age_gate_failed || "").trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            {chrome.age_gate_submit_action}
          </Button>
        </>
      ) : null}

      <div className="border-t border-[var(--dama-border)] pt-4">
        <h2 className="font-semibold">{chrome.phone_kyc_title}</h2>
        {phoneVerified ? (
          <>
            <p className="mt-1 text-sm text-[var(--dama-muted)]">
              {(chrome.phone_kyc_success || "").trim()}
            </p>
            {verifiedPhone ? (
              <p className="mt-2 text-sm tabular-nums text-[var(--dama-fg)]">{verifiedPhone}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.phone_kyc_blurb}</p>
        )}
      </div>
      {!phoneVerified ? (
        <>
          <Field
            id="cash-phone-kyc"
            label={chrome.phone_kyc_phone_label}
            error={
              phoneAttempted && phone.trim().length < 8
                ? (chrome.phone_kyc_required_error || chrome.phone_kyc_failed || "").trim()
                : undefined
            }
          >
            <Input
              id="cash-phone-kyc"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              aria-invalid={phoneAttempted && phone.trim().length < 8 ? true : undefined}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneAttempted && e.target.value.trim().length >= 8) {
                  setPhoneAttempted(false);
                }
              }}
              placeholder={
                (chrome.phone_kyc_phone_placeholder || "").trim() || chrome.phone_kyc_phone_label
              }
              disabled={busy}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={otpRequired ? "outline" : "gold"}
              isLoading={busy}
              pendingLabel={chrome.phone_kyc_send_pending}
              onClick={async () => {
                setPhoneAttempted(true);
                if (phone.trim().length < 8) {
                  toast.error(
                    (chrome.phone_kyc_required_error || chrome.phone_kyc_failed || "").trim(),
                  );
                  return;
                }
                setBusy(true);
                try {
                  const saved = await authFetch("/me/phone-kyc", {
                    method: "PUT",
                    body: JSON.stringify({ phone }),
                  });
                  if (saved.status === "verified" || !otpRequired) {
                    if (saved.status === "verified") {
                      setPhoneAttempted(false);
                      await finishPhoneVerified();
                    } else {
                      toast.error((chrome.phone_kyc_failed || "").trim());
                    }
                    return;
                  }
                  const started = await authFetch("/me/phone-kyc/otp/start", {
                    method: "POST",
                    body: "{}",
                  });
                  setChallengeId(String(started.challenge_id || ""));
                } catch {
                  toast.error((chrome.phone_kyc_failed || "").trim());
                } finally {
                  setBusy(false);
                }
              }}
            >
              {otpRequired
                ? chrome.phone_kyc_start_otp_action
                : chrome.phone_kyc_save_action || chrome.phone_kyc_start_otp_action}
            </Button>
          </div>
          {challengeId ? (
            <>
              <Field
                id="cash-phone-kyc-code"
                label={chrome.phone_kyc_code_label}
                error={
                  codeAttempted && !code.trim() ? (chrome.phone_kyc_failed || "").trim() : undefined
                }
              >
                <Input
                  id="cash-phone-kyc-code"
                  className="font-mono tracking-widest"
                  type="text"
                  value={code}
                  aria-invalid={codeAttempted && !code.trim() ? true : undefined}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    if (codeAttempted) setCodeAttempted(false);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder={(chrome.phone_kyc_code_placeholder || "").trim()}
                  disabled={busy}
                />
              </Field>
              <Button
                type="button"
                variant="gold"
                isLoading={busy}
                pendingLabel={chrome.phone_kyc_verify_pending}
                onClick={async () => {
                  setCodeAttempted(true);
                  if (!code.trim()) {
                    toast.error((chrome.phone_kyc_failed || "").trim());
                    return;
                  }
                  setBusy(true);
                  try {
                    await authFetch("/me/phone-kyc/otp/verify", {
                      method: "POST",
                      body: JSON.stringify({ challenge_id: challengeId, code }),
                    });
                    setCodeAttempted(false);
                    await finishPhoneVerified();
                  } catch {
                    toast.error((chrome.phone_kyc_failed || "").trim());
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {chrome.phone_kyc_verify_action}
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
