"use client";

import { palaceAccentsFromPair } from "@/lib/palace-piece";
import { useCallback, useEffect, useState } from "react";

export type BoardPaletteId = "black_white" | "classic" | "burgundy" | "forest" | "slate";
export type PiecePaletteId =
  | "white_half"
  | "white_green"
  | "white_black"
  | "ivory_burgundy"
  | "pearl_onyx"
  | "honey_walnut"
  | "mist_ocean"
  | "blush_espresso";

export type BoardPalette = {
  id: BoardPaletteId;
  label: string;
  boardLight: string;
  boardDark: string;
  boardFrame: string;
  highlight: string;
};

export type PiecePalette = {
  id: PiecePaletteId;
  label: string;
  /** Seat name for light pieces (guest lobby chrome). */
  lightName: string;
  /** Seat name for dark pieces (guest lobby chrome). */
  darkName: string;
  pieceLight: string;
  pieceDark: string;
  /**
   * When true, dark-side pieces render Chess.com-style 50/50 split
   * (pieceLight | pieceDark). Product default for White & half.
   */
  darkSplit?: boolean;
};

/**
 * Guest seat titles: palette color names (same Neo shapes both seats).
 */
export function pieceSeatNames(palette: PiecePalette): { light: string; dark: string } {
  return {
    light: palette.lightName,
    dark: palette.darkName,
  };
}

/** Board square themes only - pieces are selected separately. */
export const BOARD_PALETTES: BoardPalette[] = [
  {
    id: "forest",
    label: "Forest",
    boardLight: "#eeeed2",
    boardDark: "#769656",
    boardFrame: "#4a6741",
    highlight: "#baca44",
  },
  {
    id: "classic",
    label: "Classic wood",
    boardLight: "#e8dcc8",
    boardDark: "#7c4a23",
    boardFrame: "#5c4a32",
    highlight: "#22c55e",
  },
  {
    id: "black_white",
    label: "Black & white",
    boardLight: "#F5F5F5",
    boardDark: "#2C2C2C",
    boardFrame: "#1A1A1A",
    highlight: "#6B7280",
  },
  {
    id: "burgundy",
    label: "Burgundy",
    boardLight: "#f7eef1",
    boardDark: "#9B1B3A",
    boardFrame: "#4A0012",
    highlight: "#C0264A",
  },
  {
    id: "slate",
    label: "Slate",
    boardLight: "#d8dce3",
    boardDark: "#4a5568",
    boardFrame: "#2d3748",
    highlight: "#A31D38",
  },
];

/** Flat piece pairs. `darkSplit` paints dark-side Neo bodies 50/50 light|dark. */
export const PIECE_PALETTES: PiecePalette[] = [
  {
    id: "white_half",
    label: "White & half",
    lightName: "White",
    darkName: "Half",
    pieceLight: "#FFFFFF",
    pieceDark: "#141414",
    darkSplit: true,
  },
  {
    id: "white_black",
    label: "White & black",
    lightName: "White",
    darkName: "Black",
    pieceLight: "#FFFFFF",
    pieceDark: "#141414",
  },
  {
    id: "white_green",
    label: "White & green",
    lightName: "White",
    darkName: "Green",
    pieceLight: "#FFFFFF",
    pieceDark: "#22C55E",
  },
  {
    id: "ivory_burgundy",
    label: "Ivory & burgundy",
    lightName: "Ivory",
    darkName: "Burgundy",
    pieceLight: "#FFF6E8",
    pieceDark: "#7A001F",
  },
  {
    id: "pearl_onyx",
    label: "Pearl & onyx",
    lightName: "Pearl",
    darkName: "Onyx",
    pieceLight: "#F4F4F5",
    pieceDark: "#18181B",
  },
  {
    id: "honey_walnut",
    label: "Honey & walnut",
    lightName: "Honey",
    darkName: "Walnut",
    pieceLight: "#F6C453",
    pieceDark: "#3E2723",
  },
  {
    id: "mist_ocean",
    label: "Mist & ocean",
    lightName: "Mist",
    darkName: "Ocean",
    pieceLight: "#BFDBFE",
    pieceDark: "#1E3A5F",
  },
  {
    id: "blush_espresso",
    label: "Blush & espresso",
    lightName: "Blush",
    darkName: "Espresso",
    pieceLight: "#FECACA",
    pieceDark: "#3F2A1D",
  },
];

