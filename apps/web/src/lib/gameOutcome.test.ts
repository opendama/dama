import { describe, expect, it } from "vitest";
import { withResolvedOutcome, winnerFromBoard } from "./gameOutcome";
import type { BoardCell, GamePayload } from "@/types/game";

function cell(p: 1 | 2, k = false): BoardCell {
  return { p, k };
}

/** P2 wiped (no pieces) - wipe would invent winner=1. */
function p2WipedBoard(): BoardCell[][] {
  const empty = (): BoardCell => null;
  const b: BoardCell[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, empty));
  b[0][1] = cell(1, true);
  return b;
}

function baseGame(over: Partial<GamePayload>): GamePayload {
  return {
    id: "g1",
    variant: "international",
    mode: "pvp",
    size: 8,
    board: p2WipedBoard(),
    turn: 1,
    must_continue: null,
    move_count: 2,
    halfmove_clock: 0,
    draw: false,
    draw_reason: null,
    move_history: [],
    legal_moves: [],
    outcome: null,
    ai_player: null,
    ai_search_depth: 0,
    ...over,
  };
}

describe("withResolvedOutcome clock ownership", () => {
  it("does not invent a wipe winner when end_reason is clock_flag", () => {
    const game = baseGame({ end_reason: "clock_flag", outcome: null });
    expect(winnerFromBoard(game.board)).toBe(1);
    const next = withResolvedOutcome(game);
    expect(next.outcome).toBeNull();
    expect(next.end_reason).toBe("clock_flag");
  });

  it("does not invent a wipe winner when end_reason is clock_draw", () => {
    const game = baseGame({ end_reason: "clock_draw", outcome: null });
    const next = withResolvedOutcome(game);
    expect(next.outcome).toBeNull();
    expect(next.end_reason).toBe("clock_draw");
  });

  it("still fills wipe winner for non-clock board wins", () => {
    const game = baseGame({ outcome: null });
    const next = withResolvedOutcome(game);
    expect(next.outcome).toBe(1);
  });
});
