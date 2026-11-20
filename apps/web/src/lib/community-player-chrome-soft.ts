/**
 * Soft-replace known Event-sport Community/player headings (mig 377/379/380/402/403).
 * Display-time fail-open - restores migration soft-fill strings only.
 */

const eventWord = /\bevents?\b/i;

export function softCommunityPageTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community tournaments";
  return t;
}

export function softCommunityPublicListTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community tournaments";
  return t;
}

export function softCommunityPublicListBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Open community tournaments anyone can join.";
  return t;
}

export function softCommunityEmpty(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "No community tournaments open right now.";
  return t;
}

export function softCommunityFeatureDisabled(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community tournaments are temporarily unavailable";
  return t;
}

export function softCommunityChromeUnavailable(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community tournaments unavailable";
  return t;
}

export function softCommunityPublicDisabled(raw?: string): string {
  return softCommunityFeatureDisabled(raw);
}

export function softCommunitySearchPlaceholder(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Search tournaments";
  return t;
}

export function softCommunitySearchLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Search";
  return t;
}

export function softCommunityReportAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Report tournament";
  return t;
}

export function softCommunityReportTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Report this tournament";
  return t;
}

export function softCommunityJoinTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (/^(Join event|Join Event|Events|Join)$/i.test(t)) return "Join with code";
  return t;
}

/** Mig 379 soft-fill - join panel blurb without Event sport. */
export function softCommunityJoinBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Enter a join code or open a shared link.";
  return t;
}

/** Join-by-code strip on Community/All embed (mig 297 soft-fill). */
export function softCommunityJoinCodeSectionTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Have a code?";
  return t;
}

export function softCommunityJoinCodeSectionBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Enter a private invite code to open a cup.";
  return t;
}

export function softCommunityLobbyTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Cup lobby";
  return t;
}

export function softCommunityLobbyUnavailable(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Cup lobby unavailable";
  return t;
}

export function softCommunityArenaLobbyTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Arena lobby";
  return t;
}

export function softCommunityLobbyBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) {
    return "Check in, watch the bracket, and open your next match here.";
  }
  return t;
}

export function softCommunityArenaLobbyBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) {
    return "Play as many games as you can before the arena clock ends. Points and win streaks decide the standings.";
  }
  return t;
}

/** Join seat-conflict / capacity chrome - Event-sport fail-open. */
export function softCommunityJoinStatusMessage(raw?: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  if (/already joined/i.test(t) && eventWord.test(t)) {
    return "You already joined";
  }
  if (/already enrolled/i.test(t) && eventWord.test(t)) {
    return "Already enrolled";
  }
  if (/full/i.test(t) && eventWord.test(t)) {
    return "This tournament is full";
  }
  if (/not (open for )?join/i.test(t) && eventWord.test(t)) {
    return "This tournament is not open for joining";
  }
  if (/insufficient/i.test(t) && eventWord.test(t)) {
    return "Insufficient wallet balance for entry fee";
  }
  if (eventWord.test(t)) {
    return t.replace(/\bevents?\b/gi, (m) => (m[0] === "E" ? "Tournament" : "tournament"));
  }
  return t;
}

/** Payment enroll modal title - Event-sport fail-open. */
export function softPaymentModalTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Confirm enrollment";
  return t;
}

export function softCommunityWinnersTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Winners board";
  return t;
}

export function softCommunityShareResultAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Share result card";
  return t;
}

export function softCommunityResultCardShareImageAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Share result card image";
  return t;
}

export function softCommunityResultCardDownloadAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Download result card";
  return t;
}

export function softCommunityShareAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Share";
  return t;
}

export function softCommunitySpectateAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Watch";
  return t;
}

/** Admin standings/arena points label in player toast - Event-sport fail-open. */
export function softCompetitionPointsLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Pts";
  return t;
}

export function softCompetitionArenaStandingsTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Arena standings";
  return t;
}

export function softCompetitionArenaStreakLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Streak";
  return t;
}

/** Est prize share blurb (mig 368/380) - Event-sport fail-open. */
export function softCommunityEstPrizeShareBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  if (/when the event ends/i.test(t)) {
    return t.replace(/when the event ends/gi, "when the tournament ends");
  }
  if (eventWord.test(t)) {
    return t.replace(/\bevents?\b/gi, (m) => (m[0] === "E" ? "Tournament" : "tournament"));
  }
  return t;
}

export function softTournamentsPageTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Tournaments";
  return t;
}

/** Mig 376 soft-fill - Host CTA on Tournaments hub. */
export function softTournamentsHostAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t) || /^(Host|Create)$/i.test(t)) return "Host a tournament";
  return t;
}

export function softTournamentsHostBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) {
    return "Create a community tournament for your club, stream, or school.";
  }
  return t;
}

