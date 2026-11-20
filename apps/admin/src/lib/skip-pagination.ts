import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";

/** Fail-closed: API BuildMeta fields required (never invent skip/limit/labels). */
export function requireApiSkipMeta(
  meta: SkipPaginationMeta | null | undefined,
  label = "pagination meta",
): asserts meta is SkipPaginationMeta {
  if (!meta || typeof meta !== "object") {
    throw new Error(`${label} unavailable`);
  }
  if (typeof meta.skip !== "number" || meta.skip < 0) {
    throw new Error(`${label} skip unavailable`);
  }
  if (typeof meta.limit !== "number" || meta.limit < 1) {
    throw new Error(`${label} limit unavailable`);
  }
  if (typeof meta.total !== "number" || meta.total < 0) {
    throw new Error(`${label} total unavailable`);
  }
  if (typeof meta.page !== "number" || meta.page < 1) {
    throw new Error(`${label} page unavailable`);
  }
  if (typeof meta.total_pages !== "number" || meta.total_pages < 0) {
    throw new Error(`${label} total_pages unavailable`);
  }
  if (typeof meta.has_more !== "boolean") {
    throw new Error(`${label} has_more unavailable`);
  }
  if (typeof meta.page_summary !== "string" || !meta.page_summary.trim()) {
    throw new Error(`${label} page_summary unavailable`);
  }
  if (typeof meta.next_action_label !== "string" || !meta.next_action_label.trim()) {
    throw new Error(`${label} next_action_label unavailable`);
  }
}

export type ClientSkipLabels = {
  first_action_label?: string;
  prev_action_label?: string;
  next_action_label?: string;
  last_action_label?: string;
  first_pending_label?: string;
  prev_pending_label?: string;
  next_pending_label?: string;
  last_pending_label?: string;
  skip_to_label?: string;
  skip_to_action_label?: string;
  skip_to_pending_label?: string;
  skip_to_invalid?: string;
  page_summary_fmt?: string;
};

/** Build Trim-style skip/limit meta for client-side lists until API ships BuildMeta. */
export function buildClientSkipMeta(
  total: number,
  skip: number,
  limit: number,
  labels: ClientSkipLabels = {},
): SkipPaginationMeta {
  const safeLimit = Math.max(1, limit);
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);
  const page = Math.min(totalPages, Math.floor(skip / safeLimit) + 1);
  const pageSkips = Array.from({ length: totalPages }, (_, i) => i * safeLimit);
  const firstSkip = 0;
  const lastSkip = pageSkips[totalPages - 1] ?? 0;
  const prevSkip = page > 1 ? (pageSkips[page - 2] ?? null) : null;
  const nextSkip = page < totalPages ? (pageSkips[page] ?? null) : null;
  const from = safeTotal === 0 ? 0 : skip + 1;
  const to = Math.min(skip + safeLimit, safeTotal);
  const summary =
    (labels.page_summary_fmt || "")
      .replace("{from}", String(from))
      .replace("{to}", String(to))
      .replace("{total}", String(safeTotal))
      .replace("{page}", String(page))
      .replace("{pages}", String(totalPages))
      .trim() || `${from}-${to} / ${safeTotal}`;

  return {
    skip,
    limit: safeLimit,
    page,
    total_pages: totalPages,
    first_skip: firstSkip,
    last_skip: lastSkip,
    prev_skip: prevSkip,
    next_skip: nextSkip,
    has_more: nextSkip != null,
    page_skips: pageSkips,
    page_summary: summary,
    first_action_label: labels.first_action_label,
    prev_action_label: labels.prev_action_label,
    next_action_label: labels.next_action_label,
    last_action_label: labels.last_action_label,
    first_pending_label: labels.first_pending_label,
    prev_pending_label: labels.prev_pending_label,
    next_pending_label: labels.next_pending_label,
    last_pending_label: labels.last_pending_label,
    skip_to_label: labels.skip_to_label,
    skip_to_action_label: labels.skip_to_action_label,
    skip_to_pending_label: labels.skip_to_pending_label,
    skip_to_invalid: labels.skip_to_invalid,
  };
}

/** Default English chrome for skip UI when DB chrome not yet shipped (fail-open labels). */
export const DEFAULT_SKIP_LABELS: ClientSkipLabels = {
  first_action_label: "First",
  prev_action_label: "Prev",
  next_action_label: "Next",
  last_action_label: "Last",
  first_pending_label: "Loading…",
  prev_pending_label: "Loading…",
  next_pending_label: "Loading…",
  last_pending_label: "Loading…",
  skip_to_label: "Page",
  skip_to_action_label: "Go",
  skip_to_pending_label: "Going…",
  skip_to_invalid: "Invalid page",
  page_summary_fmt: "{from}-{to} of {total}",
};
