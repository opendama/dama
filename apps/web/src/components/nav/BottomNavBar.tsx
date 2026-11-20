"use client";

import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import { useClientMounted } from "@/hooks/useClientMounted";
import { usePublishHeightCssVar } from "@/hooks/usePublishHeightCssVar";
import { softHostingBrandName } from "@/lib/hosting-organizer-chrome-soft";
import { filterManualTransferNavLinks } from "@/lib/manual-transfer-nav";
import {
  PLAY_SESSION_EVENT,
  buildPlayResumeHref,
  isPlayerPlaySurface,
  readStoredPlaySession,
} from "@/lib/play-session-storage";
import {
  isPlayerNavActive,
  pickBottomNavLinks,
  pickHostingNavLinks,
  resolvePlayerNavHref,
} from "@/lib/player-nav";
import { DAMA_BOTTOM_NAV_HEIGHT_VAR, DAMA_BOTTOM_PAD_EXTRA_VAR } from "@/lib/player-shell-ui";
import { useAuthStore } from "@/store/auth";
import { useShellChromeStore } from "@/store/shell-chrome";
import {
  type ClientNavLink,
  isAdsBottomNavReady,
  isEventsBottomNavReady,
  isPlayerBottomNavReady,
} from "@/types/platform";
import { isPlayChromeReady } from "@/types/play-chrome";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  Eye,
  Home,
  LayoutDashboard,
  LayoutList,
  type LucideIcon,
  Medal,
  Megaphone,
  Play,
  PlusCircle,
  Receipt,
  Ticket,
  Trophy,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type BottomNavSurface = "player" | "ads" | "events";

type BottomNavBarProps = {
  surface: BottomNavSurface;
};

const ROUTE_ICONS: Record<string, LucideIcon> = {
  home: Home,
  dashboard: Home,
  play: Play,
  matchmaking: Users,
  match: Users,
  tournaments: Trophy,
  tournaments_mine: LayoutList,
  host_tournament: PlusCircle,
  leaderboard: Medal,
  spectate: Eye,
  wallet: Wallet,
  profile: User,
  receipts: Receipt,
  transactions: ArrowLeftRight,
  ads_dashboard: LayoutDashboard,
  ads_campaigns: Megaphone,
  ads_analytics: BarChart3,
  ads_wallet: Wallet,
  ads_receipts: Receipt,
  ads_transactions: ArrowLeftRight,
  ads_transfer: Building2,
  events_dashboard: LayoutDashboard,
  events_list: Trophy,
  events_events: Trophy,
  events_analytics: BarChart3,
  events_join: Ticket,
  events_wallet: Wallet,
  events_receipts: Receipt,
  events_transactions: ArrowLeftRight,
  events_transfer: Building2,
  transfer: Building2,
  events: Trophy,
};

function iconForRouteKey(routeKey: string): LucideIcon {
  return ROUTE_ICONS[routeKey] ?? Home;
}

const navShellClass =
  "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--dama-border)]/50 bg-[var(--dama-card)]/75 shadow-[0_-12px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[var(--dama-card)]/55 md:hidden";

function BottomNavSkeleton({
  navRef,
  scrollable,
}: {
  navRef: RefObject<HTMLElement | null>;
  /** Ads / events: horizontal scroll chips (many items). Player: equal flex tabs. */
  scrollable: boolean;
}) {
  return (
    <nav
      ref={navRef}
      className={navShellClass}
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      aria-hidden
    >
      <div
        className={
          scrollable
            ? "mx-auto flex min-h-16 max-w-full items-stretch gap-1 overflow-x-auto overscroll-x-contain px-2 pt-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "mx-auto flex min-h-16 w-full max-w-full items-stretch gap-1 px-2 pt-1.5"
        }
      >
        {(["bn-sk-0", "bn-sk-1", "bn-sk-2", "bn-sk-3", "bn-sk-4"] as const).map((id) => (
          <div
            key={id}
            className={
              scrollable
                ? "flex w-auto shrink-0 flex-col items-center justify-center gap-1 px-2.5 py-1.5"
                : "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5"
            }
          >
            <ShimmerBlock className="h-6 w-6 rounded-md" />
            <ShimmerBlock className="h-2 w-10 rounded" />
          </div>
        ))}
      </div>
    </nav>
  );
}

