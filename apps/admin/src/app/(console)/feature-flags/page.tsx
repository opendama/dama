"use client";

import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";

import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FeatureFlagsFormSkeleton } from "@/components/ui/shimmer-skeletons";
import { useCashAllowedCountriesMutation, useSetFeatureFlagMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useCashRmgPolicyQuery,
  useClientEnumsQuery,
  useConsoleFeatureFlagsQuery,
  useFeatureFlagCatalogQuery,
} from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ConsoleFeatureFlagsPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.feature_flags
    : undefined;
  const [depthsText, setDepthsText] = useState("");
  const [disabledCountriesText, setDisabledCountriesText] = useState("");
  const [allowedCountriesText, setAllowedCountriesText] = useState("");
  const [addCountryCode, setAddCountryCode] = useState("");

  const enumsQuery = useClientEnumsQuery();
  const catalogQuery = useFeatureFlagCatalogQuery();
  const { data, isLoading, error } = useConsoleFeatureFlagsQuery(token);
  const policyQuery = useCashRmgPolicyQuery(token, Boolean(isAdmin));
  const mutation = useSetFeatureFlagMutation(token);
  const allowMut = useCashAllowedCountriesMutation(token);

  useEffect(() => {
    if (data?.aiDepths && chrome?.list_join_separator) {
      setDepthsText(data.aiDepths.join(chrome.list_join_separator));
    }
  }, [data?.aiDepths, chrome?.list_join_separator]);

  useEffect(() => {
    if (!data?.cashRmgDisabledCountries || !chrome?.list_join_separator) return;
    setDisabledCountriesText(data.cashRmgDisabledCountries.join(chrome.list_join_separator));
  }, [data?.cashRmgDisabledCountries, chrome?.list_join_separator]);

  useEffect(() => {
    const codes = policyQuery.data?.allowed_country_codes;
    if (!codes || !chrome?.list_join_separator) return;
    setAllowedCountriesText(codes.join(chrome.list_join_separator));
  }, [policyQuery.data?.allowed_country_codes, chrome?.list_join_separator]);

  const catalog = catalogQuery.data;
  const paymentModes = enumsQuery.data?.ethiopia_payment_modes ?? [];
  const pageLoading =
    roleLoading ||
    isLoading ||
    catalogQuery.isLoading ||
    enumsQuery.isLoading ||
    policyQuery.isLoading;
  const allowBusy =
    allowMut.replace.isPending || allowMut.add.isPending || allowMut.remove.isPending;

  const flagMutationVars = mutation.variables;
  const isDepthsSavePending = mutation.isPending && flagMutationVars?.depths != null;
  const isDisabledCountriesSavePending =
    mutation.isPending && flagMutationVars?.disabledCountries != null;
  const isFlagTogglePending = (key: string) =>
    mutation.isPending &&
    flagMutationVars?.key === key &&
    flagMutationVars.depths == null &&
    flagMutationVars.disabledCountries == null &&
    flagMutationVars.mode == null;
  const isPaymentModePending = (key: string) =>
    mutation.isPending && flagMutationVars?.key === key && flagMutationVars.mode != null;

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-6">
        <FeatureFlagsFormSkeleton />
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

  const saveDepths = () => {
    const depths = depthsText
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s));
    if (depths.length === 0 || depths.some((d) => !Number.isInteger(d) || d < 1 || d > 20)) {
      const msg = (chrome.depths_invalid || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    if (data?.vsAiEnabled === undefined || !catalog?.ai_depths_flag_key) {
      const msg = (chrome.flags_not_loaded || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    mutation.mutate({
      key: catalog.ai_depths_flag_key,
      enabled: data.vsAiEnabled,
      depths,
    });
  };

  const booleanEnabled = (toggle: {
    key: string;
    state_field?: string;
  }): boolean => {
    if (!data) return false;
    const field = (toggle.state_field || "").trim();
    if (!field) return false;
    return (data as Record<string, unknown>)[field] === true;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      {roleLoading ? (
        <FeatureFlagsFormSkeleton />
      ) : !isAdmin ? (
        <p className="rounded-md border border-[var(--dama-border)] p-4 text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : null}

      <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
        {pageLoading ? (
          <FeatureFlagsFormSkeleton />
        ) : error || catalogQuery.error || !catalog || !data ? (
          <p className="text-sm text-[var(--dama-danger)]">{chrome.load_failed}</p>
        ) : (
          <>
            {catalog.toggles.map((toggle) => {
              if (toggle.kind === "boolean") {
                return (
                  <FlagRow
                    key={toggle.key}
                    title={toggle.title}
                    description={toggle.description}
                    enabled={booleanEnabled(toggle)}
                    disabled={!isAdmin || mutation.isPending}
                    isLoading={isFlagTogglePending(toggle.key)}
                    pendingLabel={chrome.toggle_pending}
                    onLabel={chrome.toggle_on ?? ""}
                    offLabel={chrome.toggle_off ?? ""}
                    onToggle={(enabled) => mutation.mutate({ key: toggle.key, enabled })}
                  />
                );
              }
              if (toggle.kind === "mode") {
                return (
                  <div
                    key={toggle.key}
                    className="border-t border-[var(--dama-border)] pt-4 text-sm"
                  >
                    <p className="font-medium">{toggle.title}</p>
                    <p className="mt-1 text-[var(--dama-muted)]">{toggle.description}</p>
                    <p className="mt-1 text-[var(--dama-muted)]">
                      {chrome.current_prefix}{" "}
                      <span className="font-mono text-[var(--dama-gold)]">
                        {paymentModes.find((m) => m.mode === data.ethiopiaPaymentMode)?.label ||
                          (chrome.unavailable || "").trim()}
                      </span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paymentModes.map((mode) => (
                        <Button
                          key={mode.mode}
                          size="sm"
                          variant={data.ethiopiaPaymentMode === mode.mode ? "gold" : "outline"}
                          disabled={!isAdmin || mutation.isPending}
                          isLoading={
                            isPaymentModePending(toggle.key) && flagMutationVars?.mode === mode.mode
                          }
                          pendingLabel={chrome.toggle_pending}
                          onClick={() =>
                            mutation.mutate({
                              key: toggle.key,
                              enabled: mode.enabled,
                              mode: mode.mode,
                            })
                          }
                        >
                          {mode.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })}
            <div className="border-t border-[var(--dama-border)] pt-4 text-sm">
              <p className="font-medium">{chrome.ai_depths_title}</p>
              <p className="mt-1 text-[var(--dama-muted)]">{chrome.ai_depths_blurb}</p>
              <Field id="flags-ai-depths" label={chrome.ai_depths_title} className="mt-3">
                <Input
                  id="flags-ai-depths"
                  className="font-mono text-sm"
                  value={depthsText}
                  onChange={(e) => setDepthsText(e.target.value)}
                  disabled={!isAdmin || mutation.isPending}
                  placeholder={data.aiDepths?.join(chrome.list_join_separator || "") || ""}
                />
              </Field>
              <Button
                className="mt-3"
                size="sm"
                variant="gold"
                disabled={!isAdmin || mutation.isPending}
                isLoading={isDepthsSavePending}
                pendingLabel={chrome.save_depths_pending}
                onClick={saveDepths}
              >
                {chrome.save_depths_action}
              </Button>
            </div>

            <div className="border-t border-[var(--dama-border)] pt-4 text-sm">
              <p className="font-medium">{chrome.cash_allowed_countries_title}</p>
              <p className="mt-1 text-[var(--dama-muted)]">{chrome.cash_allowed_countries_blurb}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(policyQuery.data?.allowed_country_codes ?? []).map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 py-1 font-mono text-xs uppercase"
                  >
                    {code}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-auto px-1 py-0 text-xs text-[var(--dama-muted)] underline"
                      disabled={!isAdmin || allowBusy}
                      isLoading={allowMut.remove.isPending && allowMut.remove.variables === code}
                      pendingLabel={chrome.cash_allowed_countries_remove_pending}
                      onClick={() => allowMut.remove.mutate(code)}
                    >
                      {chrome.cash_allowed_countries_remove_action}
                    </Button>
                  </span>
                ))}
              </div>
              <Field
                id="flags-add-country"
                label={chrome.cash_allowed_countries_add_label}
                className="mt-3"
              >
                <div className="flex gap-2">
                  <Input
                    id="flags-add-country"
                    className="w-24 font-mono text-sm uppercase"
                    value={addCountryCode}
                    maxLength={2}
                    onChange={(e) => setAddCountryCode(e.target.value.toUpperCase())}
                    disabled={!isAdmin || allowBusy}
                  />
                  <Button
                    size="sm"
                    variant="gold"
                    disabled={!isAdmin || allowBusy || addCountryCode.trim().length !== 2}
                    isLoading={allowMut.add.isPending}
                    pendingLabel={chrome.cash_allowed_countries_add_pending}
                    onClick={() => {
                      const code = addCountryCode.trim().toUpperCase();
                      allowMut.add.mutate(code, {
                        onSuccess: () => setAddCountryCode(""),
                      });
                    }}
                  >
                    {chrome.cash_allowed_countries_add_action}
                  </Button>
                </div>
              </Field>
              <Field
                id="flags-allowed-countries"
                label={chrome.cash_allowed_countries_label}
                className="mt-3"
              >
                <Input
                  id="flags-allowed-countries"
                  className="font-mono text-sm uppercase"
                  value={allowedCountriesText}
                  onChange={(e) => setAllowedCountriesText(e.target.value)}
                  disabled={!isAdmin || allowBusy}
                />
              </Field>
              <Button
                className="mt-3"
                size="sm"
                variant="gold"
                disabled={!isAdmin || allowBusy}
                isLoading={allowMut.replace.isPending}
                pendingLabel={chrome.cash_allowed_countries_save_pending}
                onClick={() => {
                  const codes = allowedCountriesText
                    .split(/[,\s]+/)
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean);
                  allowMut.replace.mutate(codes);
                }}
              >
                {chrome.cash_allowed_countries_save}
              </Button>
            </div>

            <div className="border-t border-[var(--dama-border)] pt-4 text-sm">
              <p className="font-medium">{chrome.cash_disabled_countries_title}</p>
              <p className="mt-1 text-[var(--dama-muted)]">
                {chrome.cash_disabled_countries_blurb}
              </p>
              <Field
                id="flags-disabled-countries"
                label={chrome.cash_disabled_countries_label}
                className="mt-3"
              >
                <Input
                  id="flags-disabled-countries"
                  className="font-mono text-sm uppercase"
                  value={disabledCountriesText}
                  onChange={(e) => setDisabledCountriesText(e.target.value)}
                  disabled={!isAdmin || mutation.isPending}
                />
              </Field>
              <Button
                className="mt-3"
                size="sm"
                variant="gold"
                disabled={
                  !isAdmin ||
                  mutation.isPending ||
                  data.cashRmgEnabled === undefined ||
                  !(catalog.cash_rmg_flag_key || "").trim()
                }
                isLoading={isDisabledCountriesSavePending}
                pendingLabel={chrome.cash_disabled_countries_save_pending}
                onClick={() => {
                  const cashKey = (catalog.cash_rmg_flag_key || "").trim();
                  if (!cashKey) {
                    const msg = (chrome.flags_not_loaded || "").trim();
                    if (msg) toast.error(msg);
                    return;
                  }
                  const disabledCountries = disabledCountriesText
                    .split(/[,\s]+/)
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean);
                  mutation.mutate(
                    {
                      key: cashKey,
                      enabled: data.cashRmgEnabled === true,
                      disabledCountries,
                    },
                    {
                      onSuccess: () => {
                        const msg = (chrome.cash_disabled_countries_saved || "").trim();
                        if (msg) toast.success(msg);
                      },
                      onError: () => {
                        const msg = (chrome.cash_disabled_countries_failed || "").trim();
                        if (msg) toast.error(msg);
                      },
                    },
                  );
                }}
              >
                {chrome.cash_disabled_countries_save}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FlagRow({
  title,
  description,
  enabled,
  disabled,
  isLoading,
  pendingLabel,
  onLabel,
  offLabel,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  pendingLabel?: string;
  onLabel: string;
  offLabel: string;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--dama-border)] pb-4 last:border-0">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{description}</p>
      </div>
      <Button
        size="sm"
        variant={enabled ? "gold" : "outline"}
        disabled={disabled}
        isLoading={isLoading}
        pendingLabel={pendingLabel}
        onClick={() => onToggle(!enabled)}
      >
        {enabled ? onLabel : offLabel}
      </Button>
    </div>
  );
}
