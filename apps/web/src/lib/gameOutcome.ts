import type { BoardCell, GamePayload, MoveHistoryEntry } from "@/types/game";

function countPlayer(board: BoardCell[][] | undefined, player: 1 | 2): number {
  if (!board) return 0;
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell?.p === player) n += 1;
    }
  }
  return n;
}

function boardsEqual(a: BoardCell[][] | undefined, b: BoardCell[][] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    const ar = a[r];
    const br = b[r];
    if (!ar || !br || ar.length !== br.length) return false;
    for (let c = 0; c < ar.length; c++) {
      const ac = ar[c];
      const bc = br[c];
      if (!ac && !bc) continue;
      if (!ac || !bc || ac.p !== bc.p || Boolean(ac.k) !== Boolean(bc.k)) return false;
    }
  }
  return true;
}

/** Wipe / no-pieces winner from a board snapshot (engine GameOutcome parity for captures). */
export function winnerFromBoard(board: BoardCell[][] | undefined): 1 | 2 | null {
  if (!board?.length) return null;
  const p1 = countPlayer(board, 1);
  const p2 = countPlayer(board, 2);
  if (p1 === 0 && p2 === 0) return null;
  if (p1 === 0) return 2;
  if (p2 === 0) return 1;
  return null;
}

export function lastBoardAfter(history: MoveHistoryEntry[] | undefined): BoardCell[][] | undefined {
  const last = history?.at(-1)?.board_after;
  return last?.length ? last : undefined;
}

/** True when live board already matches the terminal history snapshot (or there is none). */
export function isTerminalBoardSynced(game: GamePayload): boolean {
  if (game.outcome == null && !game.draw) return true;
  const after = lastBoardAfter(game.move_history);
  if (!after) return true;
  return boardsEqual(game.board, after);
}

/**
 * True when the painted board has landed on the latest history snapshot
 * (or there is no ply to animate). Same predicate clocks use to avoid mid-slide flashes.
 */
export function isBoardPlySynced(game: GamePayload | null | undefined): boolean {
  if (!game) return false;
  const after = lastBoardAfter(game.move_history);
  if (!after?.length) return true;
  return boardsEqual(game.board, after);
}

/**
 * Seat whose clock should be white (Chess.com pacing).
 * While the latest ply is still animating (board behind board_after), keep that
 * mover's clock lit - do not jump to side-to-move until the piece lands.
 * Fixes AI: server flip to "your turn" must not light your clock mid-AI-slide.
 */
export function activeClockPlayer(game: GamePayload | null | undefined): 1 | 2 | null {
  if (!game) return null;
  if (game.outcome != null || game.draw) return null;
  const last = game.move_history?.at(-1);
  const after = last?.board_after;
  const mover = last?.player;
  if (after?.length && (mover === 1 || mover === 2) && !boardsEqual(game.board, after)) {
    return mover;
  }
  return game.turn === 1 || game.turn === 2 ? game.turn : null;
}

/** Snap board to final ply so finished UI / replayMode never show a stale pre-move grid. */
export function syncTerminalBoard(game: GamePayload): GamePayload {
  if (game.outcome == null && !game.draw) return game;
  const after = lastBoardAfter(game.move_history);
  if (after && !boardsEqual(game.board, after)) {
    return { ...game, board: after, legal_moves: [] };
  }
  if ((game.legal_moves?.length ?? 0) > 0) {
    return { ...game, legal_moves: [] };
  }
  return game;
}

/** Prefer server outcome; fill wipe wins from board_after when the server payload is late. */
export function withResolvedOutcome(game: GamePayload): GamePayload {
  if (game.draw) return game;
  if (game.outcome === 1 || game.outcome === 2) return game;
  // Clock endings: ForcedOutcome / clock_draw own the result - never invent a board wipe winner.
  const endReason = (game.end_reason || "").trim();
  if (endReason === "clock_flag" || endReason === "clock_draw") return game;
  const after = lastBoardAfter(game.move_history) ?? game.board;
  const wipe = winnerFromBoard(after);
  if (wipe == null) return game;
  return { ...game, outcome: wipe, legal_moves: [] };
}
