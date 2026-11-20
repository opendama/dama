"use client";

import { SkipPagination } from "@/components/ui/skip-pagination";
import { formatMoveAlgebraic } from "@/lib/board-square";
import {
  type ClientSkipLabels,
  DEFAULT_SKIP_LABELS,
  buildClientSkipMeta,
} from "@/lib/skip-pagination";
import type { MoveHistoryEntry } from "@/types/game";
import { Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  moves: MoveHistoryEntry[];
  /** Board size for algebraic files/ranks (required for sidebar notation). */
  boardSize: number;
  replayIndex: number | null;
  onSelectLive: () => void;
  onSelectMove: (index: number) => void;
  liveLabel?: string;
  historyLabel?: string;
  /** Page size for Trim-style skip/go over history chips (horizontal layout only). */
  pageSize?: number;
  skipLabels?: ClientSkipLabels;
  /**
   * `horizontal` - under-board chip strip (legacy).
   * `sidebar` - right-rail vertical scroll list (default for live play).
   */
  layout?: "horizontal" | "sidebar";
};

const HISTORY_PAGE = 12;

function moveChipClass(active: boolean, captured: boolean): string {
  if (active) {
    return "border-[var(--dama-text)] bg-[var(--dama-text)] text-[var(--dama-bg)]";
  }
  if (captured) {
    return "border-[var(--dama-brand)]/40 text-[var(--dama-text)] hover:border-[var(--dama-brand)]";
  }
  return "border-[var(--dama-border)] text-[var(--dama-muted)] hover:border-[var(--dama-text)] hover:text-[var(--dama-text)]";
}

