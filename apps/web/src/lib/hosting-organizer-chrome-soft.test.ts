import { describe, expect, it } from "vitest";
import {
  softHostingAnalyticsTitle,
  softHostingCloseAction,
  softHostingCreateAction,
  softHostingCreateTitle,
  softHostingDashboardBlurb,
  softHostingDashboardTitle,
  softHostingEmptyList,
  softHostingFeatureDisabled,
  softHostingListBlurb,
  softHostingListTitle,
  softHostingTitleLabel,
  softHostingChromeUnavailable,
  softHostingPortalCreateLabel,
  softHostingPublicDisabled,
  softHostingPublicListEmpty,
  softHostingReopenAction,
  softHostingReportAction,
  softHostingReportTitle,
  softHostingSearchPlaceholder,
  softHostingSearchLabel,
  softHostingCreateBlurb,
  softHostingAnalyticsEmpty,
  softHostingStartAction,
  softHostingToastCreated,
  softHostingToastCreateFailed,
  softHostingToastStarted,
  softHostingToastClosed,
  softHostingToastCancelled,
  softHostingToastReopened,
  softHostingPatchTitleLocked,
  softHostingUploadLogoFailed,
  softHostingUploadSponsorFailed,
  softHostingToastSaved,
  softHostingToastSaveFailed,
  softHostingCancelAction,
  softHostingBrandName,
  softHostingToastStartFailed,
  softHostingToastCloseFailed,
  softHostingToastReopenFailed,
  softHostingPortalPublicListLabel,
  softHostingAnalyticsBlurb,
  softHostingVisibilityPrivateBlurb,
  softHostingVisibilityPublicBlurb,
} from "./hosting-organizer-chrome-soft";

