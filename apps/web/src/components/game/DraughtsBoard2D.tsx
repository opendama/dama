"use client";

/**
 * Flat Chess.com-style draughts board (default view).
 * Same interaction + move_history animation contract as DraughtsScene3D
 * (pick→hold→travel→land, legal/select/must cues, last-ply highlights).
 */

import { BoardSquareCoords } from "@/components/game/BoardSquareCoords";
import { PalacePieceMark } from "@/components/game/PalacePieceMark";
import { pieceLandKind, playPieceLandSound } from "@/lib/audio-notify";
import { cn } from "@/lib/utils";
import type { BoardCell, LegalMove, MoveHistoryEntry } from "@/types/game";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type BoardGrid = BoardCell[][];

export type DraughtsBoard2DProps = {
  board: BoardGrid;
  legalMoves: LegalMove[];
  selected: [number, number] | null;
  onSelectSquare: (row: number, col: number) => void;
  interactive?: boolean;
  mustContinue?: [number, number] | null;
  flipBoard?: boolean;
  moveHistory?: MoveHistoryEntry[];
  yourPlayer?: 1 | 2 | null;
  replayMode?: boolean;
  illegalShakeKey?: number;
  /** Called when a ply animation lands on board_after (same as 3D). */
  onPlyAnimated?: (boardAfter: BoardGrid) => void;
  className?: string;
};

const PICK_PHASE_END = 0.24;
const HOLD_PHASE_END = 0.34;
const LAND_PHASE_START = 0.72;
const MOVE_DURATION_MIN = 0.72;
const CAPTURE_DURATION_MIN = 0.92;
const DURATION_PER_SQUARE = 0.16;
const MOVE_DURATION_MAX = 1.65;
const OPPONENT_MOVE_DURATION_MIN = 0.34;
const OPPONENT_CAPTURE_DURATION_MIN = 0.44;
const OPPONENT_DURATION_PER_SQUARE = 0.09;
const OPPONENT_MOVE_DURATION_MAX = 0.82;

type ActiveAnimation = {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
  player: 1 | 2;
  isKing: boolean;
  /** Man became king this ply (Chess.com promote SFX). */
  isPromotion: boolean;
  progress: number;
  isCapture: boolean;
  duration: number;
  boardAfter?: BoardGrid;
  boardApplied?: boolean;
};

function isDark(row: number, col: number) {
  return (row + col) % 2 === 1;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function moveDurationSeconds(
  from: [number, number],
  to: [number, number],
  isCapture: boolean,
  opponentMove?: boolean,
): number {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const base = isCapture
    ? opponentMove
      ? OPPONENT_CAPTURE_DURATION_MIN
      : CAPTURE_DURATION_MIN
    : opponentMove
      ? OPPONENT_MOVE_DURATION_MIN
      : MOVE_DURATION_MIN;
  const perSq = opponentMove ? OPPONENT_DURATION_PER_SQUARE : DURATION_PER_SQUARE;
  const max = opponentMove ? OPPONENT_MOVE_DURATION_MAX : MOVE_DURATION_MAX;
  return Math.min(max, base + dist * perSq);
}

function boardsEqual(left: BoardGrid | undefined, right: BoardGrid | undefined): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  for (let row = 0; row < left.length; row++) {
    const lr = left[row];
    const rr = right[row];
    if (!lr || !rr || lr.length !== rr.length) return false;
    for (let col = 0; col < lr.length; col++) {
      const a = lr[col];
      const b = rr[col];
      if (!a && !b) continue;
      if (!a || !b || a.p !== b.p || a.k !== b.k) return false;
    }
  }
  return true;
}

