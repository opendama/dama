import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import type { HostedBracketMatch } from "@/types/events";

export type BracketSectionChrome = {
  phase_group_label?: string;
  phase_knockout_label?: string;
  phase_swiss_label?: string;
  phase_round_robin_label?: string;
  group_label_template?: string;
  swiss_round_label_template?: string;
  /** DB chrome title joiner (never invent separators). */
  meta_separator?: string;
  /** From client_enums.hosted_event_phase_*; never invent phase ids. */
  phase_group?: string;
  phase_knockout?: string;
  phase_swiss?: string;
  phase_round_robin?: string;
};

export type BracketSection = {
  key: string;
  title: string;
  matches: HostedBracketMatch[];
};

function applyTemplate(template: string, n: number): string {
  const t = (template || "").trim();
  if (!t) return "";
  return t.replaceAll("{n}", String(n));
}

/**
 * Group bracket matches by phase / group_index when present.
 * Titles come only from DB chrome templates/labels (fail closed → empty title).
 */
export function buildBracketSections(
  matches: HostedBracketMatch[],
  chrome: BracketSectionChrome,
): BracketSection[] {
  if (!matches.length) return [];

  const hasPhase = matches.some((m) => (m.phase || "").trim().length > 0);
  if (!hasPhase) {
    return [{ key: "all", title: "", matches: [...matches] }];
  }

  const sep = chromeSeparator(chrome.meta_separator);
  const joinTitle = (parts: string[]) =>
    chromeSeparatorPresent(sep) ? parts.filter(Boolean).join(sep) : parts.filter(Boolean).join("");

  const ordered = [...matches].sort((a, b) => {
    const pa = (a.phase || "").trim();
    const pb = (b.phase || "").trim();
    if (pa !== pb) return pa.localeCompare(pb);
    const ga = typeof a.group_index === "number" ? a.group_index : -1;
    const gb = typeof b.group_index === "number" ? b.group_index : -1;
    if (ga !== gb) return ga - gb;
    if (a.round_index !== b.round_index) return a.round_index - b.round_index;
    return a.match_index - b.match_index;
  });

  const phases = Array.from(new Set(ordered.map((m) => (m.phase || "").trim()).filter(Boolean)));

  const sections: BracketSection[] = [];

  for (const phase of phases) {
    const phaseMatches = ordered.filter((m) => (m.phase || "").trim() === phase);
    const groupIndexes = Array.from(
      new Set(phaseMatches.map((m) => (typeof m.group_index === "number" ? m.group_index : -1))),
    ).sort((a, b) => a - b);
    const hasGroups = groupIndexes.some((g) => g >= 0);

    const phaseGroup = (chrome.phase_group || "").trim();
    const phaseKo = (chrome.phase_knockout || "").trim();
    const phaseSwiss = (chrome.phase_swiss || "").trim();
    const phaseRr = (chrome.phase_round_robin || "").trim();

    let phaseTitle = "";
    if (phaseGroup && phase === phaseGroup) {
      phaseTitle = (chrome.phase_group_label || "").trim();
    } else if (phaseKo && phase === phaseKo) {
      phaseTitle = (chrome.phase_knockout_label || "").trim();
    } else if (phaseSwiss && phase === phaseSwiss) {
      phaseTitle = (chrome.phase_swiss_label || "").trim();
    } else if (phaseRr && phase === phaseRr) {
      phaseTitle = (chrome.phase_round_robin_label || "").trim();
    }
    // Unknown phase id: fail closed (empty title). Never invent knockout label.

    if (hasGroups) {
      for (const gi of groupIndexes) {
        const groupMatches = phaseMatches.filter(
          (m) => (typeof m.group_index === "number" ? m.group_index : -1) === gi,
        );
        const parts: string[] = [];
        if (phaseTitle) parts.push(phaseTitle);
        if (gi >= 0) {
          const gl = applyTemplate(chrome.group_label_template || "", gi + 1);
          if (gl) parts.push(gl);
        }
        sections.push({
          key: `${phase}:g${gi}`,
          title: joinTitle(parts),
          matches: groupMatches,
        });
      }
      continue;
    }

    const roundIndexes = Array.from(new Set(phaseMatches.map((m) => m.round_index))).sort(
      (a, b) => a - b,
    );
    const roundTpl = (chrome.swiss_round_label_template || "").trim();
    const isSwissPhase = Boolean(phaseSwiss) && phase === phaseSwiss;
    if (isSwissPhase && roundTpl && roundIndexes.length > 1) {
      for (const ri of roundIndexes) {
        const roundMatches = phaseMatches.filter((m) => m.round_index === ri);
        const parts: string[] = [];
        if (phaseTitle) parts.push(phaseTitle);
        const rl = applyTemplate(roundTpl, ri + 1);
        if (rl) parts.push(rl);
        sections.push({
          key: `${phase}:r${ri}`,
          title: joinTitle(parts),
          matches: roundMatches,
        });
      }
      continue;
    }

    sections.push({
      key: phase || "phase",
      title: phaseTitle,
      matches: phaseMatches,
    });
  }

  return sections;
}
