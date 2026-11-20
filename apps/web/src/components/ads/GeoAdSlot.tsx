"use client";

import { ViewportAdCreative } from "@/components/ads/ViewportAdCreative";
import { GeoAdSlotSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useAdClickMutation,
  useAdImpressionMutation,
  useAdVideoCompleteMutation,
} from "@/hooks/mutation";
import { useAdPlaybackQuery } from "@/hooks/query/useAdPlaybackQuery";
import { usePlayerGeoQuery } from "@/hooks/query/usePlayerGeoQuery";
import { useServeAdsQuery } from "@/hooks/query/useServeAdsQuery";
import {
  parseViewportBreakpoints,
  pickCampaignCreative,
  resolveViewportSlot,
} from "@/lib/resolve-viewport-creative";
import { useEffect, useRef, useState } from "react";

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

/** Player-facing geo ad slot: serves from API, records impression once, click on creative. */
export function GeoAdSlot() {
  const geoQuery = usePlayerGeoQuery();
  const geo = geoQuery.data ?? null;
  const geoReady = geoQuery.isFetched && !geoQuery.isLoading;
  const playbackQuery = useAdPlaybackQuery(true);
  const impressed = useRef<string | null>(null);
  const videoCompletedRef = useRef<string | null>(null);
  const serveQuery = useServeAdsQuery(geo, geoReady);
  const impression = useAdImpressionMutation();
  const click = useAdClickMutation();
  const videoComplete = useAdVideoCompleteMutation();
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const lobbyPlacement = playbackQuery.data?.player_chrome.placement_lobby;
  const breakpoints = playbackQuery.data?.schedule_chrome
    ? parseViewportBreakpoints(playbackQuery.data.schedule_chrome)
    : null;
  const slot = breakpoints && width > 0 ? resolveViewportSlot(width, breakpoints) : null;
  const ad =
    slot && serveQuery.data
      ? (serveQuery.data.find((c) => {
          if (!(c.title || "").trim()) return false;
          const picked = pickCampaignCreative(c, slot);
          return Boolean(picked.imageUrl || picked.videoId);
        }) ?? null)
      : null;

  const recordImpression = impression.mutate;

  useEffect(() => {
    if (!ad?.id || impressed.current === ad.id || !lobbyPlacement) return;
    impressed.current = ad.id;
    recordImpression({
      campaignId: ad.id,
      viewerKey: viewerKey(),
      placement: lobbyPlacement,
    });
  }, [ad, lobbyPlacement, recordImpression]);

  if (!geoReady || serveQuery.isLoading) {
    return <GeoAdSlotSkeleton />;
  }

  if (!ad?.title || !breakpoints || !slot) {
    return null;
  }

  return (
    <aside className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
      <button type="button" className="block w-full text-left" onClick={() => click.mutate(ad.id)}>
        <ViewportAdCreative
          campaign={ad}
          scheduleChrome={playbackQuery.data?.schedule_chrome}
          onVideoEnded={() => {
            if (videoCompletedRef.current === ad.id) return;
            videoCompletedRef.current = ad.id;
            videoComplete.mutate(ad.id);
          }}
        />
      </button>
      <p className="mt-2 text-sm">{ad.title}</p>
    </aside>
  );
}
