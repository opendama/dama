"use client";

import { tournamentsHrefFromLegacyTournamentsPath } from "@/lib/competition-cup-source";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Legacy Official-only `/tournaments` page → unified Tournament discovery
 * (`/?view=tournaments` Official | Community | All).
 */
function LegacyTournamentsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    router.replace(tournamentsHrefFromLegacyTournamentsPath(searchParams.toString()), {
      scroll: false,
    });
  }, [router, searchParams]);
  return null;
}

export default function TournamentsPage() {
  return (
    <Suspense fallback={null}>
      <LegacyTournamentsRedirect />
    </Suspense>
  );
}