/** Mig 376 soft-fill - Official | Community badges. */
export function softTournamentsBadgeOfficial(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Official";
  return t;
}

export function softTournamentsBadgeCommunity(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Community";
  return t;
}

/** Mig 376 soft-fill - Official | Community | All source filter chips. */
export function softTournamentsFilterSourceAll(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "All";
  return t;
}

export function softTournamentsFilterSourceOfficial(raw?: string): string {
  return softTournamentsBadgeOfficial(raw);
}

export function softTournamentsFilterSourceCommunity(raw?: string): string {
  return softTournamentsBadgeCommunity(raw);
}

/** Mig 376 soft-fill - "Source" heading above Official|Community|All. */
export function softTournamentsFilterSourceLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Source";
  return t;
}

/** Entry chips All/Free/Paid - Event-sport fail-open. */
export function softTournamentsFilterEntryAll(raw?: string): string {
  return softTournamentsFilterSourceAll(raw);
}

export function softTournamentsFilterEntryFree(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Free";
  return t;
}

export function softTournamentsFilterEntryPaid(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Paid";
  return t;
}

/** Card/detail Join CTA - not join-with-code (that is softCommunityJoinTitle). */
export function softTournamentsJoinAction(raw?: string): string {
  const t = (raw || "").trim();
  if (/^join event$/i.test(t) || (eventWord.test(t) && /^join\b/i.test(t))) {
    return "Join";
  }
  return t;
}

/** Entry section / fee labels - Event-sport fail-open. */
export function softTournamentsFilterEntryLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Entry";
  return t;
}

export function softTournamentsFreeLabel(raw?: string): string {
  return softTournamentsFilterEntryFree(raw);
}

export function softTournamentsEnrollAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t) || /^enroll event$/i.test(t)) return "Enroll";
  return t;
}

/** Filters toggle + card meta - Event-sport fail-open. */
export function softTournamentsFiltersToggleLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Filters";
  return t;
}

export function softTournamentsPlayersLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "players";
  return t;
}

export function softTournamentsHostedByLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Hosted by";
  return t;
}

/** Filters toggle aria - Event-sport fail-open. */
export function softTournamentsFiltersToggleShowAria(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Show filters";
  return t;
}

export function softTournamentsFiltersToggleHideAria(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Hide filters";
  return t;
}

/** Report dialog submit - Event-sport fail-open. */
export function softCommunityReportSubmitAction(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Submit report";
  return t;
}

export function softCommunityReportReasonLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Reason";
  return t;
}

export function softCommunityReportNoteLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Details";
  return t;
}

export function softTournamentsEmptyOfficial(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "No official tournaments open right now.";
  return t;
}

export function softTournamentsEmpty(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "No tournaments yet.";
  return t;
}

export function softCommunityVisibilityPublicBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) {
    return "Listed under Community tournaments when public cups are enabled.";
  }
  return t;
}

/** Private invite blurb - Event-sport fail-open (public soft parity). */
export function softCommunityVisibilityPrivateBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Private tournament. Use the join code.";
  return t;
}

/** Mig 380 soft-fills - join/lobby fail-open. */
export function softCommunityKickedBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "You were removed from this tournament";
  return t;
}

export function softCommunityLoadFailed(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Could not load tournament";
  return t;
}

/** Bracket heading (mig 183/350 soft-fill Bracket). */
export function softCommunityBracketTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Bracket";
  return t;
}

export function softCommunityPrizePendingBlurb(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Prize payout pending dispute window.";
  return t;
}

/** Card/detail gallery SR label - Event-sport fail-open. */
export function softCommunityCarouselAria(raw?: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  if (eventWord.test(t)) {
    return t.replace(/\bevents?\b/gi, (m) => (m[0] === "E" ? "Tournament" : "tournament"));
  }
  return t;
}

/** Join-code field chrome - Event-sport fail-open. */
export function softCommunityCodeLabel(raw?: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  if (eventWord.test(t)) {
    return t.replace(/\bevents?\b/gi, (m) => (m[0] === "E" ? "Tournament" : "tournament"));
  }
  return t;
}

export function softCommunityCodePlaceholder(raw?: string): string {
  return softCommunityCodeLabel(raw);
}

export function softCommunityErrCodeRequired(raw?: string): string {
  return softCommunityJoinStatusMessage(raw);
}

/** Detail roster heading - Event-sport fail-open. */
export function softCommunityRosterTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  if (eventWord.test(t)) {
    return t.replace(/\bevents?\b/gi, (m) => (m[0] === "E" ? "Tournament" : "tournament"));
  }
  return t;
}

/** Spectate activity panel (mig 394) - Event-sport fail-open. */
export function softSpectateEventLogTitle(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "Match log";
  return t;
}

export function softSpectateNoEvents(raw?: string): string {
  const t = (raw || "").trim();
  if (eventWord.test(t)) return "No activity yet";
  return t;
}
