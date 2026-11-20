"use client";

import { parseSkipParam, withSkipParam } from "@/lib/url-skip";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

function skipFromLocation(key: string, fallbackSearch: string): number {
  const k = key.trim();
  if (!k) return 0;
  if (typeof window !== "undefined") {
    return parseSkipParam(new URLSearchParams(window.location.search).get(k));
  }
  return parseSkipParam(new URLSearchParams(fallbackSearch).get(k));
}

/**
 * List offset synced to the URL (industry-standard refresh persistence).
 * Reads `window.location` first so Next App Router hydration cannot hide `?skip=`.
 * Writes with history.replaceState + router.replace so the bar and Next stay aligned.
 * Filter changes: `useResetSkipOnChange` - never reset on mount.
 */
export function useUrlSkip(paramKey: string): [number, (next: number) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = paramKey.trim();
  const [gen, setGen] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: gen forces re-read after history.replaceState before Next searchParams catch up
  const skip = useMemo(
    () => skipFromLocation(key, searchParams.toString()),
    [searchParams, key, gen],
  );

  const setSkip = useCallback(
    (next: number) => {
      if (!key) return;
      const safe = Math.max(0, Math.floor(Number(next) || 0));
      const currentSearch =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : searchParams.toString();
      const qs = withSkipParam({ toString: () => currentSearch }, key, safe);
      if (qs === currentSearch) return;
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", href);
      }
      setGen((n) => n + 1);
      router.replace(href, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  return [skip, setSkip];
}
