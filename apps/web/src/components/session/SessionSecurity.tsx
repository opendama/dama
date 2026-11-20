"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormCardSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useDeviceFingerprintMutation,
  useOtpStartMutation,
  useOtpVerifyMutation,
  usePresenceHeartbeatMutation,
} from "@/hooks/mutation";
import { useOtpChromeQuery } from "@/hooks/query/useOtpChromeQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { clearOtpSession, isOtpSessionVerified, markOtpSessionVerified } from "@/lib/otp-session";
import { useAuthStore } from "@/store/auth";
import { isOtpChromeReady } from "@/types/otp-chrome";
import { useEffect, useRef, useState } from "react";

function deviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  let h = 0;
  const raw = parts.join("|");
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `web_${Math.abs(h).toString(16)}_${raw.length}`;
}

/** Presence heartbeat, device fingerprint upsert, and OTP gate when required. */
export function SessionSecurity() {
  const token = useAuthStore((s) => s.token);
  /** Same REST flags as /play auto-start (avoid GraphQL/REST otp split). */
  const flagsQuery = useRestFeatureFlagsQuery();
  const otpChromeQuery = useOtpChromeQuery(Boolean(token));
  const otpChrome = isOtpChromeReady(otpChromeQuery.data) ? otpChromeQuery.data : undefined;
  /** Only block after flags hydrate AND otp is required (never during loading). */
  const flagsReady = flagsQuery.isSuccess && Boolean(flagsQuery.data);
  const otpFromFlags = Boolean(flagsQuery.data?.otp_required);
  const userId = useAuthStore((s) => s.user?.id);
  /** Optimistic local flag after verify click; sessionStorage is source of truth. */
  const [localVerified, setLocalVerified] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifyAttempted, setVerifyAttempted] = useState(false);
  const started = useRef(false);
  /** Reset OTP only on account switch - JWT refresh must not re-prompt. */
  const lastUserIdRef = useRef<string | null>(null);
  const heartbeat = usePresenceHeartbeatMutation(token);
  const fingerprint = useDeviceFingerprintMutation(token);
  const otpStart = useOtpStartMutation(token);
  const otpVerify = useOtpVerifyMutation(token);
  // Never gate without userId (token-before-userId hydrate must not flash OTP).
  const sessionVerified = isOtpSessionVerified(userId);
  const otpVerified = localVerified || sessionVerified;
  const gateBlocking =
    Boolean(token) && Boolean(userId) && flagsReady && otpFromFlags && !otpVerified;

  // Restore / account-switch only. JWT refresh must not re-prompt.
  useEffect(() => {
    if (!token) {
      lastUserIdRef.current = null;
      setLocalVerified(false);
      setChallengeId(null);
      setCode("");
      setError(null);
      started.current = false;
      return;
    }
    if (!userId) {
      return;
    }
    const prev = lastUserIdRef.current;
    lastUserIdRef.current = userId;
    if (prev != null && prev !== userId) {
      clearOtpSession(prev);
      setLocalVerified(false);
      setChallengeId(null);
      setCode("");
      setError(null);
      started.current = false;
      return;
    }
    if (isOtpSessionVerified(userId)) {
      setLocalVerified(true);
    }
  }, [token, userId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once per token; mutate identities change every render
  useEffect(() => {
    if (!token) return;
    const beat = () => {
      heartbeat.mutate();
    };
    beat();
    const id = window.setInterval(beat, 25_000);
    fingerprint.mutate({
      fingerprint: deviceFingerprint(),
      platform: "web",
      user_agent: navigator.userAgent,
    });
    // feature_flags WS invalidation: MatchmakingRealtimeProvider (single socket).
    return () => {
      window.clearInterval(id);
    };
  }, [token]);

  function startOtp() {
    if (!otpChrome) return;
    setError(null);
    setChallengeId(null);
    otpStart.mutate("email", {
      onSuccess: (data) => setChallengeId(data.challenge_id),
      onError: () => setError(otpChrome.start_failed),
    });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: start once per gate; startOtp closes over otpStart
  useEffect(() => {
    if (!token || !flagsReady || !otpFromFlags || otpVerified || !otpChrome || started.current)
      return;
    started.current = true;
    startOtp();
  }, [token, flagsReady, otpFromFlags, otpVerified, otpChrome]);

  if (!gateBlocking) return null;

  // Gate is required: keep a stable overlay (skeleton) until chrome is ready - no null flash / no app leak.
  if (otpChromeQuery.isLoading || (!otpChrome && !otpChromeQuery.isError)) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--dama-overlay)] p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6">
          <FormCardSkeleton />
        </div>
      </div>
    );
  }

  if (otpChromeQuery.isError || !otpChrome) {
    const partial = otpChromeQuery.data;
    const unavailable =
      (partial?.otp_chrome_unavailable || "").trim() ||
      (partial?.flags_unavailable || "").trim() ||
      (otpChromeQuery.error instanceof Error ? otpChromeQuery.error.message : "").trim();
    const retryLabel =
      (partial?.retry_action || "").trim() || (partial?.retry_otp_action || "").trim();
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--dama-overlay)] p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-bold">
              {(partial?.verify_title || "").trim() || unavailable}
            </h2>
            <ThemeToggle />
          </div>
          {unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null}
          {retryLabel ? (
            <Button variant="gold" className="w-full" onClick={() => void otpChromeQuery.refetch()}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--dama-overlay)] p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold">{otpChrome.verify_title}</h2>
          <ThemeToggle />
        </div>
        {!challengeId && !error ? (
          <FormCardSkeleton />
        ) : !challengeId ? (
          <>
            <p className="text-sm text-[var(--dama-muted)]">
              {otpChrome.verification_start_failed}
            </p>
            {error ? <p className="text-sm text-[var(--dama-danger)]">{error}</p> : null}
            <Button
              variant="gold"
              className="w-full"
              isLoading={otpStart.isPending}
              pendingLabel={otpChrome.starting_action}
              onClick={startOtp}
            >
              {otpChrome.retry_otp_action}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--dama-muted)]">{otpChrome.enter_code_blurb_web}</p>
            <Field
              id="session-otp-code"
              label={otpChrome.code_label}
              error={
                verifyAttempted && code.length < 6 ? otpChrome.invalid_code : error || undefined
              }
            >
              <Input
                id="session-otp-code"
                className="font-mono tracking-widest"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={otpChrome.code_placeholder}
                maxLength={6}
                value={code}
                aria-invalid={
                  (verifyAttempted && code.length < 6) || Boolean(error) ? true : undefined
                }
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  if (verifyAttempted) setVerifyAttempted(false);
                  if (error) setError(null);
                }}
                disabled={otpVerify.isPending}
              />
            </Field>
            <Button
              variant="gold"
              className="w-full"
              isLoading={otpVerify.isPending}
              pendingLabel={otpChrome.verifying_action}
              onClick={() => {
                setVerifyAttempted(true);
                if (code.length < 6) {
                  setError(otpChrome.invalid_code);
                  return;
                }
                setError(null);
                otpVerify.mutate(
                  { challenge_id: challengeId, code },
                  {
                    onSuccess: () => {
                      setLocalVerified(true);
                      markOtpSessionVerified(userId);
                    },
                    onError: () => setError(otpChrome.invalid_code),
                  },
                );
              }}
            >
              {otpChrome.verify_action}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
