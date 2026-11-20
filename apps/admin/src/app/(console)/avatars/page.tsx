"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { MediaProofGallery } from "@/components/media/MediaProofGallery";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
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
import { AvatarsModerationSkeleton } from "@/components/ui/shimmer-skeletons";
import { useModerateAvatarMutation, useSaveModerationSettingsMutation } from "@/hooks/mutation";
import {
  useAdminAvatarsQuery,
  useAdminConsoleChromeQuery,
  useModerationSettingsQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { CountryFlag } from "@/lib/country-flag";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { AvatarRow } from "@/types/console";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function AdminAvatarsPage() {
  const token = useAuthStore((s) => s.token);
  const searchParams = useSearchParams();
  const focusUserId = (searchParams.get("user") || "").trim();
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data.avatars : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);

  const [skip, setSkip] = useUrlSkip("skip");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [avatarSearch, setAvatarSearch] = useState("");
  const debouncedAvatarSearch = useDebouncedValue(avatarSearch.trim(), 250);
  // GET /console/avatars supports `q` (username or user id); do not conflate URL focus with search.
  const avatarsQuery = useAdminAvatarsQuery(
    token,
    isAdmin && pageSize > 0,
    skip,
    pageSize,
    debouncedAvatarSearch,
  );

  useEffect(() => {
    if (!focusUserId) return;
    setSkip(0);
    setAvatarSearch(focusUserId);
  }, [focusUserId, setSkip]);

  useResetSkipOnChange(setSkip, [debouncedAvatarSearch]);

  useEffect(() => {
    if (!focusUserId) return;
    void avatarsQuery.data;
    const el = document.getElementById(`admin-focus-${focusUserId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusUserId, avatarsQuery.data]);

  const settingsQuery = useModerationSettingsQuery(token, isAdmin);
  const moderate = useModerateAvatarMutation(token);
  const saveSettings = useSaveModerationSettingsMutation(token);
  const pageLoading = isAdmin && (avatarsQuery.isLoading || settingsQuery.isLoading);
  const softFetching = avatarsQuery.isFetching && !avatarsQuery.isLoading;
  const pageAvatars = avatarsQuery.data?.avatars ?? [];
  const detailDialog = useDeferredDialogValue<AvatarRow>();
  const openDetail = useCallback(
    (row: AvatarRow) => detailDialog.openWith(row),
    [detailDialog.openWith],
  );
  const detailLive = useMemo(() => {
    if (!detailDialog.value) return null;
    return pageAvatars.find((r) => r.id === detailDialog.value?.id) ?? detailDialog.value;
  }, [detailDialog.value, pageAvatars]);

  async function bulkApprove() {
    const ids = selectedRowIds(rowSelection);
    if (!ids.length || !chrome) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        await moderate.mutateAsync({ id, action: "approve" });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  const empty = (chrome?.empty_value || "").trim();
  const idLabel = (chrome?.detail_id_label || "").trim();
  const proofCaption = (chrome?.thumbnail_label || "").trim();

  const columns = useMemo((): OpsColumn<AvatarRow>[] => {
    if (!chrome) return [];
    const userHeader = (chrome.col_user || "").trim();
    const ratingHeader = (chrome.col_rating || "").trim();
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.row_actions_label || "").trim();
    return [
      {
        id: "user",
        header: userHeader,
        cell: (row: AvatarRow) => (
          <div
            id={`admin-focus-${row.id}`}
            className={
              focusUserId === row.id
                ? "flex items-center gap-3 rounded-md ring-2 ring-[var(--dama-gold)] ring-offset-2 ring-offset-[var(--dama-card)]"
                : "flex items-center gap-3"
            }
          >
            <DamaUserAvatar
              src={
                resolvePublicMediaUrl(row.avatar_thumb_url) ||
                resolvePublicMediaUrl(row.avatar_full_url) ||
                undefined
              }
              className="h-12 w-12 rounded-md"
            />
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="truncate">{(row.username || "").trim() || empty}</span>
                <CountryFlag code={row.country_code} />
              </p>
              {idLabel ? (
                <p className="truncate text-xs text-[var(--dama-muted)]" title={idLabel}>
                  {(row.id || "").trim() || empty}
                </p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "rating",
        header: ratingHeader,
        className: "w-24",
        cell: (row: AvatarRow) => (
          <span className="text-sm tabular-nums">{row.rating != null ? row.rating : empty}</span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (row: AvatarRow) => (
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline"
                  onClick={() => openDetail(row)}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<AvatarRow>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel || "",
        className: "w-12 text-right",
        cell: (row: AvatarRow) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              ...(viewLabel
                ? [{ id: "view", label: viewLabel, onSelect: () => openDetail(row) }]
                : []),
              {
                id: "approve",
                label: (chrome.approve_action || "").trim(),
                pendingLabel: (chrome.approve_pending || "").trim(),
                isLoading:
                  moderate.isPending &&
                  moderate.variables?.id === row.id &&
                  moderate.variables.action === "approve",
                onSelect: () => moderate.mutate({ id: row.id, action: "approve" }),
              },
              {
                id: "flag",
                label: (chrome.flag_action || "").trim(),
                pendingLabel: (chrome.flag_pending || "").trim(),
                isLoading:
                  moderate.isPending &&
                  moderate.variables?.id === row.id &&
                  moderate.variables.action === "flag",
                onSelect: () => moderate.mutate({ id: row.id, action: "flag" }),
              },
              {
                id: "reset",
                label: (chrome.reset_action || "").trim(),
                pendingLabel: (chrome.reset_pending || "").trim(),
                destructive: true,
                isLoading:
                  moderate.isPending &&
                  moderate.variables?.id === row.id &&
                  moderate.variables.action === "reset",
                onSelect: () => moderate.mutate({ id: row.id, action: "reset" }),
              },
            ]}
          />
        ),
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, empty, focusUserId, idLabel, moderate, openDetail]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <AvatarsModerationSkeleton />
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

  const detailTitle = (chrome.detail_title || "").trim();
  const closeLabel = (chrome.dialog_close_label || "").trim();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
      </div>

      {roleLoading ? (
        <AvatarsModerationSkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <AvatarsModerationSkeleton />
      ) : (
        <>
          <section className="space-y-3 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.rules_title}
            </h2>
            {settingsQuery.error || !settingsQuery.data ? (
              <p className="text-sm text-[var(--dama-danger)]">{chrome.config_unavailable}</p>
            ) : (
              <>
                <p className="text-sm text-[var(--dama-muted)]">
                  {chrome.provider_prefix}{" "}
                  <span className="font-mono text-[var(--dama-text)]">
                    {settingsQuery.data.provider}
                  </span>{" "}
                  {settingsQuery.data.enabled ? chrome.enabled_suffix : chrome.disabled_suffix}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={
                      settingsQuery.data.provider === "auto_review" && settingsQuery.data.enabled
                        ? "gold"
                        : "outline"
                    }
                    isLoading={saveSettings.isPending}
                    pendingLabel={chrome.moderation_settings_pending}
                    onClick={() => saveSettings.mutate({ provider: "auto_review", enabled: true })}
                  >
                    {chrome.auto_review_action}
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      settingsQuery.data.provider === "manual_review" || !settingsQuery.data.enabled
                        ? "gold"
                        : "outline"
                    }
                    isLoading={saveSettings.isPending}
                    pendingLabel={chrome.moderation_settings_pending}
                    onClick={() =>
                      saveSettings.mutate({ provider: "manual_review", enabled: false })
                    }
                  >
                    {chrome.manual_review_action}
                  </Button>
                </div>
              </>
            )}
          </section>

          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-avatars-search",
                label: (chrome.search_label || "").trim(),
                value: avatarSearch,
                onChange: setAvatarSearch,
                placeholder: (chrome.search_placeholder || "").trim() || undefined,
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageAvatars}
            getRowId={(row) => row.id}
            isFetching={softFetching}
            meta={avatarsQuery.data?.meta}
            onPage={(next) => {
              setSkip(next);
              setRowSelection({});
            }}
            pageDisabled={softFetching || bulkPending}
            pageInputId="admin-avatars-skip"
            empty={<span>{chrome.no_pending}</span>}
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
                    pendingLabel={chrome.bulk_approve_pending}
                    onClick={() => void bulkApprove()}
                  >
                    {chrome.bulk_approve_action}
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

      {detailLive && detailTitle && closeLabel ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-lg sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {proofCaption ? (
                <MediaProofGallery
                  slides={[
                    {
                      src: detailLive.avatar_full_url || detailLive.avatar_thumb_url || "",
                      caption: proofCaption,
                    },
                    ...(detailLive.avatar_thumb_url &&
                    detailLive.avatar_full_url &&
                    detailLive.avatar_thumb_url !== detailLive.avatar_full_url
                      ? [
                          {
                            src: detailLive.avatar_thumb_url,
                            caption: proofCaption,
                          },
                        ]
                      : []),
                  ]}
                />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 sm:col-span-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{(detailLive.username || "").trim() || empty}</span>
                    <CountryFlag code={detailLive.country_code} />
                  </p>
                  {idLabel ? (
                    <div className="mt-2 min-w-0">
                      <p className="text-xs text-[var(--dama-muted)]">{idLabel}</p>
                      <p className="truncate text-xs font-medium">
                        {(detailLive.id || "").trim() || empty}
                      </p>
                    </div>
                  ) : null}
                </div>
                {(chrome.col_rating || "").trim() ? (
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--dama-muted)]">{chrome.col_rating}</p>
                    <p className="text-sm tabular-nums">
                      {detailLive.rating != null ? detailLive.rating : empty}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="gold"
                isLoading={
                  moderate.isPending &&
                  moderate.variables?.id === detailLive.id &&
                  moderate.variables.action === "approve"
                }
                pendingLabel={chrome.approve_pending}
                onClick={() => moderate.mutate({ id: detailLive.id, action: "approve" })}
              >
                {chrome.approve_action}
              </Button>
              <Button
                type="button"
                variant="outline"
                isLoading={
                  moderate.isPending &&
                  moderate.variables?.id === detailLive.id &&
                  moderate.variables.action === "flag"
                }
                pendingLabel={chrome.flag_pending}
                onClick={() => moderate.mutate({ id: detailLive.id, action: "flag" })}
              >
                {chrome.flag_action}
              </Button>
              {(chrome.cancel_action || "").trim() ? (
                <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                  {chrome.cancel_action}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
