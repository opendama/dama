"use client";

import { PlayHubSkeleton } from "@/components/ui/shimmer-skeletons";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Legacy `/spectate` → home Play shell spectate view (`/?view=spectate`).
 * Preserves gameId / game_id query params for auto-connect.
 */
function SpectateRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "spectate");
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/?view=spectate");
  }, [router, searchParams]);

  return <PlayHubSkeleton />;
}

export default function SpectatePage() {
  return (
    <Suspense fallback={<PlayHubSkeleton />}>
      <SpectateRedirectInner />
    </Suspense>
  );
}