describe("softHosting organizer chrome headings", () => {
  it("soft-replaces known Event-sport list/dashboard/create/analytics titles", () => {
    expect(softHostingListTitle("My events")).toBe("My hosted tournaments");
    expect(softHostingListTitle("Events")).toBe("My hosted tournaments");
    expect(softHostingTitleLabel("Event name")).toBe("Tournament name");
    expect(softHostingDashboardTitle("Events dashboard")).toBe("Hosting dashboard");
    expect(softHostingCreateAction("Create event")).toBe("Host a tournament");
    expect(softHostingCreateTitle("Create event")).toBe("Host a community tournament");
    expect(softHostingAnalyticsTitle("Events analytics")).toBe("Hosting analytics");
    expect(softHostingPortalCreateLabel("Create event")).toBe("Host a tournament");
    expect(softHostingFeatureDisabled("Events unavailable")).toBe(
      "Community tournaments are temporarily unavailable",
    );
    expect(softHostingPublicDisabled("Public events disabled")).toBe(
      "Community tournaments are temporarily unavailable",
    );
    expect(softHostingPublicListEmpty("No events open")).toBe(
      "No community tournaments open right now.",
    );
    expect(softHostingStartAction("Start event")).toBe("Start tournament");
    expect(softHostingCloseAction("Close event")).toBe("Close tournament");
    expect(softHostingReopenAction("Reopen event")).toBe("Reopen tournament");
    expect(softHostingChromeUnavailable("Events chrome unavailable")).toBe(
      "Hosting chrome unavailable",
    );
    expect(softHostingSearchPlaceholder("Search events")).toBe("Search by name or code");
    expect(softHostingReportAction("Report event")).toBe("Report tournament");
    expect(softHostingReportTitle("Report this event")).toBe("Report this tournament");
    expect(softHostingDashboardBlurb("Host events for clubs.")).toBe(
      "Create and run branded checkers cups.",
    );
    expect(softHostingListBlurb("Your events.")).toBe("Hosted cups you created and paid for.");
    expect(softHostingEmptyList("No events yet.")).toBe("No hosted tournaments yet.");
    expect(softHostingToastCreated("Event created")).toBe("Tournament created");
    expect(softHostingToastCreateFailed("Could not create event")).toBe(
      "Could not create tournament",
    );
    expect(softHostingToastStarted("Event started")).toBe("Tournament started");
    expect(softHostingToastClosed("Event closed")).toBe("Tournament closed");
    expect(softHostingToastCancelled("Event cancelled")).toBe("Tournament cancelled");
    expect(softHostingToastReopened("Event reopened")).toBe("Tournament reopened");
    expect(softHostingPatchTitleLocked("Title locked while event is open")).toBe(
      "Title can only change while the tournament is open",
    );
    expect(softHostingUploadLogoFailed("Could not upload event logo")).toBe(
      "Could not upload tournament logo",
    );
    expect(softHostingUploadSponsorFailed("Could not upload event sponsor logo")).toBe(
      "Could not upload sponsor logo",
    );
    expect(softHostingToastSaved("Event saved")).toBe("Saved");
    expect(softHostingToastSaveFailed("Could not save event")).toBe("Save failed");
    expect(softHostingCancelAction("Cancel event")).toBe("Cancel");
    expect(softHostingBrandName("Event")).toBe("Hosting");
    expect(softHostingBrandName("Events")).toBe("Hosting");
    expect(softHostingToastStartFailed("Could not start event")).toBe("Could not start tournament");
    expect(softHostingToastCloseFailed("Could not close event")).toBe("Could not close tournament");
    expect(softHostingToastReopenFailed("Could not reopen event")).toBe(
      "Could not reopen tournament",
    );
    expect(softHostingPortalPublicListLabel("Public events")).toBe("Community tournaments");
    expect(softHostingAnalyticsBlurb("Fees for your events.")).toBe(
      "Joins, completions, and fees for cups you host.",
    );
    expect(softHostingVisibilityPublicBlurb("Listed under public events.")).toBe(
      "Listed under Community tournaments when public cups are enabled.",
    );
    expect(softHostingVisibilityPrivateBlurb("Private event. Use the join code.")).toBe(
      "Private tournament. Use the join code.",
    );
    expect(softHostingSearchLabel("Search events")).toBe("Search tournaments");
    expect(softHostingCreateBlurb("Pay to publish your event.")).toBe(
      "Pay the host fee to publish. Join code, link, and QR unlock after payment.",
    );
    expect(softHostingAnalyticsEmpty("No events yet.")).toBe("No hosted tournaments yet.");
  });

  it("leaves healthy Tournament headings unchanged", () => {
    expect(softHostingListTitle("My hosted tournaments")).toBe("My hosted tournaments");
    expect(softHostingDashboardTitle("Hosting dashboard")).toBe("Hosting dashboard");
    expect(softHostingCreateAction("Host a tournament")).toBe("Host a tournament");
    expect(softHostingCreateTitle("Host a community tournament")).toBe(
      "Host a community tournament",
    );
    expect(softHostingAnalyticsTitle("Hosting analytics")).toBe("Hosting analytics");
    expect(softHostingStartAction("Start tournament")).toBe("Start tournament");
    expect(softHostingCloseAction("Close tournament")).toBe("Close tournament");
    expect(softHostingReopenAction("Reopen tournament")).toBe("Reopen tournament");
    expect(softHostingChromeUnavailable("Hosting chrome unavailable")).toBe(
      "Hosting chrome unavailable",
    );
    expect(softHostingFeatureDisabled("Community tournaments are temporarily unavailable")).toBe(
      "Community tournaments are temporarily unavailable",
    );
    expect(softHostingEmptyList("No hosted tournaments yet.")).toBe("No hosted tournaments yet.");
    expect(softHostingToastCreated("Tournament created")).toBe("Tournament created");
    expect(softHostingVisibilityPrivateBlurb("Private tournament. Use the join code.")).toBe(
      "Private tournament. Use the join code.",
    );
  });
});
