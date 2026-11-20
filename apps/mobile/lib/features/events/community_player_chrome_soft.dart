// Soft-replace known Event-sport Community/player headings (mig 377/379/380/402/403).
// Display-time fail-open - restores migration soft-fill strings only.

final _eventWord = RegExp(r'\bevents?\b', caseSensitive: false);

String softCommunityPageTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Community tournaments';
  return t;
}

String softCommunityPublicListTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Community tournaments';
  return t;
}

String softCommunityPublicListBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Open community tournaments anyone can join.';
  }
  return t;
}

String softCommunityEmpty(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'No community tournaments open right now.';
  }
  return t;
}

String softCommunityFeatureDisabled(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Community tournaments are temporarily unavailable';
  }
  return t;
}

String softCommunityChromeUnavailable(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Community tournaments unavailable';
  return t;
}

String softCommunityPublicDisabled(String raw) {
  return softCommunityFeatureDisabled(raw);
}

String softCommunitySearchPlaceholder(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Search tournaments';
  return t;
}

String softCommunitySearchLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Search';
  return t;
}

String softCommunityReportAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Report tournament';
  return t;
}

String softCommunityReportTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Report this tournament';
  return t;
}

String softCommunityJoinTitle(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (lower == 'join event' || lower == 'events' || lower == 'join') {
    return 'Join with code';
  }
  return t;
}

/// Mig 379 soft-fill - join panel blurb without Event sport.
String softCommunityJoinBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Enter a join code or open a shared link.';
  }
  return t;
}

/// Join-by-code strip on Community/All embed (mig 297 soft-fill).
String softCommunityJoinCodeSectionTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Have a code?';
  return t;
}

String softCommunityJoinCodeSectionBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Enter a private invite code to open a cup.';
  }
  return t;
}

String softCommunityLobbyTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Cup lobby';
  return t;
}

String softCommunityLobbyUnavailable(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Cup lobby unavailable';
  return t;
}

String softCommunityArenaLobbyTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Arena lobby';
  return t;
}

String softCommunityLobbyBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Check in, watch the bracket, and open your next match here.';
  }
  return t;
}

String softCommunityArenaLobbyBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Play as many games as you can before the arena clock ends. Points and win streaks decide the standings.';
  }
  return t;
}

/// Join seat-conflict / capacity chrome - Event-sport fail-open.
String softCommunityJoinStatusMessage(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return t;
  final lower = t.toLowerCase();
  if (lower.contains('already joined') && _eventWord.hasMatch(t)) {
    return 'You already joined';
  }
  if (lower.contains('already enrolled') && _eventWord.hasMatch(t)) {
    return 'Already enrolled';
  }
  if (lower.contains('full') && _eventWord.hasMatch(t)) {
    return 'This tournament is full';
  }
  if ((lower.contains('not open for join') || lower.contains('not joinable')) &&
      _eventWord.hasMatch(t)) {
    return 'This tournament is not open for joining';
  }
  if (lower.contains('insufficient') && _eventWord.hasMatch(t)) {
    return 'Insufficient wallet balance for entry fee';
  }
  if (_eventWord.hasMatch(t)) {
    return t.replaceAllMapped(_eventWord, (m) {
      final w = m.group(0)!;
      return w[0].toUpperCase() == w[0] ? 'Tournament' : 'tournament';
    });
  }
  return t;
}

/// Payment enroll modal title - Event-sport fail-open.
String softPaymentModalTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Confirm enrollment';
  return t;
}

String softCommunityWinnersTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Winners board';
  return t;
}

String softCommunityShareResultAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Share result card';
  return t;
}

String softCommunityResultCardShareImageAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Share result card image';
  return t;
}

String softCommunityResultCardDownloadAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Download result card';
  return t;
}

String softCommunityShareAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Share';
  return t;
}

String softCommunitySpectateAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Watch';
  return t;
}

/// Admin standings/arena points label in player toast - Event-sport fail-open.
String softCompetitionPointsLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Pts';
  return t;
}

String softCompetitionArenaStandingsTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Arena standings';
  return t;
}

String softCompetitionArenaStreakLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Streak';
  return t;
}

/// Est prize share blurb (mig 368/380) - Event-sport fail-open.
String softCommunityEstPrizeShareBlurb(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return t;
  if (RegExp(r'when the event ends', caseSensitive: false).hasMatch(t)) {
    return t.replaceAll(
      RegExp(r'when the event ends', caseSensitive: false),
      'when the tournament ends',
    );
  }
  if (_eventWord.hasMatch(t)) {
    return t.replaceAllMapped(_eventWord, (m) {
      final w = m.group(0)!;
      return w[0].toUpperCase() == w[0] ? 'Tournament' : 'tournament';
    });
  }
  return t;
}

String softTournamentsPageTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Tournaments';
  return t;
}

/// Mig 376 soft-fill - Host CTA on Tournaments hub.
String softTournamentsHostAction(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (_eventWord.hasMatch(t) || lower == 'host' || lower == 'create') {
    return 'Host a tournament';
  }
  return t;
}

String softTournamentsHostBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Create a community tournament for your club, stream, or school.';
  }
  return t;
}

