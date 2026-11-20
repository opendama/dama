import { describe, expect, it } from "vitest";
import {
  boardCoordUsesLightInk,
  boardFileLetter,
  boardRankNumber,
  formatBoardSquare,
  formatMoveAlgebraic,
  isVisualBottomRank,
  isVisualLeftFile,
} from "./board-square";

describe("board-square algebraic", () => {
  it("maps col 0 → a and bottom row → rank 1", () => {
    expect(boardFileLetter(0)).toBe("a");
    expect(boardFileLetter(7)).toBe("h");
    expect(boardRankNumber(7, 8)).toBe(1);
    expect(boardRankNumber(0, 8)).toBe(8);
    expect(formatBoardSquare(7, 0, 8)).toBe("a1");
    expect(formatBoardSquare(0, 4, 8)).toBe("e8");
  });

  it("formats quiet and capture plies", () => {
    expect(formatMoveAlgebraic([5, 2], [4, 3], 8, 0)).toBe("c3-d4");
    expect(formatMoveAlgebraic([5, 2], [4, 3], 8, 1)).toBe("c3xd4");
  });

  it("maps visual left/bottom rails with seat flip", () => {
    expect(isVisualLeftFile(0, 10, false)).toBe(true);
    expect(isVisualLeftFile(9, 10, false)).toBe(false);
    expect(isVisualLeftFile(9, 10, true)).toBe(true);
    expect(isVisualBottomRank(9, 10, false)).toBe(true);
    expect(isVisualBottomRank(0, 10, true)).toBe(true);
    expect(boardCoordUsesLightInk(true)).toBe(true);
    expect(boardCoordUsesLightInk(false)).toBe(false);
  });
});
