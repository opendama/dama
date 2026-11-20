"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { AdminUserIdentityPanel } from "@/components/users/AdminUserIdentityPanel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
  selectedRowIds,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserIdentityBodySkeleton,
  UsersListBodySkeleton,
  UsersListSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useSetUserActiveMutation, useSetUserRoleMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useAdminUserQuery,
  useAdminUsersQuery,
  useClientEnumsQuery,
  useMyPermissionsQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { CountryFlag } from "@/lib/country-flag";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthStore } from "@/store/auth";
import type { AdminUser, AdminUserDetail } from "@/types";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type RoleConfirm = { id: string; role: string; username?: string };
type BulkConfirm = { active: boolean };

export function UsersClient() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const self = useAuthStore((s) => s.user);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data.users : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const permsQuery = useMyPermissionsQuery(token, isAdmin && Boolean(chrome));
  const readKey = (chrome?.read_permission_key || "").trim();
  const writeRoleKey = (chrome?.write_role_permission_key || "").trim();
  const writeActiveKey = (chrome?.write_active_permission_key || "").trim();
  const perms = permsQuery.data?.permissions ?? [];
  const canRead = Boolean(readKey) && perms.includes(readKey);
  const canWriteRole = Boolean(writeRoleKey) && perms.includes(writeRoleKey);
  const canWriteActive = Boolean(writeActiveKey) && perms.includes(writeActiveKey);

  const [skip, setSkip] = useUrlSkip("skip");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const debouncedUserSearch = useDebouncedValue(userSearch.trim(), 250);
  const [statusFilter, setStatusFilter] = useState("");
  const [createdRange, setCreatedRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  useResetSkipOnChange(setSkip, [
    debouncedUserSearch,
    statusFilter,
    createdRange.from,
    createdRange.to,
  ]);
  const usersQuery = useAdminUsersQuery(token, isAdmin && canRead && pageSize > 0, skip, pageSize, {
    q: debouncedUserSearch,
    status: statusFilter,
    createdFrom: createdRange.from,
    createdTo: createdRange.to,
  });
  const enumsQuery = useClientEnumsQuery(isAdmin && canRead);
  const roles = enumsQuery.data?.roles ?? [];
  const setRole = useSetUserRoleMutation(token);
  const setActive = useSetUserActiveMutation(token);
  const [confirmUser, setConfirmUser] = useState<AdminUser | AdminUserDetail | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<RoleConfirm | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirm | null>(null);
  const detailDialog = useDeferredDialogValue<AdminUser>();
  const detailId = detailDialog.value?.id?.trim() || "";
  const detailQuery = useAdminUserQuery(token, detailId, detailDialog.open && Boolean(detailId));

  async function bulkSetActive(active: boolean) {
    const ids = selectedRowIds(rowSelection).filter((id) => id !== self?.id);
    if (!ids.length) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        await setActive.mutateAsync({ id, active });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
      setBulkConfirm(null);
    }
  }

  const listLoading =
    roleLoading ||
    chromeQuery.isLoading ||
    (isAdmin && permsQuery.isLoading) ||
    (canRead && (usersQuery.isLoading || enumsQuery.isLoading));
  const softFetching =
    (usersQuery.isFetching && !usersQuery.isLoading) ||
    (enumsQuery.isFetching && !enumsQuery.isLoading);

  const pageUsers = usersQuery.data?.users ?? [];
  const pageMeta = usersQuery.data?.meta;
  const dateRangeMonths = Number.parseInt((chrome?.date_range_months || "").trim(), 10);
  const empty = (chrome?.empty_value || "").trim();

  const columns = useMemo<OpsColumn<AdminUser>[]>(() => {
    if (!chrome) return [];
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    const phoneHeader = (chrome.col_phone_label || "").trim();
    const avatarAlt = (chrome.detail_avatar_alt || "").trim();
    return [
      {
        id: "user",
        header: (chrome.col_user_label || "").trim(),
        cell: (u: AdminUser) => (
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => detailDialog.openWith(u)}
          >
            <DamaUserAvatar
              src={resolvePublicMediaUrl(u.avatar_thumb_url) || null}
              alt={avatarAlt}
              className="h-8 w-8 rounded-full"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="truncate">{(u.username || "").trim() || empty}</span>
                <CountryFlag code={u.country_code} />
                <HostTrustBadge
                  label={u.host_trust_badge}
                  tier={u.host_trust_tier}
                  className="shrink-0"
                />
              </span>
              {(() => {
                const rep = hostReputationLine({
                  finished: u.host_finished_paid_cups,
                  cancelled: u.host_cancelled_paid_cups,
                  openReports: u.host_open_reports,
                  finishedLabel: chrome.host_rep_finished_label,
                  cancelledLabel: chrome.host_rep_cancelled_label,
                  reportsLabel: chrome.host_rep_reports_label,
                  separator: chrome.host_rep_meta_separator,
                });
                return rep ? (
                  <span
                    className="truncate text-[10px] font-normal text-[var(--dama-muted)]"
                    title={rep}
                  >
                    {rep}
                  </span>
                ) : null;
              })()}
            </span>
          </button>
        ),
      },
      {
        id: "email",
        header: (chrome.col_email_label || "").trim(),
        className: "min-w-[10rem]",
        cell: (u: AdminUser) => {
          const email = (u.email || "").trim();
          if (!email) {
            return (
              <span className="block max-w-[14rem] truncate text-sm text-[var(--dama-muted)]">
                {empty}
              </span>
            );
          }
          return (
            <button
              type="button"
              className="block max-w-[14rem] truncate text-left text-sm text-[var(--dama-muted)] underline-offset-4 hover:underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => detailDialog.openWith(u)}
            >
              {email}
            </button>
          );
        },
      },
      ...(phoneHeader
        ? [
            {
              id: "phone",
              header: phoneHeader,
              className: "min-w-[8rem]",
              cell: (u: AdminUser) => (
                <span className="block max-w-[12rem] truncate text-sm tabular-nums text-[var(--dama-muted)]">
                  {(u.primary_phone || "").trim() || empty}
                </span>
              ),
            } satisfies OpsColumn<AdminUser>,
          ]
        : []),
      {
        id: "country",
        header: (chrome.col_country_label || "").trim(),
        className: "w-20",
        cell: (u: AdminUser) => (
          <span className="text-sm tabular-nums">{(u.country_code || "").trim() || empty}</span>
        ),
      },
      {
        id: "rating",
        header: (chrome.col_rating_label || "").trim(),
        className: "w-24",
        cell: (u: AdminUser) => (
          <span className="text-sm tabular-nums">{u.rating != null ? u.rating : empty}</span>
        ),
      },
      {
        id: "xp",
        header: (chrome.col_xp_label || "").trim(),
        className: "w-24",
        cell: (u: AdminUser) => (
          <span className="text-sm tabular-nums">{u.xp != null ? u.xp : empty}</span>
        ),
      },
      {
        id: "record",
        header: (chrome.col_record_label || "").trim(),
        cell: (u: AdminUser) => (
          <span className="tabular-nums text-sm">
            {u.wins}
            {chrome.wins_abbr}
            {chrome.stats_separator}
            {u.losses}
            {chrome.losses_abbr}
          </span>
        ),
      },
      {
        id: "draws",
        header: (chrome.col_draws_label || "").trim(),
        className: "w-20",
        cell: (u: AdminUser) => (
          <span className="text-sm tabular-nums">{u.draws != null ? u.draws : empty}</span>
        ),
      },
      {
        id: "status",
        header: (chrome.col_status_label || "").trim(),
        cell: (u: AdminUser) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {u.is_active ? chrome.active_label : chrome.disabled_label}
          </span>
        ),
      },
      {
        id: "role",
        header: (chrome.col_role_label || "").trim(),
        cell: (u: AdminUser) =>
          canWriteRole ? (
            <Select
              value={u.role}
              onValueChange={(role) => {
                if (role === u.role) return;
                setRoleConfirm({ id: u.id, role, username: u.username });
              }}
              disabled={setRole.isPending || roles.length === 0}
            >
              <SelectTrigger className="h-8 w-[9.5rem]">
                <SelectValue placeholder={(chrome.col_role_label || "").trim() || undefined} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm">{(u.role || "").trim() || empty}</span>
          ),
      },
      {
        id: "created",
        header: (chrome.col_created_label || "").trim(),
        className: "w-40",
        cell: (u: AdminUser) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {u.created_at ? new Date(u.created_at).toLocaleDateString() : empty}
          </span>
        ),
      },
      {
        id: "actions",
        header: actionsLabel,
        className: "w-12 text-right",
        cell: (u: AdminUser) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              ...(viewLabel
                ? [{ id: "view", label: viewLabel, onSelect: () => detailDialog.openWith(u) }]
                : []),
              {
                id: "open",
                label: (chrome.open_full_detail_action || "").trim(),
                onSelect: () => router.push(`/users/${u.id}`),
              },
              ...(canWriteActive
                ? [
                    {
                      id: "toggle",
                      label: (
                        (u.is_active ? chrome.deactivate_action : chrome.activate_action) || ""
                      ).trim(),
                      pendingLabel: (
                        (u.is_active
                          ? chrome.confirm_deactivate_pending
                          : chrome.confirm_activate_pending) || ""
                      ).trim(),
                      destructive: u.is_active,
                      disabled: u.id === self?.id,
                      isLoading: setActive.isPending && confirmUser?.id === u.id,
                      onSelect: () => setConfirmUser(u),
                    },
                  ]
                : []),
            ].filter((a) => Boolean(a.label))}
          />
        ),
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [
    canWriteActive,
    canWriteRole,
    chrome,
    confirmUser?.id,
    detailDialog,
    empty,
    roles,
    router,
    self?.id,
    setActive.isPending,
    setRole.isPending,
  ]);

  if (chromeQuery.isLoading || roleLoading || (isAdmin && permsQuery.isLoading)) {
    return (
      <div className="space-y-4">
        <UsersListSkeleton />
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
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="text-sm text-[var(--dama-muted)]">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
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

  const deactivating = Boolean(confirmUser?.is_active);
  const confirmTitle = deactivating
    ? (chrome.confirm_deactivate_title || "").trim()
    : (chrome.confirm_activate_title || "").trim();
  const confirmDescription = deactivating
    ? (chrome.confirm_deactivate_description || "").trim()
    : (chrome.confirm_activate_description || "").trim();
  const confirmLabel = deactivating
    ? (chrome.confirm_deactivate || "").trim()
    : (chrome.confirm_activate || "").trim();
  const pendingLabel = deactivating
    ? (chrome.confirm_deactivate_pending || "").trim()
    : (chrome.confirm_activate_pending || "").trim();

  const closeLabel = (chrome.dialog_close_label || "").trim();
  const cancelLabel = (chrome.cancel_action || "").trim();
  const detailTitle = (chrome.detail_title || "").trim();
  const fullDetailLabel = (chrome.open_full_detail_action || "").trim();
  /** Only paint GetUser payload - never fall back to thin list row as "loaded detail". */
  const detailLive = detailQuery.data ?? null;
  const detailFailed = detailQuery.isError;
  const detailLoading = detailQuery.isLoading && !detailQuery.data;
  const bulkActive = bulkConfirm?.active === true;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      {listLoading ? (
        <UsersListBodySkeleton />
      ) : (
        <>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-users-search",
                label: (chrome.search_label || "").trim(),
                value: userSearch,
                onChange: (v) => {
                  setUserSearch(v);
                  setSkip(0);
                  setRowSelection({});
                },
                placeholder: (chrome.search_placeholder || "").trim() || undefined,
              },
              {
                kind: "select",
                id: "admin-users-status",
                label: (chrome.col_status_label || "").trim(),
                value: statusFilter,
                onChange: (v) => {
                  setStatusFilter(v);
                  setSkip(0);
                  setRowSelection({});
                },
                allLabel: (chrome.filter_all_label || "").trim() || undefined,
                options: [
                  { value: "active", label: (chrome.active_label || "").trim() },
                  { value: "disabled", label: (chrome.disabled_label || "").trim() },
                ].filter((o) => Boolean(o.label)),
              },
              {
                kind: "dateRange",
                id: "admin-users-created-range",
                label: (chrome.date_range_label || "").trim(),
                value: createdRange,
                onChange: (next) => {
                  setCreatedRange(next);
                  setSkip(0);
                  setRowSelection({});
                },
                placeholder: (chrome.date_range_placeholder || "").trim(),
                clearLabel: (chrome.date_range_clear || "").trim(),
                applyLabel: (chrome.date_range_apply || "").trim(),
                locale: (chrome.date_range_locale || "").trim(),
                numberOfMonths: Number.isFinite(dateRangeMonths) ? dateRangeMonths : 0,
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageUsers}
            getRowId={(u) => u.id}
            isFetching={softFetching}
            meta={pageMeta}
            onPage={(next) => {
              setSkip(next);
              setRowSelection({});
            }}
            pageDisabled={softFetching || bulkPending}
            pageInputId="admin-users-skip"
            bodyRowClassName={(u) =>
              u.is_active ? undefined : "opacity-60 text-[var(--dama-muted)]"
            }
            selection={{
              chrome: {
                selectAllLabel: (chrome.select_all_label || "").trim(),
                selectRowLabel: (chrome.select_row_label || "").trim(),
                selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
              },
              rowSelection,
              onRowSelectionChange: setRowSelection,
              toolbar: canWriteActive ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="gold"
                    isLoading={bulkPending}
                    pendingLabel={chrome.bulk_status_pending}
                    disabled={selectedRowIds(rowSelection).length === 0}
                    onClick={() => setBulkConfirm({ active: true })}
                  >
                    {chrome.bulk_activate_action}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={bulkPending}
                    pendingLabel={chrome.bulk_status_pending}
                    disabled={selectedRowIds(rowSelection).length === 0}
                    onClick={() => setBulkConfirm({ active: false })}
                  >
                    {chrome.bulk_deactivate_action}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending}
                    onClick={() => setRowSelection({})}
                  >
                    {chrome.clear_selection_action}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkPending}
                  onClick={() => setRowSelection({})}
                >
                  {chrome.clear_selection_action}
                </Button>
              ),
            }}
          />
        </>
      )}

      {detailDialog.value && detailTitle && closeLabel ? (
        <Dialog
          open={detailDialog.open}
          onOpenChange={(next) => {
            if (!next && (setRole.isPending || setActive.isPending)) return;
            detailDialog.onOpenChange(next);
          }}
        >
          <DialogContent
            closeLabel={closeLabel}
            className="max-h-[90dvh] max-w-lg overflow-y-auto sm:max-w-2xl"
            onPointerDownOutside={(e) => {
              if (setRole.isPending || setActive.isPending) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (setRole.isPending || setActive.isPending) e.preventDefault();
            }}
          >
            <DialogHeader className="space-y-3 border-b border-[var(--dama-border)] pb-4 text-left">
              <div className="flex items-center gap-3">
                <DamaUserAvatar
                  src={
                    resolvePublicMediaUrl(
                      detailLive?.avatar_thumb_url || detailDialog.value.avatar_thumb_url,
                    ) || null
                  }
                  alt={(chrome.detail_avatar_alt || "").trim()}
                  className="h-12 w-12 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 text-left text-base sm:text-lg">
                    <span className="min-w-0 truncate">
                      {(detailLive?.username || detailDialog.value.username || "").trim() ||
                        detailTitle}
                    </span>
                    <HostTrustBadge
                      label={detailLive?.host_trust_badge}
                      tier={detailLive?.host_trust_tier}
                      className="shrink-0"
                    />
                  </DialogTitle>
                  <DialogDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-left text-xs">
                    <span className="rounded-md border border-[var(--dama-border)] px-1.5 py-0.5">
                      {(detailLive?.role || detailDialog.value.role || "").trim() || empty}
                    </span>
                    <span className="rounded-md border border-[var(--dama-border)] px-1.5 py-0.5">
                      {(detailLive ?? detailDialog.value).is_active
                        ? (chrome.active_label || "").trim()
                        : (chrome.disabled_label || "").trim()}
                    </span>
                    <CountryFlag
                      code={(detailLive?.country_code || detailDialog.value.country_code) ?? null}
                    />
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            {detailLoading ? (
              <UserIdentityBodySkeleton />
            ) : detailFailed ? (
              <p className="text-sm text-[var(--dama-danger)]" role="alert">
                {(chrome.detail_load_failed || "").trim()}
              </p>
            ) : detailLive ? (
              <div className="space-y-4">
                <AdminUserIdentityPanel user={detailLive} chrome={chrome} compactHeader />
                {canWriteRole && roles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--dama-border)] pt-4">
                    <Select
                      value={detailLive.role}
                      onValueChange={(role) => {
                        if (role === detailLive.role) return;
                        setRoleConfirm({
                          id: detailLive.id,
                          role,
                          username: detailLive.username,
                        });
                      }}
                      disabled={setRole.isPending}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[11rem]">
                        <SelectValue
                          placeholder={(chrome.edit_role_action || "").trim() || undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                {canWriteActive && detailLive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={detailLive.is_active ? "outline" : "gold"}
                    className="flex-1 sm:flex-none"
                    disabled={detailLive.id === self?.id || setActive.isPending}
                    onClick={() => setConfirmUser(detailLive)}
                  >
                    {(detailLive.is_active
                      ? chrome.deactivate_action
                      : chrome.activate_action
                    )?.trim()}
                  </Button>
                ) : null}
              </div>
              <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                {cancelLabel ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    disabled={setRole.isPending || setActive.isPending}
                    onClick={() => detailDialog.close()}
                  >
                    {cancelLabel}
                  </Button>
                ) : null}
                {fullDetailLabel && detailDialog.value?.id ? (
                  <Button type="button" variant="gold" className="flex-1 sm:flex-none" asChild>
                    <Link href={`/users/${detailDialog.value.id}`}>{fullDetailLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmUser)}
        onOpenChange={(next) => {
          if (!next && !setActive.isPending) setConfirmUser(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        cancelLabel={(chrome.confirm_cancel || "").trim()}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        isPending={setActive.isPending}
        destructive={deactivating}
        onConfirm={() => {
          if (!confirmUser) return;
          setActive.mutate(
            { id: confirmUser.id, active: !confirmUser.is_active },
            { onSettled: () => setConfirmUser(null) },
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(roleConfirm)}
        onOpenChange={(next) => {
          if (!next && !setRole.isPending) setRoleConfirm(null);
        }}
        title={(chrome.confirm_role_title || "").trim()}
        description={(chrome.confirm_role_description || "").trim()}
        cancelLabel={(chrome.confirm_cancel || "").trim()}
        confirmLabel={(chrome.confirm_role || "").trim()}
        pendingLabel={(chrome.confirm_role_pending || "").trim()}
        isPending={setRole.isPending}
        onConfirm={() => {
          if (!roleConfirm) return;
          setRole.mutate(
            { id: roleConfirm.id, role: roleConfirm.role },
            { onSettled: () => setRoleConfirm(null) },
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(bulkConfirm)}
        onOpenChange={(next) => {
          if (!next && !bulkPending) setBulkConfirm(null);
        }}
        title={
          (bulkActive
            ? chrome.bulk_confirm_activate_title
            : chrome.bulk_confirm_deactivate_title) || ""
        }
        description={
          (bulkActive
            ? chrome.bulk_confirm_activate_description
            : chrome.bulk_confirm_deactivate_description) || ""
        }
        cancelLabel={(chrome.confirm_cancel || "").trim()}
        confirmLabel={
          (bulkActive ? chrome.bulk_activate_action : chrome.bulk_deactivate_action) || ""
        }
        pendingLabel={(chrome.bulk_status_pending || "").trim()}
        isPending={bulkPending}
        destructive={!bulkActive}
        onConfirm={() => {
          if (!bulkConfirm) return;
          void bulkSetActive(bulkConfirm.active);
        }}
      />
    </div>
  );
}
