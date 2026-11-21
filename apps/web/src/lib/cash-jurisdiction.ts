import type { CashEligibility, CashRmgChrome, CashRmgPolicy } from "@/types/cash-rmg";

function normCountry(code: string | null | undefined): string {
  return (code || "").trim().toUpperCase();
}

function inList(code: string, list: string[] | null | undefined): boolean {
  if (!code || !Array.isArray(list) || list.length < 1) return false;
  return list.some((c) => normCountry(c) === code);
}

/**
 * Server EvaluateCash jurisdiction parity: allowlist AND not on disabled list.
 * Empty country is not "blocked" here (callers treat country_required separately).
 */
export function isCountryOutsideCashJurisdiction(
  country: string | null | undefined,
  allowedCountryCodes: string[] | null | undefined,
  disabledCountryCodes: string[] | null | undefined,
): boolean {
  const cc = normCountry(country);
  if (!cc) return false;
  const allowed = Array.isArray(allowedCountryCodes) ? allowedCountryCodes : [];
  if (allowed.length < 1) return true; // fail closed without allowlist
  if (!inList(cc, allowed)) return true;
  if (inList(cc, disabledCountryCodes)) return true;
  return false;
}

export type CashJurisdictionLockInput = {
  flagsSettled: boolean;
  cashEnabled: boolean;
  country: string | null | undefined;
  policy?: Pick<CashRmgPolicy, "allowed_country_codes"> | null;
  disabledCountryCodes?: string[] | null;
  /** Prefer server /me/cash-eligibility when fetched. */
  eligibility?: CashEligibility | null;
  eligibilityFetched?: boolean;
};

const JURISDICTION_KEYS = new Set(["jurisdiction", "cash_disabled", "unavailable"]);

/** Paid cash UI lock: server eligibility when ready, else flags + allowlist parity. */
export function isCashJurisdictionLocked(input: CashJurisdictionLockInput): boolean {
  if (!input.flagsSettled) return false;
  if (input.eligibilityFetched && input.eligibility) {
    if (input.eligibility.ok === true) return false;
    const key = (input.eligibility.error_key || "").trim();
    if (JURISDICTION_KEYS.has(key)) return true;
    // Age/phone/locate stay unlock for jurisdiction banner; dedicated gates handle them.
    if (
      key === "age_required" ||
      key === "phone_kyc" ||
      key === "locate_required" ||
      key === "locate_stale"
    ) {
      return false;
    }
    if (key === "country_required") return false;
  }
  if (!input.cashEnabled) return true;
  const allowed = input.policy?.allowed_country_codes;
  if (!Array.isArray(allowed) || allowed.length < 1) return true;
  return isCountryOutsideCashJurisdiction(input.country, allowed, input.disabledCountryCodes);
}

export function cashJurisdictionLockMessage(
  locked: boolean,
  country: string | null | undefined,
  cashChrome: CashRmgChrome | undefined,
  opts?: {
    cashEnabled?: boolean;
    eligibility?: CashEligibility | null;
  },
): string {
  if (!locked || !cashChrome) return "";
  const key = (opts?.eligibility?.error_key || "").trim();
  if (key === "cash_disabled" || key === "unavailable") {
    return (cashChrome.cash_disabled_error || cashChrome.cash_rmg_unavailable || "").trim();
  }
  if (key === "jurisdiction") {
    return (cashChrome.jurisdiction_blocked_error || cashChrome.cash_disabled_error || "").trim();
  }
  if (opts?.cashEnabled === false) {
    return (cashChrome.cash_disabled_error || cashChrome.cash_rmg_unavailable || "").trim();
  }
  if (normCountry(country)) {
    return (cashChrome.jurisdiction_blocked_error || cashChrome.cash_disabled_error || "").trim();
  }
  return (cashChrome.cash_disabled_error || cashChrome.cash_rmg_unavailable || "").trim();
}
