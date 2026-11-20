import type { XPLevel } from "@/types";

export type XpLevelsParseErrors = {
  invalidJson: string;
  empty: string;
};

/** Parse console XP levels JSON from the progression form. Fail closed on bad input. */
export function parseXpLevelsJson(levelsJson: string, errors?: XpLevelsParseErrors): XPLevel[] {
  const invalidJson = (errors?.invalidJson || "").trim();
  const empty = (errors?.empty || "").trim();
  let xp_levels: XPLevel[];
  try {
    xp_levels = JSON.parse(levelsJson) as XPLevel[];
  } catch {
    throw new Error(invalidJson);
  }
  if (!Array.isArray(xp_levels) || xp_levels.length === 0) {
    throw new Error(empty);
  }
  return xp_levels;
}
