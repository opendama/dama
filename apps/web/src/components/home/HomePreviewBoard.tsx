"use client";

import { BoardSquareCoords } from "@/components/game/BoardSquareCoords";
import { PalacePieceMark } from "@/components/game/PalacePieceMark";
import { cn } from "@/lib/utils";

const SIZE = 10;

/** Dark squares are playable (bottom-left dark for White). */
function isDark(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
}

/** FMJD 10×10 starting men: dark on top rows, light on bottom rows. */
function pieceAt(row: number, col: number): "dark" | "light" | null {
  if (!isDark(row, col)) return null;
  if (row < 4) return "dark";
  if (row > 5) return "light";
  return null;
}

function SeatRow({
  label,
  clock,
  tone,
  pieceSide = "light",
}: {
  label: string;
  clock?: string;
  tone: "muted" | "strong";
  pieceSide?: "light" | "dark";
}) {
  const mark = label.trim().slice(0, 1).toUpperCase();
  const clockText = (clock || "").trim();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden"
          aria-hidden
        >
          <PalacePieceMark
            player={pieceSide === "light" ? 1 : 2}
            isKing={false}
            className="inset-0"
          />
          <span className="sr-only">{mark}</span>
        </span>
        <p
          className={cn(
            "truncate text-sm font-medium",
            tone === "strong" ? "text-[var(--dama-text)]" : "text-[var(--dama-muted-foreground)]",
          )}
        >
          {label}
        </p>
      </div>
      {clockText ? (
        <span
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1 font-mono text-sm tabular-nums",
            tone === "strong"
              ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
              : "bg-[var(--dama-card)] text-[var(--dama-muted-foreground)]",
          )}
        >
          {clockText}
        </span>
      ) : null}
    </div>
  );
}

type HomePreviewBoardProps = {
  opponentLabel?: string;
  playerLabel?: string;
  clockLabel?: string;
  className?: string;
};

/**
 * Static marketing board - Neo court pieces on 10×10.
 */
export function HomePreviewBoard({
  opponentLabel,
  playerLabel,
  clockLabel,
  className,
}: HomePreviewBoardProps) {
  const top = (opponentLabel || "").trim();
  const bottom = (playerLabel || "").trim();
  const clock = (clockLabel || "").trim();

  return (
    <div className={cn("mx-auto flex h-full min-h-0 w-full max-w-full flex-col", className)}>
      {top ? (
        <div className="mb-2.5">
          <SeatRow label={top} clock={clock || undefined} tone="muted" pieceSide="dark" />
        </div>
      ) : null}
      <div
        className="dama-home-board relative aspect-square max-h-full min-h-0 w-full max-w-full overflow-hidden"
        role="img"
        aria-label={bottom || top || "board"}
      >
        <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const row = Math.floor(i / SIZE);
            const col = i % SIZE;
            const dark = isDark(row, col);
            const piece = pieceAt(row, col);
            return (
              <div
                key={`sq-${row}-${col}`}
                className={cn(
                  "relative flex items-center justify-center",
                  dark ? "bg-[var(--dama-board-dark)]" : "bg-[var(--dama-board-light)]",
                )}
              >
                <BoardSquareCoords row={row} col={col} boardSize={SIZE} isDark={dark} />
                {piece ? (
                  <span
                    className="relative block h-[98%] w-[98%] drop-shadow-sm transition-transform duration-300 hover:scale-105"
                    aria-hidden
                  >
                    <PalacePieceMark
                      player={piece === "light" ? 1 : 2}
                      isKing={false}
                      className="inset-0"
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {bottom ? (
        <div className="mt-2.5">
          <SeatRow label={bottom} clock={clock || undefined} tone="strong" pieceSide="light" />
        </div>
      ) : null}
    </div>
  );
}
