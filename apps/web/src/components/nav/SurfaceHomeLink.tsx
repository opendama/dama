"use client";

import { DamaWordmark } from "@/components/brand/dama-wordmark";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useClientMounted } from "@/hooks/useClientMounted";
import { softHostingBrandName } from "@/lib/hosting-organizer-chrome-soft";
import { resolvePlayerNavHref } from "@/lib/player-nav";
import { cn } from "@/lib/utils";
import { type ClientNavSurface, isPlayerDashboardChromeReady } from "@/types/platform";
import Link from "next/link";

type Props = {
  surface: ClientNavSurface;
  className?: string;
  /** Collapsed rails: show dark/light mark only (brand stays in aria-label). */
  markOnly?: boolean;
};

/** Brand home: mark + DB brand_name / ads_brand_name / events_brand_name (fail closed). */
export function SurfaceHomeLink({ surface, className, markOnly = false }: Props) {
  // Chrome is client-fetched; keep SSR + first client paint as the same empty
  // span so we never hydrate a <span> against a <Link>/<a>.
  const mounted = useClientMounted();

  const navQuery = useClientNavFullQuery();
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const links = nav?.[surface] ?? [];
  const brandRaw =
    surface === "ads"
      ? (nav?.ads_brand_name || "").trim()
      : surface === "events"
        ? (nav?.events_brand_name || "").trim()
        : (nav?.brand_name || "").trim();
  // Hosting brand: soft Event/Events → Hosting (mig 381 client fail-open).
  const brand = surface === "events" ? softHostingBrandName(brandRaw) : brandRaw;
  // Player brand always opens the public Play hub - never raw dashboard href.
  // Ads/events: first DB nav link only (never invent /ads/dashboard or /events/dashboard).
  const href = surface === "player" ? "/" : links[0] ? resolvePlayerNavHref(links[0]) : "";

  const shellClass = cn(
    "inline-flex min-w-0 items-center",
    markOnly ? "justify-center" : "gap-2",
    className,
  );
  const inner = (
    <>
      <DamaWordmark size="md" alt="" priority className="shrink-0" />
      {markOnly ? null : (
        <span className="min-w-0 truncate font-display text-lg font-bold">{brand}</span>
      )}
    </>
  );

  if (!mounted || !brand) {
    return <span className={className} aria-hidden />;
  }
  if (!href || !href.startsWith("/") || href.startsWith("//")) {
    return (
      <span className={shellClass} aria-label={brand}>
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} className={shellClass} aria-label={brand}>
      {inner}
    </Link>
  );
}