/** Live + ply chips: horizontal strip or scrollable right-rail section. */
export function GameMoveHistory({
  moves,
  boardSize,
  replayIndex,
  onSelectLive,
  onSelectMove,
  liveLabel = "",
  historyLabel = "",
  pageSize = HISTORY_PAGE,
  skipLabels,
  layout = "sidebar",
}: Props) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const isLive = replayIndex === null;
  const [skip, setSkip] = useState(0);
  const labels = useMemo(() => ({ ...DEFAULT_SKIP_LABELS, ...skipLabels }), [skipLabels]);
  const live = liveLabel.trim();
  const heading = historyLabel.trim();
  const sidebar = layout === "sidebar";

  useEffect(() => {
    if (sidebar) return;
    if (replayIndex != null && replayIndex > 0) {
      const idx = replayIndex - 1;
      setSkip(Math.floor(idx / pageSize) * pageSize);
    } else {
      setSkip(Math.max(0, Math.floor((moves.length - 1) / pageSize) * pageSize));
    }
  }, [moves.length, pageSize, replayIndex, sidebar]);

  const pageMoves = useMemo(
    () => (sidebar ? moves : moves.slice(skip, skip + pageSize)),
    [moves, pageSize, sidebar, skip],
  );

  const meta = useMemo(
    () => buildClientSkipMeta(moves.length, skip, pageSize, labels),
    [labels, moves.length, pageSize, skip],
  );

  useEffect(() => {
    void pageMoves.length;
    void skip;
    void replayIndex;
    const el = scrollRef.current;
    if (!el) return;
    if (sidebar) {
      // Nested moves list (all breakpoints) - same idea as Flutter maxHeight: 220.
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  }, [pageMoves.length, replayIndex, sidebar, skip]);

  if (moves.length === 0 || !live || !heading) return null;

  if (sidebar) {
    /** Pair plies into chess.com-style rows: move number | white | black. */
    const pairs: {
      num: number;
      white?: { move: MoveHistoryEntry; index: number };
      black?: { move: MoveHistoryEntry; index: number };
    }[] = [];
    for (let i = 0; i < pageMoves.length; i += 2) {
      const whiteMove = pageMoves[i];
      if (!whiteMove) continue;
      const blackMove = pageMoves[i + 1];
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: { move: whiteMove, index: i },
        black: blackMove ? { move: blackMove, index: i + 1 } : undefined,
      });
    }

    return (
      <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 border-t border-[var(--dama-border)] pt-3">
        <div className="flex shrink-0 items-center justify-between gap-2 bg-[var(--dama-panel)] px-0.5">
          <p className="truncate text-sm font-medium text-[var(--dama-text)]">{heading}</p>
          <span className="shrink-0 text-xs text-[var(--dama-muted)]">{moves.length}</span>
        </div>
        <button
          type="button"
          className={`inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            isLive
              ? "border-[var(--dama-text)] bg-[var(--dama-text)] text-[var(--dama-bg)]"
              : "border-[var(--dama-border)] text-[var(--dama-muted)] hover:border-[var(--dama-text)] hover:text-[var(--dama-text)]"
          }`}
          onClick={onSelectLive}
          aria-pressed={isLive}
        >
          <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {live}
        </button>
        <ul
          ref={(el) => {
            scrollRef.current = el;
          }}
          className="max-h-[220px] w-full list-none overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]"
          aria-label={heading}
        >
          {pairs.map((pair) => {
            const white = pair.white;
            const black = pair.black;
            const whiteActive = white != null && replayIndex === white.index + 1;
            const blackActive = black != null && replayIndex === black.index + 1;
            const whiteCap = white ? (white.move.captures?.length ?? 0) : 0;
            const blackCap = black ? (black.move.captures?.length ?? 0) : 0;
            const whiteLabel = white
              ? formatMoveAlgebraic(white.move.from, white.move.to, boardSize, whiteCap)
              : "";
            const blackLabel = black
              ? formatMoveAlgebraic(black.move.from, black.move.to, boardSize, blackCap)
              : "";
            return (
              <li
                key={`ply-${pair.num}`}
                className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-1 border-b border-[var(--dama-border)]/50 py-0.5 odd:bg-[var(--dama-surface)]/40"
              >
                <span className="flex items-center justify-end pr-1 text-[11px] tabular-nums text-[var(--dama-muted)]">
                  {pair.num}.
                </span>
                {white ? (
                  <button
                    type="button"
                    className={`rounded px-1.5 py-1.5 text-left text-xs font-medium tabular-nums transition-colors ${moveChipClass(whiteActive, whiteCap > 0)}`}
                    onClick={() => onSelectMove(white.index + 1)}
                    aria-label={`${heading} ${white.index + 1} ${whiteLabel}`}
                    aria-pressed={whiteActive}
                  >
                    {whiteLabel}
                  </button>
                ) : (
                  <span />
                )}
                {black ? (
                  <button
                    type="button"
                    className={`rounded px-1.5 py-1.5 text-left text-xs font-medium tabular-nums transition-colors ${moveChipClass(blackActive, blackCap > 0)}`}
                    onClick={() => onSelectMove(black.index + 1)}
                    aria-label={`${heading} ${black.index + 1} ${blackLabel}`}
                    aria-pressed={blackActive}
                  >
                    {blackLabel}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full min-w-0 max-w-full space-y-2 overflow-hidden">
      <div className="flex min-w-0 items-center justify-between gap-2 px-0.5">
        <p className="truncate text-sm font-medium text-[var(--dama-text)]">{heading}</p>
        <span className="shrink-0 text-xs text-[var(--dama-muted)]">{moves.length}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${moveChipClass(isLive, false)}`}
          onClick={onSelectLive}
          aria-pressed={isLive}
        >
          <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {live}
        </button>
        <div
          ref={(el) => {
            scrollRef.current = el;
          }}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pageMoves.map((move, i) => {
            const index = skip + i;
            const active = replayIndex === index + 1;
            const captured = (move.captures?.length ?? 0) > 0;
            const from = move.from ?? [0, 0];
            const to = move.to ?? [0, 0];
            return (
              <button
                key={`${from.join("-")}-${to.join("-")}-${index}`}
                type="button"
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${moveChipClass(active, captured)}`}
                onClick={() => onSelectMove(index + 1)}
                aria-label={`${heading} ${index + 1}`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-w-0 max-w-full overflow-x-auto">
        <SkipPagination
          meta={meta}
          onPrev={setSkip}
          onNext={setSkip}
          inputId="game-move-history-skip"
          className="min-w-0"
        />
      </div>
    </div>
  );
}
