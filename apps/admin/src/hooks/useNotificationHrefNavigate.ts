"use client";

import { releaseBodyPointerEvents } from "@/hooks/use-deferred-dialog-selection";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** Trim-parity notification deep-link navigation (replay same URL). */
export function useNotificationHrefNavigate() {
  const router = useRouter();

  return useCallback(
    (href: string) => {
      const target = href.trim();
      if (!target.startsWith("/") || target.startsWith("//")) return;

      releaseBodyPointerEvents();

      const current =
        typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "";

      if (current === target) {
        try {
          const u = new URL(target, window.location.origin);
          router.replace(u.pathname);
          window.setTimeout(() => {
            router.push(target);
            releaseBodyPointerEvents();
          }, 0);
        } catch {
          router.push(target);
        }
        return;
      }

      router.push(target);
    },
    [router],
  );
}
