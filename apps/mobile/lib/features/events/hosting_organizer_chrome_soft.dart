// Soft-replace known Event-sport Hosting page headings (mig 377/378/401/403/405/406/407).
// Display-time fail-open - restores migration soft-fill strings only.

final _eventWord = RegExp(r'\bevents?\b', caseSensitive: false);

String softHostingListTitle(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (lower == 'my events' || lower == 'events' || lower == 'event') {
    return 'My hosted tournaments';
  }
  return t;
}

/// Mig 380 soft-fill - create/manage name field without Event sport.
String softHostingTitleLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournament name';
  return t;
}

String softHostingDashboardTitle(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (lower == 'events dashboard' ||
      lower == 'events' ||
      lower == 'event dashboard') {
    return 'Hosting dashboard';
  }
  return t;
}

String softHostingCreateAction(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (lower == 'create event' || lower == 'create') {
    return 'Host a tournament';
  }
  return t;
}

String softHostingCreateTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Host a community tournament';
  return t;
}

String softHostingAnalyticsTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Hosting analytics';
  return t;
}

String softHostingPortalCreateLabel(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (lower == 'create event' || lower == 'create') {
    return 'Host a tournament';
  }
  return t;
}

String softHostingFeatureDisabled(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Community tournaments are temporarily unavailable';
  }
  return t;
}

String softHostingPublicDisabled(String raw) {
  return softHostingFeatureDisabled(raw);
}

String softHostingPublicListEmpty(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'No community tournaments open right now.';
  }
  return t;
}

String softHostingStartAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Start tournament';
  return t;
}

String softHostingCloseAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Close tournament';
  return t;
}

String softHostingReopenAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Reopen tournament';
  return t;
}

String softHostingChromeUnavailable(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Hosting chrome unavailable';
  return t;
}

String softHostingSearchPlaceholder(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Search by name or code';
  return t;
}

String softHostingSearchLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Search tournaments';
  return t;
}

String softHostingCreateBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Pay the host fee to publish. Join code, link, and QR unlock after payment.';
  }
  return t;
}

/// Same soft-fill target as empty_list when Event-sport regresses.
String softHostingAnalyticsEmpty(String raw) {
  return softHostingEmptyList(raw);
}

String softHostingReportAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Report tournament';
  return t;
}

String softHostingReportTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Report this tournament';
  return t;
}

String softHostingDashboardBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Create and run branded checkers cups.';
  }
  return t;
}

String softHostingListBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Hosted cups you created and paid for.';
  }
  return t;
}

String softHostingEmptyList(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'No hosted tournaments yet.';
  return t;
}

String softHostingToastCreated(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournament created';
  return t;
}

/// Mig 380 soft-fill - create failure without Event sport.
String softHostingToastCreateFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not create tournament';
  return t;
}

/// Mig 380 soft-fills - lifecycle toasts (create already soft).
String softHostingToastStarted(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournament started';
  return t;
}

String softHostingToastClosed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournament closed';
  return t;
}

String softHostingToastCancelled(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournament cancelled';
  return t;
}

String softHostingToastReopened(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournament reopened';
  return t;
}

String softHostingPatchTitleLocked(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Title can only change while the tournament is open';
  }
  return t;
}

String softHostingUploadLogoFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not upload tournament logo';
  return t;
}

/// Sponsor logo upload fail - Event-sport fail-open (logo soft parity).
String softHostingUploadSponsorFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not upload sponsor logo';
  return t;
}

String softHostingToastSaved(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Saved';
  return t;
}

String softHostingToastSaveFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Save failed';
  return t;
}

/// Mig 380 soft-fill - dismiss / cancel without Event sport.
String softHostingCancelAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Cancel';
  return t;
}

/// Hosting shell brand (mig 381 soft-fill Hosting).
String softHostingBrandName(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Hosting';
  return t;
}

/// Mig 380 soft-fills - lifecycle failure toasts.
String softHostingToastStartFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not start tournament';
  return t;
}

String softHostingToastCloseFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not close tournament';
  return t;
}

String softHostingToastReopenFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not reopen tournament';
  return t;
}

String softHostingPortalPublicListLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Community tournaments';
  return t;
}

String softHostingAnalyticsBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Joins, completions, and fees for cups you host.';
  }
  return t;
}

String softHostingVisibilityPublicBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Listed under Community tournaments when public cups are enabled.';
  }
  return t;
}

/// Private invite blurb - Event-sport fail-open (public soft parity).
String softHostingVisibilityPrivateBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Private tournament. Use the join code.';
  return t;
}
