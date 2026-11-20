"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { AuthGateSkeleton, portalRouteSkeleton } from "@/components/ui/shimmer-skeletons";
import { ReceiptDetailSkeletonBoot } from "@/components/wallet/ReceiptDetailSkeletonBoot";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { isSafeAppPath } from "@/lib/auth-providers";
import { isPlayerPortalPath } from "@/lib/player-nav";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function isReceiptDetailPath(pathname: string): boolean {
  const p = (pathname || "/").split("?")[0] || "/";
  return (
    (p.startsWith("/receipts/") && p !== "/receipts/") ||
    (p.startsWith("/ads/receipts/") && p !== "/ads/receipts/") ||
    (p.startsWith("/events/receipts/") && p !== "/events/receipts/")
  );
}

/**
 * Fail-closed player/ads gate: after persist hydrate, no JWT → sign-in modal.
 * Renders content-area skeleton only (layouts keep rail/header - no login-card flash).
 * Uses route-matched skeletons so auth hydrate does not flash a generic layout.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const providersQuery = useAuthProvidersQuery();
  const signInModal = useOptionalSignInModal();
  const opened = useRef(false);
  const portalOrAds =
    isPlayerPortalPath(pathname) ||
    pathname === "/ads" ||
    pathname.startsWith("/ads/") ||
    pathname === "/events" ||
    pathname.startsWith("/events/");

  useEffect(() => {
    if (!hydrated) return;
    if (token) {
      opened.current = false;
      return;
    }
    if (providersQuery.isLoading) return;
    if (opened.current) return;
    opened.current = true;
    // Overview (/dashboard) is never an OAuth return - stay on Play home after sign-in.
    // usePathname() omits search - keep ?create=1 / query for Host CTA resume
    // (SignInModal.resolveStayPath also merges live search when paths match).
    let next = isSafeAppPath(pathname) ? pathname : undefined;
    if (next && typeof window !== "undefined") {
      const here = (window.location.pathname || "").trim();
      const search = (window.location.search || "").trim();
      if (here && next === here && search) {
        next = `${here}${search}`;
      }
    }
    if (next === "/dashboard" || (next || "").startsWith("/dashboard?")) {
      next = "/";
    }
    signInModal?.openSignIn(next ? { nextPath: next } : undefined);
  }, [hydrated, token, providersQuery.isLoading, pathname, signInModal]);

  const contentSkeleton = isReceiptDetailPath(pathname) ? (
    <ReceiptDetailSkeletonBoot />
  ) : portalOrAds ? (
    portalRouteSkeleton(pathname)
  ) : (
    <AuthGateSkeleton />
  );

  if (!hydrated) {
    return contentSkeleton;
  }

  if (token) {
    return <>{children}</>;
  }

  return contentSkeleton;
}
