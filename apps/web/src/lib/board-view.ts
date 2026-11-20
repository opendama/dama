"use client";

import { useCallback, useEffect, useState } from "react";

export type BoardViewMode = "2d" | "3d";

const STORAGE_KEY = "dama-board-view";

export function readBoardViewMode(): BoardViewMode {
  if (typeof window === "undefined") return "2d";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

export function writeBoardViewMode(mode: BoardViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

const VIEW_EVENT = "dama-board-view";

/** Persist Chess.com-style 2D default with optional 3D (syncs across hub + live board). */
export function useBoardViewMode(): [BoardViewMode, (mode: BoardViewMode) => void] {
  const [mode, setMode] = useState<BoardViewMode>("2d");

  useEffect(() => {
    setMode(readBoardViewMode());
    const sync = () => setMode(readBoardViewMode());
    window.addEventListener("storage", sync);
    window.addEventListener(VIEW_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(VIEW_EVENT, sync);
    };
  }, []);

  const update = useCallback((next: BoardViewMode) => {
    setMode(next);
    writeBoardViewMode(next);
    window.dispatchEvent(new Event(VIEW_EVENT));
  }, []);

  return [mode, update];
}
