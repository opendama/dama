/// Algebraic board squares: files a… (x / col), ranks 1… (y from white bottom).
String boardFileLetter(int col) {
  if (col < 0 || col > 25) return '';
  return String.fromCharCode(97 + col);
}

int boardRankNumber(int row, int boardSize) {
  if (boardSize <= 0) return 0;
  return boardSize - row;
}

/// Viewer-left file after optional 180° seat flip (Chess.com coord rail).
bool isVisualLeftFile(int col, int boardSize, bool flipBoard) {
  if (boardSize <= 0) return false;
  return flipBoard ? col == boardSize - 1 : col == 0;
}

/// Viewer-bottom rank after optional 180° seat flip (Chess.com coord rail).
bool isVisualBottomRank(int row, int boardSize, bool flipBoard) {
  if (boardSize <= 0) return false;
  return flipBoard ? row == 0 : row == boardSize - 1;
}

/// Chess.com ink: dark square → light palette tone; light square → dark.
bool boardCoordUsesLightInk(bool isDarkSquare) => isDarkSquare;

String formatBoardSquare(int row, int col, int boardSize) {
  final file = boardFileLetter(col);
  final rank = boardRankNumber(row, boardSize);
  if (file.isEmpty || rank <= 0) return '';
  return '$file$rank';
}

/// Chess.com-style ply: `c3-d4` or `c3xd4` when captures present.
String formatMoveAlgebraic({
  required List<int> from,
  required List<int> to,
  required int boardSize,
  int captureCount = 0,
}) {
  if (from.length < 2 || to.length < 2 || boardSize <= 0) return '';
  final a = formatBoardSquare(from[0], from[1], boardSize);
  final b = formatBoardSquare(to[0], to[1], boardSize);
  if (a.isEmpty || b.isEmpty) return '';
  final sep = captureCount > 0 ? 'x' : '-';
  return '$a$sep$b';
}
