import { describe, expect, it } from "vitest";
import {
  softCommunityCarouselAria,
  softCommunityChromeUnavailable,
  softCommunityCodeLabel,
  softCommunityCodePlaceholder,
  softCommunityEstPrizeShareBlurb,
  softCommunityEmpty,
  softCommunityErrCodeRequired,
  softCommunityFeatureDisabled,
  softCommunityJoinBlurb,
  softCommunityJoinTitle,
  softCommunityArenaLobbyBlurb,
  softCommunityArenaLobbyTitle,
  softCommunityJoinStatusMessage,
  softCommunityRosterTitle,
  softSpectateEventLogTitle,
  softSpectateNoEvents,
  softCommunityLobbyBlurb,
  softCommunityLobbyTitle,
  softCommunityLobbyUnavailable,
  softCommunityResultCardDownloadAction,
  softCommunityResultCardShareImageAction,
  softCommunityShareAction,
  softCommunityShareResultAction,
  softCommunitySpectateAction,
  softCommunityWinnersTitle,
  softCompetitionArenaStandingsTitle,
  softCompetitionArenaStreakLabel,
  softCompetitionPointsLabel,
  softPaymentModalTitle,
  softCommunityPageTitle,
  softCommunityPublicListBlurb,
  softCommunityPublicListTitle,
  softCommunityReportAction,
  softCommunityReportTitle,
  softCommunitySearchLabel,
  softCommunitySearchPlaceholder,
  softTournamentsEmpty,
  softTournamentsEmptyOfficial,
  softTournamentsBadgeCommunity,
  softTournamentsBadgeOfficial,
  softTournamentsEnrollAction,
  softTournamentsFilterEntryFree,
  softTournamentsFilterEntryLabel,
  softTournamentsFilterEntryPaid,
  softTournamentsFilterSourceAll,
  softTournamentsFilterSourceCommunity,
  softTournamentsFilterSourceLabel,
  softTournamentsFilterSourceOfficial,
  softCommunityReportNoteLabel,
  softCommunityReportReasonLabel,
  softCommunityReportSubmitAction,
  softTournamentsFiltersToggleHideAria,
  softTournamentsFiltersToggleLabel,
  softTournamentsFiltersToggleShowAria,
  softTournamentsFreeLabel,
  softTournamentsHostAction,
  softTournamentsHostBlurb,
  softTournamentsHostedByLabel,
  softTournamentsJoinAction,
  softTournamentsPageTitle,
  softTournamentsPlayersLabel,
  softCommunityVisibilityPrivateBlurb,
  softCommunityVisibilityPublicBlurb,
} from "./community-player-chrome-soft";

