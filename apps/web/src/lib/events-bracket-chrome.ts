import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import type { BracketSectionChrome } from "@/lib/events-bracket-sections";
import type { ClientEnums } from "@/types/platform";

/** Merge DB chrome labels with phase id codes from client_enums (no invent). */
export function bracketChromeFrom(
  chrome: BracketSectionChrome & Record<string, unknown>,
  enums?: ClientEnums | null,
): BracketSectionChrome {
  const metaSep = chromeSeparator(chrome.meta_separator);
  return {
    phase_group_label: String(chrome.phase_group_label || "").trim() || undefined,
    phase_knockout_label: String(chrome.phase_knockout_label || "").trim() || undefined,
    phase_swiss_label: String(chrome.phase_swiss_label || "").trim() || undefined,
    phase_round_robin_label: String(chrome.phase_round_robin_label || "").trim() || undefined,
    group_label_template: String(chrome.group_label_template || "").trim() || undefined,
    swiss_round_label_template: String(chrome.swiss_round_label_template || "").trim() || undefined,
    meta_separator: chromeSeparatorPresent(metaSep) ? metaSep : undefined,
    phase_group: (enums?.hosted_event_phase_group || "").trim() || undefined,
    phase_knockout: (enums?.hosted_event_phase_knockout || "").trim() || undefined,
    phase_swiss: (enums?.hosted_event_phase_swiss || "").trim() || undefined,
    phase_round_robin: (enums?.hosted_event_phase_round_robin || "").trim() || undefined,
  };
}

export function publicVisibilityCode(enums?: ClientEnums | null): string {
  return (enums?.hosted_event_public_visibility || "").trim();
}

export function privateVisibilityCode(enums?: ClientEnums | null): string {
  return (enums?.hosted_event_private_visibility || "").trim();
}
