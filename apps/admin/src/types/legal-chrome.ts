export type LegalChrome = {
  privacy_title?: string;
  terms_title?: string;
  refunds_title?: string;
  last_updated_label?: string;
  privacy_nav_label?: string;
  terms_nav_label?: string;
  refunds_nav_label?: string;
  support_email_key?: string;
  legal_unavailable?: string;
  back_action?: string;
};

const LEGAL_CHROME_KEYS: (keyof LegalChrome)[] = [
  "privacy_title",
  "terms_title",
  "refunds_title",
  "last_updated_label",
  "privacy_nav_label",
  "terms_nav_label",
  "refunds_nav_label",
  "support_email_key",
  "legal_unavailable",
  "back_action",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every legal chrome string must be present from the database. */
export function isLegalChromeReady(
  chrome: LegalChrome | null | undefined,
): chrome is Required<LegalChrome> {
  if (!chrome) return false;
  return LEGAL_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

export type LegalSection = {
  heading?: string;
  body?: string;
  contact_lead?: string;
  contact_trail?: string;
  uses_support_email?: boolean;
};

export type LegalDocumentPayload = {
  sections?: LegalSection[];
  support_email?: string;
};

export type LegalDocKind = "privacy" | "terms" | "refunds";

export function legalDocTitle(chrome: Required<LegalChrome>, kind: LegalDocKind): string {
  if (kind === "privacy") return chrome.privacy_title;
  if (kind === "terms") return chrome.terms_title;
  return chrome.refunds_title;
}

/** Fail closed: at least one section with non-empty body from the database. */
export function isLegalDocumentReady(
  doc: LegalDocumentPayload | null | undefined,
): doc is LegalDocumentPayload & { sections: LegalSection[] } {
  if (!doc?.sections || doc.sections.length === 0) return false;
  return doc.sections.every((s) => typeof s.body === "string" && s.body.trim().length > 0);
}
