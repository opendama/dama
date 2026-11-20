/// DB policy codes from cash_rmg_policy host_trust_tier_* (mig 522).
enum HostTrustTierCode {
  unverified,
  phoneVerified,
  documentVerified,
  unknown,
}

/// Normalize server host_trust_tier to a known code (fail closed unknown).
HostTrustTierCode normalizeHostTrustTier(String? raw) {
  final t = (raw ?? '').trim().toLowerCase();
  if (t == 'document_verified') return HostTrustTierCode.documentVerified;
  if (t == 'phone_verified') return HostTrustTierCode.phoneVerified;
  if (t == 'unverified') return HostTrustTierCode.unverified;
  return HostTrustTierCode.unknown;
}

bool hostTrustTierShowsCheck(String? tier) {
  final code = normalizeHostTrustTier(tier);
  return code == HostTrustTierCode.documentVerified ||
      code == HostTrustTierCode.phoneVerified;
}