function animationFromHistoryEntry(
  entry: MoveHistoryEntry,
  yourPlayer: number | null | undefined,
  prevBoard?: BoardGrid | null,
): ActiveAnimation | null {
  if (!entry?.from || !entry?.to) return null;
  const from = entry.from;
  const to = entry.to;
  const captures = (entry.captures ?? []) as [number, number][];
  const dest = entry.board_after?.[to[0]]?.[to[1]];
  const player = (entry.player === 2 || dest?.p === 2 ? 2 : 1) as 1 | 2;
  const isCapture = captures.length > 0;
  const wasKing = Boolean(prevBoard?.[from[0]]?.[from[1]]?.k);
  const isPromotion = Boolean(dest?.k) && !wasKing;
  const opponentMove = yourPlayer != null && player !== yourPlayer;
  return {
    from,
    to,
    captures,
    player,
    isKing: Boolean(dest?.k),
    isPromotion,
    progress: 0,
    isCapture,
    duration: moveDurationSeconds(from, to, isCapture, opponentMove),
    boardAfter: entry.board_after,
  };
}

function animationFromBoardDiff(
  prev: BoardGrid,
  next: BoardGrid,
  legalHint?: LegalMove[],
): ActiveAnimation | null {
  if (!prev.length || !next.length || prev.length !== next.length) return null;
  const size = prev.length;
  const emptied: [number, number][] = [];
  const filled: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const a = prev[r]?.[c] ?? null;
      const b = next[r]?.[c] ?? null;
      if (a && !b) emptied.push([r, c]);
      if (!a && b) filled.push([r, c]);
      if (a && b && (a.p !== b.p || a.k !== b.k)) {
        emptied.push([r, c]);
        filled.push([r, c]);
      }
    }
  }
  if (filled.length !== 1) return null;
  const to = filled[0];
  if (!to) return null;
  const dest = next[to[0]]?.[to[1]];
  if (!dest) return null;
  let from: [number, number] | null = null;
  const captures: [number, number][] = [];
  for (const sq of emptied) {
    const was = prev[sq[0]]?.[sq[1]];
    if (!was) continue;
    if (was.p === dest.p) from = sq;
    else captures.push(sq);
  }
  if (!from && legalHint?.length) {
    const match = legalHint.find((m) => m.to[0] === to[0] && m.to[1] === to[1] && m.from);
    if (match) {
      from = match.from;
      if (match.captures?.length) captures.push(...match.captures);
    }
  }
  if (!from) return null;
  const isCapture = captures.length > 0;
  const wasKing = Boolean(prev[from[0]]?.[from[1]]?.k);
  const isPromotion = Boolean(dest.k) && !wasKing;
  return {
    from,
    to,
    captures,
    player: (dest.p === 2 ? 2 : 1) as 1 | 2,
    isKing: Boolean(dest.k),
    isPromotion,
    progress: 0,
    isCapture,
    duration: moveDurationSeconds(from, to, isCapture),
    boardAfter: next,
  };
}

/** Visual travel progress 0→1 across the board (after pick/hold). */
function travelT(progress: number): number {
  if (progress < HOLD_PHASE_END) return 0;
  if (progress >= LAND_PHASE_START) return 1;
  return easeInOutCubic((progress - HOLD_PHASE_END) / (LAND_PHASE_START - HOLD_PHASE_END));
}

function flyScale(progress: number): number {
  if (progress < PICK_PHASE_END) {
    return 1 + easeInOutQuad(progress / PICK_PHASE_END) * 0.08;
  }
  if (progress < LAND_PHASE_START) return 1.08;
  return 1.08 - easeInOutQuad((progress - LAND_PHASE_START) / (1 - LAND_PHASE_START)) * 0.08;
}

