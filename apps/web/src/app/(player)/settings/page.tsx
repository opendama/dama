"use client";

import { CashCompliancePanel } from "@/components/compliance/CashCompliancePanel";
import { DocumentKycPanel } from "@/components/compliance/DocumentKycPanel";
import { AccountComplianceSection } from "@/components/legal/AccountComplianceSection";
import { PortalPageShell } from "@/components/portal/PortalPageShell";
import { Button } from "@/components/ui/button";
import { SettingsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { useSignOutMutation } from "@/hooks/mutation/useSignOutMutation";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import Link from "next/link";

/**
 * Account ops (privacy / export / delete / session) vs identity KYC for payouts.
 * Profile stays career identity (avatar, rating, matches).
 * Layout: Identity (priority) | Account - side by side on lg+.
 * All labels/hrefs from client_nav + auth providers (fail closed).
 */
export default function PlayerSettingsPage() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const navQuery = useClientNavFullQuery(true);
  const providersQuery = useAuthProvidersQuery();
  const signOut = useSignOutMutation();
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const panel = (nav?.dashboard ?? []).find((p) => (p.route_key || "").trim() === "settings");
  const title = (panel?.title || "").trim();
  const blurb = (panel?.body || "").trim();
  const profileHref = (nav?.dashboard_profile_href || "").trim();
  const profileAction = (nav?.dashboard_profile_action || "").trim();
  const sessionLabel = (nav?.settings_session_label || "").trim();
  const signOutLabel = (providersQuery.data?.sign_out_action_label || "").trim();
  const signOutPending = (providersQuery.data?.sign_out_pending || "").trim();
  const settingsReady =
    Boolean(nav) &&
    Boolean(title) &&
    Boolean(blurb) &&
    Boolean(profileHref) &&
    Boolean(profileAction) &&
    Boolean(sessionLabel);

  if (!hydrated || navQuery.isLoading || providersQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (!token) {
    return null;
  }

  if (!settingsReady) {
    const unavailable =
      (navQuery.data?.settings_unavailable || "").trim() ||
      (navQuery.data?.dashboard_unavailable || "").trim() ||
      (navQuery.error instanceof Error ? navQuery.error.message : "").trim();
    return (
      <div className="w-full space-y-6">
        {unavailable ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert">
            {unavailable}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <PortalPageShell
      title={title}
      blurb={blurb}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={profileHref}>{profileAction}</Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <DocumentKycPanel />
          <CashCompliancePanel />
        </div>
        <div className="space-y-6">
          <AccountComplianceSection token={token} />
          {signOutLabel ? (
            <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
              <p className="mb-3 text-sm font-medium">{sessionLabel}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => signOut.mutate()}
                disabled={signOut.isPending}
                isLoading={signOut.isPending && Boolean(signOutPending)}
                pendingLabel={signOutPending || undefined}
              >
                {signOutLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </PortalPageShell>
  );
}
