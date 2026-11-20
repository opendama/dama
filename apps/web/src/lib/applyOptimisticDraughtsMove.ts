import { winnerFromBoard } from "@/lib/gameOutcome";
import type { BoardCell, GamePayload, LegalMove, MoveHistoryEntry } from "@/types/game";

function cloneBoard(board: BoardCell[][] | undefined): BoardCell[][] {
  if (!board) return [];
  return board.map((row) => row.map((cell) => (cell ? { p: cell.p, k: cell.k } : null)));
}

function isPlayable(row: number, col: number, size: number): boolean {
  return row >= 0 && col >= 0 && row < size && col < size && (row + col) % 2 === 1;
}

const DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** True when the piece on (row,col) still has at least one capture (engine MustContinue). */
function hasCaptureFrom(
  board: BoardCell[][],
  row: number,
  col: number,
  player: number,
  size: number,
): boolean {
  const piece = board[row]?.[col];
  if (!piece || piece.p !== player) return false;

  if (!piece.k) {
    for (const [dr, dc] of DIAGONALS) {
      const midR = row + dr;
      const midC = col + dc;
      const landR = row + 2 * dr;
      const landC = col + 2 * dc;
      if (!isPlayable(landR, landC, size)) continue;
      const mid = board[midR]?.[midC];
      const land = board[landR]?.[landC];
      if (mid && mid.p !== player && !land) return true;
    }
    return false;
  }

  for (const [dr, dc] of DIAGONALS) {
    let scanR = row + dr;
    let scanC = col + dc;
    while (isPlayable(scanR, scanC, size) && !board[scanR]?.[scanC]) {
      scanR += dr;
      scanC += dc;
    }
    if (!isPlayable(scanR, scanC, size)) continue;
    const target = board[scanR]?.[scanC];
    if (!target || target.p === player) continue;
    const landR = scanR + dr;
    const landC = scanC + dc;
    if (isPlayable(landR, landC, size) && !board[landR]?.[landC]) return true;
  }
  return false;
}

/**
 * Apply a legal move locally for instant UI feedback (smart-menu pattern).
 * Keeps `board` frozen so DraughtsScene3D animates from the new history entry.
 * Turn / must_continue follow the engine: only hold the seat when another capture
 * remains from the landing square (never on every capture - that delayed handoff
 * and inserted the multi-capture banner, pushing the board down).
 */
export function applyOptimisticDraughtsMove(
  state: GamePayload,
  from: [number, number],
  to: [number, number],
  yourPlayer: number,
): GamePayload | null {
  if (state.turn !== yourPlayer) return null;

  const move = (state.legal_moves ?? []).find(
    (candidate: LegalMove) =>
      candidate.from[0] === from[0] &&
      candidate.from[1] === from[1] &&
      candidate.to[0] === to[0] &&
      candidate.to[1] === to[1],
  );
  if (!move) return null;

  const board = cloneBoard(state.board);
  const fromRow = board[from[0]];
  const piece = fromRow?.[from[1]];
  if (!fromRow || !piece || piece.p !== yourPlayer) return null;

  fromRow[from[1]] = null;
  for (const [cr, cc] of move.captures ?? []) {
    const capRow = board[cr];
    if (capRow?.[cc]) capRow[cc] = null;
  }

  const promotes = Boolean(move.promotes);
  const toRow = board[to[0]];
  if (!toRow) return null;
  toRow[to[1]] = { p: yourPlayer, k: piece.k || promotes };

  const size = state.size > 0 ? state.size : board.length;
  const captured = (move.captures?.length ?? 0) > 0;
  const continueCapture = captured && hasCaptureFrom(board, to[0], to[1], yourPlayer, size);
  const nextTurn = yourPlayer === 1 ? 2 : 1;
  const historyEntry: MoveHistoryEntry = {
    from: move.from,
    to: move.to,
    captures: move.captures ?? [],
    promotes,
    player: yourPlayer,
    board_after: cloneBoard(board),
  };

  // Local wipe detection so game-over UI does not wait on WS (server still confirms).
  const wipeWinner = continueCapture ? null : winnerFromBoard(board);

  return {
    ...state,
    turn: continueCapture ? yourPlayer : nextTurn,
    must_continue: continueCapture ? ([to[0], to[1]] as [number, number]) : null,
    move_count: (state.move_count ?? 0) + 1,
    legal_moves: [],
    move_history: [...(state.move_history ?? []), historyEntry],
    outcome: wipeWinner ?? state.outcome ?? null,
  };
}
