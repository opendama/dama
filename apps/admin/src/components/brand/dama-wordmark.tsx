"use client";

import { BRAND_MARK_DARK, BRAND_MARK_LIGHT } from "@/lib/brand-avatar";
import { cn } from "@/lib/utils";
import Image from "next/image";

/** Width / height of official dama mark assets. */
export const DAMA_WORDMARK_ASPECT = 1;

type Size = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Heights for Dama crown (sparse ink ~40%). Trim’s dense mark is 28/18;
 * letterhead xl + footer md are sized so on-screen weight matches Trim.
 */
const HEIGHT: Record<Size, number> = {
  xs: 14,
  sm: 18,
  md: 28,
  lg: 36,
  xl: 48,
};

type DamaWordmarkProps = {
  className?: string;
  size?: Size;
  alt?: string;
  priority?: boolean;
  /**
   * `auto` follows painted theme (burgundy mark in light, white in dark).
   * `black` / light-paper mark for receipt print snapshots.
   */
  ink?: "auto" | "print";
};

/**
 * Brand mark for receipt letterheads (Trim TrimWordmark parity).
 * Follows `html.dark` so dark/light UI stays coherent; force `ink="print"` on paper.
 */
export function DamaWordmark({
  className,
  size = "md",
  alt = "",
  priority = false,
  ink = "auto",
}: DamaWordmarkProps) {
  const h = HEIGHT[size];
  const w = Math.max(1, Math.round(h * DAMA_WORDMARK_ASPECT));
  const decorative = !alt;
  const imgClass = "h-full w-auto object-contain";
  const forcePrint = ink === "print";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center leading-none", className)}
      style={{ height: h }}
      {...(decorative ? { "aria-hidden": true } : {})}
    >
      <Image
        src={BRAND_MARK_LIGHT}
        alt={decorative ? "" : alt}
        width={w}
        height={h}
        priority={priority}
        className={cn(imgClass, !forcePrint && "dark:hidden")}
      />
      {!forcePrint ? (
        <Image
          src={BRAND_MARK_DARK}
          alt=""
          width={w}
          height={h}
          priority={priority}
          aria-hidden
          className={cn(imgClass, "hidden dark:block")}
        />
      ) : null}
    </span>
  );
}
