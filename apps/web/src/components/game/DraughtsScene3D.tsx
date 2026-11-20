"use client";

/**
 * 3D draughts board - visual/interaction mirror of smart-menu DraughtsScene3D.
 * Square/piece colors come from CSS board + piece palettes (`--dama-board-*` / `--dama-piece-*`).
 */

import { BoardAreaSkeleton } from "@/components/ui/BoardColumnSkeleton";
import { useDraughtsPerformanceTier } from "@/hooks/useDraughtsPerformanceTier";
import { pieceLandKind, playPieceLandSound } from "@/lib/audio-notify";
import {
  boardCoordUsesLightInk,
  boardFileLetter,
  boardRankNumber,
  isVisualBottomRank,
  isVisualLeftFile,
} from "@/lib/board-square";
import { palacePieceRole } from "@/lib/palace-piece";
import type { BoardCell, LegalMove, MoveHistoryEntry } from "@/types/game";
import { OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const PIECE_REST_Y = 0.12;
const PICK_HEIGHT = 0.5;
const CAPTURE_PICK_HEIGHT = 0.52;
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

/** Fallbacks = Forest + White & black (product defaults). */
const SQ_LIGHT = "#eeeed2";
const SQ_DARK = "#769656";
const SQ_FRAME = "#4a6741";
/** Fallback only - live cues use `--dama-board-highlight` (same as 2D). */
const HIGHLIGHT = "#baca44";
const PIECE_P1 = "#ffffff";
const PIECE_P2 = "#141414";
const PIECE_P1_EMISSIVE = "#a1a1aa";
const PIECE_P2_EMISSIVE = "#3f3f46";
/** Fallback court metals - live values come from palette CSS vars. */
const KING_ACCENT = "#c9a227";
const QUEEN_ACCENT = "#b76e79";
const HEIR_ACCENT = "#9ca3af";

type CssBoardColors = {
  light: string;
  dark: string;
  frame: string;
  highlight: string;
  /** Chess.com-style yellow last-ply squares (`--dama-last-move`). */
  lastMove: string;
  pieceLight: string;
  pieceDark: string;
  /** When true, dark-side pieces use light|dark hemispheres (White & half). */
  pieceDarkSplit: boolean;
  pieceMark: string;
  pieceKing: string;
  pieceQueen: string;
  pieceHeir: string;
};

function readCssBoardColors(): CssBoardColors {
  if (typeof document === "undefined") {
    return {
      light: SQ_LIGHT,
      dark: SQ_DARK,
      frame: SQ_FRAME,
      highlight: HIGHLIGHT,
      lastMove: "",
      pieceLight: PIECE_P1,
      pieceDark: PIECE_P2,
      pieceDarkSplit: true,
      pieceMark: "#A31D38",
      pieceKing: KING_ACCENT,
      pieceQueen: QUEEN_ACCENT,
      pieceHeir: HEIR_ACCENT,
    };
  }
  const s = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => {
    const v = s.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    light: pick("--dama-board-light", SQ_LIGHT),
    dark: pick("--dama-board-dark", SQ_DARK),
    frame: pick("--dama-board-frame", SQ_FRAME),
    highlight: pick("--dama-board-highlight", HIGHLIGHT),
    // Theme token only - no invented Chess yellow hex.
    lastMove: s.getPropertyValue("--dama-last-move").trim(),
    pieceLight: pick("--dama-piece-light", PIECE_P1),
    pieceDark: pick("--dama-piece-dark", PIECE_P2),
    pieceDarkSplit: s.getPropertyValue("--dama-piece-dark-split").trim() === "1",
    pieceMark: pick("--dama-piece-mark", "#A31D38"),
    pieceKing: pick("--dama-piece-king", KING_ACCENT),
    pieceQueen: pick("--dama-piece-queen", QUEEN_ACCENT),
    pieceHeir: pick("--dama-piece-heir", HEIR_ACCENT),
  };
}

function useCssBoardColors(): CssBoardColors {
  const [colors, setColors] = useState(readCssBoardColors);
  useEffect(() => {
    const sync = () => setColors(readCssBoardColors());
    sync();
    window.addEventListener("dama-board-palette", sync);
    return () => window.removeEventListener("dama-board-palette", sync);
  }, []);
  return colors;
}

/** Mix highlight toward white (2D `color-mix(... 55%, white)` / Flutter Color.lerp 0.45). */
function lightenBoardHighlight(hex: string, towardWhite: number): string {
  const raw = hex.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(raw);
  const hexBody = m?.[1];
  if (!hexBody) return hex;
  const n = Number.parseInt(hexBody, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const t = Math.min(1, Math.max(0, towardWhite));
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const to = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

type BoardGrid = BoardCell[][];

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

type AnimationMask = Pick<ActiveAnimation, "from" | "to" | "captures">;

function isDarkSquare(row: number, col: number) {
  return (row + col) % 2 === 1;
}

function boardToWorld(row: number, col: number, size: number) {
  return {
    x: col - size / 2 + 0.5,
    z: row - size / 2 + 0.5,
  };
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
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
  opts?: { opponentMove?: boolean; fast?: boolean },
): number {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const opponentFast = Boolean(opts?.opponentMove);
  const ownFast = Boolean(opts?.fast);
  const base = isCapture
    ? opponentFast
      ? OPPONENT_CAPTURE_DURATION_MIN
      : ownFast
        ? OPPONENT_CAPTURE_DURATION_MIN
        : CAPTURE_DURATION_MIN
    : opponentFast
      ? OPPONENT_MOVE_DURATION_MIN
      : ownFast
        ? OPPONENT_MOVE_DURATION_MIN
        : MOVE_DURATION_MIN;
  const perSq = opponentFast || ownFast ? OPPONENT_DURATION_PER_SQUARE : DURATION_PER_SQUARE;
  const max = opponentFast || ownFast ? OPPONENT_MOVE_DURATION_MAX : MOVE_DURATION_MAX;
  return Math.min(max, base + dist * perSq);
}

function computePieceTransform(
  progress: number,
  from: { x: number; z: number },
  to: { x: number; z: number },
  isCapture: boolean,
) {
  const carryHeight = isCapture ? CAPTURE_PICK_HEIGHT : PICK_HEIGHT;
  if (progress < PICK_PHASE_END) {
    const t = easeInOutQuad(progress / PICK_PHASE_END);
    return {
      x: from.x,
      z: from.z,
      y: PIECE_REST_Y + t * (carryHeight - PIECE_REST_Y),
      scale: 1 + t * 0.035,
    };
  }
  if (progress < HOLD_PHASE_END) {
    return { x: from.x, z: from.z, y: carryHeight, scale: 1.035 };
  }
  if (progress < LAND_PHASE_START) {
    const t = easeInOutCubic((progress - HOLD_PHASE_END) / (LAND_PHASE_START - HOLD_PHASE_END));
    return {
      x: from.x + (to.x - from.x) * t,
      z: from.z + (to.z - from.z) * t,
      y: carryHeight,
      scale: 1.035,
    };
  }
  const t = easeInOutQuad((progress - LAND_PHASE_START) / (1 - LAND_PHASE_START));
  return {
    x: to.x,
    z: to.z,
    y: carryHeight - t * (carryHeight - PIECE_REST_Y),
    scale: 1.035 - t * 0.035,
  };
}

function interactiveProps(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onActivate();
    },
    onKeyDown: (event: {
      key: string;
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
      }
    },
  };
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

/** Fallback when API has not yet shipped move_history (or board_after). */
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

/** Half-revolution cylinder (left or right) for Neo hard shade. */
function ShadeCyl({
  args,
  mat,
}: {
  args: [number, number, number, number, number, boolean, number, number];
  mat: {
    color: string;
    emissive: string;
    emissiveIntensity: number;
    metalness: number;
    roughness: number;
  };
}) {
  return (
    <mesh>
      <cylinderGeometry args={args} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function PieceMesh({
  player,
  isKing,
  selected,
  movable,
  y = PIECE_REST_Y,
  scale = 1,
}: {
  player: 1 | 2;
  isKing: boolean;
  selected?: boolean;
  /** Quiet-turn cue: this piece has at least one legal move. */
  movable?: boolean;
  y?: number;
  scale?: number;
}) {
  const colors = useCssBoardColors();
  const role = palacePieceRole(player, isKing);
  const crowned = role === "king";
  const ringColor = player === 1 ? PIECE_P1_EMISSIVE : PIECE_P2_EMISSIVE;
  // White & half: dark seat uses light|dark hemispheres (same 50/50 as 2D).
  const splitDark = player === 2 && colors.pieceDarkSplit;
  const bodyColor = player === 1 ? colors.pieceLight : colors.pieceDark;
  const shadeColor = splitDark
    ? colors.pieceLight
    : player === 1
      ? mixHexRough(colors.pieceLight, "#8A8A8A", 0.55)
      : mixHexRough(colors.pieceDark, "#0A0A0A", 0.4);
  const leftColor = splitDark ? colors.pieceLight : bodyColor;
  const rightColor = splitDark ? colors.pieceDark : shadeColor;
  const selectAccent = colors.pieceKing;
  const emissive = selected ? selectAccent : movable ? colors.highlight : ringColor;
  const emissiveIntensity = selected ? 0.4 : movable ? 0.4 : 0.05;
  const matL = {
    color: leftColor,
    emissive,
    emissiveIntensity,
    metalness: 0.1,
    roughness: 0.46,
  } as const;
  const matR = {
    color: rightColor,
    emissive,
    emissiveIntensity: emissiveIntensity * 0.65,
    metalness: 0.1,
    roughness: 0.52,
  } as const;
  const segs = 32;
  // Neo physical Staunton: flared base → stem → collar → head (+ cross for king).
  const baseH = 0.09;
  const stemH = crowned ? 0.32 : 0.22;
  const stemTopR = crowned ? 0.1 : 0.115;
  const stemBotR = 0.2;
  const stemY = baseH / 2 + stemH / 2;
  const collarY = baseH / 2 + stemH + 0.035;
  const headR = crowned ? 0.135 : 0.125;
  const headY = collarY + 0.085 + headR * 0.5;
  return (
    <group position={[0, y, 0]} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>

      {/* Flared pedestal */}
      <group position={[0, baseH / 2, 0]}>
        <ShadeCyl args={[0.25, 0.32, baseH, segs, 1, false, 0, Math.PI]} mat={matL} />
        <ShadeCyl args={[0.25, 0.32, baseH, segs, 1, false, Math.PI, Math.PI]} mat={matR} />
      </group>

      {/* Tapered stem */}
      <group position={[0, stemY, 0]}>
        <ShadeCyl args={[stemTopR, stemBotR, stemH, segs, 1, false, 0, Math.PI]} mat={matL} />
        <ShadeCyl args={[stemTopR, stemBotR, stemH, segs, 1, false, Math.PI, Math.PI]} mat={matR} />
      </group>

      {/* Collar disc (horizontal ring under the head) */}
      <group position={[0, collarY, 0]}>
        <ShadeCyl args={[0.17, 0.17, 0.055, segs, 1, false, 0, Math.PI]} mat={matL} />
        <ShadeCyl args={[0.17, 0.17, 0.055, segs, 1, false, Math.PI, Math.PI]} mat={matR} />
      </group>

      {/* Head */}
      <group position={[0, headY, 0]}>
        <mesh>
          <sphereGeometry args={[headR, 24, 18, 0, Math.PI]} />
          <meshStandardMaterial {...matL} />
        </mesh>
        <mesh>
          <sphereGeometry args={[headR, 24, 18, Math.PI, Math.PI]} />
          <meshStandardMaterial {...matR} />
        </mesh>
      </group>

      {crowned ? (
        <>
          {/* Crown bowl under the cross */}
          <group position={[0, headY + headR * 0.62, 0]}>
            <ShadeCyl args={[0.1, 0.155, 0.075, segs, 1, false, 0, Math.PI]} mat={matL} />
            <ShadeCyl args={[0.1, 0.155, 0.075, segs, 1, false, Math.PI, Math.PI]} mat={matR} />
          </group>
          {/* Neo king cross */}
          <group position={[0, headY + headR + 0.13, 0]}>
            <mesh>
              <boxGeometry args={[0.034, 0.15, 0.034]} />
              <meshStandardMaterial {...matL} />
            </mesh>
            <mesh position={[0, 0.025, 0]}>
              <boxGeometry args={[0.11, 0.034, 0.034]} />
              <meshStandardMaterial {...matL} />
            </mesh>
            <mesh position={[0.045, 0.025, 0]}>
              <boxGeometry args={[0.03, 0.034, 0.034]} />
              <meshStandardMaterial {...matR} />
            </mesh>
          </group>
        </>
      ) : null}
    </group>
  );
}

function mixHexRough(hex: string, toward: string, t: number): string {
  const parse = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m?.[1]) return null;
    const n = Number.parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const a = parse(hex);
  const b = parse(toward);
  if (!a || !b) return hex;
  const k = Math.min(1, Math.max(0, t));
  const mix = (x: number, y: number) => Math.round(x + (y - x) * k);
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(mix(a.r, b.r))}${to(mix(a.g, b.g))}${to(mix(a.b, b.b))}`;
}

function SquareMesh({
  row,
  col,
  size,
  flipBoard,
  highlightKind,
  onSelect,
}: {
  row: number;
  col: number;
  size: number;
  flipBoard: boolean;
  /** select = brand cue; lastMove = Chess yellow; none = square palette. */
  highlightKind: "none" | "select" | "lastMove";
  onSelect: () => void;
}) {
  const colors = useCssBoardColors();
  const { x, z } = boardToWorld(row, col, size);
  const dark = isDarkSquare(row, col);
  const playable = dark;
  const fill =
    highlightKind === "select"
      ? colors.highlight
      : highlightKind === "lastMove"
        ? colors.lastMove
        : dark
          ? colors.dark
          : colors.light;
  const emissive = highlightKind === "none" ? (dark ? colors.frame : colors.light) : fill;
  const showRank = isVisualLeftFile(col, size, flipBoard);
  const showFile = isVisualBottomRank(row, size, flipBoard);
  // After group Y=π flip, local NW becomes SE on screen - invert corner offsets.
  const corner = flipBoard ? 0.38 : -0.38;
  const fileCorner = flipBoard ? -0.38 : 0.38;
  const ink = boardCoordUsesLightInk(dark) ? colors.light : colors.dark;
  const fontSize = size >= 10 ? 0.2 : 0.24;
  const textRotY = flipBoard ? Math.PI : 0;
  return (
    <group>
      <mesh
        position={[x, playable ? 0.004 : 0.002, z]}
        rotation={[-Math.PI / 2, 0, 0]}
        {...(playable ? interactiveProps(onSelect) : {})}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={fill}
          // Keep highlight flat like 2D CSS fills - strong emissive shifts the hue.
          emissive={emissive}
          emissiveIntensity={highlightKind !== "none" ? 0.08 : dark ? 0.04 : 0.02}
          roughness={highlightKind !== "none" ? 0.92 : 0.78}
          metalness={0}
        />
      </mesh>
      {showRank ? (
        <Text
          position={[x + corner, 0.02, z + corner]}
          rotation={[-Math.PI / 2, textRotY, 0]}
          fontSize={fontSize}
          color={ink}
          anchorX={flipBoard ? "right" : "left"}
          anchorY={flipBoard ? "bottom" : "top"}
          renderOrder={2}
        >
          {String(boardRankNumber(row, size))}
        </Text>
      ) : null}
      {showFile ? (
        <Text
          position={[x + fileCorner, 0.02, z + fileCorner]}
          rotation={[-Math.PI / 2, textRotY, 0]}
          fontSize={fontSize}
          color={ink}
          anchorX={flipBoard ? "left" : "right"}
          anchorY={flipBoard ? "top" : "bottom"}
          renderOrder={2}
        >
          {boardFileLetter(col)}
        </Text>
      ) : null}
    </group>
  );
}

function StaticPiece({
  row,
  col,
  size,
  player,
  isKing,
  selected,
  hidden,
  onSelect,
}: {
  row: number;
  col: number;
  size: number;
  player: 1 | 2;
  isKing: boolean;
  selected: boolean;
  hidden: boolean;
  onSelect: () => void;
}) {
  if (hidden) return null;
  const { x, z } = boardToWorld(row, col, size);
  // Match 2D: square fill is the only movable cue - no under-piece ring / glow.
  const liftY = selected ? 0.12 : 0;
  return (
    <group position={[x, PIECE_REST_Y + liftY, z]} {...interactiveProps(onSelect)}>
      <PieceMesh player={player} isKing={isKing} selected={selected} movable={false} y={0} />
    </group>
  );
}

function AnimatedOverlay({
  animation,
  size,
}: {
  animation: ActiveAnimation;
  size: number;
}) {
  const groupRef = useRef<Group>(null);
  useFrame(() => {
    const from = boardToWorld(animation.from[0], animation.from[1], size);
    const to = boardToWorld(animation.to[0], animation.to[1], size);
    const transform = computePieceTransform(animation.progress, from, to, animation.isCapture);
    if (groupRef.current) {
      groupRef.current.position.set(transform.x, transform.y, transform.z);
      groupRef.current.rotation.y = 0;
      groupRef.current.scale.setScalar(transform.scale);
    }
  });
  return (
    <group ref={groupRef}>
      <PieceMesh player={animation.player} isKing={animation.isKing} y={0} />
    </group>
  );
}

function CaptureBursts({
  animationRef,
  size,
}: {
  animationRef: React.RefObject<ActiveAnimation | null>;
  size: number;
}) {
  const groupRef = useRef<Group>(null);
  useFrame(() => {
    const animation = animationRef.current;
    if (!groupRef.current || !animation) return;
    const travelStart = HOLD_PHASE_END;
    const travelSpan = LAND_PHASE_START - HOLD_PHASE_END;
    const captureProgress =
      animation.progress <= travelStart
        ? 0
        : Math.min(1, (animation.progress - travelStart) / travelSpan);
    groupRef.current.children.forEach((child, index) => {
      const cap = animation.captures[index];
      if (!cap) return;
      const { x, z } = boardToWorld(cap[0], cap[1], size);
      const t = easeOutCubic(captureProgress);
      child.position.set(x, PIECE_REST_Y + t * 0.35, z);
      child.scale.setScalar(Math.max(0.01, 1 - t * 0.9));
    });
  });
  const animation = animationRef.current;
  if (!animation?.captures.length) return null;
  return (
    <group ref={groupRef}>
      {animation.captures.map(([r, c]) => (
        <mesh key={`${r}-${c}`}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color={KING_ACCENT} emissive={HIGHLIGHT} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

type Props = {
  board: BoardCell[][];
  legalMoves: LegalMove[];
  selected: [number, number] | null;
  onSelectSquare: (row: number, col: number) => void;
  interactive: boolean;
  /** When true, board faces player 2 (smart-menu flip). */
  flipBoard?: boolean;
  /** Forced multi-jump square from game.must_continue. */
  mustContinue?: [number, number] | null;
  /** Server move history (drives pick/hold/travel/land queue when present). */
  moveHistory?: MoveHistoryEntry[];
  /** Seat for duration + input-block rules (1/2). AI practice defaults to 1. */
  yourPlayer?: number | null;
  /** Scrubbing history: freeze animation and show static board. */
  replayMode?: boolean;
  /** Called when a ply animation lands on board_after. */
  onPlyAnimated?: (boardAfter: BoardGrid) => void;
  /**
   * Increment to trigger a short horizontal reject shake (illegal destination).
   * Captures must NOT shake/tilt the board.
   */
  illegalShakeKey?: number;
};

function animationFromHistoryEntry(
  entry: MoveHistoryEntry,
  yourPlayer: number | null | undefined,
  performanceTier: "high" | "low",
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
    duration: moveDurationSeconds(from, to, isCapture, {
      opponentMove,
      fast: performanceTier === "low" && !opponentMove,
    }),
    boardAfter: entry.board_after,
  };
}

function BoardScene({
  board,
  legalMoves,
  selected,
  onSelectSquare,
  interactive,
  flipBoard,
  mustContinue,
  moveHistory = [],
  yourPlayer = null,
  replayMode = false,
  onPlyAnimated,
  performanceTier,
}: Props & { performanceTier: "high" | "low" }) {
  const size = board.length > 0 ? board.length : 0;
  const [renderBoard, setRenderBoard] = useState<BoardGrid>(board);
  const animationRef = useRef<ActiveAnimation | null>(null);
  const queueRef = useRef<ActiveAnimation[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animMask, setAnimMask] = useState<AnimationMask | null>(null);
  /** Seed to current length so resume / 2D↔3D toggle does not replay all plies. */
  const prevHistoryLen = useRef(moveHistory.length);
  const holdSyncRef = useRef(false);
  const legalHintRef = useRef(legalMoves);
  const onPlyAnimatedRef = useRef(onPlyAnimated);
  const replayModeRef = useRef(replayMode);
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
      setAnimMask(null);
      setIsAnimating(false);
      return;
    }
    animationRef.current = next;
    setAnimMask({ from: next.from, to: next.to, captures: next.captures });
    setIsAnimating(true);
  }, []);

  const finishAndAdvance = useCallback(() => {
    const finished = animationRef.current;
    if (finished) commitBoardAfter(finished);
    startNext();
    if (!animationRef.current && queueRef.current.length === 0) {
      holdSyncRef.current = false;
    }
  }, [commitBoardAfter, startNext]);

  useLayoutEffect(() => {
    if (!size) return;

    if (replayMode) {
      queueRef.current = [];
      animationRef.current = null;
      holdSyncRef.current = false;
      setAnimMask(null);
      setIsAnimating(false);
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
      setAnimMask(null);
      setIsAnimating(false);
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
        const anim = animationFromHistoryEntry(entry, yourPlayer, performanceTier, prevBoard);
        if (anim) queueRef.current.push(anim);
      }
      if (!animationRef.current) startNext();
      return;
    }
  }, [board, size, moveHistory, replayMode, yourPlayer, performanceTier, startNext]);

  useLayoutEffect(() => {
    if (!size || replayMode) return;
    if (holdSyncRef.current || isAnimating || animationRef.current || queueRef.current.length > 0) {
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
    // No history yet: infer a single ply from board diffs (legacy API).
    setRenderBoard((current) => {
      if (boardsEqual(current, board)) return current;
      const anim = animationFromBoardDiff(current, board, legalHintRef.current);
      if (!anim) return board;
      holdSyncRef.current = true;
      queueRef.current.push(anim);
      if (!animationRef.current) startNext();
      return current;
    });
  }, [board, size, moveHistory, historyPresent, isAnimating, replayMode, startNext]);

  useFrame((_, delta) => {
    const animation = animationRef.current;
    if (animation) {
      const prev = animation.progress;
      animation.progress = Math.min(1, animation.progress + delta / animation.duration);
      // Commit captures/board the moment the piece starts putting down - not after a long settle.
      if (prev < LAND_PHASE_START && animation.progress >= LAND_PHASE_START) {
        commitBoardAfter(animation);
      }
      if (animation.progress >= 1) {
        finishAndAdvance();
      }
    }
  });

  const forcedSquare = mustContinue ? `${mustContinue[0]}:${mustContinue[1]}` : null;
  /** All pieces that can move this turn (quiet + capture) - fastest play cue. */
  const legalFromSquares = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) set.add(`${m.from[0]}:${m.from[1]}`);
    return set;
  }, [legalMoves]);
  const destinationHighlights = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    for (const m of legalMoves) {
      if (m.from[0] === selected[0] && m.from[1] === selected[1]) {
        set.add(`${m.to[0]}:${m.to[1]}`);
      }
    }
    return set;
  }, [legalMoves, selected]);

  /** Last completed ply from/to (Chess.com-style), when not animating/scrubbing. */
  const lastMoveSquares = useMemo(() => {
    const set = new Set<string>();
    if (replayMode || animMask || moveHistory.length === 0) return set;
    const last = moveHistory.at(-1);
    if (!last?.from || !last?.to) return set;
    set.add(`${last.from[0]}:${last.from[1]}`);
    set.add(`${last.to[0]}:${last.to[1]}`);
    return set;
  }, [animMask, moveHistory, replayMode]);

  const hiddenKeys = useMemo(() => {
    const set = new Set<string>();
    if (!animMask) return set;
    set.add(`${animMask.from[0]}:${animMask.from[1]}`);
    set.add(`${animMask.to[0]}:${animMask.to[1]}`);
    for (const [r, c] of animMask.captures) set.add(`${r}:${c}`);
    return set;
  }, [animMask]);

  // Gate own input only while the piece is still in the air - once put-down
  // starts (board committed), multi-jump / next turn can proceed immediately.
  const blockInputForAnimation =
    isAnimating &&
    animationRef.current != null &&
    yourPlayer != null &&
    animationRef.current.player === yourPlayer &&
    animationRef.current.progress < LAND_PHASE_START;

  const onSquare = useCallback(
    (row: number, col: number) => {
      if (!interactive || blockInputForAnimation) return;
      onSelectSquare(row, col);
    },
    [interactive, blockInputForAnimation, onSelectSquare],
  );

  if (size <= 0) return null;

  const display = renderBoard.length ? renderBoard : board;

  const colors = useCssBoardColors();

  // Board group is rigid - never translate/rotate for captures (that looked like a push-down).
  return (
    <group rotation={flipBoard ? [0, Math.PI, 0] : [0, 0, 0]}>
      <mesh position={[0, -0.21, 0]} receiveShadow>
        <boxGeometry args={[size + 0.4, 0.42, size + 0.4]} />
        <meshStandardMaterial color={colors.frame} roughness={0.82} metalness={0.04} />
      </mesh>
      {Array.from({ length: size * size }, (_, i) => {
        const row = Math.floor(i / size);
        const col = i % size;
        const key = `${row}:${col}`;
        const selectedKey = selected != null ? `${selected[0]}:${selected[1]}` : null;
        const isSelectCue =
          selectedKey === key ||
          destinationHighlights.has(key) ||
          forcedSquare === key ||
          (!selected && legalFromSquares.has(key));
        const highlightKind: "none" | "select" | "lastMove" = isSelectCue
          ? "select"
          : lastMoveSquares.has(key) && Boolean(colors.lastMove)
            ? "lastMove"
            : "none";
        return (
          <SquareMesh
            key={`sq-${row}-${col}`}
            row={row}
            col={col}
            size={size}
            flipBoard={Boolean(flipBoard)}
            highlightKind={highlightKind}
            onSelect={() => onSquare(row, col)}
          />
        );
      })}
      {display.flatMap((rowCells, row) =>
        rowCells.flatMap((cell, col) => {
          if (!cell) return [];
          const player = (cell.p === 2 ? 2 : 1) as 1 | 2;
          const key = `${row}:${col}`;
          return [
            <StaticPiece
              key={`pc-${key}`}
              row={row}
              col={col}
              size={size}
              player={player}
              isKing={Boolean(cell.k)}
              selected={!!selected && selected[0] === row && selected[1] === col}
              hidden={hiddenKeys.has(key)}
              onSelect={() => onSquare(row, col)}
            />,
          ];
        }),
      )}
      {Array.from(destinationHighlights).map((key) => {
        const [rs, cs] = key.split(":");
        const row = Number(rs);
        const col = Number(cs);
        if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
        const { x, z } = boardToWorld(row, col, size);
        // Match 2D: lighten highlight toward white so the ghost reads on the green square.
        const disc = lightenBoardHighlight(colors.highlight, 0.45);
        return (
          <mesh
            key={`to-${key}`}
            position={[x, 0.06, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            {...interactiveProps(() => onSquare(row, col))}
          >
            <circleGeometry args={[0.22, 28]} />
            <meshStandardMaterial
              color={disc}
              emissive={disc}
              emissiveIntensity={0.18}
              transparent
              opacity={0.95}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
        );
      })}
      {isAnimating && animationRef.current ? (
        <>
          <AnimatedOverlay animation={animationRef.current} size={size} />
          <CaptureBursts animationRef={animationRef} size={size} />
        </>
      ) : null}
    </group>
  );
}

export default function DraughtsScene3D(props: Props) {
  const size = props.board.length > 0 ? props.board.length : 0;
  const performanceTier = useDraughtsPerformanceTier();
  const [rejectShake, setRejectShake] = useState(false);
  /** Size whose first WebGL frame has painted; mismatch keeps shimmer covering the canvas. */
  const [paintedSize, setPaintedSize] = useState<number | null>(null);
  const glReady = paintedSize === size && size > 0;
  const prevIllegalKey = useRef(0);

  useEffect(() => {
    const key = props.illegalShakeKey ?? 0;
    if (!key || key === prevIllegalKey.current) return;
    prevIllegalKey.current = key;
    setRejectShake(true);
    const id = window.setTimeout(() => setRejectShake(false), 420);
    return () => window.clearTimeout(id);
  }, [props.illegalShakeKey]);

  if (size <= 0) {
    return <BoardAreaSkeleton />;
  }

  return (
    <div
      className={`relative aspect-square w-full bg-transparent${rejectShake ? " dama-board-reject" : ""}`}
      style={{ touchAction: "none" }}
    >
      {!glReady ? (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <BoardAreaSkeleton />
        </div>
      ) : null}
      <Canvas
        key={size}
        // Pulled-back default framing (more margin around the board than the prior 12.8/9.2 @ fov 37).
        camera={{ position: [0, 15.1, 10.85], fov: 38 }}
        dpr={performanceTier === "low" ? 1 : [1, 2]}
        gl={{ alpha: true }}
        style={{ background: "transparent" }}
        onCreated={() => {
          const forSize = size;
          // Double rAF: first frame scheduled, second after paint.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setPaintedSize(forSize));
          });
        }}
      >
        <ambientLight intensity={1.05} />
        <directionalLight position={[6, 14, 4]} intensity={1.35} />
        <directionalLight position={[-4, 12, -6]} intensity={0.55} />
        <BoardScene {...props} performanceTier={performanceTier} />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableRotate
          enableZoom
          enableDamping={false}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={7}
          maxDistance={32}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
