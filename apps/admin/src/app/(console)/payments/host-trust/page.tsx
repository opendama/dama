"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  PaymentsHostTrustBodySkeleton,
  PaymentsHostTrustSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { type HostTrustPolicyPayload, useSaveHostTrustPolicyMutation } from "@/hooks/mutation";
import { useAdminConsoleChromeQuery, useCashRmgPolicyQuery } from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeferredDialogValue } from "@/hooks/use-deferred-dialog-selection";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { parseSearchDebounceMs } from "@/lib/parse-search-debounce-ms";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useEffect, useMemo, useState } from "react";

type HostTrustTab = "gates" | "caps" | "reputation";
type HostTrustValueKind = "boolean" | "number";
type HostTrustFieldKey = keyof HostTrustPolicyPayload;

type HostTrustRow = {
  id: HostTrustFieldKey;
  tab: HostTrustTab;
  label: string;
  blurb: string;
  kind: HostTrustValueKind;
  displayValue: string;
  boolValue?: boolean;
  numberValue?: number;
};

type HostTrustFormMode =
  | { kind: "view"; id: HostTrustFieldKey }
  | { kind: "edit"; id: HostTrustFieldKey };

function DetailRow({ label, value }: { label: string; value: string }) {
  const l = label.trim();
  if (!l) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">{l}</p>
      <p className="text-sm text-[var(--dama-text)]">{value}</p>
    </div>
  );
}

function payloadFromPolicy(data: {
  host_paid_create_requires_phone_kyc?: boolean;
  host_guarantee_requires_document_kyc?: boolean;
  host_concurrent_open_paid_cap_phone_verified?: number;
  host_concurrent_open_paid_cap_document_verified?: number;
  host_concurrent_open_paid_cap_new_host?: number;
  host_new_host_settled_paid_threshold?: number;
  host_reputation_max_open_reports?: number;
  host_reputation_cancel_rate_bps?: number;
  host_reputation_cancel_rate_min_sample?: number;
}): HostTrustPolicyPayload | null {
  const phone = data.host_paid_create_requires_phone_kyc;
  const doc = data.host_guarantee_requires_document_kyc;
  const capPhone = data.host_concurrent_open_paid_cap_phone_verified;
  const capDoc = data.host_concurrent_open_paid_cap_document_verified;
  const capNew = data.host_concurrent_open_paid_cap_new_host;
  const threshold = data.host_new_host_settled_paid_threshold;
  const openReports = data.host_reputation_max_open_reports;
  const cancelBps = data.host_reputation_cancel_rate_bps;
  const cancelSample = data.host_reputation_cancel_rate_min_sample;
  if (
    typeof phone !== "boolean" ||
    typeof doc !== "boolean" ||
    typeof capPhone !== "number" ||
    typeof capDoc !== "number" ||
    typeof capNew !== "number" ||
    typeof threshold !== "number" ||
    typeof openReports !== "number" ||
    typeof cancelBps !== "number" ||
    typeof cancelSample !== "number"
  ) {
    return null;
  }
  return {
    host_paid_create_requires_phone_kyc: phone,
    host_guarantee_requires_document_kyc: doc,
    host_concurrent_open_paid_cap_phone_verified: capPhone,
    host_concurrent_open_paid_cap_document_verified: capDoc,
    host_concurrent_open_paid_cap_new_host: capNew,
    host_new_host_settled_paid_threshold: threshold,
    host_reputation_max_open_reports: openReports,
    host_reputation_cancel_rate_bps: cancelBps,
    host_reputation_cancel_rate_min_sample: cancelSample,
  };
}

export default function AdminPaymentsHostTrustPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;

  const searchDebounceMs = parseSearchDebounceMs(
    chrome?.host_trust_search_debounce_ms || chrome?.search_debounce_ms,
  );

  const [tab, setTab] = useState<HostTrustTab>("gates");
  const [searchDraft, setSearchDraft] = useState("");
  const searchQ = useDebouncedValue(searchDraft.trim().toLowerCase(), searchDebounceMs);
  const [boolDraft, setBoolDraft] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");

  const formDialog = useDeferredDialogValue<HostTrustFormMode>();
  const policyQuery = useCashRmgPolicyQuery(token, Boolean(isAdmin));
  const save = useSaveHostTrustPolicyMutation(token);

  useEffect(() => {
    if (!formDialog.open || !formDialog.value || !policyQuery.data || !chrome) return;
    const mode = formDialog.value;
    const payload = payloadFromPolicy(policyQuery.data);
    if (!payload) return;
    const rowKey = mode.id;
    const kind =
      rowKey === "host_paid_create_requires_phone_kyc" ||
      rowKey === "host_guarantee_requires_document_kyc"
        ? "boolean"
        : "number";
    if (kind === "boolean") {
      setBoolDraft(Boolean(payload[rowKey]));
      setNumberDraft("");
      return;
    }
    setNumberDraft(String(payload[rowKey]));
  }, [formDialog.open, formDialog.value, policyQuery.data, chrome]);

  const yesLabel = (chrome?.host_trust_yes || "").trim();
  const noLabel = (chrome?.host_trust_no || "").trim();
  const emptyValue = (chrome?.host_trust_empty_value || "").trim();

  const allRows = useMemo((): HostTrustRow[] => {
    if (!chrome) return [];
    const payload = policyQuery.data ? payloadFromPolicy(policyQuery.data) : null;
    const boolText = (v: boolean | undefined) =>
      typeof v === "boolean" ? (v ? yesLabel : noLabel) : emptyValue;
    const numText = (v: number | undefined) =>
      typeof v === "number" && Number.isFinite(v) ? String(v) : emptyValue;

    const defs: Array<{
      id: HostTrustFieldKey;
      tab: HostTrustTab;
      label: string;
      blurb: string;
      kind: HostTrustValueKind;
    }> = [
      {
        id: "host_paid_create_requires_phone_kyc",
        tab: "gates",
        label: (chrome.host_trust_phone_kyc_label || "").trim(),
        blurb: (chrome.host_trust_phone_kyc_blurb || "").trim(),
        kind: "boolean",
      },
      {
        id: "host_guarantee_requires_document_kyc",
        tab: "gates",
        label: (chrome.host_trust_doc_kyc_label || "").trim(),
        blurb: (chrome.host_trust_doc_kyc_blurb || "").trim(),
        kind: "boolean",
      },
      {
        id: "host_concurrent_open_paid_cap_new_host",
        tab: "caps",
        label: (chrome.host_trust_cap_new_host_label || "").trim(),
        blurb: (chrome.host_trust_cap_new_host_blurb || "").trim(),
        kind: "number",
      },
      {
        id: "host_concurrent_open_paid_cap_phone_verified",
        tab: "caps",
        label: (chrome.host_trust_cap_phone_label || "").trim(),
        blurb: (chrome.host_trust_cap_phone_blurb || "").trim(),
        kind: "number",
      },
      {
        id: "host_concurrent_open_paid_cap_document_verified",
        tab: "caps",
        label: (chrome.host_trust_cap_document_label || "").trim(),
        blurb: (chrome.host_trust_cap_document_blurb || "").trim(),
        kind: "number",
      },
      {
        id: "host_new_host_settled_paid_threshold",
        tab: "caps",
        label: (chrome.host_trust_settled_threshold_label || "").trim(),
        blurb: (chrome.host_trust_settled_threshold_blurb || "").trim(),
        kind: "number",
      },
      {
        id: "host_reputation_max_open_reports",
        tab: "reputation",
        label: (chrome.host_trust_rep_open_reports_label || "").trim(),
        blurb: (chrome.host_trust_rep_open_reports_blurb || "").trim(),
        kind: "number",
      },
      {
        id: "host_reputation_cancel_rate_bps",
        tab: "reputation",
        label: (chrome.host_trust_rep_cancel_bps_label || "").trim(),
        blurb: (chrome.host_trust_rep_cancel_bps_blurb || "").trim(),
        kind: "number",
      },
      {
        id: "host_reputation_cancel_rate_min_sample",
        tab: "reputation",
        label: (chrome.host_trust_rep_cancel_sample_label || "").trim(),
        blurb: (chrome.host_trust_rep_cancel_sample_blurb || "").trim(),
        kind: "number",
      },
    ];

    return defs
      .filter((d) => Boolean(d.label))
      .map((d) => {
        if (d.kind === "boolean") {
          const boolValue = payload ? Boolean(payload[d.id]) : undefined;
          return {
            ...d,
            displayValue: boolText(boolValue),
            boolValue,
          };
        }
        const numberValue = payload ? Number(payload[d.id]) : undefined;
        return {
          ...d,
          displayValue: numText(numberValue),
          numberValue,
        };
      });
  }, [chrome, emptyValue, noLabel, policyQuery.data, yesLabel]);

  const tabRows = useMemo(() => allRows.filter((r) => r.tab === tab), [allRows, tab]);

  const filteredRows = useMemo(() => {
    if (!searchQ) return tabRows;
    return tabRows.filter(
      (r) =>
        r.label.toLowerCase().includes(searchQ) ||
        r.blurb.toLowerCase().includes(searchQ) ||
        r.displayValue.toLowerCase().includes(searchQ),
    );
  }, [searchQ, tabRows]);

  const columns = useMemo((): OpsColumn<HostTrustRow>[] => {
    if (!chrome) return [];
    const settingHeader = (chrome.host_trust_col_setting || "").trim();
    const valueHeader = (chrome.host_trust_col_value || "").trim();
    const actionsHeader = (chrome.host_trust_col_actions || "").trim();
    const viewLabel = (chrome.host_trust_view_action || "").trim();
    const editLabel = (chrome.host_trust_edit_action || "").trim();
    const cols: OpsColumn<HostTrustRow>[] = [
      {
        id: "setting",
        header: settingHeader,
        cell: (row) => (
          <div className="min-w-0">
            <p className="font-medium">{row.label}</p>
            {row.blurb ? (
              <p className="mt-0.5 text-xs text-[var(--dama-muted)]">{row.blurb}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "value",
        header: valueHeader,
        cell: (row) => <span className="font-mono tabular-nums">{row.displayValue}</span>,
      },
      {
        id: "actions",
        header: actionsHeader,
        className: "w-12 text-right",
        cell: (row) => (
          <OpsDataTableRowActions
            triggerLabel={actionsHeader}
            actions={[
              {
                id: "view",
                label: viewLabel,
                onSelect: () => formDialog.openWith({ kind: "view", id: row.id }),
              },
              {
                id: "edit",
                label: editLabel,
                onSelect: () => formDialog.openWith({ kind: "edit", id: row.id }),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean(c.header));
  }, [chrome, formDialog]);

  const activeRow = useMemo(() => {
    const id = formDialog.value?.id;
    if (!id) return null;
    return allRows.find((r) => r.id === id) || null;
  }, [allRows, formDialog.value?.id]);

  const viewing = formDialog.value?.kind === "view";
  const editing = formDialog.value?.kind === "edit";

  function saveEdit() {
    if (!editing || !activeRow || !policyQuery.data) return;
    const base = payloadFromPolicy(policyQuery.data);
    if (!base) return;
    const next: HostTrustPolicyPayload = { ...base };
    if (activeRow.kind === "boolean") {
      next[activeRow.id] = boolDraft as never;
    } else {
      const n = Number.parseInt(numberDraft.trim(), 10);
      if (!Number.isFinite(n)) return;
      next[activeRow.id] = n as never;
    }
    save.mutate(next, {
      onSuccess: () => formDialog.close(),
    });
  }

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsHostTrustSkeleton />
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

  const pageLoading = roleLoading || (isAdmin && policyQuery.isLoading);
  const tabGates = (chrome.host_trust_tab_gates || "").trim();
  const tabCaps = (chrome.host_trust_tab_caps || "").trim();
  const tabRep = (chrome.host_trust_tab_reputation || "").trim();
  const dialogTitle = viewing
    ? (chrome.host_trust_detail_title || "").trim()
    : (chrome.host_trust_edit_title || "").trim();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {(chrome.host_trust_page_title || "").trim()}
        </h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">
          {(chrome.host_trust_page_blurb || "").trim()}
        </p>
      </div>

      {roleLoading ? (
        <PaymentsHostTrustBodySkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsHostTrustBodySkeleton />
      ) : (
        <>
          <div
            role="tablist"
            aria-label={(chrome.host_trust_page_title || "").trim() || undefined}
            className="flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] p-1"
          >
            {(
              [
                { id: "gates" as const, label: tabGates },
                { id: "caps" as const, label: tabCaps },
                { id: "reputation" as const, label: tabRep },
              ] as const
            )
              .filter((t) => Boolean(t.label))
              .map((t) => {
                const selected = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      selected
                        ? "bg-[var(--dama-card)] text-[var(--dama-gold)] shadow-sm"
                        : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
                    )}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                );
              })}
          </div>

          {policyQuery.error ? (
            <p className="text-sm text-[var(--dama-danger)]">
              {(chrome.host_trust_load_failed || "").trim()}
            </p>
          ) : (
            <>
              <AdminFilterBar
                filters={[
                  {
                    kind: "search",
                    id: "admin-host-trust-search",
                    label: (chrome.host_trust_search_label || chrome.search_label || "").trim(),
                    placeholder: (
                      chrome.host_trust_search_placeholder ||
                      chrome.search_placeholder ||
                      ""
                    ).trim(),
                    value: searchDraft,
                    onChange: setSearchDraft,
                  },
                ]}
              />
              <OpsDataTable
                columns={columns}
                data={filteredRows}
                getRowId={(row) => row.id}
                isFetching={policyQuery.isFetching && !policyQuery.isLoading}
                empty={
                  <p className="py-8 text-center text-sm text-[var(--dama-muted)]">
                    {(chrome.host_trust_empty_value || "").trim()}
                  </p>
                }
              />
            </>
          )}
        </>
      )}

      <Dialog
        open={formDialog.open}
        onOpenChange={(open) => {
          if (!open) formDialog.close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {activeRow?.blurb ? <DialogDescription>{activeRow.blurb}</DialogDescription> : null}
          </DialogHeader>
          {activeRow ? (
            <div className="space-y-4">
              {viewing ? (
                <>
                  <DetailRow
                    label={(chrome.host_trust_col_setting || "").trim()}
                    value={activeRow.label}
                  />
                  <DetailRow
                    label={(chrome.host_trust_col_value || "").trim()}
                    value={activeRow.displayValue}
                  />
                </>
              ) : activeRow.kind === "boolean" ? (
                <Field id={`host-trust-${activeRow.id}`} label={activeRow.label}>
                  <div className="flex min-h-10 items-center gap-2 pt-1">
                    <Checkbox
                      id={`host-trust-${activeRow.id}`}
                      checked={boolDraft}
                      onCheckedChange={(v) => setBoolDraft(v === true)}
                      disabled={save.isPending}
                    />
                    <label htmlFor={`host-trust-${activeRow.id}`} className="text-sm">
                      {boolDraft ? yesLabel : noLabel}
                    </label>
                  </div>
                </Field>
              ) : (
                <Field id={`host-trust-${activeRow.id}`} label={activeRow.label}>
                  <Input
                    id={`host-trust-${activeRow.id}`}
                    inputMode="numeric"
                    value={numberDraft}
                    onChange={(e) => setNumberDraft(e.target.value.replace(/\D/g, ""))}
                    disabled={save.isPending}
                  />
                </Field>
              )}
            </div>
          ) : null}
          <DialogFooter>
            {viewing ? (
              <Button variant="outline" onClick={() => formDialog.close()}>
                {(chrome.host_trust_dialog_close || "").trim()}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => formDialog.close()}
                >
                  {(chrome.host_trust_cancel_action || "").trim()}
                </Button>
                <Button
                  variant="gold"
                  isLoading={save.isPending}
                  pendingLabel={(chrome.host_trust_save_pending || "").trim()}
                  disabled={
                    save.isPending ||
                    !activeRow ||
                    (activeRow.kind === "number" &&
                      !Number.isFinite(Number.parseInt(numberDraft.trim(), 10)))
                  }
                  onClick={saveEdit}
                >
                  {(chrome.host_trust_save_action || "").trim()}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
