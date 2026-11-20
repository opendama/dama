/** Catalog fields used to keep Host create visibility legal for Community listing. */
export type HostCreateVisibilityCatalog = {
  hosted_event_public_visibility?: string;
  hosted_event_private_visibility?: string;
  default_visibility?: string;
  public_events_enabled?: boolean;
};

export type HostPreferPublicSeed = {
  /** Next visibility to apply (empty = leave unchanged). */
  visibility?: string;
  /** Whether the one-shot Host CTA prefer flag should clear. */
  clearPrefer: boolean;
};

/**
 * If Public cups were disabled mid-dialog, fall back off Public so submit cannot
 * race the catalog filter (API still fail-closes; this keeps UX consistent).
 */
export function resolveHostVisibilityAfterCatalog(
  visibility: string,
  catalog: HostCreateVisibilityCatalog | null | undefined,
): string {
  if (!catalog) return visibility;
  const pub = (catalog.hosted_event_public_visibility || "").trim();
  const priv = (catalog.hosted_event_private_visibility || "").trim();
  const def = (catalog.default_visibility || "").trim();
  const publicOn = catalog.public_events_enabled === true;
  const current = (visibility || "").trim();
  if (pub && current === pub && !publicOn) {
    return priv || def || "";
  }
  return current;
}

/**
 * Host CTA prefer-Public seed.
 * Do not clear prefer on a stale catalog where public cups look off - wait until
 * Public is applied, or until dialog dismiss clears the flag.
 */
export function resolveHostPreferPublicSeed(
  preferPublic: boolean,
  visibility: string,
  catalog: HostCreateVisibilityCatalog | null | undefined,
): HostPreferPublicSeed {
  if (!preferPublic || !catalog) return { clearPrefer: false };
  const pub = (catalog.hosted_event_public_visibility || "").trim();
  const def = (catalog.default_visibility || "").trim();
  const priv = (catalog.hosted_event_private_visibility || "").trim();
  const publicOn = catalog.public_events_enabled === true;
  const current = (visibility || "").trim();

  if (publicOn && pub) {
    if (current !== pub) return { visibility: pub, clearPrefer: true };
    return { clearPrefer: true };
  }

  // Public gate off (or missing code): seed default once, keep prefer for a later enable.
  if (!current && (def || priv)) {
    return { visibility: def || priv, clearPrefer: false };
  }
  return { clearPrefer: false };
}
