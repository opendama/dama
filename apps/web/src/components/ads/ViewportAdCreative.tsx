"use client";

import {
  parseViewportBreakpoints,
  pickCampaignCreative,
  resolveViewportSlot,
  viewportAspectRatioFromLabel,
  type ViewportCreativeSource,
} from "@/lib/resolve-viewport-creative";
import type { ViewportCreativeSlot } from "@/types/ads";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { cn } from "@/lib/utils";
import type { AdScheduleChrome } from "@/types/ad-playback";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  campaign: ViewportCreativeSource;
  scheduleChrome?: Pick<
    AdScheduleChrome,
    | "viewport_breakpoint_mobile_max"
    | "viewport_breakpoint_tablet_max"
    | "viewport_desktop_ratio_label"
    | "viewport_tablet_ratio_label"
    | "viewport_mobile_ratio_label"
  >;
  className?: string;
  imgClassName?: string;
  onVideoEnded?: () => void;
};

function displaySlot(
  used: ViewportCreativeSlot | "legacy" | "",
  requested: ViewportCreativeSlot,
): ViewportCreativeSlot {
  if (used === "desktop" || used === "tablet" || used === "mobile") return used;
  return requested;
}

function ratioLabelForSlot(
  chrome: Props["scheduleChrome"],
  slot: ViewportCreativeSlot,
): string | undefined {
  if (!chrome) return undefined;
  switch (slot) {
    case "desktop":
      return chrome.viewport_desktop_ratio_label;
    case "tablet":
      return chrome.viewport_tablet_ratio_label;
    case "mobile":
      return chrome.viewport_mobile_ratio_label;
    default:
      return undefined;
  }
}

function YouTubeNoCookieEmbed({
  videoId,
  title,
  onEnded,
}: {
  videoId: string;
  title: string;
  onEnded?: () => void;
}) {
  const endedRef = useRef(false);
  const videoIdTrim = videoId.trim();
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoIdTrim)}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1`;

  useEffect(() => {
    if (!onEnded || !videoIdTrim) return;
    endedRef.current = false;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      let raw: unknown = event.data;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          return;
        }
      }
      if (typeof raw !== "object" || raw === null) return;
      const data = raw as Record<string, unknown>;
      const eventName = data.event;
      if (typeof eventName !== "string") return;
      const info = data.info;
      const ended =
        (eventName === "onStateChange" && info === 0) ||
        (eventName === "infoDelivery" &&
          typeof info === "object" &&
          info !== null &&
          (info as Record<string, unknown>).playerState === 0);
      if (ended && !endedRef.current) {
        endedRef.current = true;
        onEnded();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onEnded, videoIdTrim]);

  return (
    <iframe
      title={title}
      src={src}
      className="h-full w-full border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

/** Player-facing creative: viewport pick + YouTube or image with object-contain. */
export function ViewportAdCreative({
  campaign,
  scheduleChrome,
  className,
  imgClassName,
  onVideoEnded,
}: Props) {
  const breakpoints = useMemo(
    () => (scheduleChrome ? parseViewportBreakpoints(scheduleChrome) : null),
    [scheduleChrome],
  );
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!breakpoints) {
    return null;
  }
  const requestedSlot = resolveViewportSlot(width, breakpoints);
  const picked = pickCampaignCreative(campaign, requestedSlot);
  const slot = displaySlot(picked.usedSlot, picked.requestedSlot);
  const aspect = viewportAspectRatioFromLabel(ratioLabelForSlot(scheduleChrome, slot));
  if (!aspect) {
    return null;
  }
  const imageSrc = resolvePublicMediaUrl(picked.imageUrl) || picked.imageUrl;
  const videoId = picked.videoId;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-md bg-black/40", className)}
      style={{ aspectRatio: aspect }}
    >
      {videoId ? (
        <YouTubeNoCookieEmbed videoId={videoId} title="" onEnded={onVideoEnded} />
      ) : imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" className={cn("h-full w-full object-contain", imgClassName)} />
      ) : null}
    </div>
  );
}
