import { describe, expect, it } from "vitest";
import type { EventEntryFilter } from "@/hooks/query/useEventsPublicListQuery";
import type { TournamentEntryFilter } from "@/hooks/query/useTournamentsQuery";

/** All-tab: Official filter values must be assignable to Community list filters. */
function communityFiltersFromAllTab(
  entry: TournamentEntryFilter,
  searchQ: string,
): { entry: EventEntryFilter; searchQ: string } {
  return { entry, searchQ };
}

describe("All-tab Official→Community filter passthrough", () => {
  it("maps free/paid/all + search without remapping", () => {
    expect(communityFiltersFromAllTab("free", "cup")).toEqual({
      entry: "free",
      searchQ: "cup",
    });
    expect(communityFiltersFromAllTab("paid", "")).toEqual({
      entry: "paid",
      searchQ: "",
    });
    expect(communityFiltersFromAllTab("all", "arena")).toEqual({
      entry: "all",
      searchQ: "arena",
    });
  });
});
