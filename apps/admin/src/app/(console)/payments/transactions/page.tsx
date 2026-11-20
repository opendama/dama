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
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
  selectedRowIds,
} from "@/components/ui/ops-data-table";
import {
  OpsDataTableRowActions,
  type OpsDataTableRowAction,
} from "@/components/ui/ops-data-table-row-actions";
import { PaymentsTransactionsSkeleton, ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useReviewPayoutMutation, useReviewReceiptMutation } from "@/hooks/mutation";
import {
  useAdminConsoleChromeQuery,
  useAdminTransactionsQuery,
  useCashRmgPublicChromeQuery,
} from "@/hooks/query";
import { useAdminReceiptQuery } from "@/hooks/query/useAdminReceiptQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { filterAllSentinel, isFilterAll } from "@/lib/admin-filter-options";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import {
  paidStatusTextClass,
  receiptDisplayStatusCode,
  txnDisplayStatusCode,
} from "@/lib/payment-status-display";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/parse-search-debounce-ms";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { ConsoleTransaction } from "@/types/console";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const TXN_STATUS_CODES = [
  "awaiting_receipt",
  "paid",
  "pending",
  "posted",
  "approved",
  "rejected",
  "cancelled",
] as const;

const TXN_KIND_CODES = [
  "topup",
  "payout",
  "competition_prize_payout",
  "campaign_create_fee",
  "event_host_fee",
  "event_entry_paid",
  "event_entry_earned",
  "event_entry_commission",
  "event_entry_refund",
  "event_entry_clawback",
  "prize_pool_guarantee_hold",
  "prize_pool_guarantee_release",
  "prize_pool_guarantee_capture",
  "tournament_entry_refund",
] as const;

function chromeOpt(chrome: Record<string, unknown>, key: string): string {
  const v = chrome[key];
  return typeof v === "string" ? v.trim() : "";
}

function txnStatusLabel(chrome: Record<string, unknown>, status: string, empty: string): string {
  const code = (status || "").trim();
  if (!code) return empty;
  const labeled = chromeOpt(chrome, `txn_status_${code}`);
  return labeled || empty;
}

function txnKindLabel(chrome: Record<string, unknown>, kind: string, empty: string): string {
  const code = (kind || "").trim();
  if (!code) return empty;
  const labeled = chromeOpt(chrome, `txn_kind_${code}`);
  return labeled || empty;
}

function isPayoutKind(kind: string): boolean {
  return (kind || "").trim().toLowerCase() === "payout";
}

function linkedReceiptId(t: ConsoleTransaction): string {
  return (t.receipt_id || "").trim();
}

function linkedReceiptStatus(t: ConsoleTransaction): string {
  const fromProof = (t.receipt_status || "").trim();
  if (fromProof) return fromProof;
  // Orphan receipt rows are projected as topups whose status is the receipt status.
  if (
    (t.kind || "").trim().toLowerCase() === "topup" &&
    linkedReceiptId(t) === (t.id || "").trim()
  ) {
    return (t.status || "").trim();
  }
  return "";
}

