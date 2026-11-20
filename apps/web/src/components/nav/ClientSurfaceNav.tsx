"use client";

import { NavLinksSkeleton } from "@/components/ui/shimmer-skeletons";
import { useClientNavQuery } from "@/hooks/query/useClientNavQuery";
import { cn } from "@/lib/utils";
import type { ClientNavSurface } from "@/types/platform";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ClientSurfaceNavProps = {
  surface: ClientNavSurface;
  className?: string;
  linkClassName?: string;
};

function navActive(pathname: string, href: string): boolean {
  const pathOnly = href.split("?")[0] || href;
  if (pathname === pathOnly) return true;
  if (pathOnly !== "/" && pathname.startsWith(`${pathOnly}/`)) return true;
  return false;
}

export function ClientSurfaceNav({
  surface,
  className = "flex flex-wrap gap-4 text-sm text-[var(--dama-muted-foreground)]",
  linkClassName = "hover:text-[var(--dama-gold)]",
}: ClientSurfaceNavProps) {
  const pathname = usePathname() || "";
  const navQuery = useClientNavQuery(surface);
  const links = navQuery.data ?? [];

  return (
    <nav className={className}>
      {navQuery.isLoading ? <NavLinksSkeleton count={4} /> : null}
      {!navQuery.isLoading
        ? links.map((item) => {
            if (!item.href) return null;
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={`${item.route_key}-${item.href}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(linkClassName, active && "font-medium text-[var(--dama-text)]")}
              >
                {item.title}
              </Link>
            );
          })
        : null}
    </nav>
  );
}
