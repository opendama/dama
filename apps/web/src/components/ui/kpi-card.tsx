import Link from "next/link";
import type { ReactNode } from "react";

/** Trim-style metric / KPI card (muted label + prominent value + optional hint). */
export function KpiCard({
  label,
  value,
  body,
  href,
}: {
  label: string;
  value?: ReactNode;
  body?: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-sm font-medium text-[var(--dama-muted)]">{label}</p>
      {value != null ? (
        // div (not p): value may be a ShimmerBlock div - p>div is invalid HTML / hydration.
        <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--dama-text)]">
          {value}
        </div>
      ) : null}
      {body != null ? (
        <div className={`text-xs text-[var(--dama-muted)] ${value != null ? "mt-1" : "mt-2"}`}>
          {body}
        </div>
      ) : null}
    </>
  );

  const className =
    "block rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-[var(--dama-card-shadow)] transition hover:bg-[var(--dama-surface)]/80";

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