/// Mig 376 soft-fill - Official | Community badges.
String softTournamentsBadgeOfficial(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Official';
  return t;
}

String softTournamentsBadgeCommunity(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Community';
  return t;
}

/// Mig 376 soft-fill - Official | Community | All source filter chips.
String softTournamentsFilterSourceAll(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'All';
  return t;
}

String softTournamentsFilterSourceOfficial(String raw) {
  return softTournamentsBadgeOfficial(raw);
}

String softTournamentsFilterSourceCommunity(String raw) {
  return softTournamentsBadgeCommunity(raw);
}

/// Mig 376 soft-fill - "Source" heading above Official|Community|All.
String softTournamentsFilterSourceLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Source';
  return t;
}

/// Entry chips All/Free/Paid - Event-sport fail-open.
String softTournamentsFilterEntryAll(String raw) {
  return softTournamentsFilterSourceAll(raw);
}

String softTournamentsFilterEntryFree(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Free';
  return t;
}

String softTournamentsFilterEntryPaid(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Paid';
  return t;
}

/// Card/detail Join CTA - not join-with-code (that is softCommunityJoinTitle).
String softTournamentsJoinAction(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (lower == 'join event' ||
      (_eventWord.hasMatch(t) && lower.startsWith('join'))) {
    return 'Join';
  }
  return t;
}

/// Entry section / fee labels - Event-sport fail-open.
String softTournamentsFilterEntryLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Entry';
  return t;
}

String softTournamentsFreeLabel(String raw) {
  return softTournamentsFilterEntryFree(raw);
}

String softTournamentsEnrollAction(String raw) {
  final t = raw.trim();
  final lower = t.toLowerCase();
  if (_eventWord.hasMatch(t) || lower == 'enroll event') return 'Enroll';
  return t;
}

/// Filters toggle + card meta - Event-sport fail-open.
String softTournamentsFiltersToggleLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Filters';
  return t;
}

String softTournamentsPlayersLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'players';
  return t;
}

String softTournamentsHostedByLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Hosted by';
  return t;
}

/// Filters toggle aria - Event-sport fail-open.
String softTournamentsFiltersToggleShowAria(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Show filters';
  return t;
}

String softTournamentsFiltersToggleHideAria(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Hide filters';
  return t;
}

/// Report dialog submit - Event-sport fail-open.
String softCommunityReportSubmitAction(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Submit report';
  return t;
}

String softCommunityReportReasonLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Reason';
  return t;
}

String softCommunityReportNoteLabel(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Details';
  return t;
}

String softTournamentsEmptyOfficial(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'No official tournaments open right now.';
  }
  return t;
}

String softTournamentsEmpty(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'No tournaments yet.';
  return t;
}

String softCommunityVisibilityPublicBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) {
    return 'Listed under Community tournaments when public cups are enabled.';
  }
  return t;
}

/// Private invite blurb - Event-sport fail-open (public soft parity).
String softCommunityVisibilityPrivateBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Private tournament. Use the join code.';
  return t;
}

/// Mig 380 soft-fills - join/lobby fail-open.
String softCommunityKickedBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'You were removed from this tournament';
  return t;
}

String softCommunityLoadFailed(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Could not load tournament';
  return t;
}

/// Bracket heading (mig 183/350 soft-fill Bracket).
String softCommunityBracketTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Bracket';
  return t;
}

String softCommunityPrizePendingBlurb(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Prize payout pending dispute window.';
  return t;
}

/// Card/detail gallery SR label - Event-sport fail-open.
String softCommunityCarouselAria(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return t;
  if (_eventWord.hasMatch(t)) {
    return t.replaceAllMapped(_eventWord, (m) {
      final w = m.group(0)!;
      return w[0].toUpperCase() == w[0] ? 'Tournament' : 'tournament';
    });
  }
  return t;
}

/// Join-code field chrome - Event-sport fail-open.
String softCommunityCodeLabel(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return t;
  if (_eventWord.hasMatch(t)) {
    return t.replaceAllMapped(_eventWord, (m) {
      final w = m.group(0)!;
      return w[0].toUpperCase() == w[0] ? 'Tournament' : 'tournament';
    });
  }
  return t;
}

String softCommunityCodePlaceholder(String raw) {
  return softCommunityCodeLabel(raw);
}

String softCommunityErrCodeRequired(String raw) {
  return softCommunityJoinStatusMessage(raw);
}

/// Detail roster heading - Event-sport fail-open.
String softCommunityRosterTitle(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return t;
  if (_eventWord.hasMatch(t)) {
    return t.replaceAllMapped(_eventWord, (m) {
      final w = m.group(0)!;
      return w[0].toUpperCase() == w[0] ? 'Tournament' : 'tournament';
    });
  }
  return t;
}

/// Spectate activity panel (mig 394) - Event-sport fail-open (web parity).
String softSpectateEventLogTitle(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'Match log';
  return t;
}

String softSpectateNoEvents(String raw) {
  final t = raw.trim();
  if (_eventWord.hasMatch(t)) return 'No activity yet';
  return t;
}
