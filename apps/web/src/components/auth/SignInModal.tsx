"use client";

import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { DamaWordmark } from "@/components/brand/dama-wordmark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthLoginSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { isSafeAppPath, sanitizeLoginNext } from "@/lib/auth-providers";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SignInModalContextValue = {
  open: boolean;
  openSignIn: (opts?: { nextPath?: string }) => void;
  closeSignIn: () => void;
};

const SignInModalContext = createContext<SignInModalContextValue | null>(null);

export function useSignInModal(): SignInModalContextValue {
  const ctx = useContext(SignInModalContext);
  if (!ctx) {
    throw new Error("useSignInModal requires SignInModalProvider");
  }
  return ctx;
}

/** Safe optional access when a tree may render outside the provider (tests / edge). */
export function useOptionalSignInModal(): SignInModalContextValue | null {
  return useContext(SignInModalContext);
}

function resolveStayPath(preferred?: string): string | undefined {
  const raw = (preferred || "").trim();
  if (typeof window !== "undefined") {
    const here = (window.location.pathname || "").trim();
    const search = (window.location.search || "").trim();
    const stayHere =
      here && isSafeAppPath(here) && !here.startsWith("/auth/") ? `${here}${search}` : "/";
    // No explicit next (or auth route): stay on the current public/portal URL.
    if (!raw || raw.startsWith("/auth/")) {
      return sanitizeLoginNext(stayHere, "/");
    }
    // Callers often pass pathname only - keep ?view= / query when still on that path.
    const rawPath = raw.split("?")[0] || raw;
    if (rawPath === here) {
      return sanitizeLoginNext(raw.includes("?") ? raw : stayHere, "/");
    }
  }
  return sanitizeLoginNext(raw, "/");
}

export function SignInModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [nextPath, setNextPath] = useState<string | undefined>(undefined);
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const pathname = usePathname() || "";

  const openSignIn = useCallback((opts?: { nextPath?: string }) => {
    const next = resolveStayPath(opts?.nextPath);
    setNextPath(next && isSafeAppPath(next) ? next : undefined);
    setOpen(true);
  }, []);

  const closeSignIn = useCallback(() => {
    setOpen(false);
    setNextPath(undefined);
  }, []);

  useEffect(() => {
    if (hydrated && token && open) {
      closeSignIn();
    }
  }, [hydrated, token, open, closeSignIn]);

  useEffect(() => {
    if (pathname.startsWith("/auth/oauth/")) {
      closeSignIn();
    }
  }, [pathname, closeSignIn]);

  // Deep link / OAuth return: /?signin=1 or legacy /auth/login handled on login page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") !== "1") return;
    openSignIn();
    params.delete("signin");
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", url);
  }, [openSignIn]);

  const value = useMemo(() => ({ open, openSignIn, closeSignIn }), [open, openSignIn, closeSignIn]);

  return (
    <SignInModalContext.Provider value={value}>
      {children}
      <SignInDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeSignIn();
          else setOpen(true);
        }}
        nextPath={nextPath}
      />
    </SignInModalContext.Provider>
  );
}

function SignInDialog({
  open,
  onOpenChange,
  nextPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextPath?: string;
}) {
  const providersQuery = useAuthProvidersQuery();
  const title = (providersQuery.data?.login_title || "").trim();
  const subtitle = (providersQuery.data?.login_subtitle || "").trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {providersQuery.isLoading || !providersQuery.data ? (
          <div className="space-y-3 py-2">
            <AuthLoginSkeleton />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 flex justify-center">
                <DamaWordmark
                  size="lg"
                  alt={(providersQuery.data.nav_sign_in_label || "").trim()}
                  priority
                />
              </div>
              <DialogTitle
                className={
                  title || (providersQuery.data.nav_sign_in_label || "").trim()
                    ? undefined
                    : "sr-only"
                }
              >
                {title || (providersQuery.data.nav_sign_in_label || "").trim()}
              </DialogTitle>
              {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
            </DialogHeader>
            <SocialSignInButtons nextPath={nextPath} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
