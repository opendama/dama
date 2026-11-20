"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { SurfaceHomeLink } from "@/components/nav/SurfaceHomeLink";
import { Button } from "@/components/ui/button";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  LayoutList,
  LogOut,
  type LucideIcon,
  Medal,
  Megaphone,
  PanelLeft,
  PanelLeftClose,
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
import { useCallback, useEffect, useMemo, useState } from "react";

const RAIL_COLLAPSED_KEY = "dama-player-rail-collapsed";

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
  avatar: User,
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
  receipts: Receipt,
  transactions: ArrowLeftRight,
  transfer: Building2,
  settings: Settings,
  history: LayoutDashboard,
  matches: LayoutDashboard,
};

function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Home;
}

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Chess.com / shadcn-style desktop left rail (md+), collapsible to icon mode. */
export function PlayerDesktopRail() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const mode = searchParams.get("mode");
  const gameId = searchParams.get("gameId") || searchParams.get("game_id");
  const mine = searchParams.get("mine");
  const create = searchParams.get("create");
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
  const links = useMemo(() => {
    if (!nav) return [];
    const raw = portal ? pickPortalRailLinks(nav) : pickDesktopRailLinks(nav);
    return filterManualTransferNavLinks(raw, isManual);
  }, [nav, portal, isManual]);
  const signOutLabel = (providersQuery.data?.sign_out_action_label || "").trim();
  const signOutPending = (providersQuery.data?.sign_out_pending || "").trim();
  const [collapsed, setCollapsed] = useState(false);
  const mounted = useClientMounted();

  useEffect(() => {
    if (!mounted) return;
    setCollapsed(readCollapsed());
  }, [mounted]);

  // SSR + first paint: always skeleton (matches SurfaceHomeLink mount gate).
  const showNavSkeleton = !mounted || navQuery.isLoading;
  // Auth CTA must wait: token persist + providers label or we hydrate SignInLink vs Button.
  const showAuthSkeleton =
    !mounted || !authHydrated || (providersQuery.isLoading && !providersQuery.data);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  // shadcn sidebar keyboard shortcut: Ctrl/⌘ + B
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Some IME / synthetic keydowns omit `key`; fail closed instead of crashing.
      const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
      if (key !== "b") return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const state = collapsed ? "collapsed" : "expanded";

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-state={state}
        data-collapsible={collapsed ? "icon" : ""}
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col self-start overflow-hidden border-r border-[var(--dama-border)] bg-[var(--dama-panel)] transition-[width] duration-200 ease-linear md:flex",
          collapsed ? "w-14" : "w-[15.5rem]",
          !mounted && "w-[15.5rem]",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-[var(--dama-border)]",
            collapsed ? "h-auto flex-col gap-1 px-1 py-2" : "h-14 gap-1 px-2",
          )}
        >
          <SurfaceHomeLink
            surface="player"
            markOnly={collapsed}
            className={
              collapsed
                ? "h-9 w-9 justify-center"
                : "min-w-0 flex-1 truncate px-2 font-display text-lg font-bold"
            }
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="text-[var(--dama-muted)]">⌘B</span>
            </TooltipContent>
          </Tooltip>
        </div>

        <nav
          className={cn("flex flex-1 flex-col gap-0.5 overflow-y-auto p-2", collapsed && "px-1.5")}
        >
          {showNavSkeleton
            ? (["rail-sk-0", "rail-sk-1", "rail-sk-2", "rail-sk-3", "rail-sk-4"] as const).map(
                (id) => (
                  <ShimmerBlock
                    key={id}
                    className={cn("rounded-md", collapsed ? "mx-auto h-9 w-9" : "h-9 w-full")}
                  />
                ),
              )
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
                const linkClass = cn(
                  "flex items-center rounded-md text-sm font-semibold transition-colors",
                  collapsed ? "h-9 w-9 justify-center px-0" : "gap-3 px-3 py-2.5",
                  isOn
                    ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                    : "text-[var(--dama-muted)] hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]",
                );
                if (!collapsed) {
                  return (
                    <Link
                      key={`${item.route_key}-${href}`}
                      href={href}
                      aria-current={isOn ? "page" : undefined}
                      className={linkClass}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                }
                return (
                  <Tooltip key={`${item.route_key}-${href}`}>
                    <TooltipTrigger asChild>
                      <Link
                        href={href}
                        aria-current={isOn ? "page" : undefined}
                        className={linkClass}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                );
              })
            : null}
        </nav>

        <div
          className={cn(
            "mt-auto space-y-2 border-t border-[var(--dama-border)] p-2",
            collapsed && "px-1.5",
          )}
        >
          {showAuthSkeleton ? (
            <ShimmerBlock
              className={cn("rounded-md", collapsed ? "mx-auto h-9 w-9" : "h-10 w-full")}
            />
          ) : token && signOutLabel ? (
            collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={signOut.isPending}
                    onClick={() => signOut.mutate()}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)] disabled:opacity-60"
                    aria-label={signOut.isPending && signOutPending ? signOutPending : signOutLabel}
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {signOut.isPending && signOutPending ? signOutPending : signOutLabel}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                disabled={signOut.isPending}
                onClick={() => signOut.mutate()}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)] disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                <span className="truncate">
                  {signOut.isPending && signOutPending ? signOutPending : signOutLabel}
                </span>
              </button>
            )
          ) : !token ? (
            (() => {
              const label = (providersQuery.data?.nav_sign_in_label || "").trim();
              if (label) {
                if (collapsed) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="play"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={label}
                          onClick={() =>
                            signInModal?.openSignIn(
                              pathname.startsWith("/auth/") ? undefined : { nextPath: pathname },
                            )
                          }
                        >
                          <User className="h-4 w-4" aria-hidden />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return (
                  <Button
                    type="button"
                    variant="play"
                    className="h-10 w-full"
                    onClick={() =>
                      signInModal?.openSignIn(
                        pathname.startsWith("/auth/") ? undefined : { nextPath: pathname },
                      )
                    }
                  >
                    {label}
                  </Button>
                );
              }
              return collapsed ? null : (
                <div className="px-1 text-center text-sm font-semibold">
                  <SignInLink />
                </div>
              );
            })()
          ) : null}
        </div>
      </aside>
    </TooltipProvider>
  );
}
