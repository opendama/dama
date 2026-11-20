"use client";

import { create } from "zustand";

/**
 * Ephemeral shell chrome (not persisted).
 * Immersive chat hides the fixed mobile bottom nav so the composer can sit flush.
 */
type ShellChromeState = {
  /** When true, BottomNavBar is hidden and --dama-bottom-nav-height is forced to 0. */
  immersiveChat: boolean;
  setImmersiveChat: (value: boolean) => void;
};

export const useShellChromeStore = create<ShellChromeState>((set, get) => ({
  immersiveChat: false,
  setImmersiveChat: (immersiveChat) => {
    if (get().immersiveChat === immersiveChat) return;
    set({ immersiveChat });
  },
}));
