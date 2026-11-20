import { describe, expect, it } from "vitest";
import { shouldForwardStrayOAuthCode } from "./oauth-stray-code";

describe("shouldForwardStrayOAuthCode", () => {
  it("forwards OAuth PKCE code+state on Play home", () => {
    const q = new URLSearchParams("code=oauth1&state=xyz");
    expect(shouldForwardStrayOAuthCode("/", q)).toBe(true);
  });

  it("does not forward Community invite share code", () => {
    const q = new URLSearchParams("view=tournaments&source=community&code=ABCD12");
    expect(shouldForwardStrayOAuthCode("/", q)).toBe(false);
  });

  it("does not forward legacy view=events invite code", () => {
    const q = new URLSearchParams("view=events&code=ABCD12");
    expect(shouldForwardStrayOAuthCode("/", q)).toBe(false);
  });

  it("does not forward /events/join?code= without state", () => {
    const q = new URLSearchParams("code=ABCD12");
    expect(shouldForwardStrayOAuthCode("/events/join", q)).toBe(false);
  });

  it("does not forward bare ?code= without state (invite-safe)", () => {
    const q = new URLSearchParams("code=ABCD12");
    expect(shouldForwardStrayOAuthCode("/", q)).toBe(false);
  });
});
