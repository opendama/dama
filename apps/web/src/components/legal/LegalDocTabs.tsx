"use client";

import { cn } from "@/lib/utils";
import type { LegalChrome, LegalDocKind } from "@/types/legal-chrome";
import Link from "next/link";

type LegalNavChrome = Pick<
  LegalChrome,
  "privacy_nav_label" | "terms_nav_label" | "refunds_nav_label"
>;

const TABS: { kind: LegalDocKind; href: string; labelKey: keyof LegalNavChrome }[] = [
  { kind: "privacy", href: "/privacy", labelKey: "privacy_nav_label" },
  { kind: "terms", href: "/terms", labelKey: "terms_nav_label" },
  { kind: "refunds", href: "/refunds", labelKey: "refunds_nav_label" },
];

type LegalDocTabsProps = {
  active: LegalDocKind;
  chrome: LegalNavChrome;
  className?: string;
};

/** Privacy / Terms / Refunds switcher - DB labels only. */
export function LegalDocTabs({ active, chrome, className }: LegalDocTabsProps) {
  return (
    <nav
      className={cn("flex flex-wrap gap-1 border-b border-[var(--dama-border)] pb-px", className)}
      aria-label="Legal documents"
    >
      {TABS.map((tab) => {
        const label = (chrome[tab.labelKey] || "").trim();
        if (!label) return null;
        const on = tab.kind === active;
        return (
          <Link
            key={tab.kind}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              on
                ? "border border-b-transparent border-[var(--dama-border)] bg-[var(--dama-bg)] text-[var(--dama-text)]"
                : "text-[var(--dama-muted-foreground)] hover:text-[var(--dama-text)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
