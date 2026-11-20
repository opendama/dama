export type PaymentModalChrome = {
  title?: string;
  blurb?: string;
  balance_label?: string;
  fee_label?: string;
  confirm_action?: string;
  cancel_action?: string;
  insufficient_title?: string;
  insufficient_blurb?: string;
  top_up_action?: string;
  /** DB deep link for wallet top-up (fail closed; no client invent of /wallet). */
  top_up_href?: string;
  methods_title?: string;
  methods_blurb?: string;
  checkout_action?: string;
  amount_label?: string;
  amount_placeholder?: string;
  balance_pending?: string;
  country_required_hint?: string;
  payment_modal_unavailable?: string;
  enroll_success?: string;
  enroll_failed?: string;
  already_enrolled?: string;
  confirm_pending?: string;
  checkout_pending?: string;
  amount_currency_separator?: string;
};

const PAYMENT_MODAL_CHROME_KEYS: (keyof PaymentModalChrome)[] = [
  "title",
  "blurb",
  "balance_label",
  "fee_label",
  "confirm_action",
  "cancel_action",
  "insufficient_title",
  "insufficient_blurb",
  "top_up_action",
  "top_up_href",
  "methods_title",
  "methods_blurb",
  "checkout_action",
  "amount_label",
  "amount_placeholder",
  "balance_pending",
  "country_required_hint",
  "payment_modal_unavailable",
  "enroll_success",
  "enroll_failed",
  "already_enrolled",
  "confirm_pending",
  "checkout_pending",
  "amount_currency_separator",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every payment modal chrome string must be present from the database. */
export function isPaymentModalChromeReady(
  chrome: PaymentModalChrome | null | undefined,
): chrome is Required<PaymentModalChrome> {
  if (!chrome) return false;
  return PAYMENT_MODAL_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
