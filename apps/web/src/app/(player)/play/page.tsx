"use client";

import { PlayHubSkeleton } from "@/components/ui/shimmer-skeletons";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Legacy `/play` → home Play shell (`LivePlayHub` on `/`).
 * Preserves gameId / mode / depth / resume query params.
 */
function PlayRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("view") === "play") params.delete("view");
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/");
  }, [router, searchParams]);

  return <PlayHubSkeleton />;
}

export default function PlayPage() {
  return (
    <Suspense fallback={<PlayHubSkeleton />}>
      <PlayRedirectInner />
    </Suspense>
  );
}
