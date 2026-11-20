"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { DamaWordmark } from "@/components/brand/dama-wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useSignOutMutation } from "@/hooks/mutation/useSignOutMutation";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useClientMounted } from "@/hooks/useClientMounted";
import { filterManualTransferNavLinks } from "@/lib/manual-transfer-nav";
import {
  isPlayerNavActive,
  isPlayerPortalPath,
  pickDesktopRailLinks,
  pickPortalRailLinks,
  resolvePlayerNavHref,
} from "@/lib/player-nav";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Eye,
  Home,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Megaphone,
  Menu,
  LayoutList,
  Medal,
  Play,
  PlusCircle,
  Receipt,
  Settings,
  Trophy,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  dashboard: LayoutDashboard,
  overview: LayoutDashboard,
  play: Play,
  tournaments: Trophy,
  tournaments_mine: LayoutList,
  host_tournament: PlusCircle,
  ads_publisher: Megaphone,
  events: Trophy,
  events_dashboard: Trophy,
  wallet: Wallet,
  profile: User,
  ads: Megaphone,
  ads_dashboard: LayoutDashboard,
  ads_campaigns: Megaphone,
  ads_analytics: BarChart3,
  leaderboard: Medal,
  status: Activity,
  platform_stats: Activity,
  spectate: Eye,
  matchmaking: Users,
  match: Users,
  avatar: User,
  receipts: Receipt,
  transactions: ArrowLeftRight,
  transfer: Building2,
  settings: Settings,
};

function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Home;
}

/** Tablet/mobile hamburger drawer: same menus as desktop left rail (public or portal). */
export function PlayerMobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const mode = searchParams.get("mode");
  const mine = searchParams.get("mine");
  const create = searchParams.get("create");
  const gameId = searchParams.get("gameId") || searchParams.get("game_id");
  const token = useAuthStore((s) => s.token);
  const authHydrated = useAuthHydrated();
  const signInModal = useOptionalSignInModal();
  const navQuery = useClientNavFullQuery(true);
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const routeQuery = usePaymentRouteQuery(Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const providersQuery = useAuthProvidersQuery();
  const signOut = useSignOutMutation();
  const nav = navQuery.data ?? null;
  const portal = isPlayerPortalPath(pathname);
  // Exact desktop rail parity (PlayerDesktopRail): public discovery OR portal ops.
  const links = useMemo(() => {
    if (!nav) return [];
    const raw = portal ? pickPortalRailLinks(nav) : pickDesktopRailLinks(nav);
    return filterManualTransferNavLinks(raw, isManual);
  }, [nav, portal, isManual]);
  const signOutLabel = (providersQuery.data?.sign_out_action_label || "").trim();
  const signOutPending = (providersQuery.data?.sign_out_pending || "").trim();
  const mounted = useClientMounted();
  // Brand from client-nav must not differ between SSR and first client paint.
  const brand = mounted ? (nav?.brand_name || "").trim() : "";
  const showNavSkeleton =
    !mounted ||
    navQuery.isLoading ||
    (Boolean(token) && (geoQuery.isLoading || routeQuery.isLoading));
  const showAuthSkeleton =
    !mounted || !authHydrated || (providersQuery.isLoading && !providersQuery.data);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--dama-border)]/70 bg-[var(--dama-card)]/80 text-[var(--dama-text)] backdrop-blur-md transition hover:bg-[var(--dama-surface)] md:hidden"
          {...(brand ? { "aria-label": brand } : {})}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="md:hidden" {...(brand ? { closeLabel: brand } : {})}>
        <SheetHeader>
          {brand ? (
            <SheetTitle className="inline-flex min-w-0 items-center gap-2 font-display text-lg font-bold">
              <DamaWordmark size="md" alt="" priority className="shrink-0" />
              <span className="min-w-0 truncate">{brand}</span>
            </SheetTitle>
          ) : (
            <SheetTitle className="sr-only">{"\u00a0"}</SheetTitle>
          )}
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {showNavSkeleton
            ? (["mm-sk-0", "mm-sk-1", "mm-sk-2", "mm-sk-3"] as const).map((id) => (
                <ShimmerBlock key={id} className="h-10 w-full rounded-md" />
              ))
            : null}
          {!showNavSkeleton
            ? links.map((item) => {
                const href = resolvePlayerNavHref(item);
                if (!href) return null;
                const Icon = iconFor(item.route_key);
                const isOn = isPlayerNavActive(pathname, href, view, {
                  mode,
                  gameId,
                  mine,
                  create,
                });
                return (
                  <SheetClose asChild key={`rail-${item.route_key}-${href}`}>
                    <Link
                      href={href}
                      aria-current={isOn ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                        isOn
                          ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                          : "text-[var(--dama-muted)] hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SheetClose>
                );
              })
            : null}
        </nav>
        <div className="mt-auto space-y-2 border-t border-[var(--dama-border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-end gap-2 px-1">
            <ThemeToggle />
          </div>
          {showAuthSkeleton ? (
            <ShimmerBlock className="h-10 w-full rounded-md" />
          ) : token && signOutLabel ? (
            <button
              type="button"
              disabled={signOut.isPending}
              onClick={() => {
                signOut.mutate();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)] disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">
                {signOut.isPending && signOutPending ? signOutPending : signOutLabel}
              </span>
            </button>
          ) : !token ? (
            (() => {
              const label = (providersQuery.data?.nav_sign_in_label || "").trim();
              if (label) {
                return (
                  <Button
                    type="button"
                    variant="play"
                    className="h-10 w-full"
                    onClick={() => {
                      setOpen(false);
                      signInModal?.openSignIn(
                        pathname.startsWith("/auth/") ? undefined : { nextPath: pathname },
                      );
                    }}
                  >
                    {label}
                  </Button>
                );
              }
              return (
                <div className="px-1 text-center text-sm font-semibold">
                  <SignInLink />
                </div>
              );
            })()
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
