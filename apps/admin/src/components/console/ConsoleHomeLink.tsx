"use client";

import { DamaWordmark } from "@/components/brand/dama-wordmark";
import { useConsoleNavQuery } from "@/hooks/query/useConsoleNavQuery";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Props = {
  className?: string;
  /** Compact header: dark/light mark only (brand stays in aria-label). */
  markOnly?: boolean;
};

/** Brand home: mark + console_nav.brand_title + modules[0].href (fail closed). */
export function ConsoleHomeLink({ className, markOnly = false }: Props) {
  const navQuery = useConsoleNavQuery(true);
  const href = (navQuery.data?.modules?.[0]?.href || "").trim();
  const brand = (navQuery.data?.brand_title || "").trim();
  if (!brand) {
    return null;
  }
  const inner = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center",
        markOnly ? "justify-center" : "gap-2",
        className,
      )}
    >
      <DamaWordmark size="md" alt="" priority className="shrink-0" />
      {markOnly ? null : (
        <span className="min-w-0 truncate font-display text-lg font-bold">{brand}</span>
      )}
    </span>
  );
  if (!href.startsWith("/") || href.startsWith("//")) {
    return <span className="shrink-0">{inner}</span>;
  }
  return (
    <Link href={href} className="shrink-0" aria-label={brand}>
      {inner}
    </Link>
  );
}
