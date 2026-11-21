"use client";

import { Button } from "@/components/ui/button";
import { ViewportAdCreative } from "@/components/ads/ViewportAdCreative";
import {
  useAdClickMutation,
  useAdImpressionMutation,
  useAdVideoCompleteMutation,
} from "@/hooks/mutation";
import { useInMatchEligibilityMutation } from "@/hooks/mutation/useInMatchEligibilityMutation";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { usePlayerGeoQuery } from "@/hooks/query/usePlayerGeoQuery";
import {
  parseViewportBreakpoints,
  pickCampaignCreative,
  resolveViewportSlot,
} from "@/lib/resolve-viewport-creative";
import type { InMatchCampaign } from "@/types/ad-playback";
import { useCallback, useEffect, useRef, useState } from "react";

function viewerKey(): string {
  if (typeof window === "undefined") return "";
  const key = "dama_ad_viewer";
  let v = window.localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    window.localStorage.setItem(key, v);
  }
  return v;
}

function formatSkip(template: string, seconds: number): string {
  return template.replace("{seconds}", String(seconds));
}

type Props = {
  active: boolean;
  gameStartedAtMs: number | null;
};

/**
 * In-match ad runner. Timing + non-skippable + labels come only from backend.
 */
export function InMatchAdOverlay({ active, gameStartedAtMs }: Props) {
  const geoQuery = usePlayerGeoQuery();
  const playbackQuery = useAdPlaybackQuery(active);
  const eligibility = useInMatchEligibilityMutation();
  const impression = useAdImpressionMutation();
  const click = useAdClickMutation();
  const videoComplete = useAdVideoCompleteMutation();
  const videoCompletedRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [campaign, setCampaign] = useState<InMatchCampaign | null>(null);
  const [nonSkippable, setNonSkippable] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const lastShownAtMs = useRef<number | null>(null);
  const nextIntervalSec = useRef<number | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const openRef = useRef(false);
  const checkingRef = useRef(false);
  const activeRef = useRef(active);
  const gameStartedAtMsRef = useRef(gameStartedAtMs);
  const geoRef = useRef(geoQuery.data);
  const playbackRef = useRef(playbackQuery.data);
  const eligibilityMutateRef = useRef(eligibility.mutateAsync);
  const impressionMutateRef = useRef(impression.mutate);
  activeRef.current = active;
  gameStartedAtMsRef.current = gameStartedAtMs;
  geoRef.current = geoQuery.data;
  playbackRef.current = playbackQuery.data;
  eligibilityMutateRef.current = eligibility.mutateAsync;
  impressionMutateRef.current = impression.mutate;

  const clearCheck = useCallback(() => {
    if (checkTimer.current) {
      clearTimeout(checkTimer.current);
      checkTimer.current = null;
    }
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  const runCheckRef = useRef<() => Promise<void>>(async () => {});

  const scheduleAfter = useCallback(
    (seconds: number) => {
      const wait = Math.max(1, Math.floor(seconds));
      clearCheck();
      checkTimer.current = setTimeout(() => {
        void runCheckRef.current();
      }, wait * 1000);
    },
    [clearCheck],
  );

  runCheckRef.current = async () => {
    if (!activeRef.current || gameStartedAtMsRef.current == null || openRef.current || checkingRef.current) {
      return;
    }
    const pb = playbackRef.current;
    const geo = geoRef.current;
    if (!pb?.player_chrome || !geo?.country) return;
    checkingRef.current = true;
    try {
      const elapsed = Math.floor((Date.now() - gameStartedAtMsRef.current) / 1000);
      const sinceLast =
        lastShownAtMs.current == null
          ? null
          : Math.floor((Date.now() - lastShownAtMs.current) / 1000);
      const res = await eligibilityMutateRef.current({
        body: {
          game_elapsed_seconds: elapsed,
          seconds_since_last_ad: sinceLast,
          viewer_key: viewerKey(),
          country: geo.country,
          region: geo.region,
          district: geo.district,
          lat: geo.lat,
          lng: geo.lng,
        },
        bounds: {
          non_skippable_min: pb.non_skippable_min,
          interval_min: pb.interval_min,
        },
      });
      nextIntervalSec.current = res.interval_seconds;
      if (res.show && res.campaign?.id && res.campaign.title) {
        const bp = pb.schedule_chrome ? parseViewportBreakpoints(pb.schedule_chrome) : null;
        if (!bp) {
          const wait = res.next_check_after_seconds;
          if (wait != null && wait > 0) scheduleAfter(wait);
          else if (res.interval_seconds > 0) scheduleAfter(res.interval_seconds);
          return;
        }
        const slot = resolveViewportSlot(window.innerWidth, bp);
        const picked = pickCampaignCreative(res.campaign, slot);
        if (!picked.imageUrl && !picked.videoId) {
          if (res.interval_seconds > 0) scheduleAfter(res.interval_seconds);
          return;
        }
        openRef.current = true;
        videoCompletedRef.current = false;
        setCampaign(res.campaign);
        setNonSkippable(res.non_skippable_seconds);
        setRemaining(res.non_skippable_seconds);
        setOpen(true);
        lastShownAtMs.current = Date.now();
        impressionMutateRef.current({
          campaignId: res.campaign.id,
          viewerKey: viewerKey(),
          placement: pb.player_chrome.placement_in_match,
        });
        return;
      }
      const wait = res.next_check_after_seconds;
      if (wait != null && wait > 0) scheduleAfter(wait);
      else if (res.interval_seconds > 0) scheduleAfter(res.interval_seconds);
      else scheduleAfter(Math.max(30, pb.interval_min || 30));
    } catch {
      // Fail closed with backoff so we never spin the API during live play.
      scheduleAfter(Math.max(30, playbackRef.current?.interval_min || 30));
    } finally {
      checkingRef.current = false;
    }
  };

  const closeOverlay = useCallback(() => {
    clearCountdown();
    openRef.current = false;
    setOpen(false);
    setCampaign(null);
    setNonSkippable(null);
    setRemaining(null);
    const interval = nextIntervalSec.current;
    if (interval != null && interval > 0 && active && gameStartedAtMs != null) {
      scheduleAfter(interval);
    }
  }, [active, gameStartedAtMs, scheduleAfter, clearCountdown]);

  useEffect(() => {
    if (!active || gameStartedAtMs == null) {
      clearCheck();
      clearCountdown();
      openRef.current = false;
      setOpen(false);
      setCampaign(null);
      setNonSkippable(null);
      setRemaining(null);
      lastShownAtMs.current = null;
      return;
    }
    if (!playbackQuery.data?.player_chrome || !geoQuery.data?.country) return;
    void runCheckRef.current();
    return () => clearCheck();
    // Intentionally omit mutation identities - they re-render every isPending flip and
    // were cancelling next_check timers (~4s storm + move timeouts).
  }, [
    active,
    gameStartedAtMs,
    playbackQuery.data?.player_chrome,
    geoQuery.data?.country,
    clearCheck,
    clearCountdown,
  ]);

  useEffect(() => {
    if (!open || nonSkippable == null) {
      clearCountdown();
      return;
    }
    clearCountdown();
    countdownTimer.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev == null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearCountdown();
  }, [open, nonSkippable, clearCountdown]);

  const chrome = playbackQuery.data?.player_chrome;
  const breakpoints = playbackQuery.data?.schedule_chrome
    ? parseViewportBreakpoints(playbackQuery.data.schedule_chrome)
    : null;
  const slot =
    breakpoints && typeof window !== "undefined"
      ? resolveViewportSlot(window.innerWidth, breakpoints)
      : breakpoints
        ? resolveViewportSlot(breakpoints.tabletMax + 1, breakpoints)
        : null;
  const picked = open && campaign && slot ? pickCampaignCreative(campaign, slot) : null;
  const hasMedia = Boolean(picked?.imageUrl || picked?.videoId);

  useEffect(() => {
    if (!open || !campaign || !breakpoints) return;
    if (!hasMedia) {
      // Exact-slot serve: do not block play with a title-only overlay.
      closeOverlay();
    }
  }, [open, campaign, breakpoints, hasMedia, closeOverlay]);

  if (!open || !campaign || nonSkippable == null || remaining == null || !chrome) {
    return null;
  }
  if (!breakpoints || !hasMedia) {
    return null;
  }

  const canSkip = remaining <= 0;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-center justify-center bg-black/80 p-4"
      aria-label={campaign.title}
    >
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--dama-muted)]">
          {chrome.sponsored_label}
        </p>
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => click.mutate(campaign.id)}
        >
          <ViewportAdCreative
            campaign={campaign}
            scheduleChrome={playbackQuery.data?.schedule_chrome}
            onVideoEnded={() => {
              if (videoCompletedRef.current) return;
              videoCompletedRef.current = true;
              videoComplete.mutate(campaign.id);
            }}
          />
        </button>
        <p className="text-sm">{campaign.title}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--dama-muted)]">
            {canSkip ? chrome.can_continue_label : formatSkip(chrome.skip_in_template, remaining)}
          </p>
          <Button type="button" disabled={!canSkip} onClick={closeOverlay}>
            {chrome.continue_action}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
