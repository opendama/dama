"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as React from "react";

/** Backend-driven skip/limit controls (Trim). Labels and skips come from API meta. */
export type SkipPaginationMeta = {
  skip?: number;
  limit?: number;
  /** Total matching rows (API `pagination.Meta.total`). */
  total?: number;
  page?: number;
  total_pages?: number;
  prev_skip?: number | null;
  next_skip?: number | null;
  first_skip?: number | null;
  last_skip?: number | null;
  has_more?: boolean;
  prev_action_label?: string;
  next_action_label?: string;
  first_action_label?: string;
  last_action_label?: string;
  first_pending_label?: string;
  prev_pending_label?: string;
  next_pending_label?: string;
  last_pending_label?: string;
  skip_to_label?: string;
  skip_to_action_label?: string;
  skip_to_pending_label?: string;
  skip_to_invalid?: string;
  page_skips?: number[];
  page_summary?: string;
  summary_label?: string;
};

type NavAction = "first" | "prev" | "next" | "last" | "skip";

type NavAvailability = {
  firstOk: boolean;
  prevOk: boolean;
  nextOk: boolean;
  lastOk: boolean;
};

function availabilityFromMeta(meta: SkipPaginationMeta): NavAvailability {
  return {
    firstOk: typeof meta.first_skip === "number",
    prevOk: typeof meta.prev_skip === "number",
    nextOk: Boolean(meta.has_more) && typeof meta.next_skip === "number",
    lastOk: typeof meta.last_skip === "number",
  };
}

function availabilityFromPage(page: number, totalPages: number): NavAvailability {
  const p = Math.max(1, page);
  const max = Math.max(1, totalPages);
  return {
    firstOk: p > 1,
    prevOk: p > 1,
    nextOk: p < max,
    lastOk: p < max,
  };
}

function skipForPage(meta: SkipPaginationMeta, page: number): number | null {
  const max = meta.total_pages ?? 0;
  if (!Number.isInteger(page) || page < 1 || page > max) return null;
  if (Array.isArray(meta.page_skips) && meta.page_skips.length === max) {
    const skip = meta.page_skips[page - 1];
    return typeof skip === "number" && skip >= 0 ? skip : null;
  }
  const limit = typeof meta.limit === "number" && meta.limit > 0 ? meta.limit : 0;
  if (limit < 1) return null;
  return (page - 1) * limit;
}

/**
 * Stable skip pagination - industry pattern for soft-fetched lists:
 * - Sticky meta so a one-frame null `meta` never unmounts the chrome
 * - Frozen First/Prev/Next/Last enablement while busy (no gray flash)
 * - Optimistic page field; summary slot keeps fixed width
 * - Page/Go stays mounted when labels exist (no form mount/unmount flicker)
 * - Parent `disabled` blocks re-clicks via pointer-events, not button disabled
 *
 * Prefer always rendering this component (pass null meta while loading).
 * It returns a stable spacer when there is only one page.
 */
