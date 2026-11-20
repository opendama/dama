import { describe, expect, it } from "vitest";
import {
  resolveHostPreferPublicSeed,
  resolveHostVisibilityAfterCatalog,
} from "./host-create-visibility";

describe("resolveHostVisibilityAfterCatalog", () => {
  const catalog = {
    hosted_event_public_visibility: "public",
    hosted_event_private_visibility: "private",
    default_visibility: "private",
    public_events_enabled: true,
  };

  it("keeps Public when public cups enabled", () => {
    expect(resolveHostVisibilityAfterCatalog("public", catalog)).toBe("public");
  });

  it("falls back to private when public cups disabled mid-dialog", () => {
    expect(
      resolveHostVisibilityAfterCatalog("public", {
        ...catalog,
        public_events_enabled: false,
      }),
    ).toBe("private");
  });

  it("leaves private unchanged when public cups disabled", () => {
    expect(
      resolveHostVisibilityAfterCatalog("private", {
        ...catalog,
        public_events_enabled: false,
      }),
    ).toBe("private");
  });

  it("uses default when private code missing", () => {
    expect(
      resolveHostVisibilityAfterCatalog("public", {
        hosted_event_public_visibility: "public",
        default_visibility: "invite_only",
        public_events_enabled: false,
      }),
    ).toBe("invite_only");
  });
});

describe("resolveHostPreferPublicSeed", () => {
  const catalog = {
    hosted_event_public_visibility: "public",
    hosted_event_private_visibility: "private",
    default_visibility: "private",
    public_events_enabled: true,
  };

  it("applies Public and clears prefer when gate on", () => {
    expect(resolveHostPreferPublicSeed(true, "", catalog)).toEqual({
      visibility: "public",
      clearPrefer: true,
    });
  });

  it("keeps prefer when gate off so a later enable can upgrade", () => {
    expect(
      resolveHostPreferPublicSeed(true, "", {
        ...catalog,
        public_events_enabled: false,
      }),
    ).toEqual({
      visibility: "private",
      clearPrefer: false,
    });
  });

  it("upgrades stale private seed to Public when gate turns on", () => {
    expect(resolveHostPreferPublicSeed(true, "private", catalog)).toEqual({
      visibility: "public",
      clearPrefer: true,
    });
  });

  it("no-ops when prefer is off", () => {
    expect(resolveHostPreferPublicSeed(false, "", catalog)).toEqual({
      clearPrefer: false,
    });
  });
});
