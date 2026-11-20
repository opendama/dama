"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AmountInput } from "@/components/ui/amount-input";
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
import { OpsDataTableSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useCreateEventsCatalogSizeMutation,
  useDeleteEventsCatalogSizeMutation,
  useToggleEventsCatalogSizeMutation,
  useUpdateEventsCatalogSizeMutation,
} from "@/hooks/mutation/useEventsCatalogSizeMutations";
import { useAdminEventsCatalogSizesQuery } from "@/hooks/query/useAdminEventsCatalogSizesQuery";
import { usePaymentCurrencyQuery } from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import {
  classicSeatCeiling,
  formatSeatCapDisplay,
  sizeIsUnlimitedMode,
} from "@/lib/seat-cap-display";
import type { EventsAdminChrome } from "@/types/events-admin-chrome";
import type { EventsCatalogFormat, EventsCatalogSize } from "@/types/events-catalog";
import { useEffect, useMemo, useState } from "react";

type SizeFormMode = { kind: "create" } | { kind: "edit"; size: EventsCatalogSize };

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!(label || "").trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--dama-muted)]">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseSearchDebounceMs(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function money(
  amount: number | undefined,
  currency: string | undefined,
  sep: string,
  empty: string,
) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return empty;
  const cur = (currency || "").trim();
  // Separator may be a single space from DB chrome; do not trim it away.
  if (!cur || typeof sep !== "string" || sep.length === 0) return empty;
  return `${amount}${sep}${cur}`;
}

