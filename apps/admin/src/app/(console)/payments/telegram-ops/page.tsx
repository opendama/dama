"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaymentsGeoSkeleton } from "@/components/ui/shimmer-skeletons";
import { useSaveConsoleTelegramOpsMutation } from "@/hooks/mutation";
import { useAdminConsoleChromeQuery, useConsoleTelegramOpsQuery } from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useEffect, useState } from "react";

export default function AdminPaymentsTelegramOpsPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;

  const [enabled, setEnabled] = useState(false);
  const [botServiceUrl, setBotServiceUrl] = useState("");
  const [botApiKey, setBotApiKey] = useState("");
  const [reviewerUserId, setReviewerUserId] = useState("");
  const [notifyTimeoutMs, setNotifyTimeoutMs] = useState("");

  const opsQuery = useConsoleTelegramOpsQuery(token, Boolean(isAdmin));
  const saveOps = useSaveConsoleTelegramOpsMutation(token);

  useEffect(() => {
    if (!opsQuery.data) return;
    setEnabled(Boolean(opsQuery.data.enabled));
    setBotServiceUrl(opsQuery.data.bot_service_url || "");
    setReviewerUserId(opsQuery.data.reviewer_user_id || "");
    setNotifyTimeoutMs(
      opsQuery.data.notify_timeout_ms > 0 ? String(opsQuery.data.notify_timeout_ms) : "",
    );
    setBotApiKey("");
  }, [opsQuery.data]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsGeoSkeleton />
      </div>
    );
  }

  if (!chrome) {
    return (
      <div className="p-6 text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </div>
    );
  }

  const pageLoading = roleLoading || (isAdmin && opsQuery.isLoading);
  const savePending = (chrome.save_telegram_ops_pending || "").trim();
  const timeoutNum = Number.parseInt(notifyTimeoutMs, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.telegram_ops_page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.telegram_ops_page_blurb}</p>
      </div>

      {roleLoading ? (
        <PaymentsGeoSkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsGeoSkeleton />
      ) : (
        <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <h2 className="font-semibold text-[var(--dama-gold)]">
            {chrome.telegram_ops_section_title}
          </h2>
          {opsQuery.error ? (
            <p className="text-sm text-[var(--dama-danger)]">{chrome.telegram_ops_load_failed}</p>
          ) : (
            <>
              <Field id="telegram-ops-enabled" label={chrome.telegram_ops_enabled_label}>
                <div className="flex min-h-10 items-center gap-2 pt-1">
                  <Checkbox
                    id="telegram-ops-enabled"
                    checked={enabled}
                    onCheckedChange={(v) => setEnabled(v === true)}
                    disabled={saveOps.isPending}
                  />
                </div>
              </Field>
              <Field id="telegram-ops-url" label={chrome.telegram_ops_bot_service_url_label}>
                <Input
                  id="telegram-ops-url"
                  value={botServiceUrl}
                  onChange={(e) => setBotServiceUrl(e.target.value)}
                  disabled={saveOps.isPending}
                />
              </Field>
              <Field id="telegram-ops-key" label={chrome.telegram_ops_bot_api_key_label}>
                <Input
                  id="telegram-ops-key"
                  type="password"
                  autoComplete="new-password"
                  value={botApiKey}
                  onChange={(e) => setBotApiKey(e.target.value)}
                  disabled={saveOps.isPending}
                  placeholder={
                    opsQuery.data?.has_bot_api_key
                      ? chrome.telegram_ops_has_api_key_label
                      : undefined
                  }
                />
                <p className="mt-1 text-xs text-[var(--dama-muted)]">
                  {chrome.telegram_ops_bot_api_key_hint}
                </p>
              </Field>
              <Field id="telegram-ops-reviewer" label={chrome.telegram_ops_reviewer_user_id_label}>
                <Input
                  id="telegram-ops-reviewer"
                  value={reviewerUserId}
                  onChange={(e) => setReviewerUserId(e.target.value)}
                  disabled={saveOps.isPending}
                />
              </Field>
              <Field id="telegram-ops-timeout" label={chrome.telegram_ops_notify_timeout_ms_label}>
                <Input
                  id="telegram-ops-timeout"
                  inputMode="numeric"
                  value={notifyTimeoutMs}
                  onChange={(e) => setNotifyTimeoutMs(e.target.value)}
                  disabled={saveOps.isPending}
                />
              </Field>
              {opsQuery.data ? (
                <p className="text-xs text-[var(--dama-muted)]">
                  {opsQuery.data.product_label}: {opsQuery.data.notify_receipt_type} /{" "}
                  {opsQuery.data.notify_payout_type}
                  {chrome.telegram_ops_status_joiner}
                  {opsQuery.data.ready
                    ? chrome.telegram_ops_ready_label
                    : chrome.telegram_ops_not_ready_label}
                </p>
              ) : null}
              <Button
                variant="gold"
                isLoading={saveOps.isPending}
                pendingLabel={savePending}
                disabled={
                  saveOps.isPending ||
                  !Number.isFinite(timeoutNum) ||
                  timeoutNum <= 0 ||
                  (enabled &&
                    (!botServiceUrl.trim() ||
                      !reviewerUserId.trim() ||
                      // First enable: require a key in the form when DB has none yet
                      // (empty key preserves existing secret server-side once has_bot_api_key).
                      (!opsQuery.data?.has_bot_api_key && !botApiKey.trim())))
                }
                onClick={() => {
                  saveOps.mutate({
                    enabled,
                    bot_service_url: botServiceUrl.trim(),
                    bot_api_key: botApiKey,
                    reviewer_user_id: reviewerUserId.trim(),
                    notify_timeout_ms: timeoutNum,
                  });
                }}
              >
                {chrome.save_telegram_ops_action}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
