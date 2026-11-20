"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaymentsCurrencySkeleton } from "@/components/ui/shimmer-skeletons";
import { useSaveConsoleCurrencyMutation } from "@/hooks/mutation";
import { useAdminConsoleChromeQuery, useConsoleCurrencyQuery } from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useEffect, useState } from "react";

export default function AdminPaymentsCurrencyPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;

  const [globalCur, setGlobalCur] = useState("");
  const [ethiopiaCur, setEthiopiaCur] = useState("");
  const [supportedRaw, setSupportedRaw] = useState("");

  const currencyQuery = useConsoleCurrencyQuery(token, Boolean(isAdmin));
  const saveCurrency = useSaveConsoleCurrencyMutation(token);

  useEffect(() => {
    if (!currencyQuery.data || !chrome?.list_join_separator) return;
    setGlobalCur(currencyQuery.data.global);
    setEthiopiaCur(currencyQuery.data.ethiopia);
    setSupportedRaw((currencyQuery.data.supported ?? []).join(chrome.list_join_separator));
  }, [currencyQuery.data, chrome?.list_join_separator]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsCurrencySkeleton />
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

  const pageLoading = roleLoading || (isAdmin && currencyQuery.isLoading);
  const savePending = (chrome.save_currency_pending || "").trim();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.currency_page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.currency_page_blurb}</p>
      </div>

      {roleLoading ? (
        <PaymentsCurrencySkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsCurrencySkeleton />
      ) : (
        <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <h2 className="font-semibold text-[var(--dama-gold)]">{chrome.currency_section_title}</h2>
          {currencyQuery.error ? (
            <p className="text-sm text-[var(--dama-danger)]">{chrome.currency_load_failed}</p>
          ) : (
            <>
              <Field id="payments-currency-global" label={chrome.global_label}>
                <Input
                  id="payments-currency-global"
                  className="uppercase"
                  value={globalCur}
                  onChange={(e) => setGlobalCur(e.target.value)}
                  disabled={saveCurrency.isPending}
                />
              </Field>
              <Field id="payments-currency-ethiopia" label={chrome.ethiopia_label}>
                <Input
                  id="payments-currency-ethiopia"
                  className="uppercase"
                  value={ethiopiaCur}
                  onChange={(e) => setEthiopiaCur(e.target.value)}
                  disabled={saveCurrency.isPending}
                />
              </Field>
              <Field id="payments-currency-supported" label={chrome.supported_label}>
                <Input
                  id="payments-currency-supported"
                  className="uppercase"
                  value={supportedRaw}
                  onChange={(e) => setSupportedRaw(e.target.value)}
                  disabled={saveCurrency.isPending}
                />
              </Field>
              <Button
                variant="gold"
                isLoading={saveCurrency.isPending}
                pendingLabel={savePending}
                disabled={saveCurrency.isPending || !globalCur.trim() || !ethiopiaCur.trim()}
                onClick={() => {
                  const supported = supportedRaw
                    .split(/[,\s]+/)
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean);
                  saveCurrency.mutate({
                    global: globalCur.trim().toUpperCase(),
                    ethiopia: ethiopiaCur.trim().toUpperCase(),
                    supported,
                  });
                }}
              >
                {chrome.save_currency_action}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
