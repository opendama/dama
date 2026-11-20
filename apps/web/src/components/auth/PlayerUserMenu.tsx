"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useSignOutMutation } from "@/hooks/mutation/useSignOutMutation";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useAvatarChromeQuery } from "@/hooks/query/useAvatarChromeQuery";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { pickOpsPlayerNavLinks } from "@/lib/player-nav";
import { createClient } from "@/lib/supabase/client";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isAvatarChromeReady } from "@/types/avatar-chrome";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function initials(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  return e ? e.slice(0, 2).toUpperCase() : "?";
}

function useBrowserOAuthProfile(): {
  name: string;
  email: string;
  avatarUrl: string;
} {
  const [profile, setProfile] = useState({ name: "", email: "", avatarUrl: "" });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const apply = (
      session: {
        user?: { email?: string; user_metadata?: Record<string, unknown> };
      } | null,
    ) => {
      if (cancelled || !session?.user) {
        if (!cancelled) setProfile({ name: "", email: "", avatarUrl: "" });
        return;
      }
      const meta = session.user.user_metadata || {};
      const name = [meta.full_name, meta.name, meta.user_name]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .find(Boolean);
      const avatarUrl = [meta.avatar_url, meta.picture, meta.avatar]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .find(Boolean);
      setProfile({
        name: name || "",
        email: session.user.email?.trim() || "",
        avatarUrl: avatarUrl || "",
      });
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return profile;
}

/** Trim UserMenu: Google avatar/name when available; Dashboard / Profile / Sign out. */
export function PlayerUserMenu() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const stored = useAuthStore((s) => s.oauthProfile);
  const setOAuthProfile = useAuthStore((s) => s.setOAuthProfile);
  const providersQuery = useAuthProvidersQuery();
  const navQuery = useClientNavFullQuery(Boolean(token));
  const avatarChromeQuery = useAvatarChromeQuery(Boolean(token));
  const avatarChrome = isAvatarChromeReady(avatarChromeQuery.data)
    ? avatarChromeQuery.data
    : undefined;
  const signOut = useSignOutMutation();
  const oauth = useBrowserOAuthProfile();

  useEffect(() => {
    if (!token) return;
    if ((stored?.name || "").trim() || (stored?.avatarUrl || "").trim()) return;
    if (!(oauth.name || oauth.email || oauth.avatarUrl)) return;
    setOAuthProfile({
      name: oauth.name,
      email: oauth.email,
      avatarUrl: oauth.avatarUrl,
    });
  }, [
    oauth.avatarUrl,
    oauth.email,
    oauth.name,
    setOAuthProfile,
    stored?.avatarUrl,
    stored?.name,
    token,
  ]);

  const signInModal = useOptionalSignInModal();
  const pathname = usePathname() || "/";
  const signInLabel = (providersQuery.data?.nav_sign_in_label || "").trim();
  const signOutLabel = (providersQuery.data?.sign_out_action_label || "").trim();
  const signOutPending = (providersQuery.data?.sign_out_pending || "").trim();
  const profileLabel = (avatarChrome?.profile_page_title || "").trim();
  // Ops stay in the signed-in menu (not the public left rail). Fail closed: DB hrefs only.
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const opsLinks = nav ? pickOpsPlayerNavLinks(nav) : [];
  const dashboardLabel = (nav?.dashboard_page_title || "").trim();
  const dashboardHref = (
    opsLinks.find((l) => (l.route_key || "").trim() === "dashboard")?.href || ""
  ).trim();
  const profileHref = (
    (nav?.dashboard_profile_href || "").trim() ||
    opsLinks.find((l) => (l.route_key || "").trim() === "profile")?.href ||
    ""
  ).trim();
  // Google / OAuth display only - never fall back to account username.
  const name = (stored?.name || oauth.name || "").trim();
  const email = (stored?.email || oauth.email || "").trim();
  const display = name || email || "";
  const mark = useMemo(() => initials(name, email), [name, email]);
  // Prefer uploaded game avatar; fall back to OAuth profile photo.
  const thumb = (
    authUser?.avatarThumbUrl ||
    authUser?.avatarFullUrl ||
    stored?.avatarUrl ||
    oauth.avatarUrl ||
    ""
  ).trim();

  if (!hydrated || providersQuery.isLoading) {
    return <ShimmerBlock className="h-9 w-28 rounded-md" />;
  }

  if (!token) {
    if (!signInLabel) return null;
    return (
      <button
        type="button"
        onClick={() =>
          signInModal?.openSignIn(
            pathname.startsWith("/auth/") ? undefined : { nextPath: pathname },
          )
        }
        className="inline-flex h-9 items-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 text-sm font-medium text-[var(--dama-text)] transition hover:bg-[var(--dama-surface)]"
      >
        {signInLabel}
      </button>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[14rem] items-center gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-1.5 py-1 text-left text-sm transition hover:bg-[var(--dama-surface)]"
          aria-label={display || signOutLabel || mark}
        >
          <DamaUserAvatar src={thumb} className="h-7 w-7 rounded-full" />
          <span className="min-w-0 flex-1 truncate font-medium">{display || mark}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--dama-muted)]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[200] w-56">
        {name || email ? (
          <>
            <DropdownMenuLabel className="font-normal">
              {name ? (
                <p className="truncate text-sm font-medium text-[var(--dama-text)]">{name}</p>
              ) : null}
              {email ? <p className="truncate text-xs text-[var(--dama-muted)]">{email}</p> : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {dashboardLabel && dashboardHref ? (
          <DropdownMenuItem asChild>
            <Link href={dashboardHref} className="flex cursor-pointer items-center gap-2">
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              {dashboardLabel}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {profileLabel && profileHref ? (
          <DropdownMenuItem asChild>
            <Link href={profileHref} className="flex cursor-pointer items-center gap-2">
              <UserRound className="h-4 w-4" aria-hidden />
              {profileLabel}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {signOutLabel ? (
          <DropdownMenuItem
            disabled={signOut.isPending}
            onSelect={(e) => {
              e.preventDefault();
              signOut.mutate();
            }}
            className="flex cursor-pointer items-center gap-2 text-[var(--dama-danger)] focus:text-[var(--dama-danger)]"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signOut.isPending && signOutPending ? signOutPending : signOutLabel}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
