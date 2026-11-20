/** Digits + optional single decimal - no letters (Trim amount typing parity). */
export function sanitizeDecimalInput(raw: string, maxDecimals = 2): string {
  let s = String(raw ?? "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, "")}`;
    const [whole, frac = ""] = s.split(".");
    if (frac.length > maxDecimals) {
      s = `${whole}.${frac.slice(0, maxDecimals)}`;
    }
  }
  if (s.startsWith(".")) s = `0${s}`;
  return s;
}

export function parsePositiveDecimal(raw: string): number | null {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
