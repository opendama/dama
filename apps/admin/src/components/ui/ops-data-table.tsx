"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { SkipPagination, type SkipPaginationMeta } from "@/components/ui/skip-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type OpsColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

/** Trim DataTableSelectionChrome (fail closed when labels empty). */
export type OpsSelectionChrome = {
  selectAllLabel: string;
  selectRowLabel: string;
  selectedCountFmt?: string;
};

export type OpsRowSelectionState = Record<string, boolean>;

type OpsDataTableProps<T> = {
  columns: OpsColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isFetching?: boolean;
  className?: string;
  empty?: ReactNode;
  /** Trim SkipPagination meta (API or buildClientSkipMeta). */
  meta?: SkipPaginationMeta | null;
  onPage?: (skip: number) => void;
  pageDisabled?: boolean;
  pageInputId?: string;
  /** Trim bodyRowClassName for inactive / status-muted rows. */
  bodyRowClassName?: string | ((row: T) => string | undefined);
  /** Opt-in Trim-style checkbox selection (parent owns toolbar + bulk fan-out). */
  selection?: {
    chrome: OpsSelectionChrome;
    rowSelection: OpsRowSelectionState;
    onRowSelectionChange: (next: OpsRowSelectionState) => void;
    toolbar?: ReactNode;
  };
};

export function selectedRowIds(state: OpsRowSelectionState): string[] {
  return Object.entries(state)
    .filter(([, on]) => on)
    .map(([id]) => id);
}

/** Trim-style bordered ops table without TanStack (chrome first; columns stay domain-owned). */
export function OpsDataTable<T>({
  columns,
  data,
  getRowId,
  isFetching = false,
  className,
  empty,
  meta,
  onPage,
  pageDisabled = false,
  pageInputId,
  bodyRowClassName,
  selection,
}: OpsDataTableProps<T>) {
  // Trim: keep action columns with empty header (`""` / `_actions`); only drop missing chrome labels.
  const headers = columns.filter(
    (c) => Boolean(c.header.trim()) || c.id === "actions" || c.id.startsWith("_"),
  );
  const selectAllLabel = (selection?.chrome.selectAllLabel || "").trim();
  const selectRowLabel = (selection?.chrome.selectRowLabel || "").trim();
  const selectedFmt = (selection?.chrome.selectedCountFmt || "").trim();
  const selectionEnabled = Boolean(selection && selectAllLabel && selectRowLabel);
  if (headers.length === 0) return null;

  const pageIds = data.map(getRowId);
  const selectedIds = selectionEnabled && selection ? selectedRowIds(selection.rowSelection) : [];
  const pageSelectedCount = pageIds.filter((id) => selection?.rowSelection[id]).length;
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
  const countLabel =
    selectedFmt.includes("{count}") && selectedIds.length > 0
      ? selectedFmt.replaceAll("{count}", String(selectedIds.length))
      : "";

  return (
    <div className={cn("space-y-3", className)}>
      {selectionEnabled && selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {countLabel ? (
            <span className="text-sm text-[var(--dama-muted)]">{countLabel}</span>
          ) : null}
          {selection?.toolbar}
        </div>
      ) : null}
      <div className="overflow-visible rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)]">
        <FetchProgressBar active={isFetching} />
        {data.length === 0 ? (
          <div className="p-4 text-sm text-[var(--dama-muted)]">{empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {selectionEnabled ? (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          allPageSelected ? true : somePageSelected ? "indeterminate" : false
                        }
                        aria-label={selectAllLabel}
                        title={selectAllLabel}
                        onCheckedChange={(checked) => {
                          if (!selection) return;
                          const on = checked === true;
                          const next = { ...selection.rowSelection };
                          for (const id of pageIds) {
                            if (on) next[id] = true;
                            else delete next[id];
                          }
                          selection.onRowSelectionChange(next);
                        }}
                      />
                    </TableHead>
                  ) : null}
                  {headers.map((col) => (
                    <TableHead key={col.id} className={cn("whitespace-nowrap", col.className)}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const id = getRowId(row);
                  const rowClass =
                    typeof bodyRowClassName === "function"
                      ? bodyRowClassName(row)
                      : bodyRowClassName;
                  const isSelected = Boolean(selection?.rowSelection[id]);
                  return (
                    <TableRow
                      key={id}
                      id={`ops-row-${id}`}
                      className={rowClass}
                      data-state={isSelected ? "selected" : undefined}
                    >
                      {selectionEnabled ? (
                        <TableCell className="w-10">
                          <Checkbox
                            checked={isSelected}
                            aria-label={selectRowLabel}
                            title={selectRowLabel}
                            onCheckedChange={(checked) => {
                              if (!selection) return;
                              const next = { ...selection.rowSelection };
                              if (checked === true) next[id] = true;
                              else delete next[id];
                              selection.onRowSelectionChange(next);
                            }}
                          />
                        </TableCell>
                      ) : null}
                      {headers.map((col) => (
                        <TableCell key={col.id} className={col.className}>
                          {col.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {onPage ? (
          <div className="border-t border-[var(--dama-border)] p-3">
            <SkipPagination
              meta={meta}
              disabled={pageDisabled || isFetching}
              inputId={pageInputId}
              onPrev={onPage}
              onNext={onPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
