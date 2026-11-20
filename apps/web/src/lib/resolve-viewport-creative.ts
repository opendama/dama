import type { ViewportCreativeSlot } from "@/types/ads";

export type ViewportCreativeSource = {
  creative_url?: string;
  video_id?: string;
  creative_desktop_url?: string;
  creative_tablet_url?: string;
  creative_mobile_url?: string;
  video_id_desktop?: string;
  video_id_tablet?: string;
  video_id_mobile?: string;
};

export type ViewportBreakpoints = {
  mobileMax: number;
  tabletMax: number;
};

export type PickedViewportCreative = {
  imageUrl: string;
  videoId: string;
  usedSlot: ViewportCreativeSlot | "legacy" | "";
  requestedSlot: ViewportCreativeSlot;
};

function trim(v: string | undefined | null): string {
  return (v || "").trim();
}

function slotPair(
  campaign: ViewportCreativeSource,
  slot: ViewportCreativeSlot,
): {
  imageUrl: string;
  videoId: string;
} {
  switch (slot) {
    case "desktop":
      return {
        imageUrl: trim(campaign.creative_desktop_url),
        videoId: trim(campaign.video_id_desktop),
      };
    case "tablet":
      return {
        imageUrl: trim(campaign.creative_tablet_url),
        videoId: trim(campaign.video_id_tablet),
      };
    case "mobile":
      return {
        imageUrl: trim(campaign.creative_mobile_url),
        videoId: trim(campaign.video_id_mobile),
      };
    default:
      return { imageUrl: "", videoId: "" };
  }
}

function hasAnyViewportCreative(campaign: ViewportCreativeSource): boolean {
  for (const slot of ["desktop", "tablet", "mobile"] as ViewportCreativeSlot[]) {
    const { imageUrl, videoId } = slotPair(campaign, slot);
    if (imageUrl || videoId) return true;
  }
  return false;
}

/**
 * Pick desktop|tablet|mobile from innerWidth and DB schedule_chrome breakpoints.
 * Callers must pass parseViewportBreakpoints() result; null means fail closed (no invent).
 */
export function resolveViewportSlot(
  width: number,
  breakpoints: ViewportBreakpoints,
): ViewportCreativeSlot {
  if (width <= breakpoints.mobileMax) return "mobile";
  if (width <= breakpoints.tabletMax) return "tablet";
  return "desktop";
}

export function parseViewportBreakpoints(chrome: {
  viewport_breakpoint_mobile_max?: string;
  viewport_breakpoint_tablet_max?: string;
}): ViewportBreakpoints | null {
  const mobileMax = Number.parseInt(String(chrome.viewport_breakpoint_mobile_max || "").trim(), 10);
  const tabletMax = Number.parseInt(String(chrome.viewport_breakpoint_tablet_max || "").trim(), 10);
  if (
    !Number.isFinite(mobileMax) ||
    mobileMax < 1 ||
    !Number.isFinite(tabletMax) ||
    tabletMax <= mobileMax
  ) {
    return null;
  }
  return { mobileMax, tabletMax };
}

/**
 * Exact slot only: desktop / tablet / mobile creatives never cross screens.
 * Legacy creative_url / video_id is used only when no viewport slot is filled
 * (older campaigns). Mirrored legacy from a one-slot upload must not leak.
 */
export function pickCampaignCreative(
  campaign: ViewportCreativeSource | null | undefined,
  slot: ViewportCreativeSlot,
): PickedViewportCreative {
  if (!campaign) {
    return { imageUrl: "", videoId: "", usedSlot: "", requestedSlot: slot };
  }
  const exact = slotPair(campaign, slot);
  if (exact.imageUrl || exact.videoId) {
    return {
      imageUrl: exact.imageUrl,
      videoId: exact.videoId,
      usedSlot: slot,
      requestedSlot: slot,
    };
  }
  if (hasAnyViewportCreative(campaign)) {
    return { imageUrl: "", videoId: "", usedSlot: "", requestedSlot: slot };
  }
  const legacyImg = trim(campaign.creative_url);
  const legacyVid = trim(campaign.video_id);
  if (legacyImg || legacyVid) {
    return {
      imageUrl: legacyImg,
      videoId: legacyVid,
      usedSlot: "legacy",
      requestedSlot: slot,
    };
  }
  return { imageUrl: "", videoId: "", usedSlot: "", requestedSlot: slot };
}

/**
 * CSS aspect-ratio from DB chrome ratio label (e.g. "16:9" -> "16 / 9").
 * Fail closed: empty string when label is missing or invalid.
 */
export function viewportAspectRatioFromLabel(ratioLabel: string | undefined | null): string {
  const raw = String(ratioLabel || "")
    .trim()
    .replace(/\s+/g, "");
  const parts = raw.includes(":") ? raw.split(":") : raw.split("/");
  if (parts.length !== 2) return "";
  const wRaw = parts[0];
  const hRaw = parts[1];
  if (wRaw === undefined || hRaw === undefined) return "";
  const w = Number.parseInt(wRaw, 10);
  const h = Number.parseInt(hRaw, 10);
  if (!Number.isFinite(w) || w < 1 || !Number.isFinite(h) || h < 1) return "";
  return `${w} / ${h}`;
}
