/** Digits only (schedule caps, seat counts, pagination skip). */
export function sanitizeIntegerInput(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "");
}