/** Fixed mobile bottom nav from client_nav.bottom_nav (+ play Continue/Playing resume). */
export function BottomNavBar({ surface }: BottomNavBarProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const mode = searchParams.get("mode");
  const gameId = searchParams.get("gameId") || searchParams.get("game_id");
  const navRef = useRef<HTMLElement>(null);
  const token = useAuthStore((s) => s.token);
  const navQuery = useClientNavFullQuery(true);
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const routeQuery = usePaymentRouteQuery(Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";
  const playChromeQuery = usePlayChromeQuery(true);
  const playChrome = isPlayChromeReady(playChromeQuery.data) ? playChromeQuery.data : undefined;
  const nav = navQuery.data;
  const ready =
    surface === "ads"
      ? isAdsBottomNavReady(nav)
      : surface === "events"
        ? isEventsBottomNavReady(nav)
        : isPlayerBottomNavReady(nav);
  const links: ClientNavLink[] = useMemo(() => {
    if (!ready) return [];
    const raw =
      surface === "player" && nav
        ? pickBottomNavLinks(nav)
        : surface === "events"
          ? pickHostingNavLinks(
              nav?.bottom_nav?.events ?? [],
              softHostingBrandName(nav?.events_brand_name),
            )
          : (nav?.bottom_nav?.ads ?? []);
    return filterManualTransferNavLinks(raw, isManual);
  }, [ready, surface, nav, isManual]);
  const [storedGameId, setStoredGameId] = useState<string | null>(null);
  const [storedMode, setStoredMode] = useState<string | null>(null);
  const [storedPhase, setStoredPhase] = useState<"playing" | "finished" | null>(null);
  const [storedPaused, setStoredPaused] = useState(false);
  const mounted = useClientMounted();
  const immersiveChat = useShellChromeStore((s) => s.immersiveChat);
  usePublishHeightCssVar(navRef, DAMA_BOTTOM_NAV_HEIGHT_VAR, !immersiveChat);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (immersiveChat) {
      // Zero nav height + extra pad so chat composer sits flush (no white band).
      root.style.setProperty(DAMA_BOTTOM_NAV_HEIGHT_VAR, "0px");
      root.style.setProperty(DAMA_BOTTOM_PAD_EXTRA_VAR, "0px");
      return () => {
        root.style.removeProperty(DAMA_BOTTOM_NAV_HEIGHT_VAR);
        root.style.removeProperty(DAMA_BOTTOM_PAD_EXTRA_VAR);
      };
    }
    return undefined;
  }, [immersiveChat]);

  useEffect(() => {
    void pathname;
    const tick = () => {
      const s = readStoredPlaySession();
      setStoredGameId(s?.gameId ?? null);
      setStoredMode(s?.mode ?? null);
      setStoredPhase(s?.phase ?? null);
      setStoredPaused(Boolean(s?.phase === "playing" && s.paused));
    };
    tick();
    window.addEventListener(PLAY_SESSION_EVENT, tick);
    window.addEventListener("focus", tick);
    window.addEventListener("storage", tick);
    const id = window.setInterval(tick, 2000);
    return () => {
      window.removeEventListener(PLAY_SESSION_EVENT, tick);
      window.removeEventListener("focus", tick);
      window.removeEventListener("storage", tick);
      window.clearInterval(id);
    };
  }, [pathname]);

  const onPlayPage = isPlayerPlaySurface(pathname, searchParams);
  // Leave-board auto-pause lives in LeaveBoardPauseHost (all breakpoints; BottomNav is md:hidden).
  const playNavState =
    onPlayPage && storedPhase === "playing"
      ? ("playing" as const)
      : storedGameId && storedPhase === "playing"
        ? ("continue" as const)
        : ("play" as const);

  // Keep a visible shell while mounting / loading / failed - never unmount the bar
  // (except immersive chat tab, where the composer owns the bottom edge).
  if (immersiveChat) {
    return null;
  }

  const showSkeleton =
    !mounted || navQuery.isPending || navQuery.isError || !ready || links.length === 0;
  // Ads / events dashboards: many items → horizontal scroll + full labels (never truncate).
  // Player public nav keeps equal flex tabs (untouched).
  const scrollableSurface = surface === "ads" || surface === "events";

  const node = showSkeleton ? (
    <BottomNavSkeleton navRef={navRef} scrollable={scrollableSurface} />
  ) : (
    <nav
      ref={navRef}
      className={navShellClass}
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className={
          scrollableSurface
            ? "mx-auto flex min-h-16 max-w-full items-stretch gap-1 overflow-x-auto overscroll-x-contain px-2 pt-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "mx-auto flex min-h-16 w-full max-w-full items-stretch gap-1 px-2 pt-1.5"
        }
      >
        {links.map((item) => {
          const baseHref = resolvePlayerNavHref(item);
          if (!baseHref) return null;
          const Icon = iconForRouteKey(item.route_key);
          const isPlayResume = item.route_key === "play" || item.route_key === "home";
          const href =
            isPlayResume && storedGameId && playNavState !== "play"
              ? buildPlayResumeHref(storedGameId, storedMode || undefined)
              : baseHref;
          const active = isPlayerNavActive(pathname, baseHref, view, {
            mode,
            gameId,
            mine: searchParams.get("mine"),
            create: searchParams.get("create"),
          });
          const playingLabel = (playChrome?.nav_playing_label || "").trim();
          const continueLabel = (playChrome?.nav_continue_label || "").trim();
          const pausedLabel = (playChrome?.nav_paused_label || "").trim();
          const label =
            isPlayResume && storedPaused && pausedLabel
              ? pausedLabel
              : isPlayResume && playNavState === "playing" && playingLabel
                ? playingLabel
                : isPlayResume && playNavState === "continue" && continueLabel
                  ? continueLabel
                  : item.title;
          const showPulse = isPlayResume && playNavState === "continue" && !onPlayPage;
          const emphasized = active || (isPlayResume && playNavState === "playing");
          return (
            <Link
              key={`${item.route_key}-${item.href}`}
              href={href}
              className={
                scrollableSurface
                  ? `relative flex w-auto shrink-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-tight tracking-wide transition-colors sm:text-xs ${
                      emphasized
                        ? "text-[var(--dama-text)]"
                        : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
                    }`
                  : `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-medium leading-tight tracking-wide transition-colors sm:text-xs ${
                      emphasized
                        ? "text-[var(--dama-text)]"
                        : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
                    }`
              }
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon
                  className="h-6 w-6 shrink-0"
                  strokeWidth={emphasized ? 2.25 : 1.75}
                  aria-hidden
                />
                {showPulse ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--dama-text)] ring-2 ring-[var(--dama-card)]"
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className={scrollableSurface ? "px-0.5" : "max-w-full truncate px-0.5"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  // Portal out of home `overflow-hidden` shells so fixed bottom bar is never clipped.
  if (!mounted || typeof document === "undefined") {
    return node;
  }
  return createPortal(node, document.body);
}
