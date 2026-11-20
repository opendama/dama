"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  cashEligibilityQueryKey,
  useCashEligibilityQuery,
} from "@/hooks/query/useCashEligibilityQuery";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { apiRestUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useAuthStore } from "@/store/auth";
import { isCashRmgChromeReady } from "@/types/cash-rmg";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PhoneKycFormProps = {
  onVerified?: () => void;
};

/** Compact phone KYC form for wallet dialogs - DB chrome only. OTP optional via flag. */
export function PhoneKycForm({ onVerified }: PhoneKycFormProps) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const chromeQuery = useCashRmgChromeQuery(Boolean(token));
  const flagsQuery = useRestFeatureFlagsQuery();
  const eligibilityQuery = useCashEligibilityQuery(token, Boolean(token));
  const ready = isCashRmgChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  // Fail closed: OTP required unless flag explicitly false.
  const otpRequired = flagsQuery.data?.cash_phone_otp_required === true;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      challenge_id?: string;
      status?: string;
    };
    // Never throw API English bodies - callers toast chrome.phone_kyc_failed only.
    if (!res.ok) throw new Error((chrome.phone_kyc_failed || "").trim() || "failed");
    return json;
  }

  async function finishVerified() {
    toast.success((chrome.phone_kyc_success || "").trim());
    setChallengeId(null);
    setCode("");
    await qc.invalidateQueries({ queryKey: ["me"] });
    await qc.invalidateQueries({ queryKey: cashEligibilityQueryKey(token) });
    onVerified?.();
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--dama-muted)]">{chrome.phone_kyc_blurb}</p>
      <Field
        id="wallet-phone-kyc"
        label={chrome.phone_kyc_phone_label}
        error={
          phoneAttempted && phone.trim().length < 8
            ? (chrome.phone_kyc_required_error || chrome.phone_kyc_failed || "").trim()
            : undefined
        }
      >
        <Input
          id="wallet-phone-kyc"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          aria-invalid={phoneAttempted && phone.trim().length < 8 ? true : undefined}
          onChange={(e) => {
            setPhone(e.target.value);
            if (phoneAttempted && e.target.value.trim().length >= 8) setPhoneAttempted(false);
          }}
          placeholder={
            (chrome.phone_kyc_phone_placeholder || "").trim() || chrome.phone_kyc_phone_label
          }
          disabled={busy}
        />
      </Field>
      <Button
        type="button"
        variant={otpRequired ? "outline" : "gold"}
        isLoading={busy}
        pendingLabel={chrome.phone_kyc_send_pending}
        onClick={() => {
          void (async () => {
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
                body: JSON.stringify({ phone: phone.trim() }),
              });
              // Server-authoritative: OTP off → save returns status=verified.
              // Never start OTP when the flag is off (stale API must not force the challenge UI).
              if (saved.status === "verified" || !otpRequired) {
                if (saved.status === "verified") {
                  setPhoneAttempted(false);
                  await finishVerified();
                } else {
                  toast.error((chrome.phone_kyc_failed || "").trim());
                }
                return;
              }
              const started = await authFetch("/me/phone-kyc/otp/start", {
                method: "POST",
                body: "{}",
              });
              setChallengeId(String(started.challenge_id || "").trim() || null);
            } catch {
              toast.error((chrome.phone_kyc_failed || "").trim());
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {otpRequired
          ? chrome.phone_kyc_start_otp_action
          : chrome.phone_kyc_save_action || chrome.phone_kyc_start_otp_action}
      </Button>
      {challengeId ? (
        <>
          <Field
            id="wallet-phone-kyc-code"
            label={chrome.phone_kyc_code_label}
            error={
              codeAttempted && !code.trim() ? (chrome.phone_kyc_failed || "").trim() : undefined
            }
          >
            <Input
              id="wallet-phone-kyc-code"
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
            onClick={() => {
              void (async () => {
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
                  await finishVerified();
                } catch {
                  toast.error((chrome.phone_kyc_failed || "").trim());
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {chrome.phone_kyc_verify_action}
          </Button>
        </>
      ) : null}
    </div>
  );
}
