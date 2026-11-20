"use client";

import { cn } from "@/lib/utils";

/** Final capture score row (smart-menu MatchScoreLine parity). */
export function MatchScoreLine({
  yourLabel,
  opponentLabel,
  yourCaptures,
  opponentCaptures,
  yourCapturesLabel,
  opponentCapturesLabel,
  vsSeparator = " vs ",
  className,
}: {
  yourLabel: string;
  opponentLabel: string;
  yourCaptures: number;
  opponentCaptures: number;
  yourCapturesLabel: string;
  opponentCapturesLabel: string;
  vsSeparator?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-surface)]/60 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <div className="min-w-0 text-left">
        <p className="truncate font-semibold text-[var(--dama-text)]">{yourLabel}</p>
        <p className="text-xs text-[var(--dama-muted)]">
          {yourCapturesLabel}
          {": "}
          <span className="font-semibold tabular-nums text-[var(--dama-text)]">{yourCaptures}</span>
        </p>
      </div>
      {vsSeparator.length > 0 ? (
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--dama-muted)]">
          {vsSeparator}
        </span>
      ) : null}
      <div className="min-w-0 text-right">
        <p className="truncate font-semibold text-[var(--dama-text)]">{opponentLabel}</p>
        <p className="text-xs text-[var(--dama-muted)]">
          {opponentCapturesLabel}
          {": "}
          <span className="font-semibold tabular-nums text-[var(--dama-text)]">
            {opponentCaptures}
          </span>
        </p>
      </div>
    </div>
  );
}
