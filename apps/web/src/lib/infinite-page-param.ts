import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";

/**
 * Next skip from backend meta only.
 * Fail-closed when the last page returned zero rows (prevents sparse-page fetch loops).
 */
export function nextSkipFromMeta(
  meta: SkipPaginationMeta | null | undefined,
  pageRowCount: number,
): number | undefined {
  if (!meta?.has_more) return undefined;
  if (pageRowCount <= 0) return undefined;
  const next = meta.next_skip;
  return typeof next === "number" && next >= 0 ? next : undefined;
}
