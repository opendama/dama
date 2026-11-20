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
  ReceiptsPageSkeleton,
  ShimmerBlock,
} from "@/components/ui/shimmer-skeletons";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useMyReceiptQuery } from "@/hooks/query/useMyReceiptQuery";
import { type MyPaymentReceipt, useMyReceiptsQuery } from "@/hooks/query/useMyReceiptsQuery";
import { usePaymentRouteQuery } from "@/hooks/query/usePaymentRouteQuery";
import { useWalletChromeQuery } from "@/hooks/query/useWalletChromeQuery";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { paidStatusTextClass, receiptDisplayStatusCode } from "@/lib/payment-status-display";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isPlayerDashboardChromeReady } from "@/types/platform";
import { isWalletChromeReady } from "@/types/wallet-chrome";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function chromeOpt(chrome: Record<string, unknown> | undefined, key: string): string {
  const v = chrome?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type ReceiptsWorkspaceProps = {
  /** Prefix for sibling money routes, e.g. "/events" or "/ads". Empty = player portal. */
  moneyBasePath?: string;
};

/**
 * Receipts list only. Manual transfer submit lives on ManualTransferWorkspace.
 * Shared by player, events organizer, and ads publisher portals.
 */
export function ReceiptsWorkspace({ moneyBasePath = "" }: ReceiptsWorkspaceProps) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = (searchParams.get("id") || "").trim();
  const deepLinkOpenedFor = useRef<string | null>(null);
  const portalMode = Boolean((moneyBasePath || "").trim());
  const navQuery = useClientNavFullQuery(!portalMode);
  const nav = isPlayerDashboardChromeReady(navQuery.data) ? navQuery.data : undefined;
  const panel = (nav?.dashboard ?? []).find((p) => (p.route_key || "").trim() === "receipts");
  const blurb = portalMode ? "" : (panel?.body || "").trim();

  const chromeQuery = useWalletChromeQuery(Boolean(token));
  const chrome = isWalletChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const openReceiptDetail = useCallback(
    (id: string, opts?: { download?: boolean }) => {
      const rid = (id || "").trim();
      if (!rid) return;
      const hrefRaw = chromeOpt(
        chromeQuery.data as unknown as Record<string, unknown> | undefined,
        "link_receipts_href",
      );
      if (!hrefRaw) return;
      const base = (moneyBasePath || "").replace(/\/$/, "");
      const p = hrefRaw.startsWith("/") ? hrefRaw : `/${hrefRaw}`;
      const receiptsBase = base ? `${base}${p}` : p;
      const qs = opts?.download ? "?download=1" : "";
      router.push(`${receiptsBase}/${encodeURIComponent(rid)}${qs}`);
    },
    [router, moneyBasePath, chromeQuery.data],
  );
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const title = portalMode
    ? chromeOpt(chrome as unknown as Record<string, unknown> | undefined, "link_receipts_label")
    : (panel?.title || "").trim() ||
      chromeOpt(chrome as unknown as Record<string, unknown> | undefined, "link_receipts_label");
  const geoQuery = useDetectBrowserCountryQuery(Boolean(token));
  const country = geoQuery.data ?? "";
  const routeQuery = usePaymentRouteQuery(Boolean(country));
  const isManual = routeQuery.data?.provider === "manual_transfer";

  const [skip, setSkip] = useUrlSkip("skip");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 250);
  const detailDialog = useDeferredDialogValue<MyPaymentReceipt>();
  const detailId = (detailDialog.value?.id || "").trim();
  const detailQuery = useMyReceiptQuery(
    token,
    detailId,
    Boolean(token && detailDialog.open && detailId),
  );
  const listQuery = useMyReceiptsQuery(
    token,
    skip,
    pageSize,
    search,
    Boolean(token) && pageSize > 0,
  );

  useResetSkipOnChange(setSkip, [search]);

  // Seed list search with deep-link id so the row is more likely on page 0.
  useEffect(() => {
    if (!focusId) return;
    setSearchInput((prev) => (prev.trim() ? prev : focusId));
  }, [focusId]);

  const rows = listQuery.data?.receipts ?? [];

  // Trim parity: /receipts?id= → full receipt page /receipts/{id} (prefer page over dialog).
  // biome-ignore lint/correctness/useExhaustiveDependencies: open once per id; omit openReceiptDetail identity
  useEffect(() => {
    if (!focusId) {
      deepLinkOpenedFor.current = null;
      return;
    }
    if (deepLinkOpenedFor.current === focusId) return;
    deepLinkOpenedFor.current = focusId;
    openReceiptDetail(focusId);
  }, [focusId]);

  const columns = useMemo((): OpsColumn<MyPaymentReceipt>[] => {
    if (!chrome) return [];
    const c = chrome as unknown as Record<string, unknown>;
    const dateH = chromeOpt(c, "list_col_date");
    const amountH = chromeOpt(c, "list_col_amount");
    const statusH = chromeOpt(c, "list_col_status");
    const refH = chromeOpt(c, "list_col_reference");
    const viewH = chromeOpt(c, "list_col_view");
    const viewDetailH = chromeOpt(c, "receipt_view_detail");
    const openDocH = chromeOpt(c, "receipt_open_document_action") || viewH;
    const actionsH = chromeOpt(c, "list_row_actions");
    const downloadH = chromeOpt(c, "receipt_download_action");
    const sep = chromeSeparator(chrome.amount_currency_separator);
    const empty = (chrome.empty_value || "").trim();
    if (!chromeSeparatorPresent(sep) || !empty) return [];

    const cols: OpsColumn<MyPaymentReceipt>[] = [
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
        id: "amount",
        header: amountH,
        cell: (row) => (
          <span className="font-mono text-sm text-[var(--dama-gold)]">
            {typeof row.amount === "number" && (row.currency || "").trim()
              ? `${row.amount}${sep}${row.currency}`
              : empty}
          </span>
        ),
      },
      {
        id: "status",
        header: statusH,
        cell: (row) => {
          const code = receiptDisplayStatusCode(row);
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
    if (viewDetailH || viewH) {
      cols.push({
        id: "view",
        header: viewDetailH || viewH,
        className: "w-24",
        cell: (row) => (
          <button
            type="button"
            className="text-left text-sm underline-offset-4 hover:underline"
            onClick={() => detailDialog.openWith(row)}
          >
            {viewDetailH || viewH}
          </button>
        ),
      });
    }
    if (actionsH) {
      cols.push({
        id: "actions",
        header: actionsH,
        className: "w-12",
        cell: (row) => (
          <OpsDataTableRowActions
            triggerLabel={actionsH}
            actions={[
              ...(viewDetailH
                ? [
                    {
                      id: "detail",
                      label: viewDetailH,
                      onSelect: () => detailDialog.openWith(row),
                    },
                  ]
                : []),
              ...(openDocH
                ? [
                    {
                      id: "view",
                      label: openDocH,
                      onSelect: () => openReceiptDetail(row.id),
                    },
                  ]
                : []),
              ...(downloadH
                ? [
                    {
                      id: "download",
                      label: downloadH,
                      onSelect: () => openReceiptDetail(row.id, { download: true }),
                    },
                  ]
                : []),
            ]}
          />
        ),
      });
    }
    return cols.filter((col) => Boolean(col.header.trim()));
  }, [chrome, openReceiptDetail, detailDialog]);

  if (!hydrated || (!portalMode && navQuery.isLoading) || chromeQuery.isLoading) {
    return <ReceiptsPageSkeleton columns={6} showManualForm={false} showBlurb={!portalMode} />;
  }
  if (!token || !chrome || !title) return null;

  const c = chrome as unknown as Record<string, unknown>;
  const searchLabel = chromeOpt(c, "list_search_label");
  const searchPh = chromeOpt(c, "list_search_placeholder");
  const listEmpty = chromeOpt(c, "list_empty_receipts");
  const emptyValue = (chrome.empty_value || "").trim();
  const detailTitle = chromeOpt(c, "list_detail_title");
  const closeLabel = chromeOpt(c, "dialog_close_label");
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
  const softFetching = listQuery.isFetching && !listQuery.isLoading;
  const detail = detailQuery.data ?? detailDialog.value;
  const detailStatusCode = detail ? receiptDisplayStatusCode(detail) : "";
  const statusDisp = detailStatusCode
    ? chromeOpt(c, `list_status_${detailStatusCode}`).trim() || emptyValue
    : emptyValue;
  // Prefer hydrated detail URL; fall back to list-row seed so proof never blanks while refetching.
  const proofUrl =
    resolvePublicMediaUrl(detail?.receipt_url) ||
    resolvePublicMediaUrl(detailDialog.value?.receipt_url) ||
    "";
  const openDocLabel =
    chromeOpt(c, "receipt_open_document_action") || chromeOpt(c, "list_col_view");
  const downloadLabel = chromeOpt(c, "receipt_download_action");
  const proofLabel = chromeOpt(c, "receipt_proof_label");

  const transferHrefRaw = chromeOpt(c, "link_manual_transfer_href");
  const transferLabel = chromeOpt(c, "link_manual_transfer_label");
  const base = (moneyBasePath || "").replace(/\/$/, "");
  const transferHref = (() => {
    if (!transferHrefRaw) return "";
    const p = transferHrefRaw.startsWith("/") ? transferHrefRaw : `/${transferHrefRaw}`;
    return base ? `${base}${p}` : p;
  })();

  return (
    <PortalPageShell
      title={title}
      blurb={blurb}
      actions={
        isManual && transferLabel && transferHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={transferHref}>{transferLabel}</Link>
          </Button>
        ) : null
      }
    >
      <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] shadow-[var(--dama-card-shadow)]">
        <div className="border-b border-[var(--dama-border)] p-4">
          {searchLabel ? (
            <Field id="rcpt-search" label={searchLabel} className="w-full sm:max-w-md">
              <Input
                id="rcpt-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={searchPh}
                autoComplete="off"
              />
            </Field>
          ) : (
            <Input
              id="rcpt-search"
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
            <OpsDataTableSkeleton columns={6} rows={6} embedded />
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
            pageInputId="rcpt-skip"
            empty={<span>{listEmpty}</span>}
          />
        )}
      </div>

      <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
        <DialogContent className="max-w-lg sm:max-w-xl" closeLabel={closeLabel || undefined}>
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
              <Field
                id="rcpt-d-id"
                label={chromeOpt(c, "receipt_label_id") || chromeOpt(c, "list_col_reference")}
              >
                <Input id="rcpt-d-id" readOnly value={(detail.id || "").trim() || emptyValue} />
              </Field>
              <Field id="rcpt-d-status" label={chromeOpt(c, "list_col_status")}>
                <Input
                  id="rcpt-d-status"
                  readOnly
                  value={statusDisp}
                  className={paidStatusTextClass(detailStatusCode)}
                />
              </Field>
              <Field id="rcpt-d-amount" label={chromeOpt(c, "list_col_amount")}>
                <Input
                  id="rcpt-d-amount"
                  readOnly
                  value={
                    typeof detail.amount === "number" && (detail.currency || "").trim()
                      ? `${detail.amount}${amountSep}${detail.currency}`
                      : emptyValue
                  }
                />
              </Field>
              <Field id="rcpt-d-provider" label={chromeOpt(c, "receipt_provider_label")}>
                <Input
                  id="rcpt-d-provider"
                  readOnly
                  value={(detail.provider || "").trim() || emptyValue}
                />
              </Field>
              <Field id="rcpt-d-ref" label={chromeOpt(c, "list_col_reference")}>
                <Input
                  id="rcpt-d-ref"
                  readOnly
                  value={(detail.reference || "").trim() || emptyValue}
                />
              </Field>
              <Field id="rcpt-d-intent" label={chromeOpt(c, "receipt_intent_id_label")}>
                <Input
                  id="rcpt-d-intent"
                  readOnly
                  value={(detail.intent_id || "").trim() || emptyValue}
                />
              </Field>
              <Field id="rcpt-d-date" label={chromeOpt(c, "list_col_date")}>
                <Input
                  id="rcpt-d-date"
                  readOnly
                  value={
                    detail.created_at ? new Date(detail.created_at).toLocaleString() : emptyValue
                  }
                />
              </Field>
              <Field id="rcpt-d-reviewed" label={chromeOpt(c, "receipt_reviewed_at_label")}>
                <Input
                  id="rcpt-d-reviewed"
                  readOnly
                  value={
                    detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : emptyValue
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
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter damaDialogFooter>
            <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
              {closeLabel}
            </Button>
            {detail && downloadLabel ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const id = (detail.id || "").trim();
                  detailDialog.close();
                  if (id) openReceiptDetail(id, { download: true });
                }}
              >
                {downloadLabel}
              </Button>
            ) : null}
            {detail && openDocLabel ? (
              <Button
                type="button"
                variant="gold"
                onClick={() => {
                  const id = (detail.id || "").trim();
                  detailDialog.close();
                  if (id) openReceiptDetail(id);
                }}
              >
                {openDocLabel}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPageShell>
  );
}
