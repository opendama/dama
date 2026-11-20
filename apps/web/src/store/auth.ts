"use client";

import type { AuthUser } from "@/types/auth";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OAuthProfile = {
  name: string;
  email: string;
  avatarUrl: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  oauthProfile: OAuthProfile | null;
  hasHydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setOAuthProfile: (profile: OAuthProfile | null) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      oauthProfile: null,
      hasHydrated: false,
      setSession: (token, user) => set({ token, user }),
      setOAuthProfile: (oauthProfile) => set({ oauthProfile }),
      clearSession: () => set({ token: null, user: null, oauthProfile: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "dama-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        oauthProfile: state.oauthProfile,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/** True after zustand persist finishes (SSR-safe gate for token-scoped queries). */
export function useAuthHydrated() {
  return useAuthStore((s) => s.hasHydrated);
}
