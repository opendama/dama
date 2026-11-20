import type { BoardCell, GamePayload, MoveHistoryEntry } from "@/types/game";

type BoardGrid = BoardCell[][];

function countPlayerPieces(board: BoardGrid | undefined | null, player: 1 | 2): number {
  if (!board) return 0;
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell?.p === player) total += 1;
    }
  }
  return total;
}

function countCapturesFromHistory(
  history: MoveHistoryEntry[] | undefined,
  player: 1 | 2,
  upToMove: number | null,
): number {
  const moves = history ?? [];
  const limit = upToMove ?? moves.length;
  let count = 0;
  for (let i = 0; i < limit && i < moves.length; i++) {
    const move = moves[i];
    if (move?.player === player) {
      count += move.captures?.length ?? 0;
    }
  }
  return count;
}

/** Pieces this player has captured from the opponent (smart-menu gameBoardStats). */
export function countCapturesForPlayer(
  game: Pick<GamePayload, "board" | "move_history">,
  player: 1 | 2,
  replayIndex: number | null = null,
  piecesPerSideFallback = 20,
): number {
  if (replayIndex !== null) {
    return countCapturesFromHistory(game.move_history, player, replayIndex);
  }

  const history = game.move_history ?? [];
  if (history.length > 0) {
    return countCapturesFromHistory(history, player, null);
  }

  const opponent: 1 | 2 = player === 1 ? 2 : 1;
  const currentCount = countPlayerPieces(game.board, opponent);
  return Math.max(0, piecesPerSideFallback - currentCount);
}

export function getMatchCaptureScores(
  game: Pick<GamePayload, "board" | "move_history">,
  yourPlayer: 1 | 2,
  replayIndex: number | null = null,
  piecesPerSideFallback = 20,
): { yourCaptures: number; opponentCaptures: number; yourPlayer: 1 | 2; opponentPlayer: 1 | 2 } {
  const opponentPlayer: 1 | 2 = yourPlayer === 1 ? 2 : 1;
  return {
    yourPlayer,
    opponentPlayer,
    yourCaptures: countCapturesForPlayer(game, yourPlayer, replayIndex, piecesPerSideFallback),
    opponentCaptures: countCapturesForPlayer(
      game,
      opponentPlayer,
      replayIndex,
      piecesPerSideFallback,
    ),
  };
}
