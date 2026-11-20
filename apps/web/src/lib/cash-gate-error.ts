import { ApiClientError, isApiClientError } from "@/lib/api-client-error";
import type { CashRmgChrome } from "@/types/cash-rmg";
import { isAxiosError } from "axios";

function cashGateErrorKey(err: unknown): string {
  if (isApiClientError(err)) return (err.errorKey || "").trim();
  if (isAxiosError(err)) {
    return String(
      (err.response?.data as { error_key?: string } | undefined)?.error_key || "",
    ).trim();
  }
  return "";
}

const CASH_GATE_KEYS = new Set([
  "age_required",
  "cash_disabled",
  "jurisdiction",
  "country_required",
  "locate_required",
  "locate_stale",
  "phone_kyc",
  "checkout_unavailable",
  "payment_route_unavailable",
  "invalid_top_up_amount",
  "location_currency_unresolved",
  "country_required_checkout",
]);

/** Map cash gate `error_key` to DB chrome (never surface raw API English / JSON bodies). */
export function cashGateChromeMessage(
  err: unknown,
  cashChrome: CashRmgChrome | undefined,
  fallback: string,
): string {
  const fb = (fallback || "").trim();
  const key = cashGateErrorKey(err);
  if (!key) return fb;
  if (!cashChrome) return fb;
  const map: Record<string, string | undefined> = {
    age_required: cashChrome.age_required_error,
    cash_disabled: cashChrome.cash_disabled_error,
    jurisdiction: cashChrome.jurisdiction_blocked_error,
    country_required: cashChrome.country_required_error,
    locate_required: cashChrome.locate_required_error,
    locate_stale: cashChrome.locate_stale_error,
    phone_kyc: cashChrome.phone_kyc_required_error,
  };
  const fromChrome = (map[key] || "").trim();
  if (fromChrome) return fromChrome;
  // Known cash gate: wallet chrome fallback only (never API English / JSON bodies).
  return CASH_GATE_KEYS.has(key) ? fb : fb;
}

export function isAgeRequiredError(err: unknown): boolean {
  return cashGateErrorKey(err) === "age_required";
}

export function isPhoneKycRequiredError(err: unknown): boolean {
  return cashGateErrorKey(err) === "phone_kyc";
}

export function cashGateErrorFromBody(
  body: unknown,
  cashChrome: CashRmgChrome | undefined,
  fallback: string,
): string {
  if (!body || typeof body !== "object") return (fallback || "").trim();
  const key = String((body as { error_key?: string }).error_key || "").trim();
  return cashGateChromeMessage(new ApiClientError("", { errorKey: key }), cashChrome, fallback);
}
