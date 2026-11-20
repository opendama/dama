"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { BottomNavBar } from "@/components/nav/BottomNavBar";
import { FloatingResumeFab } from "@/components/nav/FloatingResumeFab";
import { LeaveBoardPauseHost } from "@/components/nav/LeaveBoardPauseHost";
import { PlayerDesktopRail } from "@/components/nav/PlayerDesktopRail";
import { PlayerMobileSecondaryNav } from "@/components/nav/PlayerMobileSecondaryNav";
import { PlayerShellHeader } from "@/components/nav/PlayerShellHeader";
import { isPlayerPortalPath } from "@/lib/player-nav";
import { playerMainPadClass, playerMainWidthClass } from "@/lib/player-shell-ui";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

function isAuthOnlyPath(pathname: string): boolean {
  if (pathname === "/auth/login") return true;
  if (pathname.startsWith("/auth/oauth/")) return true;
  return false;
}

/** Ops / money / identity - hard gate. Play surfaces stay guest-visible. */
function requiresAuth(pathname: string): boolean {
  if (isPlayerPortalPath(pathname)) return true;
  if (pathname === "/avatar" || pathname.startsWith("/avatar/")) return true;
  return false;
}

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  // OAuth exchange: full-viewport quiet loader (no login chrome / max-w-md glitch).
  if (pathname.startsWith("/auth/oauth/")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--dama-bg)] px-4 text-[var(--dama-text)]">
        <main className="w-full max-w-sm">{children}</main>
      </div>
    );
  }

  if (isAuthOnlyPath(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--dama-bg)] px-4 text-[var(--dama-text)]">
        <main className="w-full max-w-md">{children}</main>
      </div>
    );
  }

  const portal = isPlayerPortalPath(pathname);
  const main = requiresAuth(pathname) ? <RequireAuth>{children}</RequireAuth> : children;

  return (
    <div className="min-h-screen bg-[var(--dama-bg)] text-[var(--dama-text)] md:flex">
      <Suspense fallback={<aside className="hidden h-screen w-[15.5rem] shrink-0 md:block" />}>
        <PlayerDesktopRail />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <PlayerShellHeader />
        </Suspense>
        {/* Public overflow chips (Leaderboard etc.) - never on portal ops pages. */}
        {!portal ? (
          <Suspense fallback={null}>
            <PlayerMobileSecondaryNav />
          </Suspense>
        ) : null}
        <main
          className={
            portal
              ? // pt/px only - `p-*` would override bottom-nav pb on mobile.
                `mx-auto w-full max-w-[1400px] px-3 pt-3 sm:px-4 sm:pt-4 md:px-6 md:pt-6 ${playerMainPadClass}`
              : `${playerMainWidthClass} pt-8 ${playerMainPadClass}`
          }
        >
          {main}
        </main>
        {/* Portal pages use the ops left rail - hide public Play bottom tabs. */}
        {!portal ? (
          <Suspense fallback={null}>
            <BottomNavBar surface="player" />
            <LeaveBoardPauseHost />
            <FloatingResumeFab />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <LeaveBoardPauseHost />
            <FloatingResumeFab />
          </Suspense>
        )}
      </div>
    </div>
  );
}
