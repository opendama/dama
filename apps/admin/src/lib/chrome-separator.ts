/**
 * DB chrome separators/joiners may be whitespace-only (e.g. a single space).
 * Never trim when testing presence - that blanks money UIs.
 */
export function chromeSeparator(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export function chromeSeparatorPresent(raw: unknown): boolean {
  return chromeSeparator(raw).length > 0;
}
