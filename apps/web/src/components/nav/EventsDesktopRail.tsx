"use client";

import { SurfaceHomeLink } from "@/components/nav/SurfaceHomeLink";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useClientMounted } from "@/hooks/useClientMounted";
import { softHostingBrandName } from "@/lib/hosting-organizer-chrome-soft";
import { filterManualTransferNavLinks } from "@/lib/manual-transfer-nav";
import { pickHostingNavLinks } from "@/lib/player-nav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { ClientNavLink, ClientNavPayload } from "@/types/platform";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  Home,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

/** Hosting rail: distinct icons per route (no wallet/receipts falling back to Trophy). */
const ICONS: Record<string, LucideIcon> = {
  events_dashboard: LayoutDashboard,
  events_list: Trophy,
  events_events: Trophy,
  events_analytics: BarChart3,
  events_join: Ticket,
  events_wallet: Wallet,
  events_receipts: Receipt,
  events_transactions: ArrowLeftRight,
  events_transfer: Building2,
};

function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Home;
}

function active(pathname: string, href: string): boolean {
  const pathOnly = href.split("?")[0] || href;
  if (pathname === pathOnly) return true;
  if (pathOnly !== "/" && pathname.startsWith(`${pathOnly}/`)) return true;
  // DB may still point at /events/list while the page lives at /events/events.
  if (
    (pathOnly === "/events/list" || pathOnly === "/events/events") &&
    (pathname === "/events/list" || pathname === "/events/events")
  ) {
    return true;
  }
  return false;
}

function pickLinks(nav: ClientNavPayload): ClientNavLink[] {
  const brand = softHostingBrandName(nav.events_brand_name);
  const surface = (nav.events ?? []).filter((l) => l.href && l.title);
  if (surface.length > 0) return pickHostingNavLinks(surface, brand);
  return pickHostingNavLinks(
    (nav.bottom_nav?.events ?? []).filter((l) => l.href && l.title),
    brand,
  );
}

/** Trim-style desktop left rail for events organizer surfaces (md+). */
export function EventsDesktopRail() {
  const pathname = usePathname() || "";
  const mounted = useClientMounted();
  const token = useAuthStore((s) => s.token);
  const navQuery = useClientNavFullQuery(true);
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const routeQuery = usePaymentRouteQuery(Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const nav = navQuery.data ?? null;
  const links = useMemo(
    () => (nav ? filterManualTransferNavLinks(pickLinks(nav), isManual) : []),
    [nav, isManual],
  );
  const showNavSkeleton = !mounted || navQuery.isLoading;

  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col self-start overflow-hidden border-r border-[var(--dama-border)] bg-[var(--dama-card)] md:flex">
      <div className="flex h-14 items-center border-b border-[var(--dama-border)] px-4">
        <SurfaceHomeLink surface="events" className="font-display text-lg font-bold" />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {showNavSkeleton
          ? (["events-sk-0", "events-sk-1", "events-sk-2"] as const).map((id) => (
              <ShimmerBlock key={id} className="h-9 w-full rounded-md" />
            ))
          : null}
        {!showNavSkeleton
          ? links.map((item) => {
              if (!item.href) return null;
              const Icon = iconFor(item.route_key);
              const isOn = active(pathname, item.href);
              return (
                <Link
                  key={`${item.route_key}-${item.href}`}
                  href={item.href}
                  aria-current={isOn ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isOn
                      ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                      : "text-[var(--dama-muted)] hover:bg-[var(--dama-surface)] hover:text-[var(--dama-text)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })
          : null}
      </nav>
    </aside>
  );
}
