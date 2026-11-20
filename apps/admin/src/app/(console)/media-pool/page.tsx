"use client";

import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { parseListPageSize } from "@/lib/parse-list-page-size";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
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
import { MediaDropzone } from "@/components/ui/media-dropzone";
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
  selectedRowIds,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  MediaPoolBodySkeleton,
  MediaPoolListSkeleton,
  MediaPoolPageSkeleton,
} from "@/components/ui/shimmer-skeletons";
import {
  useDeleteMediaPoolChannelMutation,
  useRegisterMediaPoolChannelMutation,
  useSetMediaPoolChannelActiveMutation,
  useTestMediaPoolChannelMutation,
  useUpdateMediaPoolChannelMutation,
  useUploadMediaPoolFileMutation,
  useUploadMediaPoolVideoMutation,
} from "@/hooks/mutation";
import { useAdminConsoleChromeQuery, useMediaPoolChannelsQuery } from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { MediaPoolChannel } from "@/types/console";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type MediaPoolTab = "test_upload" | "channels";

export default function MediaPoolPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.media_pool
    : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);

  const [channelId, setChannelId] = useState("");
  const [label, setLabel] = useState("");
  const [quota, setQuota] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLocalPath, setUploadLocalPath] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MediaPoolChannel | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editChannelId, setEditChannelId] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");
  const [editQuota, setEditQuota] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editClientSecret, setEditClientSecret] = useState("");
  const [editRefreshToken, setEditRefreshToken] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [skip, setSkip] = useUrlSkip("skip");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const debouncedPoolSearch = useDebouncedValue(poolSearch.trim(), 250);
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<MediaPoolTab>("channels");
  const [uploadAttempted, setUploadAttempted] = useState(false);

  const createDialog = useDeferredDialogValue<true>();
  const detailDialog = useDeferredDialogValue<MediaPoolChannel>();
  const openDetail = useCallback(
    (ch: MediaPoolChannel) => detailDialog.openWith(ch),
    [detailDialog.openWith],
  );

  useResetSkipOnChange(setSkip, [debouncedPoolSearch, statusFilter]);
  const channelsQuery = useMediaPoolChannelsQuery(token, isAdmin && pageSize > 0, skip, pageSize, {
    q: debouncedPoolSearch,
    status: statusFilter,
  });
  const { data, isLoading } = channelsQuery;
  const visibleChannels = data?.channels ?? [];
  const register = useRegisterMediaPoolChannelMutation(token);
  const upload = useUploadMediaPoolVideoMutation(token);
  const uploadFileMutation = useUploadMediaPoolFileMutation(token);
  const updateChannel = useUpdateMediaPoolChannelMutation(token);
  const deleteChannel = useDeleteMediaPoolChannelMutation(token);
  const setActive = useSetMediaPoolChannelActiveMutation(token);
  const testChannel = useTestMediaPoolChannelMutation(token);
  const softFetching = channelsQuery.isFetching && !channelsQuery.isLoading;

  const detailLive = useMemo(() => {
    if (!detailDialog.value) return null;
    return visibleChannels.find((c) => c.id === detailDialog.value?.id) ?? detailDialog.value;
  }, [detailDialog.value, visibleChannels]);

  useEffect(() => {
    if (!detailDialog.open || !detailLive) return;
    setEditLabel((detailLive.label || "").trim());
    setEditChannelId((detailLive.channel_id || "").trim());
    setEditSortOrder(String(detailLive.sort_order ?? 0));
    setEditQuota(String(detailLive.daily_quota_limit ?? ""));
    setEditClientId("");
    setEditClientSecret("");
    setEditRefreshToken("");
    setEditApiKey("");
  }, [detailDialog.open, detailLive]);

  function openCreateDialog() {
    const defaultQuota = (chrome?.default_daily_quota || "").trim();
    if (!quota.trim() && defaultQuota) {
      setQuota(defaultQuota);
    }
    createDialog.openWith(true);
  }

  function submitChannelUpdate() {
    if (!detailLive) return;
    const daily = Number(editQuota);
    const sort = Number(editSortOrder);
    if (!Number.isFinite(daily) || daily <= 0) {
      const msg = (chrome?.err_quota_invalid || chrome?.quota_invalid || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    if (!Number.isFinite(sort) || sort < 0 || !Number.isInteger(sort)) {
      const msg = (chrome?.err_sort_order_invalid || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    updateChannel.mutate(
      {
        id: detailLive.id,
        label: editLabel.trim(),
        channel_id: editChannelId.trim(),
        sort_order: sort,
        daily_quota_limit: daily,
        client_id: editClientId,
        client_secret: editClientSecret,
        refresh_token: editRefreshToken,
        api_key: editApiKey,
      },
      { onSuccess: () => detailDialog.close() },
    );
  }

  async function bulkSetActive(active: boolean) {
    const ids = selectedRowIds(rowSelection);
    if (!ids.length) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        await setActive.mutateAsync({ id, active });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  function resetCreateForm() {
    setChannelId("");
    setLabel("");
    setQuota("");
    setClientId("");
    setClientSecret("");
    setRefreshToken("");
    setApiKey("");
  }

  function submitRegister() {
    const daily = Number(quota);
    if (!Number.isFinite(daily) || daily <= 0) {
      const msg = (chrome?.err_quota_invalid || chrome?.quota_invalid || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    register.mutate(
      {
        channel_id: channelId,
        label,
        client_id: clientId || undefined,
        client_secret: clientSecret || undefined,
        refresh_token: refreshToken || undefined,
        api_key: apiKey || undefined,
        daily_quota_limit: daily,
      },
      {
        onSuccess: () => {
          resetCreateForm();
          createDialog.close();
        },
      },
    );
  }

  const empty = (chrome?.empty_value || "").trim();

  const channelColumns = useMemo((): OpsColumn<MediaPoolChannel>[] => {
    if (!chrome) return [];
    const labelHeader = (chrome.label_label || "").trim();
    const channelHeader = (chrome.col_channel_id || "").trim();
    const quotaHeader = (chrome.col_quota || "").trim();
    const sortHeader = (chrome.sort_order_label || "").trim();
    const statusHeader = (chrome.col_status || "").trim();
    const viewLabel = (chrome.view_detail_action || "").trim();
    const editLabel = (chrome.edit_channel_action || "").trim();
    const deleteLabel = (chrome.delete_channel_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    return [
      {
        id: "label",
        header: labelHeader,
        cell: (ch: MediaPoolChannel) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{(ch.label || "").trim() || empty}</p>
            {ch.last_error ? (
              <p className="mt-0.5 truncate text-xs text-[var(--dama-danger)]">{ch.last_error}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "channel_id",
        header: channelHeader,
        className: "w-40",
        cell: (ch: MediaPoolChannel) => (
          <span className="font-mono text-xs">{(ch.channel_id || "").trim() || empty}</span>
        ),
      },
      {
        id: "quota",
        header: quotaHeader,
        className: "w-28",
        cell: (ch: MediaPoolChannel) => (
          <span className="text-sm tabular-nums">
            {ch.uploads_today}
            {chrome.quota_ratio_separator}
            {ch.daily_quota_limit}
          </span>
        ),
      },
      ...(sortHeader
        ? [
            {
              id: "sort_order",
              header: sortHeader,
              className: "w-24",
              cell: (ch: MediaPoolChannel) => (
                <span className="text-sm tabular-nums">{ch.sort_order ?? empty}</span>
              ),
            } satisfies OpsColumn<MediaPoolChannel>,
          ]
        : []),
      {
        id: "status",
        header: statusHeader,
        className: "w-28",
        cell: (ch: MediaPoolChannel) => (
          <span className="text-sm">
            {ch.is_active ? chrome.active_status : chrome.inactive_status}
          </span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (ch: MediaPoolChannel) => (
                <button
                  type="button"
                  className="text-left text-sm text-[var(--dama-text)] underline-offset-4 hover:underline"
                  onClick={() => openDetail(ch)}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<MediaPoolChannel>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel || "",
        className: "w-12 text-right",
        cell: (ch: MediaPoolChannel) => (
          <OpsDataTableRowActions
            triggerLabel={(chrome.row_actions_label || "").trim()}
            actions={[
              ...(viewLabel
                ? [{ id: "view", label: viewLabel, onSelect: () => openDetail(ch) }]
                : []),
              ...(editLabel
                ? [{ id: "edit", label: editLabel, onSelect: () => openDetail(ch) }]
                : []),
              {
                id: "test",
                label: (chrome.test_readiness_action || "").trim(),
                pendingLabel: (chrome.test_readiness_pending || "").trim(),
                isLoading: testChannel.isPending && testChannel.variables === ch.id,
                onSelect: () => testChannel.mutate(ch.id),
              },
              {
                id: "toggle",
                label: (
                  (ch.is_active ? chrome.remove_from_pool_action : chrome.restore_to_pool_action) ||
                  ""
                ).trim(),
                pendingLabel: (chrome.status_update_pending || "").trim(),
                destructive: ch.is_active,
                isLoading: setActive.isPending && setActive.variables?.id === ch.id,
                onSelect: () => setActive.mutate({ id: ch.id, active: !ch.is_active }),
              },
              ...(deleteLabel
                ? [
                    {
                      id: "delete",
                      label: deleteLabel,
                      destructive: true,
                      onSelect: () => setDeleteTarget(ch),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, empty, openDetail, setActive, testChannel]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-6">
        <MediaPoolPageSkeleton tab={tab} />
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

  const closeLabel = (chrome.dialog_close_label || "").trim();
  const cancelLabel = (chrome.cancel_action || "").trim();
  const addLabel = (chrome.add_channel_action || "").trim();
  const detailTitle = (chrome.detail_title || "").trim();
  const formReady = Boolean(closeLabel) && Boolean(cancelLabel) && Boolean(addLabel);

  const tabUploadLabel = (chrome.test_upload_title || "").trim();
  const tabChannelsLabel = (chrome.active_pool_title || "").trim();
  const poolTabs = (
    [
      { id: "channels" as const, label: tabChannelsLabel },
      { id: "test_upload" as const, label: tabUploadLabel },
    ] as const
  ).filter((t) => Boolean(t.label));
  const dropzoneChrome = {
    drop_title: (chrome.upload_drop_title || "").trim(),
    drop_hint: (chrome.upload_drop_hint || chrome.upload_file_hint || "").trim(),
    browse_action: (chrome.upload_browse_action || "").trim(),
    replace_action: (chrome.upload_replace_action || "").trim(),
    remove_action: (chrome.upload_remove_action || "").trim(),
    uploading_label: (chrome.upload_uploading_label || chrome.run_upload_pending || "").trim(),
    selected_label: (chrome.upload_selected_label || "").trim(),
  };
  const dropzoneReady = Object.values(dropzoneChrome).every((v) => Boolean(v));
  const uploadSectionFileTitle = (chrome.upload_section_file_title || "").trim();
  const uploadSectionPathTitle = (chrome.upload_section_path_title || "").trim();
  const localPathLabel = (chrome.upload_local_path_label || "").trim();
  const localPathPlaceholder = (chrome.upload_local_path_placeholder || "").trim();
  const localPathBlurb = (chrome.upload_local_path_blurb || "").trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        {isAdmin && !roleLoading && addLabel ? (
          <Button variant="gold" onClick={() => openCreateDialog()}>
            {addLabel}
          </Button>
        ) : null}
      </div>

      {roleLoading ? (
        <MediaPoolBodySkeleton tab={tab} />
      ) : !isAdmin ? (
        <p className="rounded-md border border-[var(--dama-border)] p-4 text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : (
        <>
          {poolTabs.length > 0 ? (
            <div
              role="tablist"
              aria-label={(chrome.page_title || "").trim() || undefined}
              className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
            >
              {poolTabs.map((t) => (
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
          ) : null}

          {tab === "test_upload" ? (
            <section className="space-y-5 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
              <div className="space-y-1">
                <h2 className="font-semibold text-[var(--dama-gold)]">
                  {chrome.test_upload_title}
                </h2>
                {(chrome.upload_file_hint || "").trim() ? (
                  <p className="text-sm text-[var(--dama-muted)]">{chrome.upload_file_hint}</p>
                ) : null}
              </div>
              <Field id="pool-upload-title" label={(chrome.upload_title_label || "").trim()}>
                <Input
                  id="pool-upload-title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={(chrome.upload_title_placeholder || "").trim() || undefined}
                />
              </Field>
              {uploadSectionFileTitle ? (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                  {uploadSectionFileTitle}
                </h3>
              ) : null}
              {dropzoneReady ? (
                <MediaDropzone
                  id="pool-upload-file"
                  label={(chrome.upload_file_label || "").trim()}
                  chrome={dropzoneChrome}
                  accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  busy={uploadFileMutation.isPending}
                  selectedName={uploadFile?.name}
                  invalid={uploadAttempted && !uploadFile}
                  error={
                    uploadAttempted && !uploadFile
                      ? (chrome.err_upload_file_required || "").trim()
                      : undefined
                  }
                  onFile={(file) => {
                    setUploadAttempted(false);
                    setUploadFile(file);
                  }}
                  onClear={() => setUploadFile(null)}
                />
              ) : null}
              <Button
                variant="gold"
                isLoading={uploadFileMutation.isPending}
                pendingLabel={chrome.run_upload_pending}
                onClick={() => {
                  setUploadAttempted(true);
                  if (!uploadTitle.trim()) {
                    const msg = (chrome.upload_title_required || "").trim();
                    if (msg) toast.error(msg);
                    return;
                  }
                  if (!uploadFile) {
                    const msg = (chrome.err_upload_file_required || "").trim();
                    if (msg) toast.error(msg);
                    return;
                  }
                  uploadFileMutation.mutate(
                    {
                      file: uploadFile,
                      title: uploadTitle,
                    },
                    {
                      onSuccess: () => {
                        setUploadFile(null);
                        setUploadAttempted(false);
                      },
                    },
                  );
                }}
              >
                {chrome.run_upload_action}
              </Button>
              {localPathLabel && localPathPlaceholder ? (
                <div className="space-y-3 border-t border-[var(--dama-border)] pt-4">
                  {uploadSectionPathTitle ? (
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                      {uploadSectionPathTitle}
                    </h3>
                  ) : null}
                  {localPathBlurb ? (
                    <p className="text-sm text-[var(--dama-muted)]">{localPathBlurb}</p>
                  ) : null}
                  <Field id="pool-upload-local-path" label={localPathLabel}>
                    <Input
                      id="pool-upload-local-path"
                      className="font-mono text-xs"
                      value={uploadLocalPath}
                      onChange={(e) => setUploadLocalPath(e.target.value)}
                      placeholder={localPathPlaceholder}
                      autoComplete="off"
                    />
                  </Field>
                  <Button
                    variant="outline"
                    disabled={!uploadLocalPath.trim()}
                    isLoading={upload.isPending}
                    pendingLabel={chrome.run_upload_pending}
                    onClick={() => {
                      if (!uploadTitle.trim()) {
                        const msg = (chrome.upload_title_required || "").trim();
                        if (msg) toast.error(msg);
                        return;
                      }
                      upload.mutate({
                        title: uploadTitle,
                        local_path: uploadLocalPath,
                      });
                    }}
                  >
                    {chrome.run_upload_action}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "channels" ? (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                {chrome.active_pool_title}
              </h2>
              {isLoading ? (
                <MediaPoolListSkeleton />
              ) : (
                <>
                  <AdminFilterBar
                    filters={[
                      {
                        kind: "search",
                        id: "admin-pool-search",
                        label: (chrome.search_label || "").trim(),
                        value: poolSearch,
                        onChange: setPoolSearch,
                        placeholder: (chrome.search_placeholder || "").trim() || undefined,
                      },
                      {
                        kind: "select",
                        id: "admin-pool-status",
                        label: (chrome.col_status || "").trim(),
                        value: statusFilter,
                        onChange: setStatusFilter,
                        allLabel: (chrome.filter_all_label || "").trim() || undefined,
                        options: [
                          { value: "active", label: (chrome.active_status || "").trim() },
                          { value: "inactive", label: (chrome.inactive_status || "").trim() },
                        ].filter((o) => Boolean(o.label)),
                      },
                    ]}
                  />
                  <OpsDataTable
                    columns={channelColumns}
                    data={visibleChannels}
                    getRowId={(ch) => ch.id}
                    isFetching={softFetching}
                    empty={<span>{chrome.no_channels}</span>}
                    meta={data?.meta}
                    onPage={(next) => {
                      setSkip(next);
                      setRowSelection({});
                    }}
                    pageDisabled={softFetching || bulkPending}
                    pageInputId="admin-media-pool-skip"
                    bodyRowClassName={(ch) =>
                      ch.is_active ? undefined : "opacity-60 text-[var(--dama-muted)]"
                    }
                    selection={{
                      chrome: {
                        selectAllLabel: (chrome.select_all_label || "").trim(),
                        selectRowLabel: (chrome.select_row_label || "").trim(),
                        selectedCountFmt: (chrome.selected_count_fmt || "").trim(),
                      },
                      rowSelection,
                      onRowSelectionChange: setRowSelection,
                      toolbar: (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="gold"
                            isLoading={bulkPending}
                            pendingLabel={chrome.bulk_status_pending}
                            onClick={() => void bulkSetActive(true)}
                          >
                            {chrome.bulk_activate_action}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={bulkPending}
                            pendingLabel={chrome.bulk_status_pending}
                            onClick={() => void bulkSetActive(false)}
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
                      ),
                    }}
                  />
                </>
              )}
            </section>
          ) : null}
        </>
      )}

      {formReady ? (
        <Dialog open={createDialog.open} onOpenChange={createDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{chrome.register_title}</DialogTitle>
              <DialogDescription>
                {(chrome.quota_hint || chrome.page_blurb || "").trim()}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="pool-channel-id" label={chrome.channel_id_label}>
                <Input
                  id="pool-channel-id"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder={(chrome.channel_id_placeholder || "").trim() || undefined}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-label" label={chrome.label_label}>
                <Input
                  id="pool-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={(chrome.label_placeholder || "").trim() || undefined}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-quota" label={chrome.quota_label}>
                <Input
                  id="pool-quota"
                  type="number"
                  min={1}
                  value={quota}
                  onChange={(e) => setQuota(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={(chrome.quota_placeholder || "").trim() || undefined}
                />
              </Field>
              <Field id="pool-client-id" label={chrome.client_id_label}>
                <Input
                  id="pool-client-id"
                  className="font-mono text-xs"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={(chrome.client_id_placeholder || "").trim() || undefined}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-client-secret" label={chrome.client_secret_label}>
                <Input
                  id="pool-client-secret"
                  type="password"
                  className="font-mono text-xs"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={(chrome.client_secret_placeholder || "").trim() || undefined}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-refresh" label={chrome.refresh_token_label}>
                <Input
                  id="pool-refresh"
                  type="password"
                  className="font-mono text-xs"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder={(chrome.refresh_token_placeholder || "").trim() || undefined}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-api-key" label={chrome.api_key_label} className="sm:col-span-2">
                <Input
                  id="pool-api-key"
                  type="password"
                  className="font-mono text-xs"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={(chrome.api_key_placeholder || "").trim() || undefined}
                  autoComplete="off"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={register.isPending}
                onClick={() => createDialog.close()}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="gold"
                isLoading={register.isPending}
                pendingLabel={chrome.add_channel_pending}
                disabled={!channelId || !label || !quota}
                onClick={() => submitRegister()}
              >
                {addLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {detailLive && detailTitle && closeLabel ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            {(chrome.credentials_optional_blurb || "").trim() ? (
              <p className="text-sm text-[var(--dama-muted)]">
                {chrome.credentials_optional_blurb}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="pool-edit-label" label={chrome.label_label}>
                <Input
                  id="pool-edit-label"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </Field>
              <Field id="pool-edit-channel-id" label={chrome.channel_id_label}>
                <Input
                  id="pool-edit-channel-id"
                  className="font-mono text-xs"
                  value={editChannelId}
                  onChange={(e) => setEditChannelId(e.target.value)}
                />
              </Field>
              <Field
                id="pool-edit-sort-order"
                label={(chrome.sort_order_label || "").trim()}
                description={(chrome.sort_order_hint || "").trim() || undefined}
              >
                <Input
                  id="pool-edit-sort-order"
                  type="number"
                  min={0}
                  step={1}
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                />
              </Field>
              <Field id="pool-edit-quota" label={chrome.quota_label}>
                <Input
                  id="pool-edit-quota"
                  type="number"
                  min={1}
                  value={editQuota}
                  onChange={(e) => setEditQuota(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={chrome.quota_placeholder}
                />
              </Field>
              <div className="min-w-0">
                <p className="text-xs text-[var(--dama-muted)]">{chrome.col_status}</p>
                <p className="text-sm">
                  {(detailLive.is_active ? chrome.active_status : chrome.inactive_status) || empty}
                </p>
              </div>
              {(chrome.col_quota || "").trim() ? (
                <div className="min-w-0">
                  <p className="text-xs text-[var(--dama-muted)]">
                    {chrome.col_quota} {chrome.uploads_today_suffix}
                  </p>
                  <p className="text-sm tabular-nums">
                    {detailLive.uploads_today}
                    {chrome.quota_ratio_separator}
                    {detailLive.daily_quota_limit}
                  </p>
                </div>
              ) : null}
              <Field id="pool-edit-client-id" label={chrome.client_id_label}>
                <Input
                  id="pool-edit-client-id"
                  className="font-mono text-xs"
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  autoComplete="off"
                  placeholder={chrome.credentials_optional_blurb}
                />
              </Field>
              <Field id="pool-edit-client-secret" label={chrome.client_secret_label}>
                <Input
                  id="pool-edit-client-secret"
                  type="password"
                  className="font-mono text-xs"
                  value={editClientSecret}
                  onChange={(e) => setEditClientSecret(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-edit-refresh" label={chrome.refresh_token_label}>
                <Input
                  id="pool-edit-refresh"
                  type="password"
                  className="font-mono text-xs"
                  value={editRefreshToken}
                  onChange={(e) => setEditRefreshToken(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field id="pool-edit-api-key" label={chrome.api_key_label} className="sm:col-span-2">
                <Input
                  id="pool-edit-api-key"
                  type="password"
                  className="font-mono text-xs"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              {(chrome.last_error_label || "").trim() ? (
                <div className="min-w-0 sm:col-span-2">
                  <p className="text-xs text-[var(--dama-muted)]">{chrome.last_error_label}</p>
                  <p className="text-sm text-[var(--dama-danger)]">
                    {(detailLive.last_error || "").trim() || empty}
                  </p>
                </div>
              ) : null}
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  isLoading={testChannel.isPending && testChannel.variables === detailLive.id}
                  pendingLabel={chrome.test_readiness_pending}
                  onClick={() => testChannel.mutate(detailLive.id)}
                >
                  {chrome.test_readiness_action}
                </Button>
                <Button
                  type="button"
                  variant={detailLive.is_active ? "outline" : "gold"}
                  isLoading={setActive.isPending && setActive.variables?.id === detailLive.id}
                  pendingLabel={chrome.status_update_pending}
                  onClick={() =>
                    setActive.mutate({ id: detailLive.id, active: !detailLive.is_active })
                  }
                >
                  {detailLive.is_active
                    ? chrome.remove_from_pool_action
                    : chrome.restore_to_pool_action}
                </Button>
                {(chrome.delete_channel_action || "").trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[var(--dama-danger)]"
                    onClick={() => setDeleteTarget(detailLive)}
                  >
                    {chrome.delete_channel_action}
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {cancelLabel ? (
                  <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                    {cancelLabel}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="gold"
                  isLoading={updateChannel.isPending}
                  pendingLabel={chrome.add_channel_pending}
                  disabled={!editLabel.trim() || !editChannelId.trim() || !editQuota.trim()}
                  onClick={() => submitChannelUpdate()}
                >
                  {(chrome.save_channel_action || "").trim() ||
                    (chrome.edit_channel_action || "").trim()}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={(chrome.delete_channel_action || "").trim()}
        description={(chrome.delete_channel_confirm || "").trim()}
        cancelLabel={cancelLabel}
        confirmLabel={(chrome.delete_channel_action || "").trim()}
        pendingLabel={(chrome.status_update_pending || "").trim()}
        isPending={deleteChannel.isPending}
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteChannel.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null);
              if (detailLive?.id === deleteTarget.id) {
                detailDialog.close();
              }
            },
          });
        }}
      />
    </div>
  );
}
