/**
 * CSS aspect-ratio from DB chrome ratio label (e.g. "16:9" -> "16 / 9").
 * Fail closed: empty string when label is missing or invalid.
 */
export function viewportAspectRatioFromLabel(ratioLabel: string | undefined | null): string {
  const raw = String(ratioLabel || "")
    .trim()
    .replace(/\s+/g, "");
  const parts = raw.includes(":") ? raw.split(":") : raw.split("/");
  if (parts.length !== 2) return "";
  const wRaw = parts[0];
  const hRaw = parts[1];
  if (wRaw === undefined || hRaw === undefined) return "";
  const w = Number.parseInt(wRaw, 10);
  const h = Number.parseInt(hRaw, 10);
  if (!Number.isFinite(w) || w < 1 || !Number.isFinite(h) || h < 1) return "";
  return `${w} / ${h}`;
}