function PieceDisc({
  player,
  isKing,
  className,
  style,
}: {
  player: 1 | 2;
  isKing: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  // Neo-pattern silhouette fills the square (not a stamped disc).
  return (
    <span
      className={cn(
        "relative z-[1] block h-[98%] w-[98%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]",
        className,
      )}
      style={style}
      aria-hidden
    >
      <PalacePieceMark player={player} isKing={isKing} className="inset-0" />
    </span>
  );
}

export default function DraughtsBoard2D({
  board,
  legalMoves,
  selected,
  onSelectSquare,
  interactive = true,
  mustContinue = null,
  flipBoard = false,
  moveHistory = [],
  yourPlayer = null,
  replayMode = false,
  illegalShakeKey = 0,
  onPlyAnimated,
  className,
}: DraughtsBoard2DProps) {
  const size = board.length;
  const [shake, setShake] = useState(false);
  const [renderBoard, setRenderBoard] = useState<BoardGrid>(board);
  const [flyProgress, setFlyProgress] = useState(0);
  const [activeFly, setActiveFly] = useState<ActiveAnimation | null>(null);

  const animationRef = useRef<ActiveAnimation | null>(null);
  const queueRef = useRef<ActiveAnimation[]>([]);
  const prevHistoryLen = useRef(moveHistory.length);
  const holdSyncRef = useRef(false);
  const legalHintRef = useRef(legalMoves);
  const onPlyAnimatedRef = useRef(onPlyAnimated);
  const replayModeRef = useRef(replayMode);
  const rafRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const historyPresent = moveHistory.length > 0;

  useEffect(() => {
    legalHintRef.current = legalMoves;
  }, [legalMoves]);

  useEffect(() => {
    onPlyAnimatedRef.current = onPlyAnimated;
  }, [onPlyAnimated]);

  useEffect(() => {
    replayModeRef.current = replayMode;
  }, [replayMode]);

  useEffect(() => {
    if (!illegalShakeKey) return;
    setShake(true);
    const t = window.setTimeout(() => setShake(false), 320);
    return () => window.clearTimeout(t);
  }, [illegalShakeKey]);

  const commitBoardAfter = useCallback((anim: ActiveAnimation) => {
    if (anim.boardApplied || !anim.boardAfter?.length) return;
    anim.boardApplied = true;
    setRenderBoard(anim.boardAfter);
    onPlyAnimatedRef.current?.(anim.boardAfter);
    // Put-down only - Chess.com move / capture / promote samples.
    if (!replayModeRef.current) {
      void playPieceLandSound(
        pieceLandKind({ isCapture: anim.isCapture, isPromotion: anim.isPromotion }),
      );
    }
  }, []);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      animationRef.current = null;
      setActiveFly(null);
      setFlyProgress(0);
      lastTsRef.current = null;
      return;
    }
    animationRef.current = next;
    setActiveFly(next);
    setFlyProgress(0);
    lastTsRef.current = null;
  }, []);

  const finishAndAdvance = useCallback(() => {
    const finished = animationRef.current;
    if (finished) commitBoardAfter(finished);
    startNext();
    if (!animationRef.current && queueRef.current.length === 0) {
      holdSyncRef.current = false;
    }
  }, [commitBoardAfter, startNext]);

  // rAF progress ticker (2D equivalent of R3F useFrame).
  useEffect(() => {
    const tick = (ts: number) => {
      const anim = animationRef.current;
      if (anim) {
        const prevTs = lastTsRef.current ?? ts;
        const delta = Math.min(0.05, (ts - prevTs) / 1000);
        lastTsRef.current = ts;
        const prev = anim.progress;
        anim.progress = Math.min(1, anim.progress + delta / anim.duration);
        if (prev < LAND_PHASE_START && anim.progress >= LAND_PHASE_START) {
          commitBoardAfter(anim);
        }
        setFlyProgress(anim.progress);
        if (anim.progress >= 1) {
          finishAndAdvance();
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [commitBoardAfter, finishAndAdvance]);

  useLayoutEffect(() => {
    if (!size) return;

    if (replayMode) {
      queueRef.current = [];
      animationRef.current = null;
      holdSyncRef.current = false;
      setActiveFly(null);
      setFlyProgress(0);
      setRenderBoard(board);
      return;
    }

    const len = moveHistory.length;
    if (len === 0) {
      prevHistoryLen.current = 0;
      if (!animationRef.current && queueRef.current.length === 0) {
        holdSyncRef.current = false;
        setRenderBoard(board);
      }
      return;
    }

    if (len < prevHistoryLen.current) {
      prevHistoryLen.current = len;
      queueRef.current = [];
      animationRef.current = null;
      holdSyncRef.current = false;
      setActiveFly(null);
      setFlyProgress(0);
      setRenderBoard(board);
      return;
    }

    if (len > prevHistoryLen.current) {
      const start = prevHistoryLen.current;
      const newEntries = moveHistory.slice(start);
      prevHistoryLen.current = len;
      holdSyncRef.current = true;
      for (let i = 0; i < newEntries.length; i++) {
        const entry = newEntries[i];
        if (!entry) continue;
        const prevBoard =
          i === 0
            ? start > 0
              ? moveHistory[start - 1]?.board_after
              : undefined
            : newEntries[i - 1]?.board_after;
        const anim = animationFromHistoryEntry(entry, yourPlayer, prevBoard);
        if (anim) queueRef.current.push(anim);
      }
      if (!animationRef.current) startNext();
    }
  }, [board, size, moveHistory, replayMode, yourPlayer, startNext]);

  useLayoutEffect(() => {
    if (!size || replayMode) return;
    if (holdSyncRef.current || animationRef.current || queueRef.current.length > 0) {
      return;
    }
    if (historyPresent) {
      const last = moveHistory.at(-1);
      const completed = last?.board_after;
      setRenderBoard((current) => {
        if (boardsEqual(current, board)) return current;
        if (completed && boardsEqual(current, completed) && !boardsEqual(board, completed)) {
          return current;
        }
        return board;
      });
      return;
    }
    setRenderBoard((current) => {
      if (boardsEqual(current, board)) return current;
      const anim = animationFromBoardDiff(current, board, legalHintRef.current);
      if (!anim) return board;
      holdSyncRef.current = true;
      queueRef.current.push(anim);
      if (!animationRef.current) startNext();
      return current;
    });
  }, [board, size, moveHistory, historyPresent, replayMode, startNext]);

  const legalTargets = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) {
      if (selected) {
        if (m.from[0] === selected[0] && m.from[1] === selected[1]) {
          set.add(`${m.to[0]},${m.to[1]}`);
        }
      }
    }
    return set;
  }, [legalMoves, selected]);

  /** Same as 3D `legalFromSquares` - used for square fill + under-piece ring. */
  const legalOrigins = useMemo(() => {
    const set = new Set<string>();
    if (selected) return set;
    for (const m of legalMoves) {
      set.add(`${m.from[0]},${m.from[1]}`);
    }
    return set;
  }, [legalMoves, selected]);

  const hiddenKeys = useMemo(() => {
    const anim = activeFly;
    if (!anim || flyProgress >= 1) return new Set<string>();
    const set = new Set<string>([`${anim.from[0]},${anim.from[1]}`, `${anim.to[0]},${anim.to[1]}`]);
    for (const c of anim.captures) set.add(`${c[0]},${c[1]}`);
    return set;
  }, [activeFly, flyProgress]);

  const [lastMoveToken, setLastMoveToken] = useState("");
  useEffect(() => {
    const sync = () => {
      setLastMoveToken(
        getComputedStyle(document.documentElement).getPropertyValue("--dama-last-move").trim(),
      );
    };
    sync();
    window.addEventListener("dama-board-palette", sync);
    return () => window.removeEventListener("dama-board-palette", sync);
  }, []);

  const lastMoveKeys = useMemo(() => {
    // Fail-closed: same gate as DraughtsScene3D - no invent highlight without theme token.
    if (!lastMoveToken || replayMode || activeFly || moveHistory.length === 0) return null;
    const last = moveHistory.at(-1);
    if (!last?.from || !last?.to) return null;
    return {
      from: `${last.from[0]},${last.from[1]}`,
      to: `${last.to[0]},${last.to[1]}`,
    };
  }, [activeFly, lastMoveToken, moveHistory, replayMode]);

  const flyStyle = useMemo(() => {
    if (!activeFly || size <= 0) return null;
    const t = travelT(flyProgress);
    const scale = flyScale(flyProgress);
    const fromR = flipBoard ? size - 1 - activeFly.from[0] : activeFly.from[0];
    const fromC = flipBoard ? size - 1 - activeFly.from[1] : activeFly.from[1];
    const toR = flipBoard ? size - 1 - activeFly.to[0] : activeFly.to[0];
    const toC = flipBoard ? size - 1 - activeFly.to[1] : activeFly.to[1];
    const vr = fromR + (toR - fromR) * t;
    const vc = fromC + (toC - fromC) * t;
    const cell = 100 / size;
    return {
      left: `${vc * cell + cell / 2}%`,
      top: `${vr * cell + cell / 2}%`,
      width: `${cell * 0.78}%`,
      height: `${cell * 0.78}%`,
      transform: `translate(-50%, -50%) scale(${scale})`,
    } as const;
  }, [activeFly, flipBoard, flyProgress, size]);

  if (size <= 0) return null;

  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const row = flipBoard ? size - 1 - r : r;
      const col = flipBoard ? size - 1 - c : c;
      cells.push({ row, col });
    }
  }

  const display = renderBoard.length ? renderBoard : board;

  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden",
        shake && "animate-pulse",
        className,
      )}
      // biome-ignore lint/a11y/useSemanticElements: interactive board uses grid ARIA on div layout
      role="grid"
      aria-rowcount={size}
      aria-colcount={size}
    >
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {cells.map(({ row, col }) => {
          const cell = display[row]?.[col] ?? null;
          const dark = isDark(row, col);
          const key = `${row},${col}`;
          const isSelected = selected?.[0] === row && selected?.[1] === col;
          const isMust = mustContinue?.[0] === row && mustContinue?.[1] === col;
          const isLegalTarget = legalTargets.has(key);
          const isLastFrom = lastMoveKeys?.from === key;
          const isLastTo = lastMoveKeys?.to === key;
          const isLastMove = isLastFrom || isLastTo;
          // Select / dest / must / movable-from use brand highlight; last ply uses Chess yellow.
          const squareHighlighted =
            isSelected || isLegalTarget || isMust || (!selected && legalOrigins.has(key));
          const hidePiece = hiddenKeys.has(key);
          const canClick = Boolean(interactive && dark && !activeFly);

          return (
            <button
              key={key}
              type="button"
              // biome-ignore lint/a11y/useSemanticElements: square buttons act as grid cells
              role="gridcell"
              aria-selected={isSelected || undefined}
              disabled={!canClick}
              className={cn(
                // Explicit square cells - never inherit global button radius.
                "relative flex items-center justify-center rounded-none",
                squareHighlighted
                  ? "bg-[var(--dama-board-highlight)]"
                  : isLastMove
                    ? "bg-[var(--dama-last-move)]"
                    : dark
                      ? "bg-[var(--dama-board-dark)]"
                      : "bg-[var(--dama-board-light)]",
                canClick && "cursor-pointer",
                !canClick && "cursor-default",
              )}
              onClick={() => {
                if (!canClick) return;
                onSelectSquare(row, col);
              }}
            >
              <BoardSquareCoords
                row={row}
                col={col}
                boardSize={size}
                flipBoard={flipBoard}
                isDark={dark}
              />
              {/* 3D destination disc; lighten so it reads on the same highlight fill. */}
              {isLegalTarget ? (
                <span
                  className="absolute inset-[28%] z-[1] rounded-full opacity-95 shadow-[0_0_12px_var(--dama-board-highlight)]"
                  style={{
                    background: "color-mix(in srgb, var(--dama-board-highlight) 55%, white)",
                  }}
                  aria-hidden
                />
              ) : null}
              {cell && !hidePiece ? (
                <span className="relative z-[2] flex h-[78%] w-[78%] items-center justify-center">
                  {/* Square fill is the movable cue (same as 3D) - no under-piece ring. */}
                  <PieceDisc
                    player={(cell.p === 2 ? 2 : 1) as 1 | 2}
                    isKing={Boolean(cell.k)}
                    className={cn(
                      "h-full w-full transition-transform",
                      (isSelected || isMust) &&
                        "scale-110 shadow-[0_0_12px_2px_var(--dama-board-highlight)]",
                    )}
                  />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeFly && flyStyle ? (
        <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
          <div className="absolute flex items-center justify-center" style={flyStyle}>
            <PieceDisc
              player={activeFly.player}
              isKing={activeFly.isKing}
              className="h-full w-full shadow-lg"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
