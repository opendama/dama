"use client";

import { AdminUserMenu } from "@/components/auth/AdminUserMenu";
import { ConsoleHomeLink } from "@/components/console/ConsoleHomeLink";
import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { NavLinksSkeleton } from "@/components/ui/shimmer-skeletons";
import { useConsoleNavQuery } from "@/hooks/query";
import { adminNavIconForHref } from "@/lib/admin-nav-icons";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import type { ConsoleNavItem, ConsoleNavSection } from "@/types/console";
import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function navItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

function findActiveSectionId(pathname: string, sections: ConsoleNavSection[]): string {
  for (const section of sections) {
    for (const item of section.items ?? []) {
      const href = (item.href || "").trim();
      if (href && navItemActive(pathname, href)) return section.id;
    }
  }
  return (sections[0]?.id || "").trim();
}

function NavAccordion({
  sections,
  pathname,
  onNavigate,
}: {
  sections: ConsoleNavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const activeSection = useMemo(
    () => findActiveSectionId(pathname, sections),
    [pathname, sections],
  );
  const [openId, setOpenId] = useState(activeSection);

  useEffect(() => {
    setOpenId(activeSection);
  }, [activeSection]);

  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overscroll-contain p-2 pb-8 [-webkit-overflow-scrolling:touch]"
      aria-label="Console"
    >
      {sections.map((section) => {
        const id = (section.id || "").trim();
        const label = (section.label || "").trim();
        const items = (section.items ?? []).filter((item) => {
          const href = (item.href || "").trim();
          const itemLabel = (item.label || "").trim();
          return Boolean(href && itemLabel);
        });
        if (!id || !label || items.length === 0) return null;

        // Trim: single-item sections render as one top-level link (section label).
        if (items.length === 1) {
          const only = items[0];
          if (!only) return null;
          const href = (only.href || "").trim();
          if (!href) return null;
          const Icon = adminNavIconForHref(href);
          const active = navItemActive(pathname, href);
          return (
            <div key={id} className="border-b border-[var(--dama-border)]/80">
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                    : "text-[var(--dama-muted)] hover:bg-[var(--dama-surface)] hover:text-[var(--dama-text)]",
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
                <span className="truncate">{label}</span>
              </Link>
            </div>
          );
        }

        const open = openId === id;
        return (
          <div key={id} className="border-b border-[var(--dama-border)]/80">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId((current) => (current === id ? "" : id))}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[var(--dama-text)] transition-colors hover:bg-[var(--dama-surface)]"
            >
              <span className="truncate">{label}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-[var(--dama-muted)] transition-transform duration-200 ease-out",
                  open && "rotate-90",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="space-y-0.5 pb-2 pl-1">
                  {items.map((item: ConsoleNavItem) => {
                    const href = (item.href || "").trim();
                    const itemLabel = (item.label || "").trim();
                    const Icon = adminNavIconForHref(href);
                    const active = navItemActive(pathname, href);
                    return (
                      <li key={item.id || href}>
                        <Link
                          href={href}
                          onClick={() => {
                            setOpenId(id);
                            onNavigate?.();
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-[var(--dama-surface)] font-medium text-[var(--dama-text)]"
                              : "text-[var(--dama-muted)] hover:bg-[var(--dama-surface)] hover:text-[var(--dama-text)]",
                          )}
                        >
                          {Icon ? (
                            <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                          ) : null}
                          <span className="min-w-0 truncate">{itemLabel}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function FlatNav({
  modules,
  pathname,
  onNavigate,
}: {
  modules: { title: string; href: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2 pb-8 [-webkit-overflow-scrolling:touch]"
      aria-label="Console"
    >
      {modules.map((item) => {
        if (!item.href) return null;
        const active = navItemActive(pathname, item.href);
        const Icon = adminNavIconForHref(item.href);
        return (
          <Link
            key={`${item.href}-${item.title}`}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                : "text-[var(--dama-muted)] hover:bg-[var(--dama-surface)] hover:text-[var(--dama-text)]",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Trim-style console shell: sticky left nav + header (DB console_nav modules/sections). */
export function AdminConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const navQuery = useConsoleNavQuery(true);
  const modules = navQuery.data?.modules ?? [];
  const sections = (navQuery.data?.sections ?? []).filter(
    (s) => (s.id || "").trim() && (s.label || "").trim() && (s.items?.length ?? 0) > 0,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = () => setMobileOpen(false);

  function renderNav(onNavigate?: () => void) {
    if (navQuery.isLoading) {
      return (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <NavLinksSkeleton count={8} />
        </div>
      );
    }
    if (sections.length > 0) {
      return <NavAccordion sections={sections} pathname={pathname} onNavigate={onNavigate} />;
    }
    return <FlatNav modules={modules} pathname={pathname} onNavigate={onNavigate} />;
  }

  return (
    <div className="min-h-screen bg-[var(--dama-bg)] text-[var(--dama-text)] md:flex">
      {/* Desktop / tablet: flex column + min-h-0 so nav scrolls to last leaf */}
      <aside className="sticky top-0 z-30 hidden h-dvh max-h-dvh w-60 shrink-0 flex-col self-start overflow-hidden border-r border-[var(--dama-border)] bg-[var(--dama-card)] md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-[var(--dama-border)] px-4">
          <ConsoleHomeLink />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderNav()}</div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      ) : null}
      {/* Mobile drawer: Trim SheetContent parity - min-h-0 scroll; mount nav only when open */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-60 flex-col overflow-hidden border-r border-[var(--dama-border)] bg-[var(--dama-card)] transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none -translate-x-full",
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-[var(--dama-border)] px-4">
          <ConsoleHomeLink />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mobileOpen ? renderNav(closeMobile) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--dama-border)] bg-[var(--dama-card)]/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <ConsoleHomeLink className="min-w-0" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              {hydrated && token ? <AdminNotificationBell token={token} /> : null}
              <ThemeToggle className="shrink-0" />
              <AdminUserMenu />
            </div>
          </div>
          <FetchProgressBar active={navQuery.isFetching && !navQuery.isLoading} />
        </header>
        <main className="w-full flex-1 p-3 sm:p-4 md:p-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
