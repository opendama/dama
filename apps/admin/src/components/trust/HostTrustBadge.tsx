"use client";

import { normalizeHostTrustTier } from "@/lib/host-trust-tier";
import { cn } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

type Props = {
  label?: string | null;
  tier?: string | null;
  className?: string;
};

/**
 * Compact trust chip for console user/event surfaces.
 * Document-verified → --dama-verified green + check; phone → brand; else muted.
 */
export function HostTrustBadge({ label, tier, className }: Props) {
  const text = (label || "").trim();
  if (!text) return null;
  const code = normalizeHostTrustTier(tier);
  const showIcon = code === "document_verified" || code === "phone_verified";

  const tone =
    code === "document_verified"
      ? "border-[var(--dama-verified-border)] bg-[var(--dama-verified-bg)] text-[var(--dama-verified)]"
      : code === "phone_verified"
        ? "border-[color-mix(in_srgb,var(--dama-brand)_35%,var(--dama-border))] bg-[var(--dama-status-bg)] text-[var(--dama-brand)]"
        : "border-[var(--dama-border)] bg-[var(--dama-surface)] text-[var(--dama-muted)]";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
        className,
      )}
      title={text}
    >
      {showIcon ? <BadgeCheck className="size-3 shrink-0" aria-hidden strokeWidth={2.5} /> : null}
      <span className="truncate">{text}</span>
    </span>
  );
}
