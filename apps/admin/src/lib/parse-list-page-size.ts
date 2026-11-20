/** Parse DB chrome list_page_size. Returns 0 when missing/invalid (fail closed; never invent). */
export function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
