"use client";

import { useEffect, useState } from "react";

export type DraughtsPerformanceTier = "high" | "low";

/** Match smart-menu: low-tier devices get shorter own-move durations + capped DPR. */
export function useDraughtsPerformanceTier(): DraughtsPerformanceTier {
  const [tier, setTier] = useState<DraughtsPerformanceTier>("high");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cores = navigator.hardwareConcurrency || 4;
    const navWithMemory = navigator as Navigator & { deviceMemory?: number };
    const memory = typeof navWithMemory.deviceMemory === "number" ? navWithMemory.deviceMemory : 4;
    const coarse =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const low = reduceMotion || cores <= 4 || memory <= 3 || coarse;
    setTier(low ? "low" : "high");
  }, []);

  return tier;
}
