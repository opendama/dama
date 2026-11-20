"use client";

import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import {
  isPlayerNavActive,
  pickHamburgerOverflowLinks,
  resolvePlayerNavHref,
} from "@/lib/player-nav";
import { cn } from "@/lib/utils";
import { isPlayerBottomNavReady } from "@/types/platform";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Optional mobile chips for public overflow only (e.g. Leaderboard).
 * Full desktop-rail menus live in the hamburger; account ops stay in the user menu.
 */
export function PlayerMobileSecondaryNav() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const navQuery = useClientNavFullQuery(true);
  const nav = navQuery.data;

  if (navQuery.isLoading) {
    return (
      <nav
        className="sticky top-14 z-40 border-b border-[var(--dama-border)]/60 bg-[var(--dama-card)]/80 backdrop-blur-xl md:hidden"
        aria-hidden
      >
        <div className="flex gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["nav-sk-0", "nav-sk-1"] as const).map((id) => (
            <ShimmerBlock key={id} className="h-7 w-20 shrink-0 rounded-md" />
          ))}
        </div>
      </nav>
    );
  }

  if (!nav || !isPlayerBottomNavReady(nav)) {
    return null;
  }

  const links = pickHamburgerOverflowLinks(nav);
  if (links.length === 0) return null;

  return (
    <nav className="sticky top-14 z-40 border-b border-[var(--dama-border)]/60 bg-[var(--dama-card)]/80 backdrop-blur-xl md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((item) => {
          const href = resolvePlayerNavHref(item);
          if (!href) return null;
          const active = isPlayerNavActive(pathname, href, view);
          return (
            <Link
              key={`${item.route_key}-${href}`}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-[var(--dama-brand)] text-[var(--dama-text)]"
                  : "border-[var(--dama-border)] text-[var(--dama-muted)] hover:border-[var(--dama-brand)] hover:text-[var(--dama-brand)]",
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