export function HostSizesCatalogSection({
  token,
  chrome,
  formats,
  swissRoundsByMaxPlayers,
  arenaFormatId: arenaFormatIdProp,
  canManage,
}: {
  token: string | null | undefined;
  chrome: Required<EventsAdminChrome>;
  formats: EventsCatalogFormat[];
  swissRoundsByMaxPlayers: Record<string, number>;
  /** DB client_enums.hosted_event_arena_format (never invent "arena"). */
  arenaFormatId: string;
  canManage: boolean;
}) {
  const pageSize = parseListPageSize(chrome.list_page_size);
  const searchDebounceMs = parseSearchDebounceMs(chrome.search_debounce_ms);
  const [skip, setSkip] = useUrlSkip("sizeSkip");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), searchDebounceMs);
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EventsCatalogSize | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [sizeId, setSizeId] = useState("");
  const [label, setLabel] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [sortOrder, setSortOrder] = useState("");
  const [ethiopiaFee, setEthiopiaFee] = useState("");
  const [globalFee, setGlobalFee] = useState("");
  const [allowedFormats, setAllowedFormats] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [formAttempted, setFormAttempted] = useState(false);
  const arenaFormatId = useMemo(() => {
    const fromEnums = (arenaFormatIdProp || "").trim();
    if (fromEnums && formats.some((f) => f.id === fromEnums)) return fromEnums;
    return "";
  }, [arenaFormatIdProp, formats]);

  const formDialog = useDeferredDialogValue<SizeFormMode>();
  const detailDialog = useDeferredDialogValue<EventsCatalogSize>();
  const currencyQuery = usePaymentCurrencyQuery();
  const etCur = (currencyQuery.data?.ethiopia || "").trim().toUpperCase();
  const glCur = (currencyQuery.data?.global || "").trim().toUpperCase();
  const emptyChrome = (chrome.empty_value || "").trim();
  const geoBlurb = (chrome.host_fee_geo_blurb || "")
    .replaceAll("{ethiopia}", etCur || emptyChrome)
    .replaceAll("{global}", glCur || emptyChrome);

  useResetSkipOnChange(setSkip, [debouncedSearch, statusFilter]);
  const sizesQuery = useAdminEventsCatalogSizesQuery(
    token,
    canManage && pageSize > 0,
    skip,
    pageSize,
    { q: debouncedSearch, status: statusFilter },
  );
  const create = useCreateEventsCatalogSizeMutation(token);
  const update = useUpdateEventsCatalogSizeMutation(token);
  const toggle = useToggleEventsCatalogSizeMutation(token);
  const remove = useDeleteEventsCatalogSizeMutation(token);

  const formMode = formDialog.value;
  const isEditing = formMode?.kind === "edit";
  const formPending = create.isPending || update.isPending;
  const empty = emptyChrome;
  const sep =
    typeof chrome.amount_currency_separator === "string" ? chrome.amount_currency_separator : "";
  const pageSizes = sizesQuery.data?.sizes ?? [];
  const softFetching = sizesQuery.isFetching && !sizesQuery.isLoading;
  const currencyReady = Boolean(etCur) && Boolean(glCur) && !currencyQuery.isLoading;

  useEffect(() => {
    if (!formDialog.open || !formMode) return;
    setFormAttempted(false);
    if (formMode.kind === "create") {
      setSizeId("");
      setLabel("");
      setMaxPlayers("");
      setUnlimited(false);
      setSortOrder("");
      setEthiopiaFee("");
      setGlobalFee("");
      setAllowedFormats(formats.filter((f) => f.enabled).map((f) => f.id));
      setEnabled(true);
      return;
    }
    const s = formMode.size;
    setSizeId(s.id);
    setLabel(s.label);
    const unlim = sizeIsUnlimitedMode(s.max_players, swissRoundsByMaxPlayers);
    setUnlimited(unlim);
    setMaxPlayers(s.max_players != null && Number(s.max_players) >= 2 ? String(s.max_players) : "");
    setSortOrder(String(s.sort_order ?? ""));
    setEthiopiaFee(
      typeof s.host_fee_ethiopia_amount === "number" && s.host_fee_ethiopia_amount > 0
        ? String(s.host_fee_ethiopia_amount)
        : "",
    );
    setGlobalFee(
      typeof s.host_fee_global_amount === "number" && s.host_fee_global_amount > 0
        ? String(s.host_fee_global_amount)
        : "",
    );
    setAllowedFormats([...(s.allowed_format_ids || [])]);
    setEnabled(s.enabled);
  }, [formDialog.open, formMode, formats, swissRoundsByMaxPlayers]);

  async function bulkSetActive(active: boolean) {
    const ids = selectedRowIds(rowSelection);
    if (!ids.length) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        await toggle.mutateAsync({ id, active });
      }
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  const columns = useMemo((): OpsColumn<EventsCatalogSize>[] => {
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.sizes_actions_label || "").trim();
    return [
      {
        id: "label",
        header: (chrome.sizes_col_label || "").trim(),
        cell: (s: EventsCatalogSize) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{(s.label || "").trim() || empty}</p>
            <p className="truncate font-mono text-xs text-[var(--dama-muted)]">
              {(s.id || "").trim() || empty}
            </p>
          </div>
        ),
      },
      {
        id: "max_players",
        header: (chrome.sizes_col_max_players || "").trim(),
        className: "w-28",
        cell: (s: EventsCatalogSize) => (
          <span className="text-sm">
            {formatSeatCapDisplay(
              s.max_players,
              swissRoundsByMaxPlayers,
              chrome.unlimited_players_label || "",
              empty,
            )}
          </span>
        ),
      },
      {
        id: "ethiopia_fee",
        header: (chrome.sizes_col_ethiopia_fee || "").trim(),
        cell: (s: EventsCatalogSize) => (
          <span className="text-sm tabular-nums">
            {money(s.host_fee_ethiopia_amount, s.host_fee_ethiopia_currency, sep, empty)}
          </span>
        ),
      },
      {
        id: "global_fee",
        header: (chrome.sizes_col_global_fee || "").trim(),
        cell: (s: EventsCatalogSize) => (
          <span className="text-sm tabular-nums">
            {money(s.host_fee_global_amount, s.host_fee_global_currency, sep, empty)}
          </span>
        ),
      },
      {
        id: "formats",
        header: (chrome.sizes_col_formats || "").trim(),
        cell: (s: EventsCatalogSize) => (
          <span className="text-sm">
            {(s.allowed_format_ids || [])
              .map((id: string) => (formats.find((f) => f.id === id)?.label || "").trim())
              .filter(Boolean)
              .join(", ") || empty}
          </span>
        ),
      },
      {
        id: "status",
        header: (chrome.sizes_col_status || "").trim(),
        className: "w-28",
        cell: (s: EventsCatalogSize) => (
          <span className="text-sm">
            {s.enabled ? chrome.sizes_active_label : chrome.sizes_inactive_label}
          </span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (s: EventsCatalogSize) => (
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline"
                  onClick={() => detailDialog.openWith(s)}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<EventsCatalogSize>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel || "",
        className: "w-12 text-right",
        cell: (s: EventsCatalogSize) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              ...(viewLabel
                ? [{ id: "view", label: viewLabel, onSelect: () => detailDialog.openWith(s) }]
                : []),
              {
                id: "edit",
                label: (chrome.sizes_edit_action || "").trim(),
                onSelect: () => formDialog.openWith({ kind: "edit", size: s }),
              },
              {
                id: "toggle",
                label: (
                  (s.enabled ? chrome.sizes_inactive_label : chrome.sizes_active_label) || ""
                ).trim(),
                pendingLabel: (chrome.sizes_status_pending || "").trim(),
                isLoading: toggle.isPending && toggle.variables?.id === s.id,
                onSelect: () => toggle.mutate({ id: s.id, active: !s.enabled }),
              },
              {
                id: "delete",
                label: (chrome.sizes_delete_action || "").trim(),
                destructive: true,
                onSelect: () => setDeleteTarget(s),
              },
            ]}
          />
        ),
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, detailDialog, empty, formDialog, formats, sep, swissRoundsByMaxPlayers, toggle]);

  function submitForm() {
    setFormAttempted(true);
    if (!currencyReady) return;
    const etAmt = Number(ethiopiaFee);
    const glAmt = Number(globalFee);
    const formatsForSave = unlimited && arenaFormatId ? [arenaFormatId] : allowedFormats;
    if (!label.trim() || !(etAmt > 0) || !(glAmt > 0) || !formatsForSave.length) {
      return;
    }
    let maxPayload: number | null = null;
    if (unlimited) {
      if (!arenaFormatId) return;
      const raw = maxPlayers.trim();
      if (raw !== "") {
        const maxP = Number(raw);
        if (!(maxP >= 2)) return;
        // Unlimited mode: empty (null) or high safety only; classic-range would save as fixed Arena.
        const ceiling = classicSeatCeiling(swissRoundsByMaxPlayers);
        if (ceiling >= 2 && maxP <= ceiling) return;
        maxPayload = maxP;
      }
    } else {
      const maxP = Number(maxPlayers);
      if (!(maxP >= 2)) return;
      // Fixed classic sizes must stay at or below the DB swiss ceiling.
      const ceiling = classicSeatCeiling(swissRoundsByMaxPlayers);
      if (ceiling >= 2 && maxP > ceiling) return;
      maxPayload = maxP;
    }
    if (!isEditing && !sizeId.trim()) return;
    const payload = {
      label: label.trim(),
      enabled,
      max_players: maxPayload,
      host_fee_ethiopia_amount: etAmt,
      host_fee_global_amount: glAmt,
      allowed_format_ids: formatsForSave,
      ...(sortOrder.trim() ? { sort_order: Number(sortOrder) } : {}),
    };
    if (isEditing && formMode?.kind === "edit") {
      update.mutate({ id: formMode.size.id, ...payload }, { onSuccess: () => formDialog.close() });
      return;
    }
    create.mutate({ id: sizeId.trim(), ...payload }, { onSuccess: () => formDialog.close() });
  }

  const closeLabel = (chrome.sizes_dialog_close_label || "").trim();
  const cancelLabel = (chrome.sizes_cancel_action || "").trim();
  const saveLabel = (chrome.sizes_save_action || "").trim();
  const savePending = (chrome.sizes_save_pending || "").trim();
  const formTitle = isEditing
    ? (chrome.sizes_edit_action || "").trim()
    : (chrome.sizes_add_action || "").trim();
  const formReady =
    Boolean(closeLabel) &&
    Boolean(cancelLabel) &&
    Boolean(saveLabel) &&
    Boolean(savePending) &&
    Boolean(formTitle);
  const detail = detailDialog.value;
  const emptyLabel = (chrome.sizes_empty || "").trim();

  if (!canManage) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {chrome.sizes_title}
          </h2>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{geoBlurb}</p>
        </div>
        <Button
          variant="gold"
          disabled={!currencyReady || pageSize <= 0}
          onClick={() => formDialog.openWith({ kind: "create" })}
        >
          {chrome.sizes_add_action}
        </Button>
      </div>

      {sizesQuery.isLoading || pageSize <= 0 || !currencyReady ? (
        <OpsDataTableSkeleton />
      ) : (
        <>
          <AdminFilterBar
            filters={[
              {
                kind: "search",
                id: "admin-host-sizes-search",
                label: (chrome.sizes_search_label || "").trim(),
                value: search,
                onChange: setSearch,
                placeholder: (chrome.sizes_search_placeholder || "").trim() || undefined,
              },
              {
                kind: "select",
                id: "admin-host-sizes-status",
                label: (chrome.sizes_col_status || "").trim(),
                value: statusFilter,
                onChange: setStatusFilter,
                allLabel: (chrome.filter_all_label || "").trim() || undefined,
                options: [
                  { value: "active", label: (chrome.sizes_active_label || "").trim() },
                  { value: "inactive", label: (chrome.sizes_inactive_label || "").trim() },
                ].filter((o) => Boolean(o.label)),
              },
            ]}
          />
          <OpsDataTable
            columns={columns}
            data={pageSizes}
            getRowId={(s) => s.id}
            isFetching={softFetching}
            meta={sizesQuery.data?.meta}
            onPage={(next) => {
              setSkip(next);
              setRowSelection({});
            }}
            pageDisabled={softFetching || bulkPending}
            pageInputId="admin-host-sizes-skip"
            bodyRowClassName={(s) =>
              s.enabled ? undefined : "opacity-60 text-[var(--dama-muted)]"
            }
            empty={
              emptyLabel ? (
                <p className="py-8 text-center text-sm text-[var(--dama-muted)]">{emptyLabel}</p>
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
                  <Button
                    size="sm"
                    variant="gold"
                    isLoading={bulkPending}
                    pendingLabel={chrome.sizes_bulk_status_pending}
                    disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                    onClick={() => void bulkSetActive(true)}
                  >
                    {chrome.sizes_bulk_activate_action}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={bulkPending}
                    pendingLabel={chrome.sizes_bulk_status_pending}
                    disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                    onClick={() => void bulkSetActive(false)}
                  >
                    {chrome.sizes_bulk_deactivate_action}
                  </Button>
                  {(chrome.sizes_delete_action || "").trim() ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                      isLoading={bulkPending}
                      pendingLabel={(chrome.sizes_delete_pending || "").trim()}
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      {(chrome.sizes_delete_action || "").trim()}
                    </Button>
                  ) : null}
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

      {formReady ? (
        <Dialog open={formDialog.open} onOpenChange={formDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{formTitle}</DialogTitle>
              <DialogDescription className="sr-only">{formTitle}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="host-size-id" label={(chrome.sizes_col_id || "").trim()}>
                <Input
                  id="host-size-id"
                  value={sizeId}
                  onChange={(e) => setSizeId(e.target.value.trim())}
                  disabled={isEditing || formPending}
                  autoComplete="off"
                  className="font-mono"
                />
              </Field>
              <Field id="host-size-label" label={(chrome.sizes_col_label || "").trim()}>
                <Input
                  id="host-size-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={formPending}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="host-size-max"
                label={(chrome.sizes_col_max_players || "").trim()}
                error={
                  formAttempted
                    ? (() => {
                        const raw = maxPlayers.trim();
                        const maxP = Number(raw);
                        const ceiling = classicSeatCeiling(swissRoundsByMaxPlayers);
                        if (unlimited) {
                          // Unlimited mode: empty (null) or high safety only; typed lt2 / classic-range reject.
                          if (raw !== "" && (!(maxP >= 2) || (ceiling >= 2 && maxP <= ceiling))) {
                            return (
                              (chrome.err_unlimited_max_high_or_empty || "").trim() || undefined
                            );
                          }
                          return undefined;
                        }
                        if (!(maxP >= 2)) return undefined;
                        if (ceiling >= 2 && maxP > ceiling) {
                          return (chrome.err_unlimited_arena_only || "").trim() || undefined;
                        }
                        return undefined;
                      })()
                    : undefined
                }
              >
                <Input
                  id="host-size-max"
                  type="number"
                  min={2}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(sanitizeIntegerInput(e.target.value))}
                  disabled={formPending}
                  inputMode="numeric"
                  placeholder={
                    unlimited
                      ? (chrome.sizes_max_players_placeholder || "").trim() || undefined
                      : undefined
                  }
                />
              </Field>
              <Field id="host-size-sort" label={(chrome.sizes_sort_order_label || "").trim()}>
                <Input
                  id="host-size-sort"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => {
                    const digits = sanitizeIntegerInput(e.target.value);
                    setSortOrder(digits);
                  }}
                  disabled={formPending}
                  inputMode="numeric"
                />
              </Field>
              <Field
                id="host-size-et-fee"
                label={(chrome.host_fee_ethiopia_amount_label || "").trim()}
              >
                <AmountInput
                  id="host-size-et-fee"
                  value={ethiopiaFee}
                  onValueChange={setEthiopiaFee}
                  disabled={formPending}
                  maxDecimals={2}
                />
              </Field>
              <Field
                id="host-size-et-cur"
                label={(chrome.host_fee_ethiopia_currency_label || "").trim()}
              >
                <Input
                  id="host-size-et-cur"
                  value={etCur}
                  disabled
                  className="font-mono uppercase"
                />
              </Field>
              <Field
                id="host-size-gl-fee"
                label={(chrome.host_fee_global_amount_label || "").trim()}
              >
                <AmountInput
                  id="host-size-gl-fee"
                  value={globalFee}
                  onValueChange={setGlobalFee}
                  disabled={formPending}
                  maxDecimals={2}
                />
              </Field>
              <Field
                id="host-size-gl-cur"
                label={(chrome.host_fee_global_currency_label || "").trim()}
              >
                <Input
                  id="host-size-gl-cur"
                  value={glCur}
                  disabled
                  className="font-mono uppercase"
                />
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="host-size-unlimited"
                  checked={unlimited}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    setUnlimited(on);
                    if (on) {
                      if (arenaFormatId) setAllowedFormats([arenaFormatId]);
                    }
                  }}
                  disabled={formPending || !arenaFormatId}
                />
                <div className="min-w-0">
                  <label htmlFor="host-size-unlimited" className="text-sm">
                    {(chrome.sizes_unlimited_toggle_label || "").trim()}
                  </label>
                  {(chrome.sizes_unlimited_blurb || "").trim() ? (
                    <p className="mt-0.5 text-xs text-[var(--dama-muted)]">
                      {(chrome.sizes_unlimited_blurb || "").trim()}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-[var(--dama-muted)]">{chrome.allowed_formats_label}</p>
              <div className="flex flex-wrap gap-3">
                {formats.map((f) => {
                  const inputId = `host-size-fmt-${f.id}`;
                  const checked = unlimited
                    ? f.id === arenaFormatId
                    : allowedFormats.includes(f.id);
                  return (
                    <div key={inputId} className="flex items-center gap-2">
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        onCheckedChange={(v) => {
                          if (unlimited) return;
                          setAllowedFormats((prev) => {
                            const set = new Set(prev);
                            if (v === true) set.add(f.id);
                            else set.delete(f.id);
                            return Array.from(set);
                          });
                        }}
                        disabled={formPending || unlimited}
                      />
                      <label htmlFor={inputId} className="text-xs">
                        {(f.label || "").trim()}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Checkbox
                id="host-size-enabled"
                checked={enabled}
                onCheckedChange={(v) => setEnabled(v === true)}
                disabled={formPending}
              />
              <label htmlFor="host-size-enabled" className="text-sm">
                {chrome.enabled_label}
              </label>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => formDialog.close()} disabled={formPending}>
                {cancelLabel}
              </Button>
              <Button
                variant="gold"
                isLoading={formPending}
                pendingLabel={savePending}
                disabled={!currencyReady || formPending}
                onClick={submitForm}
              >
                {saveLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {closeLabel ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel}>
            <DialogHeader>
              <DialogTitle>{chrome.sizes_detail_title}</DialogTitle>
              <DialogDescription className="sr-only">{chrome.sizes_detail_title}</DialogDescription>
            </DialogHeader>
            {detail ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label={chrome.sizes_col_id} value={detail.id} />
                <DetailRow label={chrome.sizes_col_label} value={detail.label} />
                <DetailRow
                  label={chrome.sizes_col_max_players}
                  value={formatSeatCapDisplay(
                    detail.max_players,
                    swissRoundsByMaxPlayers,
                    chrome.unlimited_players_label || "",
                    empty,
                  )}
                />
                <DetailRow
                  label={chrome.sizes_col_status}
                  value={detail.enabled ? chrome.sizes_active_label : chrome.sizes_inactive_label}
                />
                <DetailRow
                  label={chrome.host_fee_ethiopia_amount_label}
                  value={money(
                    detail.host_fee_ethiopia_amount,
                    detail.host_fee_ethiopia_currency,
                    sep,
                    empty,
                  )}
                />
                <DetailRow
                  label={chrome.host_fee_global_amount_label}
                  value={money(
                    detail.host_fee_global_amount,
                    detail.host_fee_global_currency,
                    sep,
                    empty,
                  )}
                />
                <DetailRow
                  label={chrome.sizes_col_formats}
                  value={
                    (detail.allowed_format_ids || [])
                      .map((id) => (formats.find((f) => f.id === id)?.label || "").trim())
                      .filter(Boolean)
                      .join(", ") || empty
                  }
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {cancelLabel &&
      (chrome.sizes_delete_action || "").trim() &&
      (chrome.sizes_delete_confirm || "").trim() &&
      (chrome.sizes_delete_pending || "").trim() ? (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open && !remove.isPending) setDeleteTarget(null);
          }}
          title={chrome.sizes_delete_action}
          description={chrome.sizes_delete_confirm}
          cancelLabel={cancelLabel}
          confirmLabel={chrome.sizes_delete_action}
          pendingLabel={chrome.sizes_delete_pending}
          isPending={remove.isPending}
          destructive
          onConfirm={() => {
            if (!deleteTarget) return;
            remove.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      ) : null}

      {cancelLabel &&
      (chrome.sizes_delete_action || "").trim() &&
      (chrome.sizes_delete_confirm || "").trim() &&
      (chrome.sizes_delete_pending || "").trim() ? (
        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={(open) => {
            if (!open && !bulkPending) setBulkDeleteOpen(false);
          }}
          title={chrome.sizes_delete_action}
          description={chrome.sizes_delete_confirm}
          cancelLabel={cancelLabel}
          confirmLabel={chrome.sizes_delete_action}
          pendingLabel={chrome.sizes_delete_pending}
          isPending={bulkPending}
          destructive
          onConfirm={() => {
            const ids = selectedRowIds(rowSelection);
            if (!ids.length) return;
            setBulkPending(true);
            void (async () => {
              try {
                for (const id of ids) {
                  await remove.mutateAsync(id);
                }
                setRowSelection({});
                setBulkDeleteOpen(false);
              } finally {
                setBulkPending(false);
              }
            })();
          }}
        />
      ) : null}
    </section>
  );
}