describe("softCommunity player chrome headings", () => {
  it("soft-replaces known Event-sport Community headings", () => {
    expect(softCommunityPageTitle("Events")).toBe("Community tournaments");
    expect(softCommunityPageTitle("Public events")).toBe("Community tournaments");
    expect(softCommunityPublicListTitle("Public events")).toBe("Community tournaments");
    expect(softCommunityPublicListBlurb("Browse public events.")).toBe(
      "Open community tournaments anyone can join.",
    );
    expect(softCommunityEmpty("No events yet.")).toBe("No community tournaments open right now.");
    expect(softCommunityFeatureDisabled("Events unavailable")).toBe(
      "Community tournaments are temporarily unavailable",
    );
    expect(softCommunityChromeUnavailable("Events unavailable")).toBe(
      "Community tournaments unavailable",
    );
    expect(softCommunitySearchPlaceholder("Search events")).toBe("Search tournaments");
    expect(softCommunitySearchLabel("Search events")).toBe("Search");
    expect(softCommunityReportAction("Report event")).toBe("Report tournament");
    expect(softCommunityReportTitle("Report this event")).toBe("Report this tournament");
    expect(softCommunityJoinTitle("Join event")).toBe("Join with code");
    expect(softCommunityJoinBlurb("Join this event with a code.")).toBe(
      "Enter a join code or open a shared link.",
    );
    expect(softCommunityLobbyTitle("Event lobby")).toBe("Cup lobby");
    expect(softCommunityLobbyUnavailable("Event lobby unavailable")).toBe("Cup lobby unavailable");
    expect(softCommunityArenaLobbyTitle("Event arena")).toBe("Arena lobby");
    expect(softCommunityLobbyBlurb("Watch this event bracket.")).toBe(
      "Check in, watch the bracket, and open your next match here.",
    );
    expect(softCommunityArenaLobbyBlurb("Play event arena games.")).toBe(
      "Play as many games as you can before the arena clock ends. Points and win streaks decide the standings.",
    );
    expect(softCommunityJoinStatusMessage("This event is full")).toBe("This tournament is full");
    expect(softCommunityJoinStatusMessage("Unable to enroll in this event")).toBe(
      "Unable to enroll in this tournament",
    );
    expect(softCommunityCarouselAria("Event media")).toBe("Tournament media");
    expect(softCommunityCodeLabel("Event code")).toBe("Tournament code");
    expect(softCommunityCodePlaceholder("Enter event code")).toBe("Enter tournament code");
    expect(softCommunityErrCodeRequired("Event code is required")).toBe(
      "Tournament code is required",
    );
    expect(softCommunityRosterTitle("Event players")).toBe("Tournament players");
    expect(softSpectateEventLogTitle("Event log")).toBe("Match log");
    expect(softSpectateNoEvents("No events yet")).toBe("No activity yet");
    expect(softPaymentModalTitle("Confirm event enrollment")).toBe("Confirm enrollment");
    expect(softCommunityWinnersTitle("Event winners")).toBe("Winners board");
    expect(softCommunityShareResultAction("Share event result")).toBe("Share result card");
    expect(softCommunityResultCardShareImageAction("Share event card image")).toBe(
      "Share result card image",
    );
    expect(softCommunityResultCardDownloadAction("Download event result")).toBe(
      "Download result card",
    );
    expect(softCommunityShareAction("Share event")).toBe("Share");
    expect(softCommunitySpectateAction("Watch event")).toBe("Watch");
    expect(softCompetitionPointsLabel("Event pts")).toBe("Pts");
    expect(softCompetitionArenaStandingsTitle("Event arena standings")).toBe("Arena standings");
    expect(softCompetitionArenaStreakLabel("Event streak")).toBe("Streak");
    expect(
      softCommunityEstPrizeShareBlurb(
        "Estimated from current pot and points. Final amount locks when the event ends.",
      ),
    ).toBe("Estimated from current pot and points. Final amount locks when the tournament ends.");
    expect(softTournamentsPageTitle("Events")).toBe("Tournaments");
    expect(softTournamentsHostAction("Host an event")).toBe("Host a tournament");
    expect(softTournamentsHostAction("Create event")).toBe("Host a tournament");
    expect(softTournamentsHostBlurb("Host a public event for your club.")).toBe(
      "Create a community tournament for your club, stream, or school.",
    );
    expect(softTournamentsBadgeOfficial("Event")).toBe("Official");
    expect(softTournamentsBadgeCommunity("Events")).toBe("Community");
    expect(softTournamentsFilterSourceAll("All events")).toBe("All");
    expect(softTournamentsFilterSourceOfficial("Events")).toBe("Official");
    expect(softTournamentsFilterSourceCommunity("Event")).toBe("Community");
    expect(softTournamentsFilterSourceLabel("Event source")).toBe("Source");
    expect(softTournamentsFilterEntryFree("Free events")).toBe("Free");
    expect(softTournamentsFilterEntryPaid("Paid events")).toBe("Paid");
    expect(softTournamentsJoinAction("Join event")).toBe("Join");
    expect(softTournamentsFilterEntryLabel("Event entry")).toBe("Entry");
    expect(softTournamentsFreeLabel("Free event")).toBe("Free");
    expect(softTournamentsEnrollAction("Enroll event")).toBe("Enroll");
    expect(softTournamentsFiltersToggleLabel("Event filters")).toBe("Filters");
    expect(softTournamentsPlayersLabel("event players")).toBe("players");
    expect(softTournamentsHostedByLabel("Event hosted by")).toBe("Hosted by");
    expect(softTournamentsFiltersToggleShowAria("Show event filters")).toBe("Show filters");
    expect(softTournamentsFiltersToggleHideAria("Hide event filters")).toBe("Hide filters");
    expect(softCommunityReportSubmitAction("Submit event report")).toBe("Submit report");
    expect(softCommunityReportReasonLabel("Event reason")).toBe("Reason");
    expect(softCommunityReportNoteLabel("Event details")).toBe("Details");
    expect(softTournamentsEmptyOfficial("No official events open.")).toBe(
      "No official tournaments open right now.",
    );
    expect(softTournamentsEmpty("No events yet.")).toBe("No tournaments yet.");
    expect(softCommunityVisibilityPublicBlurb("Listed under public events.")).toBe(
      "Listed under Community tournaments when public cups are enabled.",
    );
    expect(softCommunityVisibilityPrivateBlurb("Private event. Use the join code.")).toBe(
      "Private tournament. Use the join code.",
    );
  });

  it("leaves healthy Tournament headings unchanged", () => {
    expect(softCommunityPageTitle("Community tournaments")).toBe("Community tournaments");
    expect(softCommunityJoinTitle("Join with code")).toBe("Join with code");
    expect(softCommunityLobbyTitle("Cup lobby")).toBe("Cup lobby");
    expect(softTournamentsPageTitle("Tournaments")).toBe("Tournaments");
    expect(softTournamentsHostAction("Host a tournament")).toBe("Host a tournament");
    expect(
      softTournamentsHostBlurb("Create a community tournament for your club, stream, or school."),
    ).toBe("Create a community tournament for your club, stream, or school.");
    expect(softTournamentsBadgeOfficial("Official")).toBe("Official");
    expect(softTournamentsBadgeCommunity("Community")).toBe("Community");
    expect(softTournamentsFilterSourceLabel("Source")).toBe("Source");
    expect(softTournamentsJoinAction("Join")).toBe("Join");
    expect(softCommunityFeatureDisabled("Community tournaments are temporarily unavailable")).toBe(
      "Community tournaments are temporarily unavailable",
    );
    expect(softCommunityChromeUnavailable("Community tournaments unavailable")).toBe(
      "Community tournaments unavailable",
    );
    expect(softCommunityReportAction("Report tournament")).toBe("Report tournament");
    expect(softTournamentsEmptyOfficial("No official tournaments open right now.")).toBe(
      "No official tournaments open right now.",
    );
    expect(softCommunityVisibilityPrivateBlurb("Private tournament. Use the join code.")).toBe(
      "Private tournament. Use the join code.",
    );
  });
});
