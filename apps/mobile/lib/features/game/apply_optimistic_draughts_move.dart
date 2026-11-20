import 'package:dama_mobile/core/types/game.dart';

List<List<dynamic>> _cloneBoard(List<List<dynamic>> board) {
  return board
      .map((row) => row.map((cell) {
            if (cell is Map) {
              return {'p': cell['p'], 'k': cell['k'] == true};
            }
            return null;
          }).toList())
      .toList();
}

bool _isPlayable(int row, int col, int size) {
  return row >= 0 &&
      col >= 0 &&
      row < size &&
      col < size &&
      (row + col) % 2 == 1;
}

const _diagonals = <(int, int)>[
  (-1, -1),
  (-1, 1),
  (1, -1),
  (1, 1),
];

int _countPlayer(List<List<dynamic>> board, int player) {
  var n = 0;
  for (final row in board) {
    for (final cell in row) {
      if (cell is Map && cell['p'] == player) n++;
    }
  }
  return n;
}

/// Wipe winner from a post-move board (engine parity for all-pieces-captured).
int? winnerFromBoard(List<List<dynamic>> board) {
  final p1 = _countPlayer(board, 1);
  final p2 = _countPlayer(board, 2);
  if (p1 == 0 && p2 == 0) return null;
  if (p1 == 0) return 2;
  if (p2 == 0) return 1;
  return null;
}

bool _hasCaptureFrom(
  List<List<dynamic>> board,
  int row,
  int col,
  int player,
  int size,
) {
  final cell = board[row][col];
  if (cell is! Map || cell['p'] != player) return false;
  final isKing = cell['k'] == true;

  if (!isKing) {
    for (final d in _diagonals) {
      final midR = row + d.$1;
      final midC = col + d.$2;
      final landR = row + 2 * d.$1;
      final landC = col + 2 * d.$2;
      if (!_isPlayable(landR, landC, size)) continue;
      final mid = board[midR][midC];
      final land = board[landR][landC];
      if (mid is Map && mid['p'] != player && land == null) return true;
    }
    return false;
  }

  for (final d in _diagonals) {
    var scanR = row + d.$1;
    var scanC = col + d.$2;
    while (_isPlayable(scanR, scanC, size) && board[scanR][scanC] == null) {
      scanR += d.$1;
      scanC += d.$2;
    }
    if (!_isPlayable(scanR, scanC, size)) continue;
    final target = board[scanR][scanC];
    if (target is! Map || target['p'] == player) continue;
    final landR = scanR + d.$1;
    final landC = scanC + d.$2;
    if (_isPlayable(landR, landC, size) && board[landR][landC] == null) {
      return true;
    }
  }
  return false;
}

/// Instant local ply (web `applyOptimisticDraughtsMove` parity).
/// Freezes live `board`; animation reads `moveHistory.last.boardAfter`.
({
  List<List<dynamic>>? board,
  int turn,
  List<int>? mustContinue,
  List<BoardLegalMove> legalMoves,
  List<LegalMoveDetail> legalMoveDetails,
  int moveCount,
  List<MoveHistoryEntry> moveHistory,
  int? outcome,
})? applyOptimisticDraughtsMove({
  required List<List<dynamic>>? board,
  required int turn,
  required int yourPlayer,
  required int size,
  required List<LegalMoveDetail> legalMoveDetails,
  required List<MoveHistoryEntry> moveHistory,
  required int moveCount,
  required int fromR,
  required int fromC,
  required int toR,
  required int toC,
}) {
  if (board == null || turn != yourPlayer) return null;
  LegalMoveDetail? move;
  for (final m in legalMoveDetails) {
    if (m.fromR == fromR && m.fromC == fromC && m.toR == toR && m.toC == toC) {
      move = m;
      break;
    }
  }
  if (move == null) return null;

  final nextBoard = _cloneBoard(board);
  final piece = nextBoard[fromR][fromC];
  if (piece is! Map || piece['p'] != yourPlayer) return null;

  nextBoard[fromR][fromC] = null;
  for (final c in move.captures) {
    if (c.length >= 2) nextBoard[c[0]][c[1]] = null;
  }
  final promotes = move.promotes;
  nextBoard[toR][toC] = {
    'p': yourPlayer,
    'k': piece['k'] == true || promotes,
  };

  final boardSize = size > 0 ? size : nextBoard.length;
  final captured = move.captures.isNotEmpty;
  final continueCapture =
      captured && _hasCaptureFrom(nextBoard, toR, toC, yourPlayer, boardSize);
  final nextTurn = yourPlayer == 1 ? 2 : 1;

  final entry = MoveHistoryEntry(
    from: [fromR, fromC],
    to: [toR, toC],
    captures: move.captures,
    player: yourPlayer,
    boardAfter: _cloneBoard(nextBoard),
  );

  final wipe = continueCapture ? null : winnerFromBoard(nextBoard);

  return (
    board: board, // freeze parent board for animation
    turn: continueCapture ? yourPlayer : nextTurn,
    mustContinue: continueCapture ? [toR, toC] : null,
    legalMoves: const <BoardLegalMove>[],
    legalMoveDetails: const <LegalMoveDetail>[],
    moveCount: moveCount + 1,
    moveHistory: [...moveHistory, entry],
    outcome: wipe,
  );
}
