"use client";

import { normalizeHostTrustTier } from "@/lib/host-trust-tier";
import { cn } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

type Props = {
  /** Server-resolved badge label from host trust chrome. */
  label?: string | null;
  /** Server host_trust_tier code: unverified | phone_verified | document_verified. */
  tier?: string | null;
  className?: string;
  /**
   * High-contrast tones for badges on brand/media overlays (match intro, etc.).
   * Does not invent colors - still uses --dama-verified / brand tokens.
   */
  onMedia?: boolean;
};

/**
 * Compact trust chip for host cards / profiles.
 * Document-verified → success/verified green + check (fintech KYC).
 * Phone-verified → brand burgundy soft chip + check.
 * Unverified / unknown → muted metadata chip.
 */
export function HostTrustBadge({ label, tier, className, onMedia }: Props) {
  const text = (label || "").trim();
  if (!text) return null;
  const code = normalizeHostTrustTier(tier);
  const showIcon = code === "document_verified" || code === "phone_verified";

  const tone =
    code === "document_verified"
      ? onMedia
        ? "border-[color-mix(in_srgb,var(--dama-verified)_55%,transparent)] bg-[color-mix(in_srgb,var(--dama-verified)_22%,transparent)] text-[var(--dama-verified)]"
        : "border-[var(--dama-verified-border)] bg-[var(--dama-verified-bg)] text-[var(--dama-verified)]"
      : code === "phone_verified"
        ? onMedia
          ? "border-[color-mix(in_srgb,var(--dama-brand)_50%,transparent)] bg-[color-mix(in_srgb,var(--dama-brand)_22%,transparent)] text-[var(--dama-brand)]"
          : "border-[color-mix(in_srgb,var(--dama-brand)_35%,var(--dama-border))] bg-[var(--dama-status-bg)] text-[var(--dama-brand)]"
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
