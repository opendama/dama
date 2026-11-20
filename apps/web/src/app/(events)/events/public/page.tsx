"use client";

import { playerTournamentDiscoveryHref } from "@/lib/competition-cup-source";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/** Legacy public Events browse → unified Tournaments Community (preserve code/id). */
function EventsPublicRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.toString();
    const href = playerTournamentDiscoveryHref(q ? `/events/public?${q}` : "/events/public");
    router.replace(href, { scroll: false });
  }, [router, searchParams]);
  return null;
}

export default function EventsPublicPage() {
  return (
    <Suspense fallback={null}>
      <EventsPublicRedirect />
    </Suspense>
  );
}
