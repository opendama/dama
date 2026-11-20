import { describe, expect, it } from "vitest";
import { dualPursePlacePercentInvalid, placePercentsSumInvalid } from "./competition-payout";

describe("dualPursePlacePercentInvalid", () => {
  it("rejects empty, zero, 100, and non-numeric", () => {
    expect(dualPursePlacePercentInvalid("")).toBe(true);
    expect(dualPursePlacePercentInvalid("0")).toBe(true);
    expect(dualPursePlacePercentInvalid("100")).toBe(true);
    expect(dualPursePlacePercentInvalid("abc")).toBe(true);
  });

  it("accepts 1–99 inclusive", () => {
    expect(dualPursePlacePercentInvalid("1")).toBe(false);
    expect(dualPursePlacePercentInvalid("50")).toBe(false);
    expect(dualPursePlacePercentInvalid("99")).toBe(false);
  });
});

describe("placePercentsSumInvalid", () => {
  it("flags sums outside 100 when any place is set", () => {
    expect(placePercentsSumInvalid("50", "30", "10")).toBe(true);
    expect(placePercentsSumInvalid("50", "30", "20")).toBe(false);
  });
});
