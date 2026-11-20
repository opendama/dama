"use client";

import { PortalPageShell } from "@/components/portal/PortalPageShell";
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
import { type OpsColumn, OpsDataTable } from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import {
  OpsDataTableSkeleton,
  SearchableListPageSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import {
  type WalletTransaction,
  useMyTransactionsQuery,
} from "@/hooks/query/useMyTransactionsQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { paidStatusTextClass, txnDisplayStatusCode } from "@/lib/payment-status-display";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function chromeOpt(chrome: Record<string, unknown> | undefined, key: string): string {
  const v = chrome?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type TransactionsWorkspaceProps = {
  /** Prefix for sibling money routes, e.g. "/events" or "/ads". Empty = player portal. */
  moneyBasePath?: string;
};

/** Transactions ledger (top-ups + payouts + event/ads money). Shared portals. */
export function TransactionsWorkspace({ moneyBasePath = "" }: TransactionsWorkspaceProps) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = (searchParams.get("id") || "").trim();
  const deepLinkOpenedFor = useRef<string | null>(null);
  const portalMode = Boolean((moneyBasePath || "").trim());
  const navQuery = useClientNavFullQuery(!portalMode);
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const panel = (nav?.dashboard ?? []).find((p) => (p.route_key || "").trim() === "transactions");
  const blurb = portalMode ? "" : (panel?.body || "").trim();

  const chromeQuery = useWalletChromeQuery(Boolean(token));
  const chrome = isWalletChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const receiptsHrefRaw = chromeOpt(
    chrome as unknown as Record<string, unknown> | undefined,
    "link_receipts_href",
  );
  const transferHrefRaw = chromeOpt(
    chrome as unknown as Record<string, unknown> | undefined,
    "link_manual_transfer_href",
  );
  const moneyHref = (pathRaw: string) => {
    if (!pathRaw) return "";
    const base = (moneyBasePath || "").replace(/\/$/, "");
    const p = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
    return base ? `${base}${p}` : p;
  };
  const receiptsBase = moneyHref(receiptsHrefRaw);
  const transferBase = moneyHref(transferHrefRaw);
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const title = portalMode
    ? chromeOpt(chrome as unknown as Record<string, unknown> | undefined, "link_transactions_label")
    : (panel?.title || "").trim() ||
      chromeOpt(
        chrome as unknown as Record<string, unknown> | undefined,
        "link_transactions_label",
      );
  const [skip, setSkip] = useUrlSkip("skip");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 250);
  const listQuery = useMyTransactionsQuery(
    token,
    skip,
    pageSize,
    search,
    Boolean(token) && pageSize > 0,
  );
  const detail = useDeferredDialogValue<WalletTransaction>();

  useResetSkipOnChange(setSkip, [search]);

  useEffect(() => {
    if (!focusId) return;
    setSearchInput((prev) => (prev.trim() ? prev : focusId));
  }, [focusId]);

  const rows = listQuery.data?.transactions ?? [];

  useEffect(() => {
    if (!focusId) {
      deepLinkOpenedFor.current = null;
      return;
    }
    if (deepLinkOpenedFor.current === focusId) return;
    const row = rows.find((r) => r.id === focusId);
    if (!row) return;
    deepLinkOpenedFor.current = focusId;
    detail.openWith(row);
    window.requestAnimationFrame(() => {
      document.getElementById(`ops-row-${focusId}`)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }, [focusId, rows, detail]);

  const columns = useMemo((): OpsColumn<WalletTransaction>[] => {
    if (!chrome) return [];
    const c = chrome as unknown as Record<string, unknown>;
    const dateH = chromeOpt(c, "list_col_date");
    const kindH = chromeOpt(c, "list_col_kind");
    const amountH = chromeOpt(c, "list_col_amount");
    const statusH = chromeOpt(c, "list_col_status");
    const refH = chromeOpt(c, "list_col_reference");
    const viewH = chromeOpt(c, "list_col_view");
    const actionsH = chromeOpt(c, "list_row_actions");
    const sep = chromeSeparator(chrome.amount_currency_separator);
    const empty = (chrome.empty_value || "").trim();
    if (!chromeSeparatorPresent(sep) || !empty) return [];
    const kindLabel = (kind: string) => {
      const key = `list_kind_${(kind || "").trim()}`;
      return chromeOpt(c, key).trim();
    };

    const cols: OpsColumn<WalletTransaction>[] = [
      {
        id: "date",
        header: dateH,
        cell: (row) => (
          <span className="text-sm tabular-nums text-[var(--dama-muted)]">
            {row.created_at ? new Date(row.created_at).toLocaleString() : empty}
          </span>
        ),
      },
      {
        id: "kind",
        header: kindH,
        cell: (row) => {
          const labeled = kindLabel(row.kind);
          return (
            <span className={labeled ? "text-sm font-medium" : "text-sm text-[var(--dama-muted)]"}>
              {labeled || empty}
            </span>
          );
        },
      },
      {
        id: "amount",
        header: amountH,
        cell: (row) => {
          const muted = (chrome.list_muted_kinds ?? []).includes((row.kind || "").trim());
          return (
            <span
              className={
                muted
                  ? "font-mono text-sm text-[var(--dama-muted)]"
                  : "font-mono text-sm text-[var(--dama-gold)]"
              }
            >
              {typeof row.amount === "number" && (row.currency || "").trim()
                ? `${row.amount}${sep}${row.currency}`
                : empty}
            </span>
          );
        },
      },
      {
        id: "status",
        header: statusH,
        cell: (row) => {
          const code = txnDisplayStatusCode(row);
          const labeled = code ? chromeOpt(c, `list_status_${code}`).trim() : "";
          return <span className={`text-sm ${paidStatusTextClass(code)}`}>{labeled || empty}</span>;
        },
      },
      {
        id: "reference",
        header: refH,
        cell: (row) => (
          <span className="max-w-[12rem] truncate font-mono text-xs text-[var(--dama-muted)]">
            {(row.reference || "").trim() || empty}
          </span>
        ),
      },
    ];
    if (viewH) {
      cols.push({
        id: "view",
        header: viewH,
        className: "w-24",
        cell: (row) => (
          <button
            type="button"
            className="text-left text-sm underline-offset-4 hover:underline"
            onClick={() => detail.openWith(row)}
          >
            {viewH}
          </button>
        ),
      });
    }
    const openDocH = chromeOpt(c, "receipt_open_document_action");
    const submitProofH = chromeOpt(c, "list_action_submit_receipt");
    const awaitingProof = (row: WalletTransaction) => {
      const kind = (row.kind || "").trim().toLowerCase();
      const status = txnDisplayStatusCode(row).toLowerCase();
      return kind === "topup" && status === "awaiting_receipt" && !(row.receipt_id || "").trim();
    };
    const proofHref = (row: WalletTransaction) => {
      if (!transferBase) return "";
      const params = new URLSearchParams();
      if (typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount > 0) {
        params.set("amount", String(row.amount));
      }
      const intentId = (row.id || "").trim();
      if (intentId) params.set("intent_id", intentId);
      const q = params.toString();
      return q ? `${transferBase}?${q}` : transferBase;
    };
    if (actionsH) {
      cols.push({
        id: "actions",
        header: actionsH,
        className: "w-12",
        cell: (row) => {
          const receiptId = (row.receipt_id || "").trim();
          const actions = [
            {
              id: "view",
              label: viewH || actionsH,
              onSelect: () => detail.openWith(row),
            },
          ];
          if (awaitingProof(row) && submitProofH && transferBase) {
            actions.push({
              id: "submit_proof",
              label: submitProofH,
              onSelect: () => {
                router.push(proofHref(row));
              },
            });
          }
          if (receiptId && openDocH && receiptsBase) {
            actions.push({
              id: "receipt",
              label: openDocH,
              onSelect: () => {
                router.push(`${receiptsBase}/${encodeURIComponent(receiptId)}`);
              },
            });
          }
          return <OpsDataTableRowActions triggerLabel={actionsH} actions={actions} />;
        },
      });
    }
    return cols.filter((col) => Boolean(col.header.trim()));
  }, [chrome, detail, receiptsBase, router, transferBase]);

  if (!hydrated || (!portalMode && navQuery.isLoading) || chromeQuery.isLoading) {
    return <SearchableListPageSkeleton columns={7} showBlurb={!portalMode} />;
  }
  if (!token || !chrome || !title) return null;

  const searchLabel = chromeOpt(chrome as unknown as Record<string, unknown>, "list_search_label");
  const searchPh = chromeOpt(
    chrome as unknown as Record<string, unknown>,
    "list_search_placeholder",
  );
  const listEmpty = chromeOpt(
    chrome as unknown as Record<string, unknown>,
    "list_empty_transactions",
  );
  const emptyValue = (chrome.empty_value || "").trim();
  const detailTitle = chromeOpt(chrome as unknown as Record<string, unknown>, "list_detail_title");
  const closeLabel = chromeOpt(chrome as unknown as Record<string, unknown>, "dialog_close_label");
  const softFetching = listQuery.isFetching && !listQuery.isLoading;
  const amountSep = chromeSeparator(chrome.amount_currency_separator);
  if (
    !chromeSeparatorPresent(amountSep) ||
    !listEmpty ||
    !emptyValue ||
    !detailTitle ||
    !closeLabel
  ) {
    return null;
  }
  const c = chrome as unknown as Record<string, unknown>;
  const proofLabel = chromeOpt(c, "receipt_proof_label") || chromeOpt(c, "receipt_proof_caption");
  const proofUrl = resolvePublicMediaUrl(detail.value?.receipt_url) || "";
  const openDocLabel = chromeOpt(c, "receipt_open_document_action");
  const detailReceiptId = (detail.value?.receipt_id || "").trim();
  const submitProofLabel = chromeOpt(c, "list_action_submit_receipt");
  const awaitingProofBlurb = chromeOpt(c, "list_awaiting_proof_blurb");
  const detailNeedsProof =
    Boolean(detail.value) &&
    (detail.value?.kind || "").trim().toLowerCase() === "topup" &&
    detail.value != null &&
    txnDisplayStatusCode(detail.value).toLowerCase() === "awaiting_receipt" &&
    !detailReceiptId;
  const detailSubmitHref = (() => {
    if (!detailNeedsProof || !transferBase || !detail.value) return "";
    const params = new URLSearchParams();
    if (
      typeof detail.value.amount === "number" &&
      Number.isFinite(detail.value.amount) &&
      detail.value.amount > 0
    ) {
      params.set("amount", String(detail.value.amount));
    }
    const intentId = (detail.value.id || "").trim();
    if (intentId) params.set("intent_id", intentId);
    const q = params.toString();
    return q ? `${transferBase}?${q}` : transferBase;
  })();

  return (
    <PortalPageShell title={title} blurb={blurb}>
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="border-b border-[var(--dama-border)] p-4">
          {searchLabel ? (
            <Field id="tx-search" label={searchLabel} className="w-full sm:max-w-md">
              <Input
                id="tx-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={searchPh}
                autoComplete="off"
              />
            </Field>
          ) : (
            <Input
              id="tx-search"
              className="w-full sm:max-w-md"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPh}
              aria-label={searchPh}
              autoComplete="off"
            />
          )}
        </div>
        {listQuery.isLoading ? (
          <div className="p-2">
            <OpsDataTableSkeleton columns={7} rows={6} embedded />
          </div>
        ) : (
          <OpsDataTable
            className="rounded-none border-0"
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            focusedRowId={focusId || undefined}
            isFetching={softFetching}
            meta={listQuery.data?.meta}
            onPage={setSkip}
            pageDisabled={softFetching}
            pageInputId="tx-skip"
            empty={<span>{listEmpty}</span>}
          />
        )}
      </div>

      <Dialog open={detail.open} onOpenChange={detail.onOpenChange}>
        <DialogContent className="max-w-lg sm:max-w-xl" closeLabel={closeLabel || undefined}>
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
            <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
          </DialogHeader>
          {detail.value ? (
            <div className="grid max-h-[min(70dvh,36rem)] gap-3 overflow-y-auto sm:grid-cols-2">
              <Field id="tx-d-kind" label={chromeOpt(c, "list_col_kind")}>
                <Input
                  id="tx-d-kind"
                  readOnly
                  value={
                    chromeOpt(c, `list_kind_${(detail.value.kind || "").trim()}`).trim() ||
                    emptyValue
                  }
                />
              </Field>
              <Field id="tx-d-status" label={chromeOpt(c, "list_col_status")}>
                <Input
                  id="tx-d-status"
                  readOnly
                  value={
                    chromeOpt(c, `list_status_${txnDisplayStatusCode(detail.value)}`).trim() ||
                    emptyValue
                  }
                  className={paidStatusTextClass(txnDisplayStatusCode(detail.value))}
                />
              </Field>
              <Field id="tx-d-amount" label={chromeOpt(c, "list_col_amount")}>
                <Input
                  id="tx-d-amount"
                  readOnly
                  value={
                    typeof detail.value.amount === "number" && (detail.value.currency || "").trim()
                      ? `${detail.value.amount}${amountSep}${detail.value.currency}`
                      : emptyValue
                  }
                />
              </Field>
              <Field id="tx-d-ref" label={(chrome.list_col_reference || "").trim()}>
                <Input
                  id="tx-d-ref"
                  readOnly
                  value={(detail.value.reference || "").trim() || emptyValue}
                />
              </Field>
              <Field id="tx-d-date" label={chromeOpt(c, "list_col_date")} className="sm:col-span-2">
                <Input
                  id="tx-d-date"
                  readOnly
                  value={
                    detail.value.created_at
                      ? new Date(detail.value.created_at).toLocaleString()
                      : emptyValue
                  }
                />
              </Field>
              {proofLabel ? (
                <div className="space-y-1 text-sm sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
                    {proofLabel}
                  </p>
                  {proofUrl ? (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-[var(--dama-border)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proofUrl}
                        alt={proofLabel || emptyValue}
                        className="max-h-64 w-full object-contain"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-[var(--dama-muted)]">{emptyValue}</p>
                  )}
                  {detailNeedsProof && awaitingProofBlurb ? (
                    <p className="text-sm text-[var(--dama-muted)]">{awaitingProofBlurb}</p>
                  ) : null}
                </div>
              ) : detailNeedsProof && awaitingProofBlurb ? (
                <p className="text-sm text-[var(--dama-muted)] sm:col-span-2">
                  {awaitingProofBlurb}
                </p>
              ) : null}
            </div>
          ) : null}
          {closeLabel ||
          (detailReceiptId && openDocLabel) ||
          (detailNeedsProof && submitProofLabel && detailSubmitHref) ? (
            <DialogFooter damaDialogFooter>
              {closeLabel ? (
                <Button type="button" variant="outline" onClick={() => detail.close()}>
                  {closeLabel}
                </Button>
              ) : null}
              {detailNeedsProof && submitProofLabel && detailSubmitHref ? (
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    detail.close();
                    router.push(detailSubmitHref);
                  }}
                >
                  {submitProofLabel}
                </Button>
              ) : null}
              {detailReceiptId && openDocLabel && receiptsBase ? (
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    detail.close();
                    router.push(`${receiptsBase}/${encodeURIComponent(detailReceiptId)}`);
                  }}
                >
                  {openDocLabel}
                </Button>
              ) : null}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </PortalPageShell>
  );
}
