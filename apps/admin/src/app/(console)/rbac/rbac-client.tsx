"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { RbacBodySkeleton, RbacPageSkeleton } from "@/components/ui/shimmer-skeletons";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteRbacPermissionMutation,
  useReplaceRolePermissionsMutation,
  useSaveRbacCatalogMutation,
  useUpsertRbacPermissionMutation,
} from "@/hooks/mutation";
import { useMyPermissionsQuery, useRbacSnapshotQuery } from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { DEFAULT_SKIP_LABELS, buildClientSkipMeta } from "@/lib/skip-pagination";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type RbacPermissionRow = {
  key: string;
  title: string;
  description?: string | null;
};

type RoleCatalogRow = {
  role: string;
  isConsole: boolean;
  isPublisher: boolean;
  isDefault: boolean;
};

type PermFormMode =
  | { kind: "create" }
  | { kind: "edit"; perm: RbacPermissionRow }
  | { kind: "view"; perm: RbacPermissionRow };

type RoleFormMode =
  | { kind: "create" }
  | { kind: "edit"; row: RoleCatalogRow }
  | { kind: "view"; row: RoleCatalogRow };

type RbacTab = "catalog" | "permissions" | "grants";

function DetailRow({ label, value }: { label: string; value: string }) {
  const l = label.trim();
  if (!l) return null;
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-[var(--dama-muted)]">{l}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}

function flagLabel(yes: string, no: string, on: boolean): string {
  return on ? yes : no;
}

export function RbacClient() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const permsQuery = useMyPermissionsQuery(token, isAdmin);
  const chrome = permsQuery.data?.chrome;
  const manageKey = permsQuery.data?.chrome?.manage_permission_key ?? "";
  const canManage =
    Boolean(manageKey) && permsQuery.data?.permissions?.includes(manageKey) === true;
  const snapshot = useRbacSnapshotQuery(token, isAdmin && canManage);

  const [tab, setTab] = useState<RbacTab>("catalog");
  const [selectedRole, setSelectedRole] = useState("");
  const [grantKeys, setGrantKeys] = useState<string[]>([]);
  const [permKey, setPermKey] = useState("");
  const [permTitle, setPermTitle] = useState("");
  const [permDesc, setPermDesc] = useState("");
  const [permSkip, setPermSkip] = useUrlSkip("perm_skip");
  const [roleSkip, setRoleSkip] = useUrlSkip("role_skip");
  const [permSearch, setPermSearch] = useState("");
  const debouncedPermSearch = useDebouncedValue(permSearch.trim(), 250);
  const [roleSearch, setRoleSearch] = useState("");
  const debouncedRoleSearch = useDebouncedValue(roleSearch.trim(), 250);
  const [grantSearch, setGrantSearch] = useState("");
  const debouncedGrantSearch = useDebouncedValue(grantSearch.trim(), 250);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [roleRowSelection, setRoleRowSelection] = useState<OpsRowSelectionState>({});
  const [deleteTarget, setDeleteTarget] = useState<RbacPermissionRow | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleCatalogRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteRolesOpen, setBulkDeleteRolesOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkRolesPending, setBulkRolesPending] = useState(false);
  const formDialog = useDeferredDialogValue<PermFormMode>();
  const roleDialog = useDeferredDialogValue<RoleFormMode>();
  const [draftRoleName, setDraftRoleName] = useState("");
  const [draftIsConsole, setDraftIsConsole] = useState(false);
  const [draftIsPublisher, setDraftIsPublisher] = useState(false);
  const [draftIsDefault, setDraftIsDefault] = useState(false);
  const PAGE = 25;

  const saveCatalog = useSaveRbacCatalogMutation(token);
  const upsertPerm = useUpsertRbacPermissionMutation(token);
  const deletePerm = useDeleteRbacPermissionMutation(token);
  const replaceGrants = useReplaceRolePermissionsMutation(token);

  const openCreate = useCallback(() => {
    setPermKey("");
    setPermTitle("");
    setPermDesc("");
    formDialog.openWith({ kind: "create" });
  }, [formDialog.openWith]);

  const openView = useCallback(
    (perm: RbacPermissionRow) => {
      setPermKey(perm.key);
      setPermTitle(perm.title);
      setPermDesc(perm.description ?? "");
      formDialog.openWith({ kind: "view", perm });
    },
    [formDialog.openWith],
  );

  const openEdit = useCallback(
    (perm: RbacPermissionRow) => {
      setPermKey(perm.key);
      setPermTitle(perm.title);
      setPermDesc(perm.description ?? "");
      formDialog.openWith({ kind: "edit", perm });
    },
    [formDialog.openWith],
  );

  const openRoleCreate = useCallback(() => {
    setDraftRoleName("");
    setDraftIsConsole(false);
    setDraftIsPublisher(false);
    setDraftIsDefault(false);
    roleDialog.openWith({ kind: "create" });
  }, [roleDialog.openWith]);

  const openRoleView = useCallback(
    (row: RoleCatalogRow) => {
      setDraftRoleName(row.role);
      setDraftIsConsole(row.isConsole);
      setDraftIsPublisher(row.isPublisher);
      setDraftIsDefault(row.isDefault);
      roleDialog.openWith({ kind: "view", row });
    },
    [roleDialog.openWith],
  );

  const openRoleEdit = useCallback(
    (row: RoleCatalogRow) => {
      setDraftRoleName(row.role);
      setDraftIsConsole(row.isConsole);
      setDraftIsPublisher(row.isPublisher);
      setDraftIsDefault(row.isDefault);
      roleDialog.openWith({ kind: "edit", row });
    },
    [roleDialog.openWith],
  );

  const roleRows = useMemo((): RoleCatalogRow[] => {
    if (!snapshot.data) return [];
    const consoleSet = new Set(snapshot.data.console_roles);
    const publisherSet = new Set(snapshot.data.publisher_roles);
    const def = snapshot.data.default_role;
    return snapshot.data.roles.map((role) => ({
      role,
      isConsole: consoleSet.has(role),
      isPublisher: publisherSet.has(role),
      isDefault: role === def,
    }));
  }, [snapshot.data]);

  const filteredRoles = useMemo(() => {
    const q = debouncedRoleSearch.toLowerCase();
    if (!q) return roleRows;
    return roleRows.filter((r) => r.role.toLowerCase().includes(q));
  }, [debouncedRoleSearch, roleRows]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRoleRowSelection({});
  }, [debouncedRoleSearch, roleSkip]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [debouncedPermSearch, permSkip]);

  const permissionColumns = useMemo((): OpsColumn<RbacPermissionRow>[] => {
    const chromeSnap = snapshot.data?.chrome;
    if (!chromeSnap) return [];
    const keyHeader = (chromeSnap.perm_key_label || "").trim();
    const titleHeader = (chromeSnap.perm_title_label || "").trim();
    const viewLabel = (chromeSnap.view_action || "").trim();
    const editLabel = (chromeSnap.edit_action || "").trim();
    const deleteLabel = (chromeSnap.delete_permission_action || "").trim();
    const actionsLabel = (chromeSnap.row_actions_label || "").trim();
    const protectedKeys = chromeSnap.protected_permission_keys ?? [];
    const cols: OpsColumn<RbacPermissionRow>[] = [
      {
        id: "key",
        header: keyHeader,
        cell: (p: RbacPermissionRow) => (
          <button
            type="button"
            className="font-mono text-xs text-[var(--dama-gold)] underline-offset-4 hover:underline"
            onClick={() => openView(p)}
          >
            {p.key}
          </button>
        ),
      },
      {
        id: "title",
        header: titleHeader,
        cell: (p: RbacPermissionRow) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{p.title}</p>
            {p.description ? (
              <p className="truncate text-xs text-[var(--dama-muted)]">{p.description}</p>
            ) : null}
          </div>
        ),
      },
    ];
    cols.push({
      id: "actions",
      header: actionsLabel || "",
      className: "w-12 text-right",
      cell: (p: RbacPermissionRow) => (
        <OpsDataTableRowActions
          triggerLabel={actionsLabel}
          actions={[
            ...(viewLabel ? [{ id: "view", label: viewLabel, onSelect: () => openView(p) }] : []),
            ...(editLabel ? [{ id: "edit", label: editLabel, onSelect: () => openEdit(p) }] : []),
            ...(deleteLabel
              ? [
                  {
                    id: "delete",
                    label: deleteLabel,
                    destructive: true as const,
                    disabled: protectedKeys.includes(p.key),
                    isLoading: deletePerm.isPending && deletePerm.variables === p.key,
                    pendingLabel: (chromeSnap.delete_permission_pending || "").trim(),
                    onSelect: () => setDeleteTarget(p),
                  },
                ]
              : []),
          ]}
        />
      ),
    });
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [deletePerm, openEdit, openView, snapshot.data?.chrome]);

  const roleColumns = useMemo((): OpsColumn<RoleCatalogRow>[] => {
    const chromeSnap = snapshot.data?.chrome;
    if (!chromeSnap) return [];
    const roleHeader = (chromeSnap.col_role_label || chromeSnap.role_label || "").trim();
    const consoleHeader = (chromeSnap.col_console_label || "").trim();
    const publisherHeader = (chromeSnap.col_publisher_label || "").trim();
    const defaultHeader = (chromeSnap.col_default_label || "").trim();
    const yes = (chromeSnap.flag_yes_label || "").trim();
    const no = (chromeSnap.flag_no_label || "").trim();
    const viewLabel = (chromeSnap.view_action || "").trim();
    const editLabel = (chromeSnap.edit_action || "").trim();
    const deleteLabel = (chromeSnap.delete_role_action || "").trim();
    const actionsLabel = (chromeSnap.row_actions_label || "").trim();
    const cols: OpsColumn<RoleCatalogRow>[] = [
      {
        id: "role",
        header: roleHeader,
        cell: (row) => (
          <button
            type="button"
            className="font-mono text-xs text-[var(--dama-gold)] underline-offset-4 hover:underline"
            onClick={() => openRoleView(row)}
          >
            {row.role}
          </button>
        ),
      },
      {
        id: "console",
        header: consoleHeader,
        cell: (row) => <span className="text-sm">{flagLabel(yes, no, row.isConsole)}</span>,
      },
      {
        id: "publisher",
        header: publisherHeader,
        cell: (row) => <span className="text-sm">{flagLabel(yes, no, row.isPublisher)}</span>,
      },
      {
        id: "default",
        header: defaultHeader,
        cell: (row) => <span className="text-sm">{flagLabel(yes, no, row.isDefault)}</span>,
      },
    ];
    cols.push({
      id: "actions",
      header: actionsLabel || "",
      className: "w-12 text-right",
      cell: (row) => (
        <OpsDataTableRowActions
          triggerLabel={actionsLabel}
          actions={[
            ...(viewLabel
              ? [{ id: "view", label: viewLabel, onSelect: () => openRoleView(row) }]
              : []),
            ...(editLabel
              ? [{ id: "edit", label: editLabel, onSelect: () => openRoleEdit(row) }]
              : []),
            ...(deleteLabel
              ? [
                  {
                    id: "delete",
                    label: deleteLabel,
                    destructive: true as const,
                    disabled: row.isDefault || saveCatalog.isPending || bulkRolesPending,
                    isLoading: false,
                    pendingLabel: (chromeSnap.bulk_delete_pending || "").trim(),
                    onSelect: () => setDeleteRoleTarget(row),
                  },
                ]
              : []),
          ]}
        />
      ),
    });
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [bulkRolesPending, openRoleEdit, openRoleView, saveCatalog.isPending, snapshot.data?.chrome]);

  useEffect(() => {
    if (!snapshot.data) return;
    if (!selectedRole && snapshot.data.roles[0]) {
      setSelectedRole(snapshot.data.roles[0]);
    }
  }, [snapshot.data, selectedRole]);

  useEffect(() => {
    if (!snapshot.data || !selectedRole) return;
    setGrantKeys(snapshot.data.role_permissions[selectedRole] ?? []);
  }, [snapshot.data, selectedRole]);

  const filteredPermissions = useMemo(() => {
    const all = snapshot.data?.permissions ?? [];
    const q = debouncedPermSearch.toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        (p.title || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [debouncedPermSearch, snapshot.data?.permissions]);

  const filteredGrantPermissions = useMemo(() => {
    const all = snapshot.data?.permissions ?? [];
    const q = debouncedGrantSearch.toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        (p.title || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [debouncedGrantSearch, snapshot.data?.permissions]);

  const pageChrome = snapshot.data?.chrome ?? chrome;
  const formMode = formDialog.value;
  const isViewing = formMode?.kind === "view";
  const isEditing = formMode?.kind === "edit";
  const formTitle = isViewing
    ? (pageChrome?.detail_title || "").trim()
    : isEditing
      ? (pageChrome?.edit_action || "").trim()
      : (pageChrome?.add_permission_action || "").trim();
  const closeLabel = (pageChrome?.dialog_close_label || "").trim();
  const cancelLabel = (pageChrome?.cancel_action || "").trim();
  const protectedKeys = pageChrome?.protected_permission_keys ?? [];

  const roleFormMode = roleDialog.value;
  const isRoleViewing = roleFormMode?.kind === "view";
  const isRoleEditing = roleFormMode?.kind === "edit";
  const roleFormTitle = isRoleViewing
    ? (pageChrome?.role_detail_title || pageChrome?.detail_title || "").trim()
    : isRoleEditing
      ? (pageChrome?.edit_action || "").trim()
      : (pageChrome?.add_role_action || "").trim();

  function buildCatalogPayload(nextRoles: RoleCatalogRow[]) {
    const roles = nextRoles.map((r) => r.role);
    const console_roles = nextRoles.filter((r) => r.isConsole).map((r) => r.role);
    const publisher_roles = nextRoles.filter((r) => r.isPublisher).map((r) => r.role);
    const defaultRow = nextRoles.find((r) => r.isDefault);
    const default_role = defaultRow?.role || roles[0] || "";
    return { roles, console_roles, publisher_roles, default_role };
  }

  function submitRoleForm() {
    if (!snapshot.data) return;
    const name = draftRoleName.trim();
    if (!name) return;
    const existing = roleRows.filter((r) =>
      roleFormMode?.kind === "edit" ? r.role !== roleFormMode.row.role : r.role !== name,
    );
    if (roleFormMode?.kind === "create" && roleRows.some((r) => r.role === name)) {
      const msg = (pageChrome?.toast_save_failed || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    if (roleFormMode?.kind === "edit" && roleFormMode.row.role !== name) {
      if (roleRows.some((r) => r.role === name)) {
        const msg = (pageChrome?.toast_save_failed || "").trim();
        if (msg) toast.error(msg);
        return;
      }
    }
    let next: RoleCatalogRow[] = [
      ...existing,
      {
        role: name,
        isConsole: draftIsConsole,
        isPublisher: draftIsPublisher,
        isDefault: draftIsDefault,
      },
    ];
    if (draftIsDefault) {
      next = next.map((r) => ({ ...r, isDefault: r.role === name }));
    } else if (!next.some((r) => r.isDefault) && next[0]) {
      next = next.map((r, i) => ({ ...r, isDefault: i === 0 }));
    }
    saveCatalog.mutate(buildCatalogPayload(next), {
      onSuccess: () => roleDialog.close(),
    });
  }

  function removeRoles(rolesToRemove: string[]) {
    if (!snapshot.data || rolesToRemove.length === 0) return;
    const removeSet = new Set(rolesToRemove);
    let next = roleRows.filter((r) => !removeSet.has(r.role));
    if (next.length === 0) {
      const msg = (pageChrome?.toast_delete_failed || pageChrome?.toast_save_failed || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    if (!next.some((r) => r.isDefault)) {
      next = next.map((r, i) => ({ ...r, isDefault: i === 0 }));
    }
    return saveCatalog.mutateAsync(buildCatalogPayload(next));
  }

  async function runBulkDelete() {
    const selected = selectedRowIds(rowSelection);
    const ids = selected.filter((k) => !protectedKeys.includes(k));
    if (!ids.length) {
      setBulkDeleteOpen(false);
      const msg = (
        pageChrome?.err_protected_delete ||
        pageChrome?.toast_delete_failed ||
        ""
      ).trim();
      if (msg && selected.length > 0) toast.error(msg);
      return;
    }
    setBulkPending(true);
    try {
      for (const key of ids) {
        await deletePerm.mutateAsync(key);
      }
      setRowSelection({});
      setBulkDeleteOpen(false);
    } finally {
      setBulkPending(false);
    }
  }

  async function runBulkDeleteRoles() {
    const selected = selectedRowIds(roleRowSelection).filter((role) => {
      const row = roleRows.find((r) => r.role === role);
      return row && !row.isDefault;
    });
    if (!selected.length) {
      setBulkDeleteRolesOpen(false);
      const msg = (pageChrome?.toast_delete_failed || "").trim();
      if (msg && selectedRowIds(roleRowSelection).length > 0) toast.error(msg);
      return;
    }
    setBulkRolesPending(true);
    try {
      await removeRoles(selected);
      setRoleRowSelection({});
      setBulkDeleteRolesOpen(false);
    } finally {
      setBulkRolesPending(false);
    }
  }

  if (roleLoading || (isAdmin && permsQuery.isLoading)) {
    return (
      <div className="space-y-6">
        <RbacPageSkeleton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <p className="rounded-md border border-[var(--dama-border)] p-4 text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }

  if (permsQuery.error || !chrome) {
    const unavailable =
      (permsQuery.data?.chrome?.unavailable || "").trim() ||
      (permsQuery.data?.chrome?.load_failed || "").trim() ||
      adminConsoleChromeUnavailable(
        permsQuery.data as { admin_console_chrome_unavailable?: string } | null,
        permsQuery.error,
      );
    return (
      <div className="space-y-6 p-6">
        <p className="text-sm text-[var(--dama-danger)]" role="alert" data-error="rbac_chrome">
          {unavailable}
        </p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="text-sm text-[var(--dama-muted)]">{chrome.lacks_manage}</p>
      </div>
    );
  }

  const tabCatalog =
    (pageChrome?.tab_catalog_label || "").trim() ||
    (snapshot.data?.chrome.catalog_title || "").trim();
  const tabPermissions =
    (pageChrome?.tab_permissions_label || "").trim() ||
    (snapshot.data?.chrome.permissions_title || "").trim();
  const tabGrants =
    (pageChrome?.tab_grants_label || "").trim() ||
    (snapshot.data?.chrome.grants_title || "").trim();
  const yesLabel = (pageChrome?.flag_yes_label || "").trim();
  const noLabel = (pageChrome?.flag_no_label || "").trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {pageChrome?.page_title ?? chrome.page_title}
        </h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">
          {pageChrome?.page_body ?? chrome.page_body}
        </p>
      </div>

      {snapshot.isLoading ? (
        <RbacBodySkeleton tab={tab} />
      ) : snapshot.error || !snapshot.data?.chrome ? (
        <p className="text-sm text-[var(--dama-danger)]" role="alert">
          {chrome.load_failed}
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={(pageChrome?.page_title || "").trim() || undefined}
            className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
          >
            {(
              [
                { id: "catalog" as const, label: tabCatalog },
                { id: "permissions" as const, label: tabPermissions },
                { id: "grants" as const, label: tabGrants },
              ] as const
            )
              .filter((t) => Boolean(t.label))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "bg-[var(--dama-card)] text-[var(--dama-fg)] shadow-sm"
                      : "text-[var(--dama-muted)] hover:text-[var(--dama-fg)]",
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
          </div>

          {tab === "catalog" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                  {snapshot.data.chrome.catalog_title}
                </h2>
                {(snapshot.data.chrome.add_role_action || "").trim() ? (
                  <Button type="button" size="sm" variant="gold" onClick={() => openRoleCreate()}>
                    {snapshot.data.chrome.add_role_action}
                  </Button>
                ) : null}
              </div>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-rbac-role-search",
                    label: (snapshot.data.chrome.search_label || "").trim(),
                    value: roleSearch,
                    onChange: (v) => {
                      setRoleSearch(v);
                      setRoleSkip(0);
                      setRoleRowSelection({});
                    },
                    placeholder:
                      (snapshot.data.chrome.search_placeholder || "").trim() || undefined,
                  },
                ]}
              />
              <OpsDataTable
                columns={roleColumns}
                data={filteredRoles.slice(roleSkip, roleSkip + PAGE)}
                getRowId={(r) => r.role}
                isFetching={snapshot.isFetching && !snapshot.isLoading}
                empty={<span>{(snapshot.data.chrome.catalog_empty || "").trim()}</span>}
                meta={buildClientSkipMeta(
                  filteredRoles.length,
                  roleSkip,
                  PAGE,
                  DEFAULT_SKIP_LABELS,
                )}
                onPage={(next) => {
                  setRoleSkip(next);
                  setRoleRowSelection({});
                }}
                pageInputId="admin-rbac-roles-skip"
                selection={{
                  chrome: {
                    selectAllLabel: (snapshot.data.chrome.select_all_label || "").trim(),
                    selectRowLabel: (snapshot.data.chrome.select_row_label || "").trim(),
                    selectedCountFmt: (snapshot.data.chrome.selected_count_fmt || "").trim(),
                  },
                  rowSelection: roleRowSelection,
                  onRowSelectionChange: setRoleRowSelection,
                  toolbar: (
                    <div className="flex flex-wrap gap-2">
                      {(snapshot.data.chrome.bulk_delete_action || "").trim() ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={
                            selectedRowIds(roleRowSelection).length === 0 || bulkRolesPending
                          }
                          isLoading={bulkRolesPending}
                          pendingLabel={(snapshot.data.chrome.bulk_delete_pending || "").trim()}
                          onClick={() => setBulkDeleteRolesOpen(true)}
                        >
                          {snapshot.data.chrome.bulk_delete_action}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkRolesPending}
                        onClick={() => setRoleRowSelection({})}
                      >
                        {snapshot.data.chrome.clear_selection_action}
                      </Button>
                    </div>
                  ),
                }}
              />
            </section>
          ) : null}

          {tab === "permissions" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                  {snapshot.data.chrome.permissions_title}
                </h2>
                {(snapshot.data.chrome.add_permission_action || "").trim() ? (
                  <Button type="button" size="sm" variant="gold" onClick={() => openCreate()}>
                    {snapshot.data.chrome.add_permission_action}
                  </Button>
                ) : null}
              </div>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-rbac-perm-search",
                    label: (snapshot.data.chrome.search_label || "").trim(),
                    value: permSearch,
                    onChange: (v) => {
                      setPermSearch(v);
                      setPermSkip(0);
                      setRowSelection({});
                    },
                    placeholder:
                      (snapshot.data.chrome.search_placeholder || "").trim() || undefined,
                  },
                ]}
              />
              <OpsDataTable
                columns={permissionColumns}
                data={filteredPermissions.slice(permSkip, permSkip + PAGE)}
                getRowId={(p) => p.key}
                isFetching={snapshot.isFetching && !snapshot.isLoading}
                empty={<span>{snapshot.data.chrome.permissions_empty}</span>}
                meta={buildClientSkipMeta(
                  filteredPermissions.length,
                  permSkip,
                  PAGE,
                  DEFAULT_SKIP_LABELS,
                )}
                onPage={(next) => {
                  setPermSkip(next);
                  setRowSelection({});
                }}
                pageInputId="admin-rbac-permissions-skip"
                selection={{
                  chrome: {
                    selectAllLabel: (snapshot.data.chrome.select_all_label || "").trim(),
                    selectRowLabel: (snapshot.data.chrome.select_row_label || "").trim(),
                    selectedCountFmt: (snapshot.data.chrome.selected_count_fmt || "").trim(),
                  },
                  rowSelection,
                  onRowSelectionChange: setRowSelection,
                  toolbar: (
                    <div className="flex flex-wrap gap-2">
                      {(snapshot.data.chrome.bulk_delete_action || "").trim() ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                          isLoading={bulkPending}
                          pendingLabel={(snapshot.data.chrome.bulk_delete_pending || "").trim()}
                          onClick={() => setBulkDeleteOpen(true)}
                        >
                          {snapshot.data.chrome.bulk_delete_action}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkPending}
                        onClick={() => setRowSelection({})}
                      >
                        {snapshot.data.chrome.clear_selection_action}
                      </Button>
                    </div>
                  ),
                }}
              />
            </section>
          ) : null}

          {tab === "grants" ? (
            <section className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <h2 className="font-semibold">{snapshot.data.chrome.grants_title}</h2>
              <Field id="rbac-grant-role" label={snapshot.data.chrome.role_label}>
                <Select
                  value={selectedRole}
                  onValueChange={setSelectedRole}
                  disabled={snapshot.data.roles.length === 0}
                >
                  <SelectTrigger id="rbac-grant-role">
                    <SelectValue placeholder={snapshot.data.chrome.role_label} />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshot.data.roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-rbac-grant-search",
                    label: (snapshot.data.chrome.search_label || "").trim(),
                    value: grantSearch,
                    onChange: setGrantSearch,
                    placeholder:
                      (snapshot.data.chrome.search_placeholder || "").trim() || undefined,
                  },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                {(snapshot.data.chrome.select_all_label || "").trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={filteredGrantPermissions.length === 0}
                    onClick={() => {
                      const keys = filteredGrantPermissions.map((p) => p.key);
                      setGrantKeys((prev) => Array.from(new Set([...prev, ...keys])));
                    }}
                  >
                    {snapshot.data.chrome.select_all_label}
                  </Button>
                ) : null}
                {(snapshot.data.chrome.clear_selection_action || "").trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={grantKeys.length === 0}
                    onClick={() => {
                      const visible = new Set(filteredGrantPermissions.map((p) => p.key));
                      setGrantKeys((prev) => prev.filter((k) => !visible.has(k)));
                    }}
                  >
                    {snapshot.data.chrome.clear_selection_action}
                  </Button>
                ) : null}
              </div>
              {filteredGrantPermissions.length === 0 ? (
                <p className="text-sm text-[var(--dama-muted)]">
                  {(snapshot.data.chrome.permissions_empty || "").trim()}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredGrantPermissions.map((p) => {
                    const checked = grantKeys.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        htmlFor={`rbac-grant-${p.key}`}
                        className="flex items-start gap-2 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] px-3 py-2 text-sm"
                      >
                        <Checkbox
                          id={`rbac-grant-${p.key}`}
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={(v) => {
                            const on = v === true;
                            setGrantKeys((prev) =>
                              on ? [...prev, p.key] : prev.filter((k) => k !== p.key),
                            );
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {(p.title || "").trim() || p.key}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-[var(--dama-muted)]">
                            {p.key}
                          </span>
                          {p.description ? (
                            <span className="mt-0.5 block line-clamp-2 text-xs text-[var(--dama-muted)]">
                              {p.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <Button
                isLoading={replaceGrants.isPending}
                pendingLabel={snapshot.data.chrome.save_grants_pending}
                disabled={!selectedRole}
                onClick={() => replaceGrants.mutate({ role: selectedRole, permissions: grantKeys })}
              >
                {snapshot.data.chrome.save_grants_action}
              </Button>
            </section>
          ) : null}
        </>
      )}

      {roleFormMode && roleFormTitle && closeLabel ? (
        <Dialog open={roleDialog.open} onOpenChange={roleDialog.onOpenChange}>
          <DialogContent
            closeLabel={closeLabel}
            className="max-h-[min(90dvh,56rem)] max-w-lg overflow-y-auto sm:max-w-xl"
          >
            <DialogHeader>
              <DialogTitle>{roleFormTitle}</DialogTitle>
              <DialogDescription className="sr-only">{roleFormTitle}</DialogDescription>
            </DialogHeader>
            {isRoleViewing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={(pageChrome?.col_role_label || pageChrome?.role_label || "").trim()}
                  value={draftRoleName}
                />
                <DetailRow
                  label={(
                    pageChrome?.is_console_label ||
                    pageChrome?.col_console_label ||
                    ""
                  ).trim()}
                  value={flagLabel(yesLabel, noLabel, draftIsConsole)}
                />
                <DetailRow
                  label={(
                    pageChrome?.is_publisher_label ||
                    pageChrome?.col_publisher_label ||
                    ""
                  ).trim()}
                  value={flagLabel(yesLabel, noLabel, draftIsPublisher)}
                />
                <DetailRow
                  label={(
                    pageChrome?.is_default_label ||
                    pageChrome?.col_default_label ||
                    ""
                  ).trim()}
                  value={flagLabel(yesLabel, noLabel, draftIsDefault)}
                />
              </div>
            ) : (
              <div className="grid gap-3">
                <Field
                  id="rbac-role-name"
                  label={(pageChrome?.col_role_label || pageChrome?.role_label || "").trim()}
                >
                  <Input
                    id="rbac-role-name"
                    className="font-mono text-xs"
                    value={draftRoleName}
                    onChange={(e) => setDraftRoleName(e.target.value)}
                    disabled={isRoleEditing}
                  />
                </Field>
                <label htmlFor="rbac-role-console" className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="rbac-role-console"
                    checked={draftIsConsole}
                    onCheckedChange={(v) => setDraftIsConsole(v === true)}
                  />
                  <span>
                    {(pageChrome?.is_console_label || pageChrome?.col_console_label || "").trim()}
                  </span>
                </label>
                <label htmlFor="rbac-role-publisher" className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="rbac-role-publisher"
                    checked={draftIsPublisher}
                    onCheckedChange={(v) => setDraftIsPublisher(v === true)}
                  />
                  <span>
                    {(
                      pageChrome?.is_publisher_label ||
                      pageChrome?.col_publisher_label ||
                      ""
                    ).trim()}
                  </span>
                </label>
                <label htmlFor="rbac-role-default" className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="rbac-role-default"
                    checked={draftIsDefault}
                    onCheckedChange={(v) => setDraftIsDefault(v === true)}
                  />
                  <span>
                    {(pageChrome?.is_default_label || pageChrome?.col_default_label || "").trim()}
                  </span>
                </label>
              </div>
            )}
            <DialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => roleDialog.close()}>
                  {isRoleViewing ? closeLabel : cancelLabel}
                </Button>
              ) : null}
              {isRoleViewing &&
              roleFormMode.kind === "view" &&
              (pageChrome?.edit_action || "").trim() ? (
                <Button type="button" variant="gold" onClick={() => openRoleEdit(roleFormMode.row)}>
                  {(pageChrome?.edit_action || "").trim()}
                </Button>
              ) : null}
              {!isRoleViewing ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={saveCatalog.isPending}
                  pendingLabel={(pageChrome?.upsert_role_pending || "").trim()}
                  disabled={!draftRoleName.trim()}
                  onClick={() => submitRoleForm()}
                >
                  {(pageChrome?.upsert_role_action || "").trim()}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {formMode && formTitle && closeLabel ? (
        <Dialog open={formDialog.open} onOpenChange={formDialog.onOpenChange}>
          <DialogContent
            closeLabel={closeLabel}
            className="max-h-[min(90dvh,56rem)] max-w-lg overflow-y-auto sm:max-w-xl"
          >
            <DialogHeader>
              <DialogTitle>{formTitle}</DialogTitle>
              <DialogDescription className="sr-only">{formTitle}</DialogDescription>
            </DialogHeader>
            {isViewing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label={(pageChrome?.perm_key_label || "").trim()} value={permKey} />
                <DetailRow label={(pageChrome?.perm_title_label || "").trim()} value={permTitle} />
                <div className="sm:col-span-2">
                  <DetailRow
                    label={(pageChrome?.perm_description_label || "").trim()}
                    value={permDesc || (pageChrome?.empty_value || "").trim()}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="rbac-perm-key" label={(pageChrome?.perm_key_label || "").trim()}>
                  <Input
                    id="rbac-perm-key"
                    className="font-mono text-xs"
                    value={permKey}
                    onChange={(e) => setPermKey(e.target.value)}
                    disabled={isEditing}
                  />
                </Field>
                <Field id="rbac-perm-title" label={(pageChrome?.perm_title_label || "").trim()}>
                  <Input
                    id="rbac-perm-title"
                    value={permTitle}
                    onChange={(e) => setPermTitle(e.target.value)}
                  />
                </Field>
                <Field
                  id="rbac-perm-desc"
                  label={(pageChrome?.perm_description_label || "").trim()}
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="rbac-perm-desc"
                    className="min-h-20"
                    value={permDesc}
                    onChange={(e) => setPermDesc(e.target.value)}
                  />
                </Field>
              </div>
            )}
            <DialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => formDialog.close()}>
                  {isViewing ? closeLabel : cancelLabel}
                </Button>
              ) : null}
              {isViewing && formMode.kind === "view" && (pageChrome?.edit_action || "").trim() ? (
                <Button type="button" variant="gold" onClick={() => openEdit(formMode.perm)}>
                  {(pageChrome?.edit_action || "").trim()}
                </Button>
              ) : null}
              {!isViewing ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={upsertPerm.isPending}
                  pendingLabel={(pageChrome?.upsert_permission_pending || "").trim()}
                  disabled={!permKey.trim() || !permTitle.trim()}
                  onClick={() =>
                    upsertPerm.mutate(
                      {
                        key: permKey.trim(),
                        title: permTitle.trim(),
                        description: permDesc.trim(),
                      },
                      { onSuccess: () => formDialog.close() },
                    )
                  }
                >
                  {(pageChrome?.upsert_permission_action || "").trim()}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deletePerm.isPending) setDeleteTarget(null);
        }}
        title={(pageChrome?.confirm_delete_title || "").trim()}
        description={(pageChrome?.confirm_delete_description || "").trim()}
        cancelLabel={(pageChrome?.confirm_cancel || pageChrome?.cancel_action || "").trim()}
        confirmLabel={(pageChrome?.confirm_delete || "").trim()}
        pendingLabel={(pageChrome?.confirm_delete_pending || "").trim()}
        isPending={deletePerm.isPending}
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePerm.mutate(deleteTarget.key, {
            onSettled: () => setDeleteTarget(null),
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteRoleTarget)}
        onOpenChange={(next) => {
          if (!next && !saveCatalog.isPending) setDeleteRoleTarget(null);
        }}
        title={(pageChrome?.confirm_delete_role_title || "").trim()}
        description={(pageChrome?.confirm_delete_role_description || "").trim()}
        cancelLabel={(pageChrome?.confirm_cancel || pageChrome?.cancel_action || "").trim()}
        confirmLabel={(pageChrome?.delete_role_action || "").trim()}
        pendingLabel={(pageChrome?.bulk_delete_pending || "").trim()}
        isPending={saveCatalog.isPending}
        destructive
        onConfirm={() => {
          if (!deleteRoleTarget) return;
          void removeRoles([deleteRoleTarget.role])?.finally(() => setDeleteRoleTarget(null));
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(next) => {
          if (!next && !bulkPending) setBulkDeleteOpen(false);
        }}
        title={(pageChrome?.bulk_delete_confirm_title || "").trim()}
        description={(pageChrome?.bulk_delete_confirm_description || "").trim()}
        cancelLabel={(pageChrome?.confirm_cancel || pageChrome?.cancel_action || "").trim()}
        confirmLabel={(pageChrome?.bulk_delete_action || "").trim()}
        pendingLabel={(pageChrome?.bulk_delete_pending || "").trim()}
        isPending={bulkPending}
        destructive
        onConfirm={() => {
          void runBulkDelete();
        }}
      />

      <ConfirmDialog
        open={bulkDeleteRolesOpen}
        onOpenChange={(next) => {
          if (!next && !bulkRolesPending) setBulkDeleteRolesOpen(false);
        }}
        title={(pageChrome?.bulk_delete_roles_confirm_title || "").trim()}
        description={(pageChrome?.bulk_delete_roles_confirm_description || "").trim()}
        cancelLabel={(pageChrome?.confirm_cancel || pageChrome?.cancel_action || "").trim()}
        confirmLabel={(pageChrome?.bulk_delete_action || "").trim()}
        pendingLabel={(pageChrome?.bulk_delete_pending || "").trim()}
        isPending={bulkRolesPending}
        destructive
        onConfirm={() => {
          void runBulkDeleteRoles();
        }}
      />
    </div>
  );
}
