"use client";

import { useEffect, useState } from "react";

/**
 * False during SSR and the first client paint; true after mount.
 * Use for client-fetched chrome so React Query cache / isLoading never
 * hydrates a skeleton against real links (or null attrs against labels).
 */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
