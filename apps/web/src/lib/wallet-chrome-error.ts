import { ApiClientError, isApiClientError } from "@/lib/api-client-error";
import type { WalletChrome } from "@/types/wallet-chrome";
import { isAxiosError } from "axios";

function walletErrorKey(err: unknown): string {
  if (isApiClientError(err)) return (err.errorKey || "").trim();
  if (isAxiosError(err)) {
    return String(
      (err.response?.data as { error_key?: string } | undefined)?.error_key || "",
    ).trim();
  }
  return "";
}

/**
 * Map wallet/payment `error_key` → DB wallet chrome (never API JSON / Error.message).
 * Checkout provider failures use checkout_failed (single professional user copy).
 */
export function walletChromeErrorMessage(
  err: unknown,
  chrome: WalletChrome | undefined,
  fallback: string,
): string {
  const fb = (fallback || "").trim();
  if (!chrome) return fb;
  const key = walletErrorKey(err);
  const map: Record<string, string | undefined> = {
    checkout_unavailable: chrome.checkout_failed || chrome.checkout_unavailable,
    checkout_failed: chrome.checkout_failed,
    payment_route_unavailable: chrome.payment_route_unavailable || chrome.checkout_failed,
    invalid_top_up_amount: chrome.invalid_top_up_amount,
    location_currency_unresolved: chrome.location_currency_unresolved || chrome.checkout_failed,
    country_required_checkout: chrome.country_required_checkout,
    err_unauthorized: chrome.err_unauthorized,
    err_invalid_json: chrome.err_invalid_json,
    document_kyc_required: chrome.document_kyc_required,
  };
  if (key && map[key] != null) {
    const fromChrome = (map[key] || "").trim();
    if (fromChrome) return fromChrome;
  }
  return fb;
}

/** Build a synthetic key-bearing error for body/error_key maps. */
export function walletErrorFromKey(errorKey: string): ApiClientError {
  return new ApiClientError("", { errorKey: (errorKey || "").trim() });
}
