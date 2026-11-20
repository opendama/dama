"use client";

import { HomePlayHub } from "@/components/home/HomePlayHub";
import { PaymentEnrollModal } from "@/components/tournaments/PaymentEnrollModal";
import { useTournamentEnrollMutation } from "@/hooks/mutation/useTournamentEnrollMutation";
import { useClientNavFullQuery } from "@/hooks/query/useClientNavFullQuery";
import { useHomeChromeQuery } from "@/hooks/query/useHomeChromeQuery";
import { usePaymentModalChromeQuery } from "@/hooks/query/usePaymentModalChromeQuery";
import { softCommunityJoinStatusMessage } from "@/lib/community-player-chrome-soft";
import { cupLifecyclePhase } from "@/lib/cupLifecycle";
import { isHomeViewportLocked } from "@/lib/home-shell";
import { prizePoolCardLabelsFromHome } from "@/lib/prize-pool-lines";
import {
  freeJoinPlayHref,
  isAlreadyEnrolledError,
  tournamentEnrollErrorChrome,
} from "@/lib/tournament-free-join";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { isHomeSurfaceChromeReady } from "@/types/home-chrome";
import { isPaymentModalChromeReady } from "@/types/payment-modal-chrome";
import { isMarketingChromeReady } from "@/types/platform";
import type { Tournament } from "@/types/tournament";
import { invalidateTournamentCup, invalidateTournaments } from "@/lib/invalidate";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

/**
 * Marketing home = Chess.com Play: board | AI/Match rail.
 * Left nav Tournaments → `/?view=tournaments` center cards. Dashboard ops on /dashboard.
 * Free cups Join silently then open cup lobby; paid opens enroll modal then same lobby.
 */
function LandingBody() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const navQuery = useClientNavFullQuery();
  const homeChromeQuery = useHomeChromeQuery(true);
  const homeChrome = isHomeSurfaceChromeReady(homeChromeQuery.data)
    ? homeChromeQuery.data
    : undefined;
  const payChromeQuery = usePaymentModalChromeQuery(Boolean(token));
  const payChrome = isPaymentModalChromeReady(payChromeQuery.data)
    ? payChromeQuery.data
    : undefined;
  const searchParams = useSearchParams();
  const lockViewport = isHomeViewportLocked(searchParams);
  const [enrollTournament, setEnrollTournament] = useState<Tournament | null>(null);
  const [enrolledTournamentIdLatch, setEnrolledTournamentIdLatch] = useState<string | null>(null);
  const qc = useQueryClient();
  const enroll = useTournamentEnrollMutation(token);

  function onTournamentEnrolled(id: string) {
    const next = id.trim();
    if (!next) return;
    setEnrolledTournamentIdLatch(next);
    void invalidateTournaments(qc);
    void invalidateTournamentCup(qc, next);
  }

  const nav = isMarketingChromeReady(navQuery.data) ? navQuery.data : undefined;
  const brand = (nav?.brand_name || "").trim();
  const eyebrow = (nav?.marketing_hero_eyebrow || "").trim();
  const blurb = (nav?.marketing_hero_blurb || "").trim();

  async function onTournamentCta(t: Tournament) {
    // Belt-and-suspenders: finished/live / already seated → lobby (hub already gates enroll).
    const phase = cupLifecyclePhase(t);
    if (phase !== "open" || t.viewer_enrolled) {
      onTournamentEnrolled(t.id);
      router.replace(freeJoinPlayHref(t.id));
      return;
    }
    if (t.is_free) {
      if (!payChrome || !homeChrome) return;
      try {
        await enroll.mutateAsync({ id: t.id });
        onTournamentEnrolled(t.id);
        const ok = softCommunityJoinStatusMessage(
          (payChrome.enroll_success || homeChrome.join_cta || "").trim(),
        );
        if (ok && !ok.startsWith("{")) toast.success(ok);
        router.replace(freeJoinPlayHref(t.id));
      } catch (err) {
        const msg = tournamentEnrollErrorChrome(err, payChrome);
        if (msg) toast.error(msg);
        if (isAlreadyEnrolledError(err)) {
          onTournamentEnrolled(t.id);
          router.replace(freeJoinPlayHref(t.id));
        }
      }
      return;
    }
    setEnrollTournament(t);
  }

  return (
    <div
      className={cn(
        "dama-hero-surface flex flex-col",
        lockViewport ? "min-h-0 h-full flex-1 overflow-hidden" : "min-h-0 flex-1",
      )}
    >
      <Suspense fallback={null}>
        <HomePlayHub
          brand={brand}
          eyebrow={eyebrow}
          blurb={blurb}
          enrolledTournamentIdLatch={enrolledTournamentIdLatch}
          onEnrollTournament={(t) => void onTournamentCta(t)}
        />
      </Suspense>

      <PaymentEnrollModal
        open={Boolean(enrollTournament)}
        onOpenChange={(next) => {
          if (!next) setEnrollTournament(null);
        }}
        tournament={enrollTournament}
        prizePoolLabels={homeChrome ? prizePoolCardLabelsFromHome(homeChrome) : undefined}
        onEnrolled={onTournamentEnrolled}
      />
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="dama-hero-surface flex min-h-0 h-full flex-1 flex-col overflow-hidden" />
      }
    >
      <LandingBody />
    </Suspense>
  );
}
