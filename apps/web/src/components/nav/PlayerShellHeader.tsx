"use client";

import { PlayerUserMenu } from "@/components/auth/PlayerUserMenu";
import { PlayerMobileMenu } from "@/components/nav/PlayerMobileMenu";
import { SurfaceHomeLink } from "@/components/nav/SurfaceHomeLink";
import { CompetitionPointsToast } from "@/components/notifications/CompetitionPointsToast";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePublishHeightCssVar } from "@/hooks/usePublishHeightCssVar";
import {
  DAMA_MOBILE_HEADER_HEIGHT_VAR,
  playerHeaderInnerClass,
  playerStickyHeaderClass,
} from "@/lib/player-shell-ui";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useRef } from "react";

/** Sticky player header: hamburger (mobile) + brand + theme + identity menu. */
export function PlayerShellHeader() {
  const headerRef = useRef<HTMLElement>(null);
  usePublishHeightCssVar(headerRef, DAMA_MOBILE_HEADER_HEIGHT_VAR, true);
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  return (
    <header ref={headerRef} className={playerStickyHeaderClass}>
      <div className={playerHeaderInnerClass}>
        <div className="flex min-w-0 items-center gap-2 md:hidden">
          <PlayerMobileMenu />
          <SurfaceHomeLink surface="player" className="font-display text-lg font-bold" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {hydrated && token ? (
            <>
              <CompetitionPointsToast accessToken={token} />
              <NotificationBell accessToken={token} />
            </>
          ) : null}
          <ThemeToggle />
          <PlayerUserMenu />
        </div>
      </div>
      <div
        data-board-match-header=""
        className="hidden w-full max-w-none items-center justify-center gap-2 border-t border-[var(--dama-border)]/40 px-3 py-1.5 data-[active]:flex sm:gap-3 sm:px-6 lg:px-8"
      />
    </header>
  );
}
