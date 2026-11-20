"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { MediaProofGallery } from "@/components/media/MediaProofGallery";
import { Button } from "@/components/ui/button";
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
import { PaymentsKycBodySkeleton, PaymentsKycSkeleton } from "@/components/ui/shimmer-skeletons";
import { useReviewKycMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useAdminKycQuery,
  useCashRmgPublicChromeQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/parse-search-debounce-ms";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { ConsoleKycSubmission } from "@/types/console";
import { useEffect, useMemo, useState } from "react";

export default function AdminPaymentsKycPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const searchDebounceMs = parseSearchDebounceMs(chrome?.search_debounce_ms);

  const policyQuery = useCashRmgPublicChromeQuery(Boolean(isAdmin));
  const policy = policyQuery.data?.policy;
  const cashChrome = policyQuery.data?.chrome;

  const pendingStatus = (policy?.document_kyc_pending_status || "").trim();
  const approvedStatus = (policy?.document_kyc_approved_status || "").trim();
  const rejectedStatus = (policy?.document_kyc_rejected_status || "").trim();

  const [skip, setSkip] = useUrlSkip("skip");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const searchQ = useDebouncedValue(searchDraft.trim(), searchDebounceMs);
  const [reviewNote, setReviewNote] = useState("");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);

  const detailDialog = useDeferredDialogValue<ConsoleKycSubmission>();
  const review = useReviewKycMutation(token);

  async function bulkKyc(status: string) {
    const ids = selectedRowIds(rowSelection);
    const st = (status || "").trim();
    if (!ids.length || !st) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        await review.mutateAsync({ id, status: st, note: "" });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  useEffect(() => {
    if (!pendingStatus) return;
    setStatusFilter((prev) => (prev ? prev : pendingStatus));
  }, [pendingStatus]);

  useResetSkipOnChange(setSkip, [statusFilter, searchQ]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [statusFilter, searchQ, skip]);

  const listQuery = useAdminKycQuery(
    token,
    isAdmin && pageSize > 0 && Boolean(statusFilter),
    skip,
    pageSize,
    statusFilter,
    searchQ,
  );

  const empty = (chrome?.empty_value || "").trim();
  const softFetching = listQuery.isFetching && !listQuery.isLoading;
  const pageRows = listQuery.data?.submissions ?? [];

  const columns = useMemo((): OpsColumn<ConsoleKycSubmission>[] => {
    if (!chrome) return [];
    const actionsLabel = (chrome.actions_label || "").trim();
    const statusLabel = (code: string): string => {
      if (code === pendingStatus) return (chrome.doc_kyc_history_pending || "").trim() || empty;
      if (code === approvedStatus) return (chrome.doc_kyc_history_approved || "").trim() || empty;
      if (code === rejectedStatus) return (chrome.doc_kyc_history_rejected || "").trim() || empty;
      return empty;
    };
    const typeLabel = (code: string): string => {
      const raw = (code || "").trim();
      if (!raw) return empty;
      return (cashChrome?.[`doc_kyc_type_${raw}`] || "").trim() || empty;
    };
    return [
      {
        id: "user",
        header: (chrome.doc_kyc_col_user || "").trim(),
        cell: (k: ConsoleKycSubmission) => (
          <span className="text-sm">{(k.username || "").trim() || empty}</span>
        ),
      },
      {
        id: "type",
        header: (chrome.doc_kyc_col_type || "").trim(),
        cell: (k: ConsoleKycSubmission) => (
          <span className="text-sm">{typeLabel(k.document_type)}</span>
        ),
      },
      {
        id: "name",
        header: (chrome.doc_kyc_col_name || "").trim(),
        cell: (k: ConsoleKycSubmission) => (
          <span className="text-sm">{(k.legal_name || "").trim() || empty}</span>
        ),
      },
      {
        id: "status",
        header: (chrome.doc_kyc_col_status || "").trim(),
        cell: (k: ConsoleKycSubmission) => (
          <span className="text-sm text-[var(--dama-muted)]">{statusLabel(k.status)}</span>
        ),
      },
      {
        id: "when",
        header: (chrome.doc_kyc_col_when || "").trim(),
        className: "w-40",
        cell: (k: ConsoleKycSubmission) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {k.created_at ? new Date(k.created_at).toLocaleString() : empty}
          </span>
        ),
      },
      {
        id: "actions",
        header: (chrome.doc_kyc_col_actions || "").trim(),
        className: "w-12 text-right",
        cell: (k: ConsoleKycSubmission) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              {
                id: "view",
                label: (chrome.doc_kyc_view_detail || "").trim(),
                onSelect: () => {
                  setReviewNote("");
                  detailDialog.openWith(k);
                },
              },
            ]}
          />
        ),
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [approvedStatus, cashChrome, chrome, detailDialog, empty, pendingStatus, rejectedStatus]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsKycSkeleton />
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

  const closeLabel = (chrome.doc_kyc_detail_close || "").trim();
  const detailTitle = (chrome.doc_kyc_detail_title || "").trim();
  const detail = detailDialog.value;
  const canReview = Boolean(detail && pendingStatus && detail.status === pendingStatus);
  const reviewBusy = review.isPending;
  const pageLoading =
    roleLoading || (isAdmin && (policyQuery.isLoading || !statusFilter || listQuery.isLoading));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.kyc_page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.kyc_page_blurb}</p>
      </div>

      {roleLoading ? (
        <PaymentsKycBodySkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsKycBodySkeleton />
      ) : (
        <>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-kyc-search",
                label: (chrome.search_label || "").trim(),
                placeholder: (chrome.search_placeholder || "").trim(),
                value: searchDraft,
                onChange: setSearchDraft,
              },
              {
                kind: "select",
                id: "admin-kyc-status",
                label: (chrome.doc_kyc_filter_label || "").trim(),
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  {
                    value: pendingStatus,
                    label: (chrome.doc_kyc_history_pending || "").trim(),
                  },
                  {
                    value: approvedStatus,
                    label: (chrome.doc_kyc_history_approved || "").trim(),
                  },
                  {
                    value: rejectedStatus,
                    label: (chrome.doc_kyc_history_rejected || "").trim(),
                  },
                  {
                    value: "all",
                    label: (chrome.doc_kyc_history_all || "").trim(),
                  },
                ].filter((o) => Boolean(o.value) && Boolean(o.label)),
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageRows}
            getRowId={(k) => k.id}
            isFetching={softFetching}
            meta={listQuery.data?.meta}
            onPage={setSkip}
            pageDisabled={softFetching || reviewBusy || bulkPending}
            pageInputId="admin-kyc-skip"
            empty={
              (chrome.doc_kyc_empty || "").trim() ? (
                <p className="py-8 text-center text-sm text-[var(--dama-muted)]">
                  {chrome.doc_kyc_empty}
                </p>
              ) : undefined
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
                  {pendingStatus &&
                  statusFilter === pendingStatus &&
                  approvedStatus &&
                  (chrome.doc_kyc_approve_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.doc_kyc_approve_pending || "").trim()}
                      onClick={() => void bulkKyc(approvedStatus)}
                    >
                      {(chrome.doc_kyc_approve_action || "").trim()}
                    </Button>
                  ) : null}
                  {pendingStatus &&
                  statusFilter === pendingStatus &&
                  rejectedStatus &&
                  (chrome.doc_kyc_reject_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.doc_kyc_reject_pending || "").trim()}
                      onClick={() => void bulkKyc(rejectedStatus)}
                    >
                      {(chrome.doc_kyc_reject_action || "").trim()}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending}
                    onClick={() => setRowSelection({})}
                  >
                    {(chrome.clear_selection_action || "").trim()}
                  </Button>
                </div>
              ),
            }}
          />
        </>
      )}

      {closeLabel && detailTitle ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-3xl sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            {detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.doc_kyc_col_user}
                    </p>
                    <p>{(detail.username || "").trim() || empty}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.doc_kyc_col_type}
                    </p>
                    <p>
                      {(
                        cashChrome?.[`doc_kyc_type_${(detail.document_type || "").trim()}`] || empty
                      ).toString()}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.doc_kyc_col_name}
                    </p>
                    <p>{(detail.legal_name || "").trim() || empty}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.doc_kyc_col_status}
                    </p>
                    <p>
                      {detail.status === pendingStatus
                        ? (chrome.doc_kyc_history_pending || "").trim() || empty
                        : detail.status === approvedStatus
                          ? (chrome.doc_kyc_history_approved || "").trim() || empty
                          : detail.status === rejectedStatus
                            ? (chrome.doc_kyc_history_rejected || "").trim() || empty
                            : empty}
                    </p>
                  </div>
                  {(chrome.doc_kyc_col_when || "").trim() ? (
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.doc_kyc_col_when}
                      </p>
                      <p>
                        {detail.created_at ? new Date(detail.created_at).toLocaleString() : empty}
                      </p>
                    </div>
                  ) : null}
                  {!canReview && (detail.reviewed_at || "").trim() ? (
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.payout_reviewed_at_prefix}
                      </p>
                      <p>{new Date((detail.reviewed_at || "").trim()).toLocaleString()}</p>
                    </div>
                  ) : null}
                  {!canReview && (detail.review_note || "").trim() ? (
                    <div className="space-y-1 text-sm sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.doc_kyc_review_note_label}
                      </p>
                      <p>{detail.review_note}</p>
                    </div>
                  ) : null}
                </div>
                <MediaProofGallery
                  slides={[
                    {
                      src: detail.id_front_url,
                      caption: chrome.doc_kyc_front_caption || "",
                    },
                    {
                      src: detail.id_back_url || "",
                      caption: chrome.doc_kyc_back_caption || "",
                    },
                    {
                      src: detail.selfie_url,
                      caption: chrome.doc_kyc_selfie_caption || "",
                    },
                  ]}
                />
                {canReview ? (
                  <Field id="admin-kyc-review-note" label={chrome.doc_kyc_review_note_label}>
                    <Input
                      id="admin-kyc-review-note"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      disabled={reviewBusy}
                    />
                  </Field>
                ) : null}
              </>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={reviewBusy}
                onClick={() => detailDialog.close()}
              >
                {closeLabel}
              </Button>
              {canReview && approvedStatus ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={reviewBusy && review.variables?.status === approvedStatus}
                  pendingLabel={(chrome.doc_kyc_approve_pending || "").trim()}
                  disabled={reviewBusy}
                  onClick={() => {
                    if (!detail) return;
                    review.mutate(
                      { id: detail.id, status: approvedStatus, note: reviewNote },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {chrome.doc_kyc_approve_action}
                </Button>
              ) : null}
              {canReview && rejectedStatus ? (
                <Button
                  type="button"
                  variant="outline"
                  isLoading={reviewBusy && review.variables?.status === rejectedStatus}
                  pendingLabel={(chrome.doc_kyc_reject_pending || "").trim()}
                  disabled={reviewBusy}
                  onClick={() => {
                    if (!detail) return;
                    review.mutate(
                      { id: detail.id, status: rejectedStatus, note: reviewNote },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {chrome.doc_kyc_reject_action}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
