"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
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
import {
  PaymentsPayoutsBodySkeleton,
  PaymentsPayoutsSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useReviewPayoutMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useAdminPayoutsQuery,
  useCashRmgPublicChromeQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { paidStatusTextClass } from "@/lib/payment-status-display";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/parse-search-debounce-ms";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { ConsolePayout } from "@/types/console";
import { useEffect, useMemo, useState } from "react";

export default function AdminPaymentsPayoutsPage() {
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
  const approvable = (policy?.approvable_payout_status || "").trim();
  const approved = (policy?.approved_payout_status || "").trim();
  const rejected = (policy?.rejected_payout_status || "").trim();
  const paid = (policy?.paid_payout_status || "").trim();
  const policyReady = Boolean(approvable && approved && rejected && paid);

  const [skip, setSkip] = useUrlSkip("skip");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const searchQ = useDebouncedValue(searchDraft.trim(), searchDebounceMs);
  const [reviewNote, setReviewNote] = useState("");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);

  const detailDialog = useDeferredDialogValue<ConsolePayout>();
  const review = useReviewPayoutMutation(token);

  async function bulkPayouts(status: string) {
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
    if (!approvable) return;
    setStatusFilter((prev) => (prev ? prev : approvable));
  }, [approvable]);

  useResetSkipOnChange(setSkip, [statusFilter, searchQ]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [statusFilter, searchQ, skip]);

  const listQuery = useAdminPayoutsQuery(
    token,
    isAdmin && pageSize > 0 && policyReady,
    skip,
    pageSize,
    statusFilter,
    searchQ,
  );

  const empty = (chrome?.empty_value || "").trim();
  const softFetching = listQuery.isFetching && !listQuery.isLoading;
  const pageRows = listQuery.data?.payouts ?? [];

  const columns = useMemo((): OpsColumn<ConsolePayout>[] => {
    if (!chrome || !policyReady) return [];
    const sep =
      typeof chrome.amount_currency_separator === "string" ? chrome.amount_currency_separator : "";
    const statusLabel = (code: string): string => {
      if (code === approvable) return (chrome.payout_history_pending || "").trim() || empty;
      if (code === approved) return (chrome.payout_history_approved || "").trim() || empty;
      if (code === rejected) return (chrome.payout_history_rejected || "").trim() || empty;
      if (code === paid) return (chrome.payout_history_paid || "").trim() || empty;
      return empty;
    };
    const formatAmount = (amount: number, currency: string): string => {
      if (!Number.isFinite(amount) || !(currency || "").trim() || sep.length === 0) return empty;
      return `${amount}${sep}${currency}`;
    };
    const actionsLabel = (chrome.actions_label || "").trim();
    return [
      {
        id: "user",
        header: (chrome.payout_col_user || "").trim(),
        cell: (p: ConsolePayout) => (
          <span className="text-sm">{(p.username || "").trim() || empty}</span>
        ),
      },
      {
        id: "amount",
        header: (chrome.payout_col_amount || "").trim(),
        cell: (p: ConsolePayout) => (
          <span className="font-medium tabular-nums text-[var(--dama-gold)]">
            {formatAmount(p.amount, p.currency)}
          </span>
        ),
      },
      {
        id: "status",
        header: (chrome.payout_col_status || "").trim(),
        cell: (p: ConsolePayout) => (
          <span className={`text-sm ${paidStatusTextClass((p.status || "").trim())}`}>
            {statusLabel(p.status)}
          </span>
        ),
      },
      {
        id: "phone",
        header: (chrome.payout_col_phone || "").trim(),
        cell: (p: ConsolePayout) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(p.phone || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "provider",
        header: (chrome.payout_col_provider || "").trim(),
        cell: (p: ConsolePayout) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(p.provider || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "when",
        header: (chrome.payout_col_when || "").trim(),
        cell: (p: ConsolePayout) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(p.created_at || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "actions",
        header: (chrome.actions_label || "").trim(),
        className: "w-12 text-right",
        cell: (p: ConsolePayout) => {
          const busy = review.isPending && review.variables?.id === p.id;
          return (
            <OpsDataTableRowActions
              triggerLabel={actionsLabel}
              actions={[
                {
                  id: "view",
                  label: (chrome.payout_view_detail || "").trim(),
                  onSelect: () => {
                    setReviewNote((p.review_note || "").trim());
                    detailDialog.openWith(p);
                  },
                },
                ...(p.status === approvable
                  ? [
                      {
                        id: "approve",
                        label: (chrome.payout_approve_action || "").trim(),
                        pendingLabel: (chrome.payout_approve_pending || "").trim(),
                        isLoading: busy && review.variables?.status === approved,
                        onSelect: () => review.mutate({ id: p.id, status: approved, note: "" }),
                      },
                      {
                        id: "reject",
                        label: (chrome.payout_reject_action || "").trim(),
                        pendingLabel: (chrome.payout_reject_pending || "").trim(),
                        destructive: true,
                        isLoading: busy && review.variables?.status === rejected,
                        onSelect: () => review.mutate({ id: p.id, status: rejected, note: "" }),
                      },
                    ]
                  : []),
                ...(p.status === approved
                  ? [
                      {
                        id: "paid",
                        label: (chrome.payout_mark_paid_action || "").trim(),
                        pendingLabel: (chrome.payout_mark_paid_pending || "").trim(),
                        isLoading: busy && review.variables?.status === paid,
                        onSelect: () => review.mutate({ id: p.id, status: paid, note: "" }),
                      },
                    ]
                  : []),
              ].filter((a) => Boolean(a.label))}
            />
          );
        },
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, policyReady, empty, approvable, approved, rejected, paid, review, detailDialog]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsPayoutsSkeleton />
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

  const closeLabel = (chrome.payout_detail_close || "").trim();
  const detailTitle = (chrome.payout_detail_title || "").trim();
  const detail = detailDialog.value;
  const canReview = Boolean(detail && policyReady && approvable && detail.status === approvable);
  const canMarkPaid = Boolean(detail && policyReady && approved && detail.status === approved);
  const reviewBusy = review.isPending;
  const pageLoading = roleLoading || (isAdmin && (policyQuery.isLoading || listQuery.isLoading));

  const statusLabel = (code: string): string => {
    if (code === approvable) return (chrome.payout_history_pending || "").trim() || empty;
    if (code === approved) return (chrome.payout_history_approved || "").trim() || empty;
    if (code === rejected) return (chrome.payout_history_rejected || "").trim() || empty;
    if (code === paid) return (chrome.payout_history_paid || "").trim() || empty;
    return empty;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.payouts_page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.payouts_page_blurb}</p>
      </div>

      {roleLoading ? (
        <PaymentsPayoutsBodySkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsPayoutsBodySkeleton />
      ) : !policyReady ? (
        <p className="text-sm text-[var(--dama-muted)]">{chrome.payouts_empty}</p>
      ) : (
        <>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-payouts-search",
                label: (chrome.search_label || "").trim(),
                placeholder: (chrome.search_placeholder || "").trim(),
                value: searchDraft,
                onChange: setSearchDraft,
              },
              {
                kind: "select",
                id: "admin-payouts-status",
                label: (chrome.payout_col_status || "").trim(),
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  {
                    value: approvable,
                    label: (chrome.payout_history_pending || "").trim(),
                  },
                  {
                    value: approved,
                    label: (chrome.payout_history_approved || "").trim(),
                  },
                  {
                    value: rejected,
                    label: (chrome.payout_history_rejected || "").trim(),
                  },
                  {
                    value: paid,
                    label: (chrome.payout_history_paid || "").trim(),
                  },
                ].filter((o) => Boolean(o.value) && Boolean(o.label)),
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageRows}
            getRowId={(p) => p.id}
            isFetching={softFetching}
            meta={listQuery.data?.meta}
            onPage={setSkip}
            pageDisabled={softFetching || reviewBusy || bulkPending}
            pageInputId="admin-payouts-skip"
            empty={
              (chrome.payouts_empty || "").trim() ? (
                <p className="py-8 text-center text-sm text-[var(--dama-muted)]">
                  {chrome.payouts_empty}
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
                  {approvable &&
                  statusFilter === approvable &&
                  (chrome.payout_approve_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.payout_approve_pending || "").trim()}
                      onClick={() => void bulkPayouts(approved)}
                    >
                      {(chrome.payout_approve_action || "").trim()}
                    </Button>
                  ) : null}
                  {approvable &&
                  statusFilter === approvable &&
                  (chrome.payout_reject_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.payout_reject_pending || "").trim()}
                      onClick={() => void bulkPayouts(rejected)}
                    >
                      {(chrome.payout_reject_action || "").trim()}
                    </Button>
                  ) : null}
                  {approved &&
                  statusFilter === approved &&
                  (chrome.payout_mark_paid_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.payout_mark_paid_pending || "").trim()}
                      onClick={() => void bulkPayouts(paid)}
                    >
                      {(chrome.payout_mark_paid_action || "").trim()}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
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
        <Dialog
          open={detailDialog.open}
          onOpenChange={(open) => {
            if (!open) setReviewNote("");
            detailDialog.onOpenChange(open);
          }}
        >
          <DialogContent closeLabel={closeLabel} className="max-w-lg sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            {detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(chrome.detail_id_label || "").trim() ? (
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.detail_id_label}
                      </p>
                      <p className="break-all font-mono text-xs">
                        {(detail.id || "").trim() || empty}
                      </p>
                    </div>
                  ) : null}
                  {(chrome.detail_user_id_label || "").trim() ? (
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.detail_user_id_label}
                      </p>
                      <p className="break-all font-mono text-xs">
                        {(detail.user_id || "").trim() || empty}
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.payout_col_user}
                    </p>
                    <p>{(detail.username || "").trim() || empty}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.payout_col_amount}
                    </p>
                    <p className="font-medium tabular-nums text-[var(--dama-gold)]">
                      {typeof detail.amount === "number" &&
                      (detail.currency || "").trim() &&
                      (chrome.amount_currency_separator || "").length > 0
                        ? `${detail.amount}${chrome.amount_currency_separator}${detail.currency}`
                        : empty}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.payout_col_status}
                    </p>
                    <p className={paidStatusTextClass((detail.status || "").trim())}>
                      {statusLabel(detail.status)}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.payout_col_phone}
                    </p>
                    <p>{(detail.phone || "").trim() || empty}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.payout_col_provider}
                    </p>
                    <p>{(detail.provider || "").trim() || empty}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                      {chrome.payout_col_when}
                    </p>
                    <p>{(detail.created_at || "").trim() || empty}</p>
                  </div>
                  {(detail.reviewed_at || "").trim() ? (
                    <div className="space-y-1 text-sm sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.payout_reviewed_at_prefix}
                      </p>
                      <p>{detail.reviewed_at}</p>
                    </div>
                  ) : null}
                  {(detail.review_note || "").trim() && !canReview ? (
                    <div className="space-y-1 text-sm sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                        {chrome.payout_note_prefix}
                      </p>
                      <p>{detail.review_note}</p>
                    </div>
                  ) : null}
                </div>
                {canReview || canMarkPaid ? (
                  <Field id="admin-payout-detail-note" label={chrome.payout_review_note_label}>
                    <Input
                      id="admin-payout-detail-note"
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
                onClick={() => {
                  setReviewNote("");
                  detailDialog.close();
                }}
              >
                {closeLabel}
              </Button>
              {canReview && approved ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={reviewBusy && review.variables?.status === approved}
                  pendingLabel={(chrome.payout_approve_pending || "").trim()}
                  disabled={reviewBusy}
                  onClick={() => {
                    if (!detail) return;
                    review.mutate(
                      { id: detail.id, status: approved, note: reviewNote },
                      {
                        onSuccess: () => {
                          setReviewNote("");
                          detailDialog.close();
                        },
                      },
                    );
                  }}
                >
                  {chrome.payout_approve_action}
                </Button>
              ) : null}
              {canReview && rejected ? (
                <Button
                  type="button"
                  variant="outline"
                  isLoading={reviewBusy && review.variables?.status === rejected}
                  pendingLabel={(chrome.payout_reject_pending || "").trim()}
                  disabled={reviewBusy}
                  onClick={() => {
                    if (!detail) return;
                    review.mutate(
                      { id: detail.id, status: rejected, note: reviewNote },
                      {
                        onSuccess: () => {
                          setReviewNote("");
                          detailDialog.close();
                        },
                      },
                    );
                  }}
                >
                  {chrome.payout_reject_action}
                </Button>
              ) : null}
              {canMarkPaid && paid ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={reviewBusy && review.variables?.status === paid}
                  pendingLabel={(chrome.payout_mark_paid_pending || "").trim()}
                  disabled={reviewBusy}
                  onClick={() => {
                    if (!detail) return;
                    review.mutate(
                      { id: detail.id, status: paid, note: reviewNote },
                      {
                        onSuccess: () => {
                          setReviewNote("");
                          detailDialog.close();
                        },
                      },
                    );
                  }}
                >
                  {chrome.payout_mark_paid_action}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
