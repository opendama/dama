"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import {
  type OpsColumn,
  OpsDataTable,
  type OpsRowSelectionState,
  selectedRowIds,
} from "@/components/ui/ops-data-table";
import { OpsDataTableRowActions } from "@/components/ui/ops-data-table-row-actions";
import { OpsDataTableSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useDismissTournamentReportMutation,
  useResolveTournamentReportMutation,
} from "@/hooks/mutation";
import {
  useClientEnumsQuery,
  useMyPermissionsQuery,
  useTournamentChromeQuery,
  useTournamentReportsQuery,
} from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { useResetSkipOnChange } from "@/hooks/useResetSkipOnChange";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { useAuthStore } from "@/store/auth";
import { isTournamentChromeReady } from "@/types/tournament-chrome";
import type { TournamentReport } from "@/types/tournament-reports";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function TournamentReportsPanel() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useTournamentChromeQuery(true);
  const chrome = isTournamentChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const enumsQuery = useClientEnumsQuery(isAdmin);
  const reportStatusLabels = enumsQuery.data?.hosted_event_report_status_labels ?? {};
  const reportStatuses = enumsQuery.data?.hosted_event_report_statuses ?? [];
  const reportOpenStatus = (enumsQuery.data?.hosted_event_report_open_status || "").trim();
  const permsQuery = useMyPermissionsQuery(token, isAdmin);
  const canReviewReports =
    permsQuery.data?.permissions?.includes("tournaments.write") === true ||
    permsQuery.data?.permissions?.includes("payments.review") === true;
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const [reportsSkip, setReportsSkip] = useUrlSkip("tournament_reports_skip");
  /** null = unset (wait for enums); "" = All; otherwise a status code. */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<OpsRowSelectionState>({});
  const [bulkPending, setBulkPending] = useState(false);
  const searchParams = useSearchParams();
  const focusReportId = (searchParams.get("report") || "").trim();

  async function bulkReview(kind: "dismiss" | "resolve") {
    const ids = selectedRowIds(rowSelection);
    if (!ids.length) return;
    setBulkPending(true);
    try {
      for (const id of ids) {
        if (kind === "dismiss") await dismissReport.mutateAsync(id);
        else await resolveReport.mutateAsync(id);
      }
      const msg =
        kind === "dismiss"
          ? (chrome?.toast_dismissed || "").trim()
          : (chrome?.toast_resolved || "").trim();
      if (msg) toast.success(msg);
      setRowSelection({});
    } finally {
      setBulkPending(false);
    }
  }

  useEffect(() => {
    if (statusFilter !== null) return;
    if (!enumsQuery.isFetched) return;
    setStatusFilter(reportOpenStatus || "");
  }, [enumsQuery.isFetched, reportOpenStatus, statusFilter]);

  useResetSkipOnChange(setReportsSkip, [statusFilter]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when list context changes
  useEffect(() => {
    setRowSelection({});
  }, [statusFilter, reportsSkip]);

  const reportsQuery = useTournamentReportsQuery(
    token,
    isAdmin && canReviewReports && statusFilter !== null,
    statusFilter ?? "",
    reportsSkip,
    pageSize,
  );
  const dismissReport = useDismissTournamentReportMutation(token);
  const resolveReport = useResolveTournamentReportMutation(token);

  const statusOptions = useMemo(() => {
    return reportStatuses
      .map((code) => {
        const value = (code || "").trim();
        const label = (reportStatusLabels[value] || "").trim();
        return { value, label };
      })
      .filter((o) => Boolean(o.value) && Boolean(o.label));
  }, [reportStatuses, reportStatusLabels]);

  const tournamentReportsColumns = useMemo((): OpsColumn<TournamentReport>[] => {
    if (!chrome) return [];
    const empty = chrome.empty_value;
    const cols: OpsColumn<TournamentReport>[] = [
      {
        id: "tournament",
        header: chrome.report_tournament_col,
        cell: (row) => (
          <p className="truncate font-medium">{(row.tournament_title || "").trim() || empty}</p>
        ),
      },
      {
        id: "reporter",
        header: chrome.report_reporter_col,
        cell: (row) => (
          <span className="truncate text-sm">{(row.reporter_username || "").trim() || empty}</span>
        ),
      },
      {
        id: "reason",
        header: chrome.report_reason_col,
        cell: (row) => (
          <div className="min-w-0 max-w-xs">
            <p className="truncate text-sm">{(row.reason_label || "").trim() || empty}</p>
            {row.note.trim() ? (
              <p className="mt-0.5 truncate text-xs text-[var(--dama-muted)]">{row.note}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: chrome.report_status_col,
        cell: (row) => (
          <span className="text-xs">{(reportStatusLabels[row.status] || "").trim() || empty}</span>
        ),
      },
      {
        id: "actions",
        header: chrome.col_actions,
        className: "w-12 text-right",
        cell: (row) => (
          <OpsDataTableRowActions
            triggerLabel={chrome.actions_label}
            actions={[
              {
                id: "dismiss",
                label: (chrome.dismiss_action || "").trim(),
                disabled: dismissReport.isPending || resolveReport.isPending,
                isLoading: dismissReport.isPending && dismissReport.variables === row.id,
                pendingLabel: chrome.save_pending,
                onSelect: () =>
                  dismissReport.mutate(row.id, {
                    onSuccess: () => {
                      const msg = (chrome.toast_dismissed || "").trim();
                      if (msg) toast.success(msg);
                    },
                  }),
              },
              {
                id: "resolve",
                label: (chrome.resolve_action || "").trim(),
                disabled: dismissReport.isPending || resolveReport.isPending,
                isLoading: resolveReport.isPending && resolveReport.variables === row.id,
                pendingLabel: chrome.save_pending,
                onSelect: () =>
                  resolveReport.mutate(row.id, {
                    onSuccess: () => {
                      const msg = (chrome.toast_resolved || "").trim();
                      if (msg) toast.success(msg);
                    },
                  }),
              },
            ]}
          />
        ),
      },
    ];
    return cols.filter((c) => c.id === "actions" || Boolean((c.header || "").trim()));
  }, [chrome, dismissReport, resolveReport, reportStatusLabels]);

  if (chromeQuery.isLoading || roleLoading) {
    return <OpsDataTableSkeleton columns={5} rows={5} showSelection />;
  }

  if (!chrome) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        {(chromeQuery.data?.tournament_chrome_unavailable || "").trim()}
      </p>
    );
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-[var(--dama-muted)]">
        <SignInLink className="text-[var(--dama-gold)] underline" />
      </p>
    );
  }

  if (!canReviewReports || !(chrome.reports_title || "").trim()) {
    return null;
  }

  const softFetching = reportsQuery.isFetching && !reportsQuery.isLoading;
  const statusFilterLabel = (chrome.report_status_col || "").trim();
  const allLabel = (chrome.filter_all_label || "").trim();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
          {chrome.reports_title}
        </h2>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.reports_blurb}</p>
      </div>
      {statusFilter !== null && statusFilterLabel && statusOptions.length > 0 ? (
        <AdminFilterBar
          filters={[
            {
              kind: "select",
              id: "console-tournament-reports-status",
              label: statusFilterLabel,
              value: statusFilter,
              onChange: setStatusFilter,
              allLabel: allLabel || undefined,
              options: statusOptions,
            },
          ]}
        />
      ) : null}
      {reportsQuery.isLoading ? (
        <OpsDataTableSkeleton columns={5} rows={5} showSelection />
      ) : reportsQuery.error ? (
        <p className="text-sm text-[var(--dama-danger)]">{chrome.err_reports_failed}</p>
      ) : (
        <OpsDataTable
          columns={tournamentReportsColumns}
          data={reportsQuery.data?.reports ?? []}
          getRowId={(row) => row.id}
          isFetching={softFetching}
          bodyRowClassName={(row) =>
            focusReportId && row.id === focusReportId
              ? "bg-[var(--dama-gold)]/10 ring-1 ring-inset ring-[var(--dama-gold)]"
              : undefined
          }
          meta={reportsQuery.data?.meta ?? null}
          onPage={(next) => {
            setReportsSkip(next);
            setRowSelection({});
          }}
          pageInputId="console-tournament-reports-skip"
          pageDisabled={softFetching || bulkPending}
          empty={<p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.reports_empty}</p>}
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
                {(chrome.resolve_action || "").trim() ? (
                  <Button
                    size="sm"
                    variant="gold"
                    disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                    isLoading={bulkPending}
                    pendingLabel={(chrome.save_pending || "").trim()}
                    onClick={() => void bulkReview("resolve")}
                  >
                    {(chrome.resolve_action || "").trim()}
                  </Button>
                ) : null}
                {(chrome.dismiss_action || "").trim() ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={selectedRowIds(rowSelection).length === 0 || bulkPending}
                    isLoading={bulkPending}
                    pendingLabel={(chrome.save_pending || "").trim()}
                    onClick={() => void bulkReview("dismiss")}
                  >
                    {(chrome.dismiss_action || "").trim()}
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
      )}
    </section>
  );
}
