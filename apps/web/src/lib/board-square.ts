/**
 * Algebraic board squares: files a… (x / col), ranks 1… (y / row from white bottom).
 * Row 0 is the top rank (black side); rank labels count up from the bottom.
 */
export function boardFileLetter(col: number): string {
  if (!Number.isFinite(col) || col < 0 || col > 25) return "";
  return String.fromCharCode(97 + col);
}

export function boardRankNumber(row: number, boardSize: number): number {
  if (!Number.isFinite(row) || !Number.isFinite(boardSize) || boardSize <= 0) return 0;
  return boardSize - row;
}

/** Viewer-left file after optional 180° seat flip (Chess.com coord rail). */
export function isVisualLeftFile(col: number, boardSize: number, flipBoard: boolean): boolean {
  if (!Number.isFinite(col) || boardSize <= 0) return false;
  return flipBoard ? col === boardSize - 1 : col === 0;
}

/** Viewer-bottom rank after optional 180° seat flip (Chess.com coord rail). */
export function isVisualBottomRank(row: number, boardSize: number, flipBoard: boolean): boolean {
  if (!Number.isFinite(row) || boardSize <= 0) return false;
  return flipBoard ? row === 0 : row === boardSize - 1;
}

/**
 * Chess.com ink: on a dark square use the light palette tone; on a light square use dark.
 * Based on the square's inherent tone (not last-move / select overlays).
 */
export function boardCoordUsesLightInk(isDarkSquare: boolean): boolean {
  return Boolean(isDarkSquare);
}

export function formatBoardSquare(row: number, col: number, boardSize: number): string {
  const file = boardFileLetter(col);
  const rank = boardRankNumber(row, boardSize);
  if (!file || rank <= 0) return "";
  return `${file}${rank}`;
}

/** Chess.com-style ply: `c3-d4` or `c3xd4` when captures present. */
export function formatMoveAlgebraic(
  from: [number, number] | number[] | undefined,
  to: [number, number] | number[] | undefined,
  boardSize: number,
  captureCount = 0,
): string {
  if (!from || !to || from.length < 2 || to.length < 2 || boardSize <= 0) return "";
  const a = formatBoardSquare(from[0], from[1], boardSize);
  const b = formatBoardSquare(to[0], to[1], boardSize);
  if (!a || !b) return "";
  const sep = captureCount > 0 ? "x" : "-";
  return `${a}${sep}${b}`;
}
