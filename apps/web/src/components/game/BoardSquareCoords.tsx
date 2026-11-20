"use client";

import {
  boardCoordUsesLightInk,
  boardFileLetter,
  boardRankNumber,
  isVisualBottomRank,
  isVisualLeftFile,
} from "@/lib/board-square";
import { cn } from "@/lib/utils";

type Props = {
  row: number;
  col: number;
  boardSize: number;
  flipBoard?: boolean;
  isDark: boolean;
  /** Slightly smaller type on 10×10 (and larger) boards. */
  className?: string;
};

/**
 * Chess.com-style in-square algebraic rails:
 * ranks on the visual left file (top-left), files on the visual bottom rank (bottom-right).
 * Ink follows the board palette (opposite square tone).
 */
export function BoardSquareCoords({
  row,
  col,
  boardSize,
  flipBoard = false,
  isDark,
  className,
}: Props) {
  const showRank = isVisualLeftFile(col, boardSize, flipBoard);
  const showFile = isVisualBottomRank(row, boardSize, flipBoard);
  if (!showRank && !showFile) return null;

  const ink = boardCoordUsesLightInk(isDark) ? "var(--dama-board-light)" : "var(--dama-board-dark)";
  // Chess.com-scale type: slightly tighter on 10×10 FMJD.
  const type = boardSize >= 10 ? "text-[0.58rem]" : "text-[0.68rem]";

  return (
    <>
      {showRank ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-[3px] top-[2px] z-[3] select-none font-bold leading-none tabular-nums",
            type,
            className,
          )}
          style={{ color: ink }}
        >
          {boardRankNumber(row, boardSize)}
        </span>
      ) : null}
      {showFile ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-[2px] right-[3px] z-[3] select-none font-bold leading-none lowercase",
            type,
            className,
          )}
          style={{ color: ink }}
        >
          {boardFileLetter(col)}
        </span>
      ) : null}
    </>
  );
}
