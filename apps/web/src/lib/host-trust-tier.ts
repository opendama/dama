/** DB policy codes from cash_rmg_policy host_trust_tier_* (mig 522). */
export type HostTrustTierCode = "unverified" | "phone_verified" | "document_verified" | "";

/** Normalize server host_trust_tier to a known code (fail closed empty). */
export function normalizeHostTrustTier(raw?: string | null): HostTrustTierCode {
  const t = (raw || "").trim().toLowerCase();
  if (t === "document_verified") return "document_verified";
  if (t === "phone_verified") return "phone_verified";
  if (t === "unverified") return "unverified";
  return "";
}

export function hostTrustTierShowsCheck(tier?: string | null): boolean {
  const code = normalizeHostTrustTier(tier);
  return code === "document_verified" || code === "phone_verified";
}
