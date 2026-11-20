export type StoreComplianceChrome = {
  account_section_title?: string;
  delete_account_title?: string;
  delete_account_blurb?: string;
  delete_account_action?: string;
  delete_account_confirm?: string;
  delete_account_confirm_token?: string;
  delete_account_pending?: string;
  delete_account_failed?: string;
  delete_account_success?: string;
  export_data_title?: string;
  export_data_blurb?: string;
  export_data_action?: string;
  export_data_pending?: string;
  export_data_failed?: string;
  export_filename?: string;
  privacy_link_label?: string;
  terms_link_label?: string;
  refunds_link_label?: string;
  store_compliance_unavailable?: string;
  err_unauthorized?: string;
};

const STORE_COMPLIANCE_CHROME_KEYS: (keyof StoreComplianceChrome)[] = [
  "account_section_title",
  "delete_account_title",
  "delete_account_blurb",
  "delete_account_action",
  "delete_account_confirm",
  "delete_account_confirm_token",
  "delete_account_pending",
  "delete_account_failed",
  "delete_account_success",
  "export_data_title",
  "export_data_blurb",
  "export_data_action",
  "export_data_pending",
  "export_data_failed",
  "export_filename",
  "privacy_link_label",
  "terms_link_label",
  "refunds_link_label",
  "store_compliance_unavailable",
  "err_unauthorized",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every store compliance chrome string must be present from the database. */
export function isStoreComplianceChromeReady(
  chrome: StoreComplianceChrome | null | undefined,
): chrome is Required<StoreComplianceChrome> {
  if (!chrome) return false;
  return STORE_COMPLIANCE_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
