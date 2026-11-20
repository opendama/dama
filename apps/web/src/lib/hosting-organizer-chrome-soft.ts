/**
 * Soft-replace known Event-sport Hosting page headings (mig 377/378/401/403/405/406/407).
 * Display-time fail-open - never invents beyond migration soft-fill strings.
 */

const eventWord = /\bevents?\b/i;

export function softHostingListTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (/^(My events|Events|Event)$/i.test(t)) return "My hosted tournaments";
  return t;
}

/** Mig 380 soft-fill - create/manage name field without Event sport. */
export function softHostingTitleLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournament name";
  return t;
}

export function softHostingDashboardTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (/^(Events dashboard|Events|Event dashboard)$/i.test(t)) return "Hosting dashboard";
  return t;
}

export function softHostingCreateAction(raw?: string): string {
  const t = (raw || "").trim();
  if (/^(Create event|Create)$/i.test(t)) return "Host a tournament";
  return t;
}

export function softHostingCreateTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Host a community tournament";
  return t;
}

export function softHostingAnalyticsTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Hosting analytics";
  return t;
}

export function softHostingPortalCreateLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (/^(Create event|Create)$/i.test(t)) return "Host a tournament";
  return t;
}

export function softHostingFeatureDisabled(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community tournaments are temporarily unavailable";
  return t;
}

export function softHostingPublicDisabled(raw?: string): string {
  return softHostingFeatureDisabled(raw);
}

export function softHostingPublicListEmpty(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "No community tournaments open right now.";
  return t;
}

export function softHostingStartAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Start tournament";
  return t;
}

export function softHostingCloseAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Close tournament";
  return t;
}

export function softHostingReopenAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Reopen tournament";
  return t;
}

export function softHostingChromeUnavailable(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Hosting chrome unavailable";
  return t;
}

export function softHostingSearchPlaceholder(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Search by name or code";
  return t;
}

export function softHostingSearchLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Search tournaments";
  return t;
}

export function softHostingCreateBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) {
    return "Pay the host fee to publish. Join code, link, and QR unlock after payment.";
  }
  return t;
}

/** Same soft-fill target as empty_list when Event-sport regresses. */
export function softHostingAnalyticsEmpty(raw?: string): string {
  return softHostingEmptyList(raw);
}

export function softHostingReportAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Report tournament";
  return t;
}

export function softHostingReportTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Report this tournament";
  return t;
}

export function softHostingDashboardBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Create and run branded checkers cups.";
  return t;
}

export function softHostingListBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Hosted cups you created and paid for.";
  return t;
}

export function softHostingEmptyList(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "No hosted tournaments yet.";
  return t;
}

export function softHostingToastCreated(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournament created";
  return t;
}

/** Mig 380 soft-fill - create failure without Event sport. */
export function softHostingToastCreateFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not create tournament";
  return t;
}

/** Mig 380 soft-fills - lifecycle toasts (create already soft). */
export function softHostingToastStarted(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournament started";
  return t;
}

export function softHostingToastClosed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournament closed";
  return t;
}

export function softHostingToastCancelled(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournament cancelled";
  return t;
}

export function softHostingToastReopened(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournament reopened";
  return t;
}

export function softHostingPatchTitleLocked(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Title can only change while the tournament is open";
  return t;
}

export function softHostingUploadLogoFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not upload tournament logo";
  return t;
}

/** Sponsor logo upload fail - Event-sport fail-open (logo soft parity). */
export function softHostingUploadSponsorFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not upload sponsor logo";
  return t;
}

export function softHostingToastSaved(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Saved";
  return t;
}

export function softHostingToastSaveFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Save failed";
  return t;
}

/** Mig 380 soft-fill - dismiss / cancel without Event sport. */
export function softHostingCancelAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Cancel";
  return t;
}

/** Hosting shell brand (mig 381 soft-fill Hosting). */
export function softHostingBrandName(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Hosting";
  return t;
}

/** Mig 380 soft-fills - lifecycle failure toasts. */
export function softHostingToastStartFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not start tournament";
  return t;
}

export function softHostingToastCloseFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not close tournament";
  return t;
}

export function softHostingToastReopenFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not reopen tournament";
  return t;
}

export function softHostingPortalPublicListLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community tournaments";
  return t;
}

export function softHostingAnalyticsBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Joins, completions, and fees for cups you host.";
  return t;
}

export function softHostingVisibilityPublicBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) {
    return "Listed under Community tournaments when public cups are enabled.";
  }
  return t;
}

/** Private invite blurb - Event-sport fail-open (public soft parity). */
export function softHostingVisibilityPrivateBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Private tournament. Use the join code.";
  return t;
}
