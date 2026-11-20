"use client";

import { Button } from "@/components/ui/button";
import { type OpsRowSelectionState, selectedRowIds } from "@/components/ui/ops-data-table";

/** Trim-style clear-selection toolbar shared by ops list pages. */
export function opsClearSelectionToolbar(
  chrome: {
    select_all_label?: string;
    select_row_label?: string;
    selected_count_fmt?: string;
    clear_selection_action?: string;
  },
  rowSelection: OpsRowSelectionState,
  setRowSelection: (next: OpsRowSelectionState) => void,
) {
  return {
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
          variant="outline"
          disabled={selectedRowIds(rowSelection).length === 0}
          onClick={() => setRowSelection({})}
        >
          {(chrome.clear_selection_action || "").trim()}
        </Button>
      </div>
    ),
  };
}
