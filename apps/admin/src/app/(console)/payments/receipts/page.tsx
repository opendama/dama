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
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  PaymentsReceiptsBodySkeleton,
  PaymentsReceiptsSkeleton,
  ShimmerBlock,
} from "@/components/ui/shimmer-skeletons";
import { useReviewReceiptMutation } from "@/hooks/mutation";
import { useAdminReceiptQuery } from "@/hooks/query/useAdminReceiptQuery";
import { useAdminConsoleChromeQuery, useAdminReceiptsQuery } from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { filterAllSentinel, isFilterAll } from "@/lib/admin-filter-options";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { parseSearchDebounceMs } from "@/lib/parse-search-debounce-ms";
import { paidStatusTextClass, receiptDisplayStatusCode } from "@/lib/payment-status-display";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { AdminReceipt } from "@/types/console";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

const RECEIPT_STATUS_CODES = ["pending", "paid", "rejected"] as const;

function chromeOpt(chrome: Record<string, unknown>, key: string): string {
  const v = chrome[key];
  return typeof v === "string" ? v.trim() : "";
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

function AdminPaymentsReceiptsPageInner() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const searchDebounceMs = parseSearchDebounceMs(chrome?.search_debounce_ms);
  const allSentinel = filterAllSentinel();

  const [skip, setSkip] = useUrlSkip("skip");
  const [searchDraft, setSearchDraft] = useState("");
  const searchQ = useDebouncedValue(searchDraft.trim(), searchDebounceMs);
  const [statusFilter, setStatusFilter] = useState(allSentinel);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);

  const review = useReviewReceiptMutation(token);
  const detailDialog = useDeferredDialogValue<AdminReceipt>();
  const statusParam = isFilterAll(statusFilter) ? "" : statusFilter.trim();

  const detailId = (detailDialog.value?.id || "").trim();
  const detailQuery = useAdminReceiptQuery(
    token,
    detailId,
    Boolean(isAdmin && detailDialog.open && detailId),
  );
  const detail = detailQuery.data ?? detailDialog.value;
  const deepLinkOpenedFor = useRef<string | null>(null);

  // Notification deep link ?receipt= → full document page (print/PDF).
  useEffect(() => {
    const rid = (searchParams.get("receipt") || "").trim();
    if (!rid) {
      deepLinkOpenedFor.current = null;
      return;
    }
    if (deepLinkOpenedFor.current === rid) return;
    deepLinkOpenedFor.current = rid;
    router.replace(`/payments/receipts/${encodeURIComponent(rid)}`);
  }, [searchParams, router]);

  useResetSkipOnChange(setSkip, [searchQ, statusParam]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [searchQ, statusParam, skip]);

  const receiptsQuery = useAdminReceiptsQuery(
    token,
    isAdmin && pageSize > 0,
    skip,
    pageSize,
    searchQ,
    statusParam,
  );

  const c = (chrome || {}) as unknown as Record<string, unknown>;
  const empty = (chrome?.empty_value || "").trim();
  // Status-aware empty copy (legacy no_receipts said "No pending receipts" for every filter).
  const listEmpty = (() => {
    if (!chrome) return "";
    const fallback = (chrome.no_receipts || "").trim();
    if (isFilterAll(statusFilter)) {
      return chromeOpt(c, "receipts_empty_all") || fallback;
    }
    const code = statusFilter.trim().toLowerCase();
    if (code === "pending") return chromeOpt(c, "receipts_empty_pending") || fallback;
    if (code === "paid") return chromeOpt(c, "receipts_empty_paid") || fallback;
    if (code === "rejected") return chromeOpt(c, "receipts_empty_rejected") || fallback;
    return fallback;
  })();
  const softFetching = receiptsQuery.isFetching && !receiptsQuery.isLoading;
  const pageRows = receiptsQuery.data?.receipts ?? [];

  const isPendingReceipt = useCallback((r: AdminReceipt): boolean => {
    return (r.status || "").trim().toLowerCase() === "pending";
  }, []);

  async function bulkReceipts(approve: boolean) {
    const ids = selectedRowIds(rowSelection);
    if (!ids.length) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        const row = pageRows.find((r) => r.id === id);
        if (!row || !isPendingReceipt(row)) continue;
        await review.mutateAsync({ id, approve });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  const columns = useMemo((): OpsColumn<AdminReceipt>[] => {
    if (!chrome) return [];
    const sep =
      typeof chrome.amount_currency_separator === "string" ? chrome.amount_currency_separator : "";
    const formatAmount = (amount: number, currency: string): string => {
      if (!Number.isFinite(amount) || !(currency || "").trim() || sep.length === 0) return empty;
      return `${amount}${sep}${currency}`;
    };
    const actionsLabel = (chrome.actions_label || "").trim();
    const viewDetail = chromeOpt(c, "receipt_view_detail");
    const viewDoc =
      chromeOpt(c, "receipt_open_document_action") || (chrome.view_receipt_action || "").trim();
    const downloadLabel = chromeOpt(c, "receipt_download_action");
    return [
      {
        id: "user",
        header: (chrome.receipt_col_user || "").trim(),
        cell: (r: AdminReceipt) => (
          <span className="text-sm">{(r.username || "").trim() || empty}</span>
        ),
      },
      {
        id: "amount",
        header: (chrome.receipt_col_amount || "").trim(),
        cell: (r: AdminReceipt) => (
          <span className="font-medium tabular-nums">
            {formatAmount(r.amount, r.currency || "")}
          </span>
        ),
      },
      {
        id: "reference",
        header: (chrome.receipt_col_reference || "").trim(),
        cell: (r: AdminReceipt) => (
          <span className="max-w-[12rem] truncate font-mono text-xs text-[var(--dama-muted)]">
            {(r.reference || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "status",
        header: (chrome.receipt_col_status || "").trim(),
        cell: (r: AdminReceipt) => {
          const code = receiptDisplayStatusCode(r);
          const label = code ? chromeOpt(c, `receipt_status_${code}`) : "";
          return <span className={`text-sm ${paidStatusTextClass(code)}`}>{label || empty}</span>;
        },
      },
      {
        id: "when",
        header: (chrome.receipt_col_when || "").trim(),
        cell: (r: AdminReceipt) => (
          <span className="text-sm text-[var(--dama-muted)]">
            {(r.created_at || "").trim() || empty}
          </span>
        ),
      },
      {
        id: "actions",
        header: (chrome.receipt_col_actions || "").trim(),
        className: "w-12 text-right",
        cell: (r: AdminReceipt) => {
          const canReviewRow = isPendingReceipt(r);
          return (
            <OpsDataTableRowActions
              triggerLabel={actionsLabel}
              actions={[
                ...(viewDetail
                  ? [
                      {
                        id: "detail",
                        label: viewDetail,
                        onSelect: () => detailDialog.openWith(r),
                      },
                    ]
                  : []),
                ...(viewDoc
                  ? [
                      {
                        id: "view",
                        label: viewDoc,
                        onSelect: () =>
                          router.push(`/payments/receipts/${encodeURIComponent(r.id)}`),
                      },
                    ]
                  : []),
                ...(downloadLabel
                  ? [
                      {
                        id: "download",
                        label: downloadLabel,
                        onSelect: () =>
                          router.push(`/payments/receipts/${encodeURIComponent(r.id)}?download=1`),
                      },
                    ]
                  : []),
                ...(canReviewRow
                  ? [
                      {
                        id: "approve",
                        label: (chrome.approve_action || "").trim(),
                        pendingLabel: (chrome.receipt_approve_pending || "").trim(),
                        isLoading:
                          review.isPending &&
                          review.variables?.id === r.id &&
                          review.variables.approve,
                        onSelect: () => review.mutate({ id: r.id, approve: true }),
                      },
                      {
                        id: "reject",
                        label: (chrome.reject_action || "").trim(),
                        pendingLabel: (chrome.receipt_reject_pending || "").trim(),
                        destructive: true,
                        isLoading:
                          review.isPending &&
                          review.variables?.id === r.id &&
                          !review.variables.approve,
                        onSelect: () => review.mutate({ id: r.id, approve: false }),
                      },
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ].filter((col) => col.id === "actions" || Boolean(col.header));
  }, [chrome, c, empty, review, router, detailDialog, isPendingReceipt]);

  if (roleLoading || chromeQuery.isLoading) {
    return <PaymentsReceiptsSkeleton />;
  }
  if (!token) {
    return (
      <div className="space-y-4">
        <SignInLink />
      </div>
    );
  }
  if (!isAdmin || !chrome) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </p>
    );
  }

  const title = (chrome.receipts_page_title || "").trim();
  const blurb = (chrome.receipts_page_blurb || "").trim();
  const searchLabel = (chrome.search_label || "").trim();
  const searchPh = (chrome.search_placeholder || "").trim();
  const pageLoading = isAdmin && receiptsQuery.isLoading;
  const closeLabel = (chrome.receipt_detail_close || "").trim();
  const detailTitle = (chrome.receipt_detail_title || "").trim();
  const sep = chrome.amount_currency_separator || "";
  const statusCode = detail ? receiptDisplayStatusCode(detail) : "";
  const statusDisp = statusCode
    ? chromeOpt(c, `receipt_status_${statusCode}`) || statusCode
    : empty;
  const proofUrl = resolvePublicMediaUrl(detail?.receipt_url) || "";
  const openDocLabel =
    chromeOpt(c, "receipt_open_document_action") || (chrome.view_receipt_action || "").trim();
  const canReview = Boolean(detail && isPendingReceipt(detail));
  const selected = selectedRowIds(rowSelection);
  const selectedPending = pageRows.filter((r) => selected.includes(r.id) && isPendingReceipt(r));
  const allLabel = chromeOpt(c, "filter_all_label");
  const statusOptions = RECEIPT_STATUS_CODES.map((code) => ({
    value: code,
    label: chromeOpt(c, `receipt_status_${code}`),
  })).filter((o) => Boolean(o.label));

  return (
    <div className="space-y-4">
      {title ? <h1 className="text-2xl font-semibold tracking-tight">{title}</h1> : null}
      {blurb ? <p className="text-sm text-[var(--dama-muted)]">{blurb}</p> : null}

      {pageLoading ? <PaymentsReceiptsBodySkeleton /> : null}

      {!pageLoading && pageSize > 0 ? (
        <>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-receipts-search",
                label: searchLabel,
                placeholder: searchPh,
                value: searchDraft,
                onChange: setSearchDraft,
              },
              {
                kind: "select",
                id: "admin-receipts-status",
                label: (chrome.receipt_col_status || "").trim(),
                value: statusFilter,
                onChange: setStatusFilter,
                allLabel: allLabel || undefined,
                options: statusOptions,
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageRows}
            getRowId={(r) => r.id}
            isFetching={softFetching}
            meta={receiptsQuery.data?.meta}
            onPage={setSkip}
            pageDisabled={softFetching || bulkPending}
            pageInputId="admin-receipts-skip"
            empty={
              listEmpty ? (
                <p className="py-8 text-center text-sm text-[var(--dama-muted)]">{listEmpty}</p>
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
                  {selectedPending.length > 0 && (chrome.approve_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.receipt_approve_pending || "").trim()}
                      onClick={() => void bulkReceipts(true)}
                    >
                      {(chrome.approve_action || "").trim()}
                    </Button>
                  ) : null}
                  {selectedPending.length > 0 && (chrome.reject_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.receipt_reject_pending || "").trim()}
                      onClick={() => void bulkReceipts(false)}
                    >
                      {(chrome.reject_action || "").trim()}
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
      ) : null}

      {closeLabel && detailTitle ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            {detailQuery.isLoading && !detailQuery.data ? (
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
                <DetailField label={(chrome.receipt_col_user || "").trim()}>
                  <p>{(detail.username || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "receipt_email_label")}>
                  <p>{(detail.email || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={(chrome.receipt_col_amount || "").trim()}>
                  <p className="font-medium tabular-nums">
                    {typeof detail.amount === "number" && (detail.currency || "").trim() && sep
                      ? `${detail.amount}${sep}${detail.currency}`
                      : empty}
                  </p>
                </DetailField>
                <DetailField label={(chrome.receipt_col_status || "").trim()}>
                  <p className={paidStatusTextClass(statusCode)}>{statusDisp}</p>
                </DetailField>
                <DetailField label={(chrome.receipt_col_reference || "").trim()}>
                  <p className="break-all font-mono text-xs">
                    {(detail.reference || "").trim() || empty}
                  </p>
                </DetailField>
                <DetailField
                  label={
                    chromeOpt(c, "receipt_provider_label") || chromeOpt(c, "receipt_label_channel")
                  }
                >
                  <p>{(detail.provider || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={(chrome.receipt_col_when || "").trim()}>
                  <p>{(detail.created_at || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "receipt_reviewed_at_label")}>
                  <p>{(detail.reviewed_at || "").trim() || empty}</p>
                </DetailField>
                <DetailField label={chromeOpt(c, "receipt_intent_id_label")} wide>
                  <p className="break-all font-mono text-xs">
                    {(detail.intent_id || "").trim() || empty}
                  </p>
                </DetailField>
                {chromeOpt(c, "receipt_pdf_label") || chromeOpt(c, "receipt_download_action") ? (
                  <DetailField
                    label={
                      chromeOpt(c, "receipt_pdf_label") || chromeOpt(c, "receipt_download_action")
                    }
                    wide
                  >
                    {(detail.id || "").trim() ? (
                      <a
                        className="text-sm text-[var(--dama-gold)] underline underline-offset-4"
                        href={`/payments/receipts/${encodeURIComponent(detail.id)}?download=1`}
                      >
                        {chromeOpt(c, "receipt_download_action") ||
                          chromeOpt(c, "receipt_pdf_label")}
                      </a>
                    ) : (
                      <p>{empty}</p>
                    )}
                  </DetailField>
                ) : null}
                <DetailField label={chromeOpt(c, "receipt_proof_label")} wide>
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
                        alt={chromeOpt(c, "receipt_proof_label") || empty}
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
              {closeLabel ? (
                <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                  {closeLabel}
                </Button>
              ) : null}
              {detail && openDocLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const id = (detail.id || "").trim();
                    detailDialog.close();
                    if (id) router.push(`/payments/receipts/${encodeURIComponent(id)}`);
                  }}
                >
                  {openDocLabel}
                </Button>
              ) : null}
              {detail && canReview ? (
                <>
                  <Button
                    type="button"
                    variant="gold"
                    isLoading={
                      review.isPending &&
                      review.variables?.id === detail.id &&
                      review.variables.approve
                    }
                    pendingLabel={(chrome.receipt_approve_pending || "").trim()}
                    disabled={review.isPending}
                    onClick={() => {
                      review.mutate(
                        { id: detail.id, approve: true },
                        { onSuccess: () => detailDialog.close() },
                      );
                    }}
                  >
                    {(chrome.approve_action || "").trim()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={
                      review.isPending &&
                      review.variables?.id === detail.id &&
                      !review.variables.approve
                    }
                    pendingLabel={(chrome.receipt_reject_pending || "").trim()}
                    disabled={review.isPending}
                    onClick={() => {
                      review.mutate(
                        { id: detail.id, approve: false },
                        { onSuccess: () => detailDialog.close() },
                      );
                    }}
                  >
                    {(chrome.reject_action || "").trim()}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export default function AdminPaymentsReceiptsPage() {
  return (
    <Suspense fallback={<PaymentsReceiptsSkeleton />}>
      <AdminPaymentsReceiptsPageInner />
    </Suspense>
  );
}
