/** Shared filter option builders (Trim). Labels come from chrome - never invent copy. */

export type FilterOption = { value: string; label: string };

const ALL = "__all__";

export function filterAllSentinel(): string {
  return ALL;
}

export function isFilterAll(value: string): boolean {
  return !value || value === ALL;
}

/** Build options from value→label pairs; drop empty labels (fail closed). */
export function filterOptionsFromPairs(
  pairs: ReadonlyArray<readonly [string, string | undefined]>,
): FilterOption[] {
  return pairs.flatMap(([value, label]) => {
    const trimmed = label?.trim() || "";
    return trimmed ? [{ value, label: trimmed }] : [];
  });
}