const BOARD_KEY = "dama-board-palette";
const PIECE_KEY = "dama-piece-palette";
/** One-time: force Black & white board for users stuck on legacy Classic/Ivory prefs. */
const BW_DEFAULT_MIGRATION_KEY = "dama-palette-bw-v1";
/** One-time: default dark pieces to green (visible on black squares). */
const WG_DEFAULT_MIGRATION_KEY = "dama-palette-white-green-v1";
/** One-time: product default → Classic wood board + White & black pieces. */
const CLASSIC_WB_MIGRATION_KEY = "dama-palette-classic-wb-v1";
/** One-time: product default → Forest board + White & black pieces (Neo era). */
const FOREST_WB_MIGRATION_KEY = "dama-palette-forest-wb-v2";
/** One-time: Forest board + White & half (50/50 dark pieces) as Neo default. */
const FOREST_WH_MIGRATION_KEY = "dama-palette-forest-wh-v3";

const DEFAULT_BOARD_ID: BoardPaletteId = "forest";
const DEFAULT_PIECE_ID: PiecePaletteId = "white_half";

/** Dark-side draughts disc: half light / half dark (135°). */
export const DARK_PIECE_FILL =
  "linear-gradient(135deg, var(--dama-piece-light) 50%, var(--dama-piece-dark) 50%)";

/**
 * Force product defaults once so existing localStorage (classic / ivory_burgundy / burgundy)
 * does not keep showing the old themes after Black & white became the default.
 * After this runs, Colors picker choices persist normally.
 */
export function migratePalettesToBlackWhiteDefault(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(BW_DEFAULT_MIGRATION_KEY) === "1") return;
    window.localStorage.setItem(BOARD_KEY, "black_white");
    window.localStorage.setItem(PIECE_KEY, "white_green");
    window.localStorage.setItem(BW_DEFAULT_MIGRATION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** One-time: switch previous White & black default pieces → White & green. */
export function migratePalettesToWhiteGreenDefault(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(WG_DEFAULT_MIGRATION_KEY) === "1") return;
    const current = window.localStorage.getItem(PIECE_KEY);
    if (!current || current === "white_black") {
      window.localStorage.setItem(PIECE_KEY, "white_green");
    }
    window.localStorage.setItem(WG_DEFAULT_MIGRATION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** One-time: Classic wood + White & black (overrides prior B&W / green defaults). */
export function migratePalettesToClassicWoodWhiteBlackDefault(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(CLASSIC_WB_MIGRATION_KEY) === "1") return;
    window.localStorage.setItem(BOARD_KEY, "classic");
    window.localStorage.setItem(PIECE_KEY, DEFAULT_PIECE_ID);
    window.localStorage.setItem(CLASSIC_WB_MIGRATION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** One-time: Forest + White & black (Neo default; overrides prior classic wood). */
export function migratePalettesToForestWhiteBlackDefault(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FOREST_WB_MIGRATION_KEY) === "1") return;
    window.localStorage.setItem(BOARD_KEY, DEFAULT_BOARD_ID);
    window.localStorage.setItem(PIECE_KEY, "white_black");
    window.localStorage.setItem(FOREST_WB_MIGRATION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** One-time: Forest + White & half (50/50 dark pieces; prior solid B/W stays selectable). */
export function migratePalettesToForestWhiteHalfDefault(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FOREST_WH_MIGRATION_KEY) === "1") return;
    window.localStorage.setItem(BOARD_KEY, DEFAULT_BOARD_ID);
    window.localStorage.setItem(PIECE_KEY, DEFAULT_PIECE_ID);
    window.localStorage.setItem(FOREST_WH_MIGRATION_KEY, "1");
  } catch {
    /* ignore */
  }
}

function defaultBoardPalette(): BoardPalette {
  return boardPaletteById(DEFAULT_BOARD_ID);
}

function defaultPiecePalette(): PiecePalette {
  return piecePaletteById(DEFAULT_PIECE_ID);
}

export function boardPaletteById(id: string | null | undefined): BoardPalette {
  const found =
    BOARD_PALETTES.find((p) => p.id === id) ??
    BOARD_PALETTES.find((p) => p.id === DEFAULT_BOARD_ID) ??
    BOARD_PALETTES[0];
  if (!found) throw new Error("BOARD_PALETTES is empty");
  return found;
}

export function piecePaletteById(id: string | null | undefined): PiecePalette {
  const found =
    PIECE_PALETTES.find((p) => p.id === id) ??
    PIECE_PALETTES.find((p) => p.id === DEFAULT_PIECE_ID) ??
    PIECE_PALETTES[0];
  if (!found) throw new Error("PIECE_PALETTES is empty");
  return found;
}

