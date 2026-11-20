"use client";

import { EventsJoinPanel } from "@/components/events/EventsJoinPanel";
import { EventsJoinSkeleton } from "@/components/ui/shimmer-skeletons";
import { playerTournamentDiscoveryHref } from "@/lib/competition-cup-source";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function JoinBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const code = (searchParams.get("code") || "").trim();
  const eventId = (searchParams.get("id") || "").trim();

  // Guests: join lives on unified Tournaments Community (not Hosting shell).
  // Signed-in: keep Hosting "Join with code" panel (organizer bottom-nav).
  useEffect(() => {
    if (!hydrated || token) return;
    const q = searchParams.toString();
    const href = playerTournamentDiscoveryHref(q ? `/events/join?${q}` : "/events/join");
    router.replace(href, { scroll: false });
  }, [hydrated, token, router, searchParams]);

  if (!hydrated) {
    return <EventsJoinSkeleton />;
  }
  if (!token) {
    return null;
  }
  return <EventsJoinPanel initialCode={code} initialEventId={eventId} />;
}

export default function EventsJoinPage() {
  return (
    <Suspense fallback={<EventsJoinSkeleton />}>
      <JoinBody />
    </Suspense>
  );
}
