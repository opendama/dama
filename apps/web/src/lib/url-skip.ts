/**
 * Persist list offset (`skip`) in the URL so refresh / share / back keep the page.
 * Prefer namespaced keys on multi-list routes (e.g. events_skip, tournaments_skip).
 */

export function parseSkipParam(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function readSkipParam(
  searchParams: { get(name: string): string | null },
  key: string,
): number {
  const k = key.trim();
  if (!k) return 0;
  return parseSkipParam(searchParams.get(k));
}

/** Returns query string without leading `?`. Deletes key when skip is 0. */
export function withSkipParam(
  searchParams: { toString(): string },
  key: string,
  skip: number,
): string {
  const k = key.trim();
  if (!k) return searchParams.toString();
  const next = new URLSearchParams(searchParams.toString());
  const safe = Math.max(0, Math.floor(Number(skip) || 0));
  if (safe <= 0) next.delete(k);
  else next.set(k, String(safe));
  return next.toString();
}

/**
 * Patch query keys without dropping unrelated params (skip, view, code, …).
 * Empty/null values delete the key.
 */
export function hrefWithQueryPatch(
  pathname: string,
  searchParams: { toString(): string },
  patch: Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams(searchParams.toString());
  for (const [rawKey, rawVal] of Object.entries(patch)) {
    const k = rawKey.trim();
    if (!k) continue;
    const v = (rawVal ?? "").trim();
    if (!v) next.delete(k);
    else next.set(k, v);
  }
  const path = pathname.trim() || "/";
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}
