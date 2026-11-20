"use client";

import { Button } from "@/components/ui/button";
import { WalletBanksSkeleton } from "@/components/ui/shimmer-skeletons";
import type { PaymentBank } from "@/types/payments";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type ManualBankCopyChrome = {
  manual_accounts_title?: string;
  banks_loading?: string;
  banks_empty?: string;
  bank_name_prefix?: string;
  bank_account_prefix?: string;
  bank_mobile_prefix?: string;
  bank_currency_prefix?: string;
  copy_action?: string;
  toast_copied?: string;
  toast_copy_failed?: string;
  bank_copy_account_label?: string;
  bank_copy_mobile_label?: string;
  bank_copy_name_label?: string;
};

type Props = {
  chrome: ManualBankCopyChrome;
  banks: PaymentBank[];
  loading?: boolean;
};

async function copyText(value: string, ok: string, fail: string): Promise<boolean> {
  const text = value.trim();
  if (!text) {
    if (fail) toast.error(fail);
    return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const okExec = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!okExec) throw new Error("copy failed");
    }
    if (ok) toast.success(ok);
    return true;
  } catch {
    // User-gesture fallback when Clipboard API is blocked (iframe / unfocused doc).
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const okExec = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!okExec) throw new Error("copy failed");
      if (ok) toast.success(ok);
      return true;
    } catch {
      if (fail) toast.error(fail);
      return false;
    }
  }
}

function CopyIconButton({
  value,
  label,
  copiedLabel,
  failedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
}) {
  const [done, setDone] = useState(false);
  const raw = value.trim();
  if (!raw || !label) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={label}
      title={label}
      onClick={() => {
        void copyText(raw, copiedLabel, failedLabel).then((ok) => {
          if (!ok) return;
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </Button>
  );
}

/** Manual-transfer bank cards with copy controls (matches standard dialog chrome). */
export function ManualBankAccounts({ chrome, banks, loading }: Props) {
  const title = (chrome.manual_accounts_title || "").trim();
  const empty = (chrome.banks_empty || "").trim();
  const copied = (chrome.toast_copied || "").trim();
  const failed = (chrome.toast_copy_failed || "").trim();
  const copyAccount = (chrome.bank_copy_account_label || chrome.copy_action || "").trim();
  const copyMobile = (chrome.bank_copy_mobile_label || chrome.copy_action || "").trim();
  const copyName = (chrome.bank_copy_name_label || chrome.copy_action || "").trim();

  return (
    <div className="grid gap-3">
      {title ? (
        <p className="text-sm font-semibold tracking-wide text-[var(--dama-text)]">{title}</p>
      ) : null}
      {loading ? <WalletBanksSkeleton count={3} /> : null}
      {!loading && banks.length === 0 && empty ? (
        <p className="text-sm text-[var(--dama-danger)]">{empty}</p>
      ) : null}
      <ul className="space-y-3">
        {banks.map((b) => {
          const name = (b.account_name || "").trim();
          const number = (b.account_number || "").trim();
          const mobile = (b.mobile_code || "").trim();
          return (
            <li
              key={b.id}
              className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] px-3.5 py-3 text-sm shadow-[var(--dama-card-shadow)]"
            >
              <p className="font-semibold text-[var(--dama-text)]">{b.label}</p>
              {name ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[var(--dama-muted)]">
                    <span className="text-[var(--dama-muted)]">{chrome.bank_name_prefix}</span>{" "}
                    <span className="font-medium text-[var(--dama-text)]">{name}</span>
                  </p>
                  <CopyIconButton
                    value={name}
                    label={copyName}
                    copiedLabel={copied}
                    failedLabel={failed}
                  />
                </div>
              ) : null}
              {number ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0">
                    <span className="text-[var(--dama-muted)]">{chrome.bank_account_prefix}</span>{" "}
                    <span className="font-bold tracking-wide text-[var(--dama-text)]">
                      {number}
                    </span>
                  </p>
                  <CopyIconButton
                    value={number}
                    label={copyAccount}
                    copiedLabel={copied}
                    failedLabel={failed}
                  />
                </div>
              ) : null}
              {mobile ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0">
                    <span className="text-[var(--dama-muted)]">{chrome.bank_mobile_prefix}</span>{" "}
                    <span className="font-semibold text-[var(--dama-text)]">{mobile}</span>
                  </p>
                  <CopyIconButton
                    value={mobile}
                    label={copyMobile}
                    copiedLabel={copied}
                    failedLabel={failed}
                  />
                </div>
              ) : null}
              <p className="mt-2 text-xs text-[var(--dama-muted)]">
                {chrome.bank_currency_prefix} {b.currency}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
