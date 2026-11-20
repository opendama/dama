"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdsDesktopRail } from "@/components/nav/AdsDesktopRail";
import { BottomNavBar } from "@/components/nav/BottomNavBar";
import { FloatingResumeFab } from "@/components/nav/FloatingResumeFab";
import { LeaveBoardPauseHost } from "@/components/nav/LeaveBoardPauseHost";
import { SurfaceHomeLink } from "@/components/nav/SurfaceHomeLink";
import { CompetitionPointsToast } from "@/components/notifications/CompetitionPointsToast";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { pickOpsPlayerNavLinks } from "@/lib/player-nav";
import {
  playerHeaderInnerClass,
  playerMainPadClass,
  playerStickyHeaderClass,
} from "@/lib/player-shell-ui";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  const navQuery = useClientNavFullQuery(true);
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const overviewTitle = (nav?.dashboard_page_title || "").trim();
  const overviewHref = nav
    ? (
        pickOpsPlayerNavLinks(nav).find((l) => (l.route_key || "").trim() === "dashboard")?.href ||
        ""
      ).trim()
    : "";
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  return (
    <div className="min-h-screen bg-[var(--dama-bg)] text-[var(--dama-text)] md:flex">
      <AdsDesktopRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={playerStickyHeaderClass}>
          <div className={playerHeaderInnerClass}>
            {overviewTitle && overviewHref ? (
              <Link
                href={overviewHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--dama-muted)] transition-colors hover:text-[var(--dama-text)]"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{overviewTitle}</span>
              </Link>
            ) : null}
            <SurfaceHomeLink
              surface="ads"
              className="ml-3 font-display text-lg font-bold md:hidden"
            />
            <div className="ml-auto flex items-center gap-3">
              {hydrated && token ? (
                <>
                  <CompetitionPointsToast accessToken={token} />
                  <NotificationBell accessToken={token} />
                </>
              ) : null}
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main
          className={`mx-auto w-full max-w-[1400px] px-3 pt-3 sm:px-4 sm:pt-4 md:px-6 md:pt-6 ${playerMainPadClass}`}
        >
          <RequireAuth>{children}</RequireAuth>
        </main>
        <Suspense fallback={null}>
          <BottomNavBar surface="ads" />
          <LeaveBoardPauseHost />
          <FloatingResumeFab />
        </Suspense>
      </div>
    </div>
  );
}
