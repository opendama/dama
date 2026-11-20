import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Smart Menu StatCard + Trim Card: label row (+ optional icon), bold tabular value.
 * No hover on static tiles; linked tiles get a light surface shift only.
 */
export function KpiCard({
  label,
  value,
  body,
  href,
  icon: Icon,
}: {
  label: string;
  value?: ReactNode;
  body?: ReactNode;
  href?: string;
  icon?: LucideIcon;
}) {
  const title = label.trim();
  if (!title) return null;

  const inner = (
    <>
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
          {title}
        </h2>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[var(--dama-muted)]" aria-hidden /> : null}
      </div>
      {value != null ? (
        // div (not p): value may include block nodes (shimmer) - p>div is invalid HTML.
        <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--dama-text)]">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      ) : null}
      {body != null ? (
        <div className={`text-xs text-[var(--dama-muted)] ${value != null ? "mt-1" : ""}`}>
          {body}
        </div>
      ) : null}
    </>
  );

  const className = cn(
    "block min-h-[7.5rem] rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-none",
    href ? "cursor-pointer transition-colors hover:bg-[var(--dama-surface)]" : "",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
