/** Digits only (schedule caps, seat counts, pagination skip). */
export function sanitizeIntegerInput(raw: string, opts?: { allowNegative?: boolean }): string {
  const s = String(raw ?? "");
  if (!opts?.allowNegative) return s.replace(/\D/g, "");
  const neg = s.trimStart().startsWith("-");
  const digits = s.replace(/\D/g, "");
  if (!digits) return neg ? "-" : "";
  return neg ? `-${digits}` : digits;
}
