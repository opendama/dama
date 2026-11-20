import { describe, expect, it } from "vitest";
import {
  filterHostingNavLinks,
  filterPlayerNavLinks,
  isHostingPublicBrowseNavLink,
  isPlayerEventsBrowseNavLink,
  isPublicGuestPath,
  mapHostingNavDisplayTitles,
  mapPlayerNavDisplayTitles,
  pickBottomNavLinks,
  pickHostingNavLinks,
  pickOpsPlayerNavLinks,
  resolvePlayerNavHref,
} from "./player-nav";
import type { ClientNavPayload } from "@/types/platform";

function q(href: string): URLSearchParams {
  return new URL(href, "http://x").searchParams;
}

describe("resolvePlayerNavHref legacy Events browse", () => {
  it("remaps route_key events → Community", () => {
    const href = resolvePlayerNavHref({
      route_key: "events",
      title: "x",
      href: "/events/public",
    });
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
  });

  it("preserves code/id on /?view=events", () => {
    const href = resolvePlayerNavHref({
      route_key: "",
      title: "x",
      href: "/?view=events&code=ABCD12&id=e1",
    });
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("ABCD12");
    expect(q(href).get("id")).toBe("e1");
  });

  it("preserves code on /events/public", () => {
    const href = resolvePlayerNavHref({
      route_key: "",
      title: "x",
      href: "/events/public?code=ZZZZ99",
    });
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("ZZZZ99");
  });

  it("preserves id/source on legacy /tournaments", () => {
    const href = resolvePlayerNavHref({
      route_key: "",
      title: "x",
      href: "/tournaments?id=t1&source=official",
    });
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("id")).toBe("t1");
    expect(q(href).get("source")).toBe("official");
  });
});

describe("isPublicGuestPath legacy Events browse", () => {
  it("treats /events/public as guest (until Community redirect)", () => {
    expect(isPublicGuestPath("/events/public")).toBe(true);
    expect(isPublicGuestPath("/events/public/", "?code=ABCD12")).toBe(true);
  });

  it("treats /events/join as guest (until Community redirect)", () => {
    expect(isPublicGuestPath("/events/join")).toBe(true);
    expect(isPublicGuestPath("/events/join/", "?code=ABCD12")).toBe(true);
  });
});

describe("resolvePlayerNavHref Hosting Join tab", () => {
  it("keeps bare /events/join for signed-in Hosting nav (not Community remap)", () => {
    const href = resolvePlayerNavHref({
      route_key: "events_join",
      title: "Join with code",
      href: "/events/join",
    });
    expect(href).toBe("/events/join");
  });
});

describe("filterHostingNavLinks", () => {
  it("drops legacy public browse from Hosting nav", () => {
    const out = filterHostingNavLinks([
      { route_key: "events_list", title: "My hosted tournaments", href: "/events/events" },
      { route_key: "events_public", title: "Public", href: "/events/public" },
      { route_key: "events_join", title: "Join with code", href: "/events/join" },
    ]);
    expect(out.map((l) => l.route_key)).toEqual(["events_list", "events_join"]);
    expect(
      isHostingPublicBrowseNavLink({
        route_key: "events_public",
        title: "x",
        href: "/events/public",
      }),
    ).toBe(true);
  });
});

describe("mapPlayerNavDisplayTitles", () => {
  it("soft-replaces Event-sport Tournaments tab title", () => {
    const out = mapPlayerNavDisplayTitles([
      { route_key: "play", title: "Play", href: "/" },
      { route_key: "tournaments", title: "Events", href: "/?view=tournaments" },
      { route_key: "spectate", title: "Spectate", href: "/?view=spectate" },
    ]);
    expect(out.map((l) => l.title)).toEqual(["Play", "Tournaments", "Spectate"]);
  });
});

describe("mapHostingNavDisplayTitles / pickHostingNavLinks", () => {
  it("soft-replaces Event-sport Hosting titles (mig 378 + brand)", () => {
    const out = mapHostingNavDisplayTitles(
      [
        { route_key: "events_dashboard", title: "Events", href: "/events/dashboard" },
        { route_key: "events_list", title: "My events", href: "/events/events" },
        { route_key: "events_join", title: "Join", href: "/events/join" },
        { route_key: "events_analytics", title: "Events analytics", href: "/events/analytics" },
        { route_key: "events_wallet", title: "Wallet", href: "/events/wallet" },
      ],
      "Hosting",
    );
    expect(out.map((l) => l.title)).toEqual([
      "Hosting",
      "My hosted tournaments",
      "Join with code",
      "Hosting analytics",
      "Wallet",
    ]);
  });

  it("soft-replaces Hosting Join event tab title (softCommunityJoinTitle parity)", () => {
    const out = mapHostingNavDisplayTitles(
      [{ route_key: "events_join", title: "Join event", href: "/events/join" }],
      "Hosting",
    );
    expect(out[0]?.title).toBe("Join with code");
  });

  it("pickHostingNavLinks drops public browse then remaps titles", () => {
    const out = pickHostingNavLinks(
      [
        { route_key: "events_list", title: "Events", href: "/events/events" },
        { route_key: "events_public", title: "Public events", href: "/events/public" },
      ],
      "Hosting",
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toBe("My hosted tournaments");
  });
});

describe("pickBottomNavLinks / filterPlayerNavLinks no Event sport tab", () => {
  it("drops legacy events browse from player rail filter", () => {
    const out = filterPlayerNavLinks([
      { route_key: "play", title: "Play", href: "/" },
      { route_key: "tournaments", title: "Tournaments", href: "/?view=tournaments" },
      { route_key: "events", title: "Events", href: "/events/public" },
      { route_key: "events_public", title: "Public events", href: "/events/public" },
    ]);
    expect(out.map((l) => l.route_key)).toEqual(["play", "tournaments"]);
    expect(isPlayerEventsBrowseNavLink({ route_key: "events", title: "Events", href: "/x" })).toBe(
      true,
    );
  });

  it("fallback bottom nav never keeps Events beside Tournaments", () => {
    const nav = {
      bottom_nav: {
        player: [
          { route_key: "play", title: "Play", href: "/" },
          { route_key: "tournaments", title: "Tournaments", href: "/?view=tournaments" },
          { route_key: "events", title: "Events", href: "/events/public" },
          { route_key: "wallet", title: "Wallet", href: "/wallet" },
        ],
      },
    } as ClientNavPayload;
    // Only 2 primary keys → fallback path; Events must still be stripped.
    const keys = pickBottomNavLinks(nav).map((l) => l.route_key);
    expect(keys).toContain("play");
    expect(keys).toContain("tournaments");
    expect(keys).not.toContain("events");
    expect(keys).not.toContain("wallet");
  });
});

describe("pickOpsPlayerNavLinks Hosting title", () => {
  it("replaces Event-sport ops title with events_brand_name", () => {
    const nav = {
      events_brand_name: "Hosting",
      dashboard_page_title: "Overview",
      dashboard: [
        {
          route_key: "events_dashboard",
          title: "Events",
          href: "/events/dashboard",
        },
        {
          route_key: "dashboard",
          title: "Overview",
          href: "/dashboard",
        },
      ],
      player: [],
      mobile: [],
    } as ClientNavPayload;
    const host = pickOpsPlayerNavLinks(nav).find((l) => l.route_key === "events_dashboard");
    expect(host?.title).toBe("Hosting");
    expect(host?.href).toBe("/events/dashboard");
  });
});
