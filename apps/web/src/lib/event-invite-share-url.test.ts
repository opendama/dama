import { describe, expect, it } from "vitest";
import { resolveEventInviteShareUrl } from "./event-invite-share-url";

const communityTpl = "/?view=tournaments&source=community&code={code}";

function q(href: string): URLSearchParams {
  return new URL(href).searchParams;
}

describe("resolveEventInviteShareUrl", () => {
  it("builds from community share_path_template when share_url is bare origin", () => {
    const href = resolveEventInviteShareUrl({
      shareUrl: "http://localhost:3000/",
      joinCode: "ABCD12",
      sharePathTemplate: communityTpl,
      origin: "http://localhost:3000",
    });
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("ABCD12");
  });

  it("keeps a valid API share_url", () => {
    const href = resolveEventInviteShareUrl({
      shareUrl: "https://play.example/?view=tournaments&source=community&code=ABCD12",
      joinCode: "abcd12",
      sharePathTemplate: communityTpl,
      origin: "http://localhost:3000",
    });
    expect(href.startsWith("https://play.example/")).toBe(true);
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("ABCD12");
  });

  it("remaps legacy view=events share_url → Community (copy never emits Event sport)", () => {
    const href = resolveEventInviteShareUrl({
      shareUrl: "https://play.example/?view=events&code=ABCD12",
      joinCode: "abcd12",
      sharePathTemplate: communityTpl,
      origin: "http://localhost:3000",
    });
    expect(href.startsWith("https://play.example/")).toBe(true);
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("ABCD12");
  });

  it("remaps legacy /events/public share_url → Community", () => {
    const href = resolveEventInviteShareUrl({
      shareUrl: "https://play.example/events/public?code=ZZZZ99",
      joinCode: "zzzz99",
      sharePathTemplate: communityTpl,
      origin: "http://localhost:3000",
    });
    expect(href.startsWith("https://play.example/")).toBe(true);
    expect(href.includes("/events/public")).toBe(false);
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("ZZZZ99");
  });

  it("remaps legacy /events/join share_url → Community", () => {
    const href = resolveEventInviteShareUrl({
      shareUrl: "https://play.example/events/join?code=JOIN99",
      joinCode: "join99",
      sharePathTemplate: communityTpl,
      origin: "http://localhost:3000",
    });
    expect(href.startsWith("https://play.example/")).toBe(true);
    expect(href.includes("/events/join")).toBe(false);
    expect(q(href).get("view")).toBe("tournaments");
    expect(q(href).get("source")).toBe("community");
    expect(q(href).get("code")).toBe("JOIN99");
  });

  it("returns empty when code missing", () => {
    expect(
      resolveEventInviteShareUrl({
        shareUrl: "http://localhost:3000/",
        joinCode: "",
        sharePathTemplate: communityTpl,
        origin: "http://localhost:3000",
      }),
    ).toBe("");
  });
});