/** @deprecated use boardPaletteById */
export function paletteById(id: string | null | undefined): BoardPalette & {
  pieceLight: string;
  pieceDark: string;
} {
  const board = boardPaletteById(id);
  const piece = piecePaletteById(readPiecePaletteId());
  return { ...board, pieceLight: piece.pieceLight, pieceDark: piece.pieceDark };
}

export function readBoardPaletteId(): BoardPaletteId {
  if (typeof window === "undefined") return DEFAULT_BOARD_ID;
  try {
    const raw = window.localStorage.getItem(BOARD_KEY);
    if (BOARD_PALETTES.some((p) => p.id === raw)) return raw as BoardPaletteId;
  } catch {
    /* ignore */
  }
  return DEFAULT_BOARD_ID;
}

export function readPiecePaletteId(): PiecePaletteId {
  if (typeof window === "undefined") return DEFAULT_PIECE_ID;
  try {
    const raw = window.localStorage.getItem(PIECE_KEY);
    if (PIECE_PALETTES.some((p) => p.id === raw)) return raw as PiecePaletteId;
  } catch {
    /* ignore */
  }
  return DEFAULT_PIECE_ID;
}

export function applyBoardAndPiecePalettes(board: BoardPalette, piece: PiecePalette): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--dama-board-light", board.boardLight);
  root.style.setProperty("--dama-board-dark", board.boardDark);
  root.style.setProperty("--dama-board-frame", board.boardFrame);
  root.style.setProperty("--dama-board-highlight", board.highlight);
  root.style.setProperty("--dama-piece-light", piece.pieceLight);
  root.style.setProperty("--dama-piece-dark", piece.pieceDark);
  root.style.setProperty("--dama-piece-dark-split", piece.darkSplit ? "1" : "0");
  root.style.setProperty(
    "--dama-piece-dark-fill",
    piece.darkSplit
      ? `linear-gradient(135deg, ${piece.pieceLight} 50%, ${piece.pieceDark} 50%)`
      : piece.pieceDark,
  );
  // Palace court metals + brand mark tint from the active piece pair.
  const accents = palaceAccentsFromPair(piece.pieceLight, piece.pieceDark);
  root.style.setProperty("--dama-piece-mark", accents.mark);
  root.style.setProperty("--dama-piece-king", accents.king);
  root.style.setProperty("--dama-piece-queen", accents.queen);
  root.style.setProperty("--dama-piece-heir", accents.heir);
  window.dispatchEvent(new Event("dama-board-palette"));
}

export function writeBoardPaletteId(id: BoardPaletteId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOARD_KEY, id);
  } catch {
    /* ignore */
  }
  applyBoardAndPiecePalettes(boardPaletteById(id), piecePaletteById(readPiecePaletteId()));
}

export function writePiecePaletteId(id: PiecePaletteId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIECE_KEY, id);
  } catch {
    /* ignore */
  }
  applyBoardAndPiecePalettes(boardPaletteById(readBoardPaletteId()), piecePaletteById(id));
}

export function hydratePalettesFromStorage(): {
  board: BoardPalette;
  piece: PiecePalette;
} {
  migratePalettesToBlackWhiteDefault();
  migratePalettesToWhiteGreenDefault();
  migratePalettesToClassicWoodWhiteBlackDefault();
  migratePalettesToForestWhiteBlackDefault();
  migratePalettesToForestWhiteHalfDefault();
  const board = boardPaletteById(readBoardPaletteId());
  const piece = piecePaletteById(readPiecePaletteId());
  applyBoardAndPiecePalettes(board, piece);
  return { board, piece };
}

export function useBoardPalette(): [BoardPalette, (id: BoardPaletteId) => void] {
  const [palette, setPalette] = useState<BoardPalette>(() => defaultBoardPalette());

  useEffect(() => {
    const { board } = hydratePalettesFromStorage();
    setPalette(board);
  }, []);

  const update = useCallback((id: BoardPaletteId) => {
    const next = boardPaletteById(id);
    setPalette(next);
    writeBoardPaletteId(id);
  }, []);

  return [palette, update];
}

export function usePiecePalette(): [PiecePalette, (id: PiecePaletteId) => void] {
  const [palette, setPalette] = useState<PiecePalette>(() => defaultPiecePalette());

  useEffect(() => {
    const { piece } = hydratePalettesFromStorage();
    setPalette(piece);
  }, []);

  const update = useCallback((id: PiecePaletteId) => {
    const next = piecePaletteById(id);
    setPalette(next);
    writePiecePaletteId(id);
  }, []);

  return [palette, update];
}
