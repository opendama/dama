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
import {
  BanksListBodySkeleton,
  BanksListSkeleton,
  ShimmerBlock,
} from "@/components/ui/shimmer-skeletons";
import {
  useCreateBankMutation,
  useDeleteBankMutation,
  useToggleBankMutation,
  useUpdateBankMutation,
} from "@/hooks/mutation";
import {
  useAdminBanksQuery,
  useAdminConsoleChromeQuery,
  usePaymentCurrencyQuery,
} from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import type { AdminBank } from "@/types/console";
import { Check, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type BankFormMode = { kind: "create" } | { kind: "edit"; bank: AdminBank };

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!(label || "").trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--dama-muted)]">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function CopyableDetailRow({
  label,
  value,
  emptyValue,
  copyLabel,
  copiedToast,
  failedToast,
}: {
  label: string;
  value: string;
  emptyValue: string;
  copyLabel: string;
  copiedToast: string;
  failedToast: string;
}) {
  const [done, setDone] = useState(false);
  const raw = (value || "").trim();
  const rowLabel = (label || "").trim();
  const empty = (emptyValue || "").trim();
  if (!rowLabel) return null;
  const canCopy = Boolean(raw) && Boolean((copyLabel || "").trim());
  return (
    <div className="min-w-0 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-2">
      <p className="text-xs text-[var(--dama-muted)]">{rowLabel}</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <p className="break-words text-sm font-bold tracking-wide text-[var(--dama-text)]">
          {raw || empty}
        </p>
        {canCopy ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={copyLabel}
            title={copyLabel}
            onClick={() => {
              void (async () => {
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(raw);
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = raw;
                    ta.setAttribute("readonly", "");
                    ta.style.position = "fixed";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    const okExec = document.execCommand("copy");
                    document.body.removeChild(ta);
                    if (!okExec) throw new Error("copy failed");
                  }
                  if (copiedToast) toast.success(copiedToast);
                  setDone(true);
                  window.setTimeout(() => setDone(false), 1200);
                } catch {
                  if (failedToast) toast.error(failedToast);
                }
              })();
            }}
          >
            {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminBanksPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data) ? chromeQuery.data.banks : undefined;
  const pageSize = parseListPageSize(chrome?.list_page_size);

  const [skip, setSkip] = useUrlSkip("skip");
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const [currency, setCurrency] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const debouncedBankSearch = useDebouncedValue(bankSearch.trim(), 250);
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminBank | null>(null);

  const formDialog = useDeferredDialogValue<BankFormMode>();
  const detailDialog = useDeferredDialogValue<AdminBank>();

  const { data: currencyCfg, isLoading: currencyLoading } = usePaymentCurrencyQuery();
  useResetSkipOnChange(setSkip, [debouncedBankSearch, statusFilter]);
  const banksQuery = useAdminBanksQuery(token, isAdmin && pageSize > 0, skip, pageSize, {
    q: debouncedBankSearch,
    status: statusFilter,
  });
  const create = useCreateBankMutation(token);
  const update = useUpdateBankMutation(token);
  const remove = useDeleteBankMutation(token);
  const toggle = useToggleBankMutation(token);

  const formMode = formDialog.value;
  const isEditing = formMode?.kind === "edit";
  const formPending = create.isPending || update.isPending;
  const formBusy = formPending || currencyLoading;

  useEffect(() => {
    if (!formDialog.open || !formMode) return;
    if (formMode.kind === "create") {
      setProvider("");
      setLabel("");
      setAccountName("");
      setAccountNumber("");
      setMobileCode("");
      setCurrency(currencyCfg?.global || "");
      return;
    }
    const b = formMode.bank;
    setProvider(b.provider);
    setLabel(b.label);
    setAccountName(b.account_name || "");
    setAccountNumber(b.account_number || "");
    setMobileCode(b.mobile_code || "");
    setCurrency(b.currency);
  }, [formDialog.open, formMode, currencyCfg?.global]);

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

  const supportedCurrencies = currencyCfg?.supported ?? [];
  const softFetching = banksQuery.isFetching && !banksQuery.isLoading;
  const pageBanks = banksQuery.data?.banks ?? [];

  const empty = (chrome?.empty_value || "").trim();

  const columns = useMemo((): OpsColumn<AdminBank>[] => {
    if (!chrome) return [];
    const labelHeader = (chrome.col_label || "").trim();
    const providerHeader = (chrome.col_provider || "").trim();
    const currencyHeader = (chrome.col_currency || "").trim();
    const statusHeader = (chrome.col_status || "").trim();
    const accountNameHeader = (chrome.account_name_label || "").trim();
    const viewLabel = (chrome.view_detail_action || "").trim();
    const actionsLabel = (chrome.actions_label || "").trim();
    return [
      {
        id: "label",
        header: labelHeader,
        cell: (b: AdminBank) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{(b.label || "").trim() || empty}</p>
            <p className="truncate text-xs text-[var(--dama-muted)]">
              {(b.account_number || b.mobile_code || "").trim() || empty}
            </p>
          </div>
        ),
      },
      {
        id: "provider",
        header: providerHeader,
        className: "w-32",
        cell: (b: AdminBank) => (
          <span className="text-sm">{(b.provider || "").trim() || empty}</span>
        ),
      },
      ...(accountNameHeader
        ? [
            {
              id: "account_name",
              header: accountNameHeader,
              cell: (b: AdminBank) => (
                <span className="text-sm">{(b.account_name || "").trim() || empty}</span>
              ),
            } satisfies OpsColumn<AdminBank>,
          ]
        : []),
      {
        id: "currency",
        header: currencyHeader,
        className: "w-20",
        cell: (b: AdminBank) => (
          <span className="text-sm tabular-nums">{(b.currency || "").trim() || empty}</span>
        ),
      },
      {
        id: "status",
        header: statusHeader,
        className: "w-28",
        cell: (b: AdminBank) => (
          <span className="text-sm">
            {b.is_active ? chrome.active_label : chrome.inactive_label}
          </span>
        ),
      },
      ...(viewLabel
        ? [
            {
              id: "view",
              header: viewLabel,
              className: "w-24",
              cell: (b: AdminBank) => (
                <button
                  type="button"
                  className="text-left text-sm underline-offset-4 hover:underline"
                  onClick={() => detailDialog.openWith(b)}
                >
                  {viewLabel}
                </button>
              ),
            } satisfies OpsColumn<AdminBank>,
          ]
        : []),
      {
        id: "actions",
        header: actionsLabel || "",
        className: "w-12 text-right",
        cell: (b: AdminBank) => (
          <OpsDataTableRowActions
            triggerLabel={actionsLabel}
            actions={[
              ...(viewLabel
                ? [{ id: "view", label: viewLabel, onSelect: () => detailDialog.openWith(b) }]
                : []),
              {
                id: "edit",
                label: (chrome.edit_action || "").trim(),
                onSelect: () => formDialog.openWith({ kind: "edit", bank: b }),
              },
              {
                id: "toggle",
                label: ((b.is_active ? chrome.inactive_label : chrome.active_label) || "").trim(),
                pendingLabel: (chrome.status_pending || "").trim(),
                isLoading: toggle.isPending && toggle.variables?.id === b.id,
                onSelect: () => toggle.mutate({ id: b.id, active: !b.is_active }),
              },
              {
                id: "delete",
                label: (chrome.delete_action || "").trim(),
                destructive: true,
                onSelect: () => setDeleteTarget(b),
              },
            ]}
          />
        ),
      },
    ].filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, detailDialog, empty, formDialog, toggle]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BanksListSkeleton />
      </div>
    );
  }

  if (!chrome) {
    const unavailable = adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error);
    return <div className="p-6 text-sm text-[var(--dama-muted)]">{unavailable}</div>;
  }

  const closeLabel = (chrome.dialog_close_label || "").trim();
  const cancelLabel = (chrome.cancel_action || "").trim();
  const saveLabel = (chrome.save_action || "").trim();
  const savePending = (chrome.save_pending || "").trim();
  const formTitle = isEditing
    ? (chrome.edit_action || "").trim()
    : (chrome.add_action || "").trim();
  const formReady =
    Boolean(closeLabel) &&
    Boolean(cancelLabel) &&
    Boolean(saveLabel) &&
    Boolean(savePending) &&
    Boolean(formTitle);
  const detailTitle = (chrome.detail_title || "").trim();
  const detail = detailDialog.value;
  const currencyLabel = (chrome.col_currency || "").trim();
  const deleteDescription = (chrome.delete_confirm || "").trim();
  const deleteLabel = (chrome.delete_action || "").trim();
  const emptyLabel = (chrome.empty_label || "").trim();

  function submitForm() {
    if (!provider.trim() || !label.trim() || !currency) return;
    const payload = {
      provider,
      label,
      account_name: accountName.trim() || undefined,
      account_number: accountNumber || undefined,
      mobile_code: mobileCode || undefined,
      currency,
    };
    if (isEditing && formMode?.kind === "edit") {
      update.mutate(
        { id: formMode.bank.id, ...payload, is_active: formMode.bank.is_active },
        { onSuccess: () => formDialog.close() },
      );
      return;
    }
    create.mutate(payload, { onSuccess: () => formDialog.close() });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{chrome.page_title}</h1>
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.page_blurb}</p>
        </div>
        {isAdmin && !roleLoading ? (
          <Button variant="gold" onClick={() => formDialog.openWith({ kind: "create" })}>
            {chrome.add_action}
          </Button>
        ) : null}
      </div>

      {roleLoading ? (
        <BanksListBodySkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : (
        <>
          {banksQuery.isLoading ? (
            <BanksListBodySkeleton />
          ) : (
            <>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-banks-search",
                    label: (chrome.search_label || "").trim(),
                    value: bankSearch,
                    onChange: setBankSearch,
                    placeholder: (chrome.search_placeholder || "").trim() || undefined,
                  },
                  {
                    kind: "select",
                    id: "admin-banks-status",
                    label: (chrome.col_status || "").trim(),
                    value: statusFilter,
                    onChange: setStatusFilter,
                    allLabel: (chrome.filter_all_label || "").trim() || undefined,
                    options: [
                      { value: "active", label: (chrome.active_label || "").trim() },
                      { value: "inactive", label: (chrome.inactive_label || "").trim() },
                    ].filter((o) => Boolean(o.label)),
                  },
                ]}
              />
              <OpsDataTable
                columns={columns}
                data={pageBanks}
                getRowId={(b) => b.id}
                isFetching={softFetching}
                meta={banksQuery.data?.meta}
                onPage={(next) => {
                  setSkip(next);
                  setRowSelection({});
                }}
                pageDisabled={softFetching || bulkPending}
                pageInputId="admin-banks-skip"
                bodyRowClassName={(b) =>
                  b.is_active ? undefined : "opacity-60 text-[var(--dama-muted)]"
                }
                empty={
                  emptyLabel ? (
                    <p className="py-8 text-center text-sm text-[var(--dama-muted)]">
                      {emptyLabel}
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
              <Field id="bank-provider" label={(chrome.provider_label || "").trim()}>
                <Input
                  id="bank-provider"
                  placeholder={chrome.provider_placeholder}
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  required
                />
              </Field>
              <Field id="bank-label" label={(chrome.label_label || "").trim()}>
                <Input
                  id="bank-label"
                  placeholder={chrome.label_placeholder}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              {(chrome.account_name_label || "").trim() ? (
                <Field id="bank-account-name" label={(chrome.account_name_label || "").trim()}>
                  <Input
                    id="bank-account-name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </Field>
              ) : null}
              <Field id="bank-account" label={(chrome.account_label || "").trim()}>
                <Input
                  id="bank-account"
                  placeholder={chrome.account_placeholder}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </Field>
              <Field id="bank-mobile" label={(chrome.mobile_label || "").trim()}>
                <Input
                  id="bank-mobile"
                  placeholder={chrome.mobile_placeholder}
                  value={mobileCode}
                  onChange={(e) => setMobileCode(e.target.value)}
                />
              </Field>
              {currencyLabel ? (
                <Field id="bank-currency" label={currencyLabel} className="sm:col-span-2">
                  {currencyLoading ? (
                    <ShimmerBlock className="h-10 w-full rounded-md" />
                  ) : (
                    <Select
                      value={currency || undefined}
                      onValueChange={setCurrency}
                      disabled={!supportedCurrencies.length}
                    >
                      <SelectTrigger id="bank-currency">
                        <SelectValue
                          placeholder={(currencyCfg?.global || "").trim() || undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {supportedCurrencies.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              ) : null}
            </div>
            <DialogFooter damaDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={formBusy}
                onClick={() => formDialog.close()}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="gold"
                isLoading={formPending}
                pendingLabel={savePending}
                disabled={formBusy || !provider.trim() || !label.trim() || !currency}
                onClick={() => submitForm()}
              >
                {saveLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {detail && detailTitle && closeLabel ? (
        <Dialog open={detailDialog.open} onOpenChange={detailDialog.onOpenChange}>
          <DialogContent closeLabel={closeLabel} className="max-w-lg sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{detailTitle}</DialogTitle>
              <DialogDescription className="sr-only">{detailTitle}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow
                label={(chrome.provider_label || "").trim()}
                value={(detail.provider || "").trim() || empty}
              />
              <DetailRow
                label={(chrome.label_label || "").trim()}
                value={(detail.label || "").trim() || empty}
              />
              <CopyableDetailRow
                label={(chrome.account_label || "").trim()}
                value={(detail.account_number || "").trim()}
                emptyValue={empty}
                copyLabel={(chrome.copy_account_label || chrome.copy_action || "").trim()}
                copiedToast={(chrome.toast_copied || "").trim()}
                failedToast={(chrome.toast_copy_failed || "").trim()}
              />
              <CopyableDetailRow
                label={(chrome.mobile_label || "").trim()}
                value={(detail.mobile_code || "").trim()}
                emptyValue={empty}
                copyLabel={(chrome.copy_mobile_label || chrome.copy_action || "").trim()}
                copiedToast={(chrome.toast_copied || "").trim()}
                failedToast={(chrome.toast_copy_failed || "").trim()}
              />
              <CopyableDetailRow
                label={(chrome.account_name_label || "").trim()}
                value={(detail.account_name || "").trim()}
                emptyValue={empty}
                copyLabel={(chrome.copy_name_label || chrome.copy_action || "").trim()}
                copiedToast={(chrome.toast_copied || "").trim()}
                failedToast={(chrome.toast_copy_failed || "").trim()}
              />
              <DetailRow label={currencyLabel} value={(detail.currency || "").trim() || empty} />
              <DetailRow
                label={(chrome.col_status || "").trim()}
                value={
                  (detail.is_active
                    ? (chrome.active_label || "").trim()
                    : (chrome.inactive_label || "").trim()) || empty
                }
              />
            </div>
            <DialogFooter damaDialogFooter>
              {cancelLabel ? (
                <Button type="button" variant="outline" onClick={() => detailDialog.close()}>
                  {cancelLabel}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !remove.isPending) setDeleteTarget(null);
        }}
        title={deleteLabel}
        description={deleteDescription}
        cancelLabel={cancelLabel}
        confirmLabel={deleteLabel}
        pendingLabel={(chrome.status_pending || "").trim()}
        isPending={remove.isPending}
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          remove.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}