export function SkipPagination({
  meta,
  onPrev,
  onNext,
  disabled,
  className,
  inputId,
}: {
  meta?: SkipPaginationMeta | null;
  onPrev: (skip: number) => void;
  onNext: (skip: number) => void;
  disabled?: boolean;
  className?: string;
  inputId?: string;
}) {
  const generatedSkipId = React.useId();
  const skipInputId = inputId?.trim() || generatedSkipId;
  const [skipPage, setSkipPage] = React.useState("");
  const [skipError, setSkipError] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState<NavAction | null>(null);
  const [frozenNav, setFrozenNav] = React.useState<NavAvailability | null>(null);
  const [displaySummary, setDisplaySummary] = React.useState(
    () => meta?.page_summary || meta?.summary_label || "",
  );
  const inputFocusedRef = React.useRef(false);
  const stickyMetaRef = React.useRef<SkipPaginationMeta | null>(null);
  const wasDisabledRef = React.useRef(false);

  if (meta != null) stickyMetaRef.current = meta;
  const view = meta ?? stickyMetaRef.current;

  const busy = Boolean(disabled) || pendingAction != null;

  // Keep summary text stable: only update when not mid-flight (or first paint).
  React.useEffect(() => {
    if (busy) return;
    const next = view?.page_summary || view?.summary_label || "";
    setDisplaySummary((prev) => (prev === next ? prev : next));
  }, [busy, view?.page_summary, view?.summary_label]);

  React.useEffect(() => {
    if (inputFocusedRef.current) return;
    if (typeof meta?.page === "number" && meta.page >= 1) {
      const next = String(meta.page);
      setSkipPage((prev) => (prev === next ? prev : next));
      setSkipError("");
    }
  }, [meta?.page]);

  // Settle when parent fetch clears (true → false), or when meta page matches
  // the optimistic target (parents that omit `disabled`).
  React.useEffect(() => {
    const was = wasDisabledRef.current;
    wasDisabledRef.current = Boolean(disabled);
    if (was && !disabled) {
      setPendingAction(null);
      setFrozenNav(null);
      return;
    }
    if (disabled || pendingAction == null) return;
    if (typeof meta?.page === "number" && String(meta.page) === skipPage) {
      setPendingAction(null);
      setFrozenNav(null);
    }
  }, [disabled, meta?.page, pendingAction, skipPage]);

  const pageFromSkip = React.useCallback(
    (skip: number): number => {
      const limit = typeof view?.limit === "number" && view.limit > 0 ? view.limit : 0;
      if (limit < 1) return Number.parseInt(skipPage, 10) || 1;
      return Math.floor(skip / limit) + 1;
    },
    [view?.limit, skipPage],
  );

  const applySkip = (skip: number, action: NavAction, viaPrev = false) => {
    if (busy || !view) return;
    const page = pageFromSkip(skip);
    const totalPages = typeof view.total_pages === "number" ? view.total_pages : 1;
    setPendingAction(action);
    setSkipPage(String(page));
    setSkipError("");
    setFrozenNav(availabilityFromPage(page, totalPages));
    // Optimistic summary: rewrite leading page digit in API-localized string.
    const template = view.page_summary || view.summary_label || displaySummary;
    if (template) setDisplaySummary(template.replace(/\d+/, String(page)));
    if (viaPrev) onPrev(skip);
    else onNext(skip);
  };

  const totalPages = view?.total_pages ?? 0;
  if (!view || totalPages <= 1) {
    // Stable spacer so parents can always mount this component without layout jump.
    return <div className={cn("min-h-6", className)} aria-hidden />;
  }

  const liveNav = availabilityFromMeta(view);
  const nav = frozenNav ?? liveNav;
  const canSkipTo =
    Boolean(view.skip_to_label?.trim()) && Boolean(view.skip_to_action_label?.trim());

  function submitSkipTo() {
    if (!canSkipTo || busy || !view) return;
    const page = Number.parseInt(skipPage, 10);
    const skip = skipForPage(view, page);
    if (skip == null) {
      setSkipError(view.skip_to_invalid || "");
      return;
    }
    setSkipError("");
    applySkip(skip, "skip");
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        busy && "pointer-events-none cursor-wait",
        className,
      )}
      aria-busy={busy || undefined}
    >
      <span className="mr-auto min-h-[1.25rem] min-w-[11rem] text-xs tabular-nums text-[var(--dama-muted)]">
        {displaySummary}
      </span>
      {view.first_action_label ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[4.5rem] transition-none", !nav.firstOk && "opacity-50")}
          aria-disabled={!nav.firstOk || undefined}
          onClick={() => {
            if (!nav.firstOk || typeof view.first_skip !== "number") return;
            applySkip(view.first_skip, "first");
          }}
        >
          {view.first_action_label}
        </Button>
      ) : null}
      {view.prev_action_label ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[4.5rem] transition-none", !nav.prevOk && "opacity-50")}
          aria-disabled={!nav.prevOk || undefined}
          onClick={() => {
            if (!nav.prevOk || typeof view.prev_skip !== "number") return;
            applySkip(view.prev_skip, "prev", true);
          }}
        >
          {view.prev_action_label}
        </Button>
      ) : null}
      {canSkipTo ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitSkipTo();
          }}
        >
          <label className="sr-only" htmlFor={skipInputId}>
            {view.skip_to_label}
          </label>
          <input
            id={skipInputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPages}
            className="h-8 w-16 rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-2 text-sm tabular-nums"
            value={skipPage}
            placeholder={view.skip_to_label?.trim() || ""}
            aria-invalid={Boolean(skipError) || undefined}
            onFocus={() => {
              inputFocusedRef.current = true;
            }}
            onBlur={() => {
              inputFocusedRef.current = false;
            }}
            onChange={(e) => {
              setSkipPage(e.target.value.replace(/\D/g, ""));
              setSkipError("");
            }}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="min-w-[3.5rem] transition-none"
          >
            {view.skip_to_action_label}
          </Button>
        </form>
      ) : null}
      {view.next_action_label ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[4.5rem] transition-none", !nav.nextOk && "opacity-50")}
          aria-disabled={!nav.nextOk || undefined}
          onClick={() => {
            if (!nav.nextOk || typeof view.next_skip !== "number") return;
            applySkip(view.next_skip, "next");
          }}
        >
          {view.next_action_label}
        </Button>
      ) : null}
      {view.last_action_label ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[4.5rem] transition-none", !nav.lastOk && "opacity-50")}
          aria-disabled={!nav.lastOk || undefined}
          onClick={() => {
            if (!nav.lastOk || typeof view.last_skip !== "number") return;
            applySkip(view.last_skip, "last");
          }}
        >
          {view.last_action_label}
        </Button>
      ) : null}
      {skipError ? (
        <span className="w-full text-xs text-[var(--dama-danger)]">{skipError}</span>
      ) : null}
    </div>
  );
}
