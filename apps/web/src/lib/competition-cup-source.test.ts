import { describe, expect, it } from "vitest";
import {
  parseCompetitionCupSource,
  playerTournamentDiscoveryHref,
  tournamentsHrefFromEventsView,
  tournamentsHrefFromLegacyTournamentsPath,
} from "./competition-cup-source";

describe("parseCompetitionCupSource", () => {
  it("maps official aliases", () => {
    expect(parseCompetitionCupSource("official")).toBe("official");
    expect(parseCompetitionCupSource("platform")).toBe("official");
  });

  it("maps community aliases including legacy events", () => {
    expect(parseCompetitionCupSource("community")).toBe("community");
    expect(parseCompetitionCupSource("hosted")).toBe("community");
    expect(parseCompetitionCupSource("events")).toBe("community");
  });

  it("defaults unknown to all", () => {
    expect(parseCompetitionCupSource("")).toBe("all");
    expect(parseCompetitionCupSource("all")).toBe("all");
    expect(parseCompetitionCupSource("nope")).toBe("all");
  });
});

describe("tournamentsHrefFromEventsView", () => {
  it("rewrites view=events to tournaments Community and keeps id/code", () => {
    const href = tournamentsHrefFromEventsView("view=events&code=ABCD12&id=e1");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBe("community");
    expect(q.get("code")).toBe("ABCD12");
    expect(q.get("id")).toBe("e1");
  });

  it("handles empty search", () => {
    const href = tournamentsHrefFromEventsView("");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBe("community");
  });
});

describe("tournamentsHrefFromLegacyTournamentsPath", () => {
  it("maps bare path to unified hub", () => {
    const href = tournamentsHrefFromLegacyTournamentsPath("");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBeNull();
  });

  it("preserves id and source filters", () => {
    const href = tournamentsHrefFromLegacyTournamentsPath("id=t1&source=community&q=cup");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("id")).toBe("t1");
    expect(q.get("source")).toBe("community");
    expect(q.get("q")).toBe("cup");
  });
});

describe("playerTournamentDiscoveryHref", () => {
  it("remaps legacy view=events notif hrefs to Community", () => {
    const href = playerTournamentDiscoveryHref("/?view=events&id=e1&code=ABCD12");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBe("community");
    expect(q.get("id")).toBe("e1");
    expect(q.get("code")).toBe("ABCD12");
  });

  it("remaps /events/public to Community", () => {
    const href = playerTournamentDiscoveryHref("/events/public?code=ZZZZ99");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBe("community");
    expect(q.get("code")).toBe("ZZZZ99");
  });

  it("remaps invite /events/join to Community (preserve code/id)", () => {
    const href = playerTournamentDiscoveryHref("/events/join?code=ABCD12&id=e1");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBe("community");
    expect(q.get("code")).toBe("ABCD12");
    expect(q.get("id")).toBe("e1");
  });

  it("adds Community source when tournaments invite has code but no source", () => {
    const href = playerTournamentDiscoveryHref("/?view=tournaments&code=ABCD12");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("view")).toBe("tournaments");
    expect(q.get("source")).toBe("community");
    expect(q.get("code")).toBe("ABCD12");
  });

  it("leaves tournaments and play hrefs unchanged", () => {
    expect(playerTournamentDiscoveryHref("/?view=tournaments&id=t1")).toBe(
      "/?view=tournaments&id=t1",
    );
    expect(playerTournamentDiscoveryHref("/?gameId=g1")).toBe("/?gameId=g1");
  });
});
