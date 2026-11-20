import { describe, expect, it } from "vitest";
import { computeEstPrizeShare, formatEstPrizeShareAmount } from "./est-prize-share";

describe("computeEstPrizeShare", () => {
  const places = "places_percent";
  const score = "score_share";
  const dual = "dual_purse";
  const percents = { "1": 50, "2": 30, "3": 20 };

  it("places_percent pays finish share of full pot", () => {
    expect(
      computeEstPrizeShare({
        mode: places,
        placesMode: places,
        scoreMode: score,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: null,
        totalPoints: null,
      }),
    ).toBe(100);
  });

  it("score_share pays pot×points/total", () => {
    expect(
      computeEstPrizeShare({
        mode: score,
        placesMode: places,
        scoreMode: score,
        potNow: 180,
        myPoints: 2,
        totalPoints: 3,
        myPlacement: null,
        placePercents: null,
      }),
    ).toBe(120);
  });

  it("dual_purse merges place purse + performance purse", () => {
    // pot 200, place purse 50% = 100 → 1st 50; perf 100 → 2/3 pts ≈ 66.67; total ≈ 116.67
    expect(
      computeEstPrizeShare({
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: 50,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: 2,
        totalPoints: 3,
      }),
    ).toBe(116.67);
  });

  it("dual_purse pays performance-only when not in the money", () => {
    // place purse slice ignored (no place%); perf purse 100 with 1/1 pts → 100
    expect(
      computeEstPrizeShare({
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: 50,
        potNow: 200,
        myPlacement: 4,
        placePercents: percents,
        myPoints: 1,
        totalPoints: 1,
      }),
    ).toBe(100);
  });

  it("dual_purse fail-closes without place-purse percent", () => {
    expect(
      computeEstPrizeShare({
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: null,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: 1,
        totalPoints: 1,
      }),
    ).toBeNull();
  });

  it("dual_purse with zero total points uses full-pot places% (server parity)", () => {
    // pot 200, place-purse setting 50% ignored when no Pts → 1st gets 50% of full pot = 100
    expect(
      computeEstPrizeShare({
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: 50,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: 0,
        totalPoints: 0,
      }),
    ).toBe(100);
  });
});

describe("formatEstPrizeShareAmount", () => {
  it("joins amount and currency", () => {
    expect(formatEstPrizeShareAmount(12.5, "USD", " ")).toBe("12.5 USD");
  });

  it("fail-closes empty currency", () => {
    expect(formatEstPrizeShareAmount(12.5, "", " ")).toBeNull();
  });
});
