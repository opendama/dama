"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { AdminUserIdentityPanel } from "@/components/users/AdminUserIdentityPanel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserDetailSkeleton, UserIdentityBodySkeleton } from "@/components/ui/shimmer-skeletons";
import { useSetUserActiveMutation, useSetUserRoleMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useAdminUserQuery,
  useClientEnumsQuery,
  useMyPermissionsQuery,
} from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import Link from "next/link";
import { useState } from "react";

export function UserDetailClient({ userId }: { userId: string }) {
  const token = useAuthStore((s) => s.token);
  const self = useAuthStore((s) => s.user);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data.users : undefined;
  const permsQuery = useMyPermissionsQuery(token, isAdmin && Boolean(chrome));
  const readKey = (chrome?.read_permission_key || "").trim();
  const writeRoleKey = (chrome?.write_role_permission_key || "").trim();
  const writeActiveKey = (chrome?.write_active_permission_key || "").trim();
  const perms = permsQuery.data?.permissions ?? [];
  const canRead = Boolean(readKey) && perms.includes(readKey);
  const canWriteRole = Boolean(writeRoleKey) && perms.includes(writeRoleKey);
  const canWriteActive = Boolean(writeActiveKey) && perms.includes(writeActiveKey);

  const id = (userId || "").trim();
  const detailQuery = useAdminUserQuery(token, id, isAdmin && canRead && Boolean(id));
  const enumsQuery = useClientEnumsQuery(isAdmin && canRead);
  const roles = enumsQuery.data?.roles ?? [];
  const setRole = useSetUserRoleMutation(token);
  const setActive = useSetUserActiveMutation(token);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  if (chromeQuery.isLoading || roleLoading || (isAdmin && permsQuery.isLoading)) {
    return (
      <div className="space-y-4">
        <UserDetailSkeleton />
      </div>
    );
  }

  if (!chrome) {
    return (
      <div className="p-6 text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        <SignInLink className="text-[var(--dama-gold)] underline" />
      </p>
    );
  }

  if (permsQuery.isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="text-sm text-[var(--dama-danger)]" role="alert">
          {(chrome.detail_load_failed || chrome.lacks_read || "").trim()}
        </p>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="text-sm text-[var(--dama-muted)]">{(chrome.lacks_read || "").trim()}</p>
      </div>
    );
  }

  const backLabel = (chrome.detail_back_action || "").trim();
  const detail = detailQuery.data;
  const deactivating = Boolean(detail?.is_active);
  const isSelf = detail?.id === self?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {backLabel ? (
            <Link
              href="/users"
              className="text-sm text-[var(--dama-muted)] underline-offset-4 hover:underline"
            >
              {backLabel}
            </Link>
          ) : null}
          <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="min-w-0 truncate">
              {(detail?.username || "").trim() || (chrome.detail_title || "").trim()}
            </span>
            <HostTrustBadge
              label={detail?.host_trust_badge}
              tier={detail?.host_trust_tier}
              className="shrink-0"
            />
          </h1>
          {(() => {
            const rep = hostReputationLine({
              finished: detail?.host_finished_paid_cups,
              cancelled: detail?.host_cancelled_paid_cups,
              openReports: detail?.host_open_reports,
              finishedLabel: chrome.host_rep_finished_label,
              cancelledLabel: chrome.host_rep_cancelled_label,
              reportsLabel: chrome.host_rep_reports_label,
              separator: chrome.host_rep_meta_separator,
            });
            return rep ? (
              <p className="text-xs text-[var(--dama-muted)]" title={rep}>
                {rep}
              </p>
            ) : null;
          })()}
          <p className="text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        {detail ? (
          <div className="flex flex-wrap items-center gap-2">
            {canWriteRole && (chrome.edit_role_action || "").trim() && roles.length > 0 ? (
              <Select
                value={detail.role}
                onValueChange={(role) => {
                  if (role === detail.role) return;
                  setPendingRole(role);
                }}
                disabled={setRole.isPending}
              >
                <SelectTrigger className="h-9 w-[11rem]">
                  <SelectValue placeholder={(chrome.edit_role_action || "").trim()} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {canWriteActive ? (
              <Button
                type="button"
                size="sm"
                variant={detail.is_active ? "outline" : "gold"}
                disabled={isSelf}
                onClick={() => setConfirmOpen(true)}
              >
                {(detail.is_active ? chrome.deactivate_action : chrome.activate_action)?.trim()}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {detailQuery.isLoading ? (
        <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <UserIdentityBodySkeleton />
        </section>
      ) : detailQuery.isError || !detail ? (
        <p className="text-sm text-[var(--dama-danger)]" role="alert">
          {(chrome.detail_load_failed || "").trim()}
        </p>
      ) : (
        <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <AdminUserIdentityPanel user={detail} chrome={chrome} />
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next && !setActive.isPending) setConfirmOpen(false);
        }}
        title={
          (deactivating ? chrome.confirm_deactivate_title : chrome.confirm_activate_title) || ""
        }
        description={
          (deactivating
            ? chrome.confirm_deactivate_description
            : chrome.confirm_activate_description) || ""
        }
        cancelLabel={(chrome.confirm_cancel || "").trim()}
        confirmLabel={(deactivating ? chrome.confirm_deactivate : chrome.confirm_activate) || ""}
        pendingLabel={
          (deactivating ? chrome.confirm_deactivate_pending : chrome.confirm_activate_pending) || ""
        }
        isPending={setActive.isPending}
        destructive={deactivating}
        onConfirm={() => {
          if (!detail) return;
          setActive.mutate(
            { id: detail.id, active: !detail.is_active },
            { onSettled: () => setConfirmOpen(false) },
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingRole)}
        onOpenChange={(next) => {
          if (!next && !setRole.isPending) setPendingRole(null);
        }}
        title={(chrome.confirm_role_title || "").trim()}
        description={(chrome.confirm_role_description || "").trim()}
        cancelLabel={(chrome.confirm_cancel || "").trim()}
        confirmLabel={(chrome.confirm_role || "").trim()}
        pendingLabel={(chrome.confirm_role_pending || "").trim()}
        isPending={setRole.isPending}
        onConfirm={() => {
          if (!detail || !pendingRole) return;
          setRole.mutate(
            { id: detail.id, role: pendingRole },
            { onSettled: () => setPendingRole(null) },
          );
        }}
      />
    </div>
  );
}
