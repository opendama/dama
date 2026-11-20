"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { KpiCard } from "@/components/ui/kpi-card";
import { PaymentsOverviewSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useAdminConsoleChromeQuery,
  useAdminFinancialOverviewQuery,
  useConsoleNavQuery,
  type FinancialOverviewPeriodDays,
} from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { ConsoleNavModule } from "@/types/console";
import type { FinancialCurrencyAmount } from "@/hooks/query/useAdminFinancialOverviewQuery";
import {
  ArrowLeftRight,
  Building2,
  ChartColumn,
  CreditCard,
  FileCheck2,
  Globe2,
  IdCard,
  Landmark,
  Receipt,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

function consoleNavHref(modules: ConsoleNavModule[], path: string): string {
  const want = path.trim().replace(/\/$/, "");
  if (!want) return "";
  const hit = modules.find((m) => {
    const h = (m.href || "").trim().replace(/\/$/, "");
    return h === want || h.endsWith(want);
  });
  return (hit?.href || "").trim();
}

function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  const t = title.trim();
  if (!t) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--dama-text)]">{t}</h2>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function formatCurrRows(
  rows: FinancialCurrencyAmount[] | undefined,
  empty: string,
  sep: string,
  joinSep: string,
): string {
  if (!rows || rows.length === 0) return empty;
  return rows
    .map((r) => {
      const cur = (r.currency || "").trim();
      const amt = typeof r.amount === "number" ? r.amount.toLocaleString() : empty;
      if (!cur || !chromeSeparatorPresent(sep)) return amt;
      return `${amt}${sep}${cur}`;
    })
    .filter(Boolean)
    .join(joinSep);
}

export default function AdminPaymentsOverviewPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(Boolean(token) && isAdmin);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const pay = chrome?.payments;
  const navQuery = useConsoleNavQuery(isAdmin);
  const modules = navQuery.data?.modules ?? [];
  const [periodDays, setPeriodDays] = useState<FinancialOverviewPeriodDays>(7);
  const overviewQuery = useAdminFinancialOverviewQuery(
    token,
    Boolean(token) && isAdmin,
    periodDays,
  );

  const title = (pay?.overview_page_title || "").trim();
  const blurb = (pay?.overview_page_blurb || "").trim();
  const empty = (pay?.overview_empty_value || "").trim();
  const sep = chromeSeparator(pay?.amount_currency_separator);
  const joinSep = chromeSeparator(pay?.list_join_separator);
  const periodNote = (pay?.overview_period_note || "").trim();
  const period7 = (pay?.overview_period_7d || "").trim();
  const period30 = (pay?.overview_period_30d || "").trim();
  const period90 = (pay?.overview_period_90d || "").trim();

  if (!hydrated || roleLoading || chromeQuery.isLoading || !chrome) {
    if (chromeQuery.isError || (chromeQuery.isSuccess && !chrome)) {
      return (
        <p className="text-sm text-[var(--dama-muted)]">
          {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
        </p>
      );
    }
    return <PaymentsOverviewSkeleton />;
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        <SignInLink className="text-[var(--dama-gold)] underline" />
      </p>
    );
  }

  if (!title) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </p>
    );
  }

  const data = overviewQuery.data;
  const loading = overviewQuery.isLoading;
  const overviewFailed = overviewQuery.isError;

  const periodTabs: { days: FinancialOverviewPeriodDays; label: string }[] = (
    [
      { days: 7 as const, label: period7 },
      { days: 30 as const, label: period30 },
      { days: 90 as const, label: period90 },
    ] satisfies { days: FinancialOverviewPeriodDays; label: string }[]
  ).filter((t) => Boolean(t.label));

  const salesLinks: { href: string; label: string; icon: typeof Receipt }[] = [
    {
      href: consoleNavHref(modules, "/payments/receipts"),
      label: (pay?.receipts_section_title || "").trim(),
      icon: Receipt,
    },
    {
      href: consoleNavHref(modules, "/payments/payouts"),
      label: (pay?.payouts_section_title || "").trim(),
      icon: ArrowLeftRight,
    },
    {
      href: consoleNavHref(modules, "/payments/transactions"),
      label: (pay?.transactions_section_title || "").trim(),
      icon: CreditCard,
    },
    {
      href: consoleNavHref(modules, "/payments/kyc"),
      label: (pay?.doc_kyc_section_title || "").trim(),
      icon: IdCard,
    },
    {
      href: consoleNavHref(modules, "/payments/currency"),
      label: (pay?.currency_section_title || "").trim(),
      icon: Wallet,
    },
    {
      href: consoleNavHref(modules, "/payments/geo"),
      label: (pay?.geo_payment_section_title || "").trim(),
      icon: Globe2,
    },
    {
      href: consoleNavHref(modules, "/banks"),
      label: (chrome.banks?.page_title || "").trim(),
      icon: Landmark,
    },
    {
      href: consoleNavHref(modules, "/payments/telegram-ops"),
      label: (pay?.telegram_ops_page_title || "").trim(),
      icon: Building2,
    },
  ].filter((l) => Boolean(l.href) && Boolean(l.label));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--dama-text)]">{title}</h1>
        {blurb ? <p className="text-sm text-[var(--dama-muted)]">{blurb}</p> : null}
        {periodNote ? <p className="text-xs text-[var(--dama-muted)]">{periodNote}</p> : null}
      </div>

      {periodTabs.length > 0 ? (
        <div
          role="tablist"
          aria-label={title}
          className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
        >
          {periodTabs.map((t) => (
            <button
              key={t.days}
              type="button"
              role="tab"
              aria-selected={periodDays === t.days}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                periodDays === t.days
                  ? "bg-[var(--dama-card)] text-[var(--dama-fg)] shadow-sm"
                  : "text-[var(--dama-muted)] hover:text-[var(--dama-fg)]",
              )}
              onClick={() => setPeriodDays(t.days)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {overviewFailed ? (
        <p className="text-sm text-[var(--dama-muted)]">
          {adminConsoleChromeUnavailable(chromeQuery.data, overviewQuery.error)}
        </p>
      ) : loading || !data ? (
        <PaymentsOverviewSkeleton />
      ) : (
        <>
          <OverviewSection title={(pay?.overview_section_queues_title || "").trim()}>
            <KpiCard
              label={(pay?.overview_kpi_pending_receipts || "").trim()}
              value={data.pending_receipts}
              href={consoleNavHref(modules, "/payments/receipts") || undefined}
              icon={Receipt}
            />
            <KpiCard
              label={(pay?.overview_kpi_pending_payouts || "").trim()}
              value={data.pending_payouts}
              href={consoleNavHref(modules, "/payments/payouts") || undefined}
              icon={ArrowLeftRight}
            />
            <KpiCard
              label={(pay?.overview_kpi_pending_kyc || "").trim()}
              value={data.pending_kyc}
              href={consoleNavHref(modules, "/payments/kyc") || undefined}
              icon={FileCheck2}
            />
            <KpiCard
              label={(pay?.overview_kpi_wallet_balances || "").trim()}
              value={formatCurrRows(data.wallet_balances, empty, sep, joinSep)}
              icon={Wallet}
            />
          </OverviewSection>

          <OverviewSection title={(pay?.overview_section_volume_title || "").trim()}>
            <KpiCard
              label={(pay?.overview_kpi_net_profit || "").trim()}
              value={formatCurrRows(data.net_profit, empty, sep, joinSep)}
              icon={ChartColumn}
            />
            <KpiCard
              label={(pay?.overview_kpi_platform_revenue || "").trim()}
              value={formatCurrRows(data.platform_revenue, empty, sep, joinSep)}
              icon={ChartColumn}
            />
            <KpiCard
              label={(pay?.overview_kpi_net_cashflow || "").trim()}
              value={formatCurrRows(data.net_cashflow, empty, sep, joinSep)}
              icon={ArrowLeftRight}
            />
            <KpiCard
              label={(pay?.overview_kpi_topup_volume || "").trim()}
              value={formatCurrRows(data.topup_volume, empty, sep, joinSep)}
              icon={Wallet}
            />
            <KpiCard
              label={(pay?.overview_kpi_payout_volume || "").trim()}
              value={formatCurrRows(data.payout_volume, empty, sep, joinSep)}
              icon={ArrowLeftRight}
            />
            <KpiCard
              label={(pay?.overview_kpi_host_fee_volume || "").trim()}
              value={formatCurrRows(data.host_fee_volume, empty, sep, joinSep)}
              icon={CreditCard}
            />
            <KpiCard
              label={(pay?.overview_kpi_entry_commission || "").trim()}
              value={formatCurrRows(data.entry_commission, empty, sep, joinSep)}
              icon={Receipt}
            />
          </OverviewSection>

          <OverviewSection title={(pay?.overview_section_links_title || "").trim()}>
            {salesLinks.map((l) => (
              <KpiCard key={l.href} label={l.label} href={l.href} icon={l.icon} value={empty} />
            ))}
          </OverviewSection>
        </>
      )}
    </div>
  );
}
