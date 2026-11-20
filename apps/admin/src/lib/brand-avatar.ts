/** Exact Dama brand mark paths (public/brand) - transparent PNGs, light/dark. */

/** Burgundy mark on transparent - for light UI surfaces. */
export const BRAND_MARK_LIGHT = "/brand/dama-mark.png?v=receipt-mark-v2";
/** White mark on transparent - for dark UI surfaces. */
export const BRAND_MARK_DARK = "/brand/dama-mark-white.png?v=receipt-mark-v2";

export type BrandAvatarTone = "light" | "dark";

/** Exact transparent mark for the given tone (no redesigned plates). */
export function brandMarkSrc(tone: BrandAvatarTone): string {
  return tone === "dark" ? BRAND_MARK_DARK : BRAND_MARK_LIGHT;
}

export function resolveAvatarTone(opts: {
  resolvedTheme?: string | null;
  /** Board seat piece side overrides app theme for contrast. */
  pieceSide?: "light" | "dark" | null;
}): BrandAvatarTone {
  if (opts.pieceSide === "light") return "light";
  if (opts.pieceSide === "dark") return "dark";
  return opts.resolvedTheme === "dark" ? "dark" : "light";
}