function DetailField({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const text = (label || "").trim();
  if (!text) return null;
  return (
    <div className={`space-y-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
        {text}
      </p>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export default function AdminPaymentsTransactionsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const searchDebounceMs = parseSearchDebounceMs(chrome?.search_debounce_ms);
  const allSentinel = filterAllSentinel();

  const policyQuery = useCashRmgPublicChromeQuery(Boolean(isAdmin));
  const policy = policyQuery.data?.policy;
  const approvable = (policy?.approvable_payout_status || "").trim();
  const approved = (policy?.approved_payout_status || "").trim();
  const rejected = (policy?.rejected_payout_status || "").trim();
  const paid = (policy?.paid_payout_status || "").trim();
  const policyReady = Boolean(approvable && approved && rejected && paid);

  const [skip, setSkip] = useUrlSkip("skip");
  const [searchDraft, setSearchDraft] = useState("");
  const searchQ = useDebouncedValue(searchDraft.trim(), searchDebounceMs);
  const [statusFilter, setStatusFilter] = useState(allSentinel);
  const [kindFilter, setKindFilter] = useState(allSentinel);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);

  const detailDialog = useDeferredDialogValue<ConsoleTransaction>();
  const receiptReview = useReviewReceiptMutation(token);
  const payoutReview = useReviewPayoutMutation(token);
  const statusParam = isFilterAll(statusFilter) ? "" : statusFilter.trim();
  const kindParam = isFilterAll(kindFilter) ? "" : kindFilter.trim();

  useResetSkipOnChange(setSkip, [searchQ, statusParam, kindParam]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [searchQ, statusParam, kindParam, skip]);

  const listQuery = useAdminTransactionsQuery(
    token,
    isAdmin && pageSize > 0,
    skip,
    pageSize,
    searchQ,
    statusParam,
    kindParam,
  );

  const empty = (chrome?.empty_value || "").trim();
  const softFetching = listQuery.isFetching && !listQuery.isLoading;
  const pageRows = listQuery.data?.transactions ?? [];
  const c = (chrome || {}) as unknown as Record<string, unknown>;

  const detailReceiptId = linkedReceiptId(detailDialog.value || ({} as ConsoleTransaction));
  const receiptQuery = useAdminReceiptQuery(
    token,
    detailReceiptId,
    Boolean(isAdmin && detailDialog.open && detailReceiptId),
  );
  const receiptDetail = receiptQuery.data;

  const receiptIsPending = useCallback((t: ConsoleTransaction): boolean => {
    return linkedReceiptStatus(t).toLowerCase() === "pending";
  }, []);

  async function bulkReceiptReview(approve: boolean) {
    const ids = selectedRowIds(rowSelection);
    if (!ids.length) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        const row = pageRows.find((t) => t.id === id);
        if (!row || !receiptIsPending(row)) continue;
        const rid = linkedReceiptId(row);
        if (!rid) continue;
        await receiptReview.mutateAsync({ id: rid, approve });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  async function bulkPayoutReview(status: string) {
    const st = (status || "").trim();
    const ids = selectedRowIds(rowSelection);
    if (!ids.length || !st) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        const row = pageRows.find((t) => t.id === id);
        if (!row || !isPayoutKind(row.kind)) continue;
        if (st === approved && row.status !== approvable) continue;
        if (st === rejected && row.status !== approvable) continue;
        if (st === paid && row.status !== approved) continue;
        await payoutReview.mutateAsync({ id, status: st, note: "" });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  const columns = useMemo((): OpsColumn<ConsoleTransaction>[] => {
    if (!chrome) return [];
    const sep =
      typeof chrome.amount_currency_separator === "string" ? chrome.amount_currency_separator : "";
    const formatAmount = (amount: number, currency: string): string => {
      if (!Number.isFinite(amount) || !(currency || "").trim() || sep.length === 0) return empty;
      return `${amount}${sep}${currency}`;
    };
    const actionsLabel = (chrome.actions_label || "").trim();
    const viewDetail = (chrome.txn_view_detail || "").trim();
    const openDoc =
      chromeOpt(c, "receipt_open_document_action") || (chrome.view_receipt_action || "").trim();
    const downloadLabel = chromeOpt(c, "receipt_download_action");
    const approveReceipt = (chrome.approve_action || "").trim();
    const rejectReceipt = (chrome.reject_action || "").trim();
    const approvePayout = (chrome.payout_approve_action || "").trim();
    const rejectPayout = (chrome.payout_reject_action || "").trim();
    const markPaid = (chrome.payout_mark_paid_action || "").trim();
    return [
      {
        id: "user",
        header: (chrome.txn_col_user || "").trim(),
        cell: (t: ConsoleTransaction) => (
          <span className="text-sm">{(t.username || "").trim() || empty}</span>
        ),
      },
      {
        id: "kind",
        header: (chrome.txn_col_kind || "").trim(),
        cell: (t: ConsoleTransaction) => (
          <span className="text-sm">{txnKindLabel(c, t.kind, empty)}</span>
        ),
      },
      {
        id: "amount",
        header: (chrome.txn_col_amount || "").trim(),
        cell: (t: ConsoleTransaction) => (
          <span className="font-medium tabular-nums">{formatAmount(t.amount, t.currency)}</span>
        ),
      },
      {
        id: "status",
        header: (chrome.txn_col_status || "").trim(),
        cell: (t: ConsoleTransaction) => {
          const code = txnDisplayStatusCode(t);
          return (
            <span className={`text-sm ${paidStatusTextClass(code)}`}>
              {txnStatusLabel(c, code, empty)}
            </span>
          );
        },
      },
      {
        id: "reference",
        header: (chrome.txn_col_reference || "").trim(),
        cell: (t: ConsoleTransaction) => (
          <span className="max-w-[12rem] truncate font-mono text-xs text-[var(--dama-muted)]">
            {(t.reference || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "provider",
        header: (chrome.txn_col_provider || "").trim(),
        cell: (t: ConsoleTransaction) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(t.provider || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "when",
        header: (chrome.txn_col_when || "").trim(),
        cell: (t: ConsoleTransaction) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(t.created_at || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "actions",
        header: (chrome.txn_col_actions || "").trim(),
        className: "w-12 text-right",
        cell: (t: ConsoleTransaction) => {
          const receiptId = linkedReceiptId(t);
          const payoutBusy = payoutReview.isPending && payoutReview.variables?.id === t.id;
          const receiptBusy = receiptReview.isPending && receiptReview.variables?.id === receiptId;
          const actions: OpsDataTableRowAction[] = [];

          if (viewDetail) {
            actions.push({
              id: "detail",
              label: viewDetail,
              onSelect: () => detailDialog.openWith(t),
            });
          }

          if (receiptId && openDoc) {
            actions.push({
              id: "open-doc",
              label: openDoc,
              onSelect: () => router.push(`/payments/receipts/${encodeURIComponent(receiptId)}`),
            });
          }

          if (receiptId && downloadLabel) {
            actions.push({
              id: "download",
              label: downloadLabel,
              onSelect: () =>
                router.push(`/payments/receipts/${encodeURIComponent(receiptId)}?download=1`),
            });
          }

          // Receipt review only while proof is still pending (API rejects otherwise).
          if (receiptId && receiptIsPending(t)) {
            if (approveReceipt) {
              actions.push({
                id: "receipt-approve",
                label: approveReceipt,
                pendingLabel: (chrome.receipt_approve_pending || "").trim(),
                isLoading: receiptBusy && Boolean(receiptReview.variables?.approve),
                onSelect: () => receiptReview.mutate({ id: receiptId, approve: true }),
              });
            }
            if (rejectReceipt) {
              actions.push({
                id: "receipt-reject",
                label: rejectReceipt,
                pendingLabel: (chrome.receipt_reject_pending || "").trim(),
                destructive: true,
                isLoading: receiptBusy && receiptReview.variables?.approve === false,
                onSelect: () => receiptReview.mutate({ id: receiptId, approve: false }),
              });
            }
          }

          // Payout transitions: pending → approve/reject; approved → mark paid.
          if (policyReady && isPayoutKind(t.kind)) {
            if (t.status === approvable) {
              if (approvePayout) {
                actions.push({
                  id: "payout-approve",
                  label: approvePayout,
                  pendingLabel: (chrome.payout_approve_pending || "").trim(),
                  isLoading: payoutBusy && payoutReview.variables?.status === approved,
                  onSelect: () => payoutReview.mutate({ id: t.id, status: approved, note: "" }),
                });
              }
              if (rejectPayout) {
                actions.push({
                  id: "payout-reject",
                  label: rejectPayout,
                  pendingLabel: (chrome.payout_reject_pending || "").trim(),
                  destructive: true,
                  isLoading: payoutBusy && payoutReview.variables?.status === rejected,
                  onSelect: () => payoutReview.mutate({ id: t.id, status: rejected, note: "" }),
                });
              }
            }
            if (t.status === approved && markPaid) {
              actions.push({
                id: "payout-paid",
                label: markPaid,
                pendingLabel: (chrome.payout_mark_paid_pending || "").trim(),
                isLoading: payoutBusy && payoutReview.variables?.status === paid,
                onSelect: () => payoutReview.mutate({ id: t.id, status: paid, note: "" }),
              });
            }
          }

          return <OpsDataTableRowActions triggerLabel={actionsLabel} actions={actions} />;
        },
      },
    ].filter((col) => col.id === "actions" || Boolean(col.header));
  }, [
    chrome,
    c,
    empty,
    detailDialog,
    router,
    receiptReview,
    payoutReview,
    policyReady,
    approvable,
    approved,
    rejected,
    paid,
    receiptIsPending,
  ]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsTransactionsSkeleton />
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

  const closeLabel = (chrome.txn_detail_close || "").trim();
  const detailTitle = (chrome.txn_detail_title || "").trim();
  const detail = detailDialog.value;
  const sep = chrome.amount_currency_separator || "";
  const openDocLabel =
    chromeOpt(c, "receipt_open_document_action") || (chrome.view_receipt_action || "").trim();
  const downloadLabel = chromeOpt(c, "receipt_download_action");
  const proofLabel = chromeOpt(c, "receipt_proof_label") || chromeOpt(c, "receipt_proof_caption");
  const proofUrl =
    resolvePublicMediaUrl(receiptDetail?.receipt_url) ||
    resolvePublicMediaUrl(detail?.receipt_url) ||
    "";
  const receiptStatusCode = receiptDetail
    ? receiptDisplayStatusCode(receiptDetail)
    : detail
      ? receiptDisplayStatusCode({ status: linkedReceiptStatus(detail) })
      : "";
  const receiptStatusDisp = receiptStatusCode
    ? chromeOpt(c, `receipt_status_${receiptStatusCode}`) || receiptStatusCode
    : empty;
  const allLabel = chromeOpt(c, "filter_all_label");
  const statusOptions = TXN_STATUS_CODES.map((code) => ({
    value: code,
    label: chromeOpt(c, `txn_status_${code}`),
  })).filter((o) => Boolean(o.label));
  const kindOptions = TXN_KIND_CODES.map((code) => ({
    value: code,
    label: chromeOpt(c, `txn_kind_${code}`),
  })).filter((o) => Boolean(o.label));
  const pageLoading = roleLoading || (isAdmin && listQuery.isLoading);
  const receiptLoading = Boolean(detailReceiptId && receiptQuery.isLoading && !receiptQuery.data);

  const selected = selectedRowIds(rowSelection);
  const selectedRows = pageRows.filter((t) => selected.includes(t.id));
  const selectedPendingReceipts = selectedRows.filter((t) => receiptIsPending(t));
  const selectedApprovablePayouts = selectedRows.filter(
    (t) => isPayoutKind(t.kind) && t.status === approvable,
  );
  const selectedApprovedPayouts = selectedRows.filter(
    (t) => isPayoutKind(t.kind) && t.status === approved,
  );
  const detailCanReceiptReview = Boolean(
    detailReceiptId &&
      ((receiptDetail?.status || "").trim().toLowerCase() === "pending" ||
        (detail && !receiptDetail && receiptIsPending(detail))),
  );
  const detailCanPayoutReview = Boolean(
    detail && policyReady && isPayoutKind(detail.kind) && detail.status === approvable,
  );
  const detailCanMarkPaid = Boolean(
    detail && policyReady && isPayoutKind(detail.kind) && detail.status === approved,
  );
  const detailPayoutBusy =
    Boolean(detail) && payoutReview.isPending && payoutReview.variables?.id === detail?.id;
  const detailReceiptBusy =
    Boolean(detailReceiptId) &&
    receiptReview.isPending &&
    receiptReview.variables?.id === detailReceiptId;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.transactions_page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.transactions_page_blurb}</p>
      </div>

      {roleLoading ? (
        <PaymentsTransactionsSkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsTransactionsSkeleton />
      ) : (
        <>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-transactions-search",
                label: (chrome.search_label || "").trim(),
                placeholder: (chrome.search_placeholder || "").trim(),
                value: searchDraft,
                onChange: setSearchDraft,
              },
              {
                kind: "select",
                id: "admin-transactions-status",
                label: (chrome.txn_col_status || "").trim(),
                value: statusFilter,
                onChange: setStatusFilter,
                allLabel: allLabel || undefined,
                options: statusOptions,
              },
              {
                kind: "select",
                id: "admin-transactions-kind",
                label: (chrome.txn_col_kind || "").trim(),
                value: kindFilter,
                onChange: setKindFilter,
                allLabel: allLabel || undefined,
                options: kindOptions,
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageRows}
            getRowId={(t) => t.id}
            isFetching={softFetching}
            meta={listQuery.data?.meta}
            onPage={setSkip}
            pageDisabled={softFetching || bulkPending}
            pageInputId="admin-transactions-skip"
            empty={
              (chrome.transactions_empty || "").trim() ? (
                <p className="py-8 text-center text-sm text-[var(--dama-muted)]">
                  {chrome.transactions_empty}
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
                  {selectedPendingReceipts.length > 0 && (chrome.approve_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.receipt_approve_pending || "").trim()}
                      onClick={() => void bulkReceiptReview(true)}
                    >
                      {(chrome.approve_action || "").trim()}
                    </Button>
                  ) : null}
                  {selectedPendingReceipts.length > 0 && (chrome.reject_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.receipt_reject_pending || "").trim()}
                      onClick={() => void bulkReceiptReview(false)}
                    >
                      {(chrome.reject_action || "").trim()}
                    </Button>
                  ) : null}
                  {policyReady &&
                  selectedApprovablePayouts.length > 0 &&
                  (chrome.payout_approve_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.payout_approve_pending || "").trim()}
                      onClick={() => void bulkPayoutReview(approved)}
                    >
                      {(chrome.payout_approve_action || "").trim()}
                    </Button>
                  ) : null}
                  {policyReady &&
                  selectedApprovablePayouts.length > 0 &&
                  (chrome.payout_reject_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.payout_reject_pending || "").trim()}
                      onClick={() => void bulkPayoutReview(rejected)}
                    >
                      {(chrome.payout_reject_action || "").trim()}
                    </Button>
                  ) : null}
                  {policyReady &&
                  selectedApprovedPayouts.length > 0 &&
                  (chrome.payout_mark_paid_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.payout_mark_paid_pending || "").trim()}
                      onClick={() => void bulkPayoutReview(paid)}
                    >
                      {(chrome.payout_mark_paid_action || "").trim()}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selected.length === 0 || bulkPending}
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
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            {receiptLoading ? (
              <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
                <ShimmerBlock className="h-12 w-full rounded-md" />
                <ShimmerBlock className="h-12 w-full rounded-md" />
                <ShimmerBlock className="h-12 w-full rounded-md sm:col-span-2" />
                <ShimmerBlock className="h-40 w-full rounded-md sm:col-span-2" />
              </div>
            ) : detail ? (
              <div className="grid max-h-[min(70dvh,36rem)] gap-3 overflow-y-auto sm:grid-cols-2">
                <DetailField label={chromeOpt(c, "detail_id_label")}>
                  <p className="break-all font-mono text-xs">{(detail.id || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "detail_user_id_label")}>
                  <p className="break-all font-mono text-xs">
                    {(detail.user_id || "").trim() || empty}
                  </p>
                </DetailField>
                <DetailField label={(chrome.txn_col_user || "").trim()}>
                  <p>{(receiptDetail?.username || detail.username || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "receipt_email_label")}>
                  <p>{(receiptDetail?.email || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={(chrome.txn_col_kind || "").trim()}>
                  <p>{txnKindLabel(c, detail.kind, empty)}</p>
                </DetailField>
                <DetailField label={(chrome.txn_col_amount || "").trim()}>
                  <p className="font-medium tabular-nums">
                    {typeof detail.amount === "number" && (detail.currency || "").trim() && sep
                      ? `${detail.amount}${sep}${detail.currency}`
                      : empty}
                  </p>
                </DetailField>
                <DetailField label={(chrome.txn_col_status || "").trim()}>
                  <p className={paidStatusTextClass(txnDisplayStatusCode(detail))}>
                    {txnStatusLabel(c, txnDisplayStatusCode(detail), empty)}
                  </p>
                </DetailField>
                {detailReceiptId ? (
                  <DetailField label={(chrome.receipt_col_status || "").trim()}>
                    <p className={paidStatusTextClass(receiptStatusCode)}>{receiptStatusDisp}</p>
                  </DetailField>
                ) : null}
                <DetailField label={(chrome.txn_col_reference || "").trim()}>
                  <p className="break-all font-mono text-xs">
                    {(receiptDetail?.reference || detail.reference || "").trim() || empty}
                  </p>
                </DetailField>
                <DetailField
                  label={
                    chromeOpt(c, "receipt_provider_label") ||
                    chromeOpt(c, "receipt_label_channel") ||
                    (chrome.txn_col_provider || "").trim()
                  }
                >
                  <p>{(receiptDetail?.provider || detail.provider || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={(chrome.txn_col_when || "").trim()}>
                  <p>{(detail.created_at || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "receipt_reviewed_at_label")}>
                  <p>{(receiptDetail?.reviewed_at || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "receipt_intent_id_label")} wide>
                  <p className="break-all font-mono text-xs">
                    {(receiptDetail?.intent_id || "").trim() || empty}
                  </p>
                </DetailField>
                {chromeOpt(c, "receipt_pdf_label") || downloadLabel ? (
                  <DetailField label={chromeOpt(c, "receipt_pdf_label") || downloadLabel} wide>
                    {detailReceiptId ? (
                      <a
                        className="text-sm text-[var(--dama-gold)] underline underline-offset-4"
                        href={`/payments/receipts/${encodeURIComponent(detailReceiptId)}?download=1`}
                      >
                        {downloadLabel || chromeOpt(c, "receipt_pdf_label")}
                      </a>
                    ) : (
                      <p>{empty}</p>
                    )}
                  </DetailField>
                ) : null}
                <DetailField label={proofLabel} wide>
                  {proofUrl ? (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-[var(--dama-border)] bg-[var(--dama-panel)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proofUrl}
                        alt={proofLabel || empty}
                        className="max-h-72 w-full object-contain"
                      />
                    </a>
                  ) : (
                    <p>{empty}</p>
                  )}
                </DetailField>
              </div>
            ) : null}
            <DialogFooter damaDialogFooter>
              <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                {closeLabel}
              </Button>
              {detailReceiptId && openDocLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    detailDialog.close();
                    router.push(`/payments/receipts/${encodeURIComponent(detailReceiptId)}`);
                  }}
                >
                  {openDocLabel}
                </Button>
              ) : null}
              {detailReceiptId && downloadLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    detailDialog.close();
                    router.push(
                      `/payments/receipts/${encodeURIComponent(detailReceiptId)}?download=1`,
                    );
                  }}
                >
                  {downloadLabel}
                </Button>
              ) : null}
              {detailCanReceiptReview && (chrome.approve_action || "").trim() ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={detailReceiptBusy && Boolean(receiptReview.variables?.approve)}
                  pendingLabel={(chrome.receipt_approve_pending || "").trim()}
                  onClick={() => {
                    receiptReview.mutate(
                      { id: detailReceiptId, approve: true },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {(chrome.approve_action || "").trim()}
                </Button>
              ) : null}
              {detailCanReceiptReview && (chrome.reject_action || "").trim() ? (
                <Button
                  type="button"
                  variant="destructive"
                  isLoading={detailReceiptBusy && receiptReview.variables?.approve === false}
                  pendingLabel={(chrome.receipt_reject_pending || "").trim()}
                  onClick={() => {
                    receiptReview.mutate(
                      { id: detailReceiptId, approve: false },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {(chrome.reject_action || "").trim()}
                </Button>
              ) : null}
              {detailCanPayoutReview && (chrome.payout_approve_action || "").trim() ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={detailPayoutBusy && payoutReview.variables?.status === approved}
                  pendingLabel={(chrome.payout_approve_pending || "").trim()}
                  onClick={() => {
                    if (!detail) return;
                    payoutReview.mutate(
                      { id: detail.id, status: approved, note: "" },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {(chrome.payout_approve_action || "").trim()}
                </Button>
              ) : null}
              {detailCanPayoutReview && (chrome.payout_reject_action || "").trim() ? (
                <Button
                  type="button"
                  variant="destructive"
                  isLoading={detailPayoutBusy && payoutReview.variables?.status === rejected}
                  pendingLabel={(chrome.payout_reject_pending || "").trim()}
                  onClick={() => {
                    if (!detail) return;
                    payoutReview.mutate(
                      { id: detail.id, status: rejected, note: "" },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {(chrome.payout_reject_action || "").trim()}
                </Button>
              ) : null}
              {detailCanMarkPaid && (chrome.payout_mark_paid_action || "").trim() ? (
                <Button
                  type="button"
                  variant="gold"
                  isLoading={detailPayoutBusy && payoutReview.variables?.status === paid}
                  pendingLabel={(chrome.payout_mark_paid_pending || "").trim()}
                  onClick={() => {
                    if (!detail) return;
                    payoutReview.mutate(
                      { id: detail.id, status: paid, note: "" },
                      { onSuccess: () => detailDialog.close() },
                    );
                  }}
                >
                  {(chrome.payout_mark_paid_action || "").trim()}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
