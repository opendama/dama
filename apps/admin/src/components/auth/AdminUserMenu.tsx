"use client";

import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOutMutation } from "@/hooks/mutation/useSignOutMutation";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { createClient } from "@/lib/supabase/client";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function displayFallback(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  return e ? e.slice(0, 2).toUpperCase() : "";
}

function useLiveSupabaseProfile(): { name: string; email: string; avatarUrl: string } {
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

/** Trim UserMenu: Google avatar + name; dropdown = identity + Sign out only (no console login link). */
export function AdminUserMenu() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const stored = useAuthStore((s) => s.oauthProfile);
  const setOAuthProfile = useAuthStore((s) => s.setOAuthProfile);
  const providersQuery = useAuthProvidersQuery();
  const signOut = useSignOutMutation();
  const live = useLiveSupabaseProfile();

  useEffect(() => {
    if (!token) return;
    if ((stored?.name || "").trim() || (stored?.avatarUrl || "").trim()) return;
    if (!(live.name || live.email || live.avatarUrl)) return;
    setOAuthProfile({
      name: live.name,
      email: live.email,
      avatarUrl: live.avatarUrl,
    });
  }, [
    live.avatarUrl,
    live.email,
    live.name,
    setOAuthProfile,
    stored?.avatarUrl,
    stored?.name,
    token,
  ]);

  const signOutLabel = (providersQuery.data?.sign_out_action_label || "").trim();
  const signOutPending = (providersQuery.data?.sign_out_pending || "").trim() || signOutLabel;

  // Google / OAuth display only - never console username or in-game avatar.
  const name = (stored?.name || live.name || "").trim();
  const email = (stored?.email || live.email || "").trim();
  const avatarUrl = (stored?.avatarUrl || live.avatarUrl || "").trim();
  const display = name || email || "";
  const textMark = useMemo(() => displayFallback(name, email), [name, email]);

  if (!hydrated || !token || !signOutLabel) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[14rem] items-center gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-1.5 py-1 text-left text-sm transition hover:bg-[var(--dama-surface)]"
          aria-label={display || signOutLabel}
        >
          <DamaUserAvatar src={avatarUrl} className="h-7 w-7 rounded-full" />
          <span className="min-w-0 flex-1 truncate font-medium">{display || textMark}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--dama-muted)]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" collisionPadding={12}>
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
        <DropdownMenuItem
          disabled={signOut.isPending}
          onSelect={(e: Event) => {
            e.preventDefault();
            signOut.mutate();
          }}
          className="flex cursor-pointer items-center gap-2 text-[var(--dama-danger)] focus:text-[var(--dama-danger)]"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {signOut.isPending ? signOutPending : signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
