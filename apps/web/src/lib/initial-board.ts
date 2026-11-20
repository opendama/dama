import type { BoardCell } from "@/types/game";

/** FMJD dark-square setup matching engine.InitialBoard (client preview only). */
export function buildInitialBoard(size: number, setupRows: number): BoardCell[][] {
  if (size <= 0 || setupRows <= 0 || setupRows * 2 >= size) {
    return [];
  }
  const board: BoardCell[][] = [];
  for (let row = 0; row < size; row++) {
    const line: BoardCell[] = [];
    for (let col = 0; col < size; col++) {
      const playable = (row + col) % 2 === 1;
      if (!playable) {
        line.push(null);
        continue;
      }
      if (row < setupRows) {
        line.push({ p: 2, k: false });
      } else if (row >= size - setupRows) {
        line.push({ p: 1, k: false });
      } else {
        line.push(null);
      }
    }
    board.push(line);
  }
  return board;
}
