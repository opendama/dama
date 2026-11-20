import { describe, expect, it } from "vitest";
import { sanitizeLoginNext } from "./auth-providers";

describe("sanitizeLoginNext Host CTA", () => {
  it("keeps Host create deep link after sign-in", () => {
    expect(sanitizeLoginNext("/events/events?create=1", "/")).toBe("/events/events?create=1");
  });

  it("rejects auth routes", () => {
    expect(sanitizeLoginNext("/auth/login", "/")).toBe("/");
  });

  it("keeps Host create query when pathname-only next is merged with live search", () => {
    // Mirrors RequireAuth + SignInModal.resolveStayPath: pathname /events/events + ?create=1.
    const pathname = "/events/events";
    const liveSearch = "?create=1";
    const merged = `${pathname}${liveSearch}`;
    expect(sanitizeLoginNext(merged, "/")).toBe("/events/events?create=1");
  });

  it("remaps legacy Events browse next → Tournaments Community", () => {
    const fromView = new URL(sanitizeLoginNext("/?view=events&id=e1", "/"), "http://x");
    expect(fromView.searchParams.get("view")).toBe("tournaments");
    expect(fromView.searchParams.get("source")).toBe("community");
    expect(fromView.searchParams.get("id")).toBe("e1");

    const fromPublic = new URL(sanitizeLoginNext("/events/public?code=ABCD12", "/"), "http://x");
    expect(fromPublic.searchParams.get("view")).toBe("tournaments");
    expect(fromPublic.searchParams.get("source")).toBe("community");
    expect(fromPublic.searchParams.get("code")).toBe("ABCD12");

    const fromJoin = new URL(sanitizeLoginNext("/events/join?code=JOIN99", "/"), "http://x");
    expect(fromJoin.searchParams.get("view")).toBe("tournaments");
    expect(fromJoin.searchParams.get("source")).toBe("community");
    expect(fromJoin.searchParams.get("code")).toBe("JOIN99");
  });
});
