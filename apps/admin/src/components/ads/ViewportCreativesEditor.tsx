"use client";

import { Button } from "@/components/ui/button";
import {
  useClearViewportCreativeMutation,
  useClearViewportVideoMutation,
  useUploadViewportCreativeMutation,
  useUploadViewportVideoMutation,
} from "@/hooks/mutation";
import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { viewportAspectRatioFromLabel } from "@/lib/resolve-viewport-creative";
import { cn } from "@/lib/utils";
import type { AdRuntimeChrome, ConsoleAdCampaign, ViewportCreativeSlot } from "@/types/ad-runtime";
import { Loader2, Monitor, Smartphone, Tablet, Upload, X, Youtube } from "lucide-react";
import { useCallback, useId, useRef } from "react";

export type ViewportCreativesChrome = AdRuntimeChrome &
  Required<
    Pick<
      AdRuntimeChrome,
      | "viewport_creatives_title"
      | "viewport_creatives_blurb"
      | "viewport_desktop_label"
      | "viewport_tablet_label"
      | "viewport_mobile_label"
      | "viewport_desktop_ratio_label"
      | "viewport_tablet_ratio_label"
      | "viewport_mobile_ratio_label"
      | "viewport_desktop_hint"
      | "viewport_tablet_hint"
      | "viewport_mobile_hint"
      | "viewport_upload_image_action"
      | "viewport_upload_video_action"
      | "viewport_replace_image_action"
      | "viewport_clear_action"
      | "viewport_preview_empty"
      | "viewport_optional_badge"
      | "viewport_video_badge"
      | "viewport_image_badge"
      | "media_upload_failed"
    >
  >;

type SlotConfig = {
  slot: ViewportCreativeSlot;
  label: string;
  ratioLabel: string;
  hint: string;
  icon: typeof Monitor;
  imageUrl: string;
  videoId: string;
};

type Props = {
  campaign: ConsoleAdCampaign;
  chrome: ViewportCreativesChrome;
  token: string | null | undefined;
  disabled?: boolean;
};

function isStubVideoId(id: string): boolean {
  return id.startsWith("stub_");
}

export function ViewportCreativesEditor({ campaign, chrome, token, disabled = false }: Props) {
  const uploadImage = useUploadViewportCreativeMutation(token);
  const clearImage = useClearViewportCreativeMutation(token);
  const uploadVideo = useUploadViewportVideoMutation(token);
  const clearVideo = useClearViewportVideoMutation(token);

  const slots: SlotConfig[] = [
    {
      slot: "desktop",
      label: chrome.viewport_desktop_label,
      ratioLabel: chrome.viewport_desktop_ratio_label,
      hint: chrome.viewport_desktop_hint,
      icon: Monitor,
      imageUrl: (campaign.creative_desktop_url || "").trim(),
      videoId: (campaign.video_id_desktop || "").trim(),
    },
    {
      slot: "tablet",
      label: chrome.viewport_tablet_label,
      ratioLabel: chrome.viewport_tablet_ratio_label,
      hint: chrome.viewport_tablet_hint,
      icon: Tablet,
      imageUrl: (campaign.creative_tablet_url || "").trim(),
      videoId: (campaign.video_id_tablet || "").trim(),
    },
    {
      slot: "mobile",
      label: chrome.viewport_mobile_label,
      ratioLabel: chrome.viewport_mobile_ratio_label,
      hint: chrome.viewport_mobile_hint,
      icon: Smartphone,
      imageUrl: (campaign.creative_mobile_url || "").trim(),
      videoId: (campaign.video_id_mobile || "").trim(),
    },
  ];

  const busy = (slot: ViewportCreativeSlot) =>
    (uploadImage.isPending && uploadImage.variables?.slot === slot) ||
    (clearImage.isPending && clearImage.variables?.slot === slot) ||
    (uploadVideo.isPending && uploadVideo.variables?.slot === slot) ||
    (clearVideo.isPending && clearVideo.variables?.slot === slot);

  const locked =
    disabled ||
    uploadImage.isPending ||
    clearImage.isPending ||
    uploadVideo.isPending ||
    clearVideo.isPending;

  return (
    <div className="space-y-4 border-t border-[var(--dama-border)] pt-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--dama-text)]">
          {chrome.viewport_creatives_title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--dama-muted)]">
          {chrome.viewport_creatives_blurb}
        </p>
      </div>

      <div className="space-y-6">
        {slots.map((s) => (
          <ViewportSlotSection
            key={s.slot}
            config={s}
            chrome={chrome}
            campaignTitle={(campaign.title || "").trim()}
            busy={busy(s.slot)}
            locked={locked}
            onImage={(file) => uploadImage.mutate({ id: campaign.id, slot: s.slot, file })}
            onClearImage={() => clearImage.mutate({ id: campaign.id, slot: s.slot })}
            onVideo={(file) =>
              uploadVideo.mutate({
                id: campaign.id,
                slot: s.slot,
                file,
                title: (campaign.title || "").trim(),
              })
            }
            onClearVideo={() => clearVideo.mutate({ id: campaign.id, slot: s.slot })}
          />
        ))}
      </div>
    </div>
  );
}

function ViewportSlotSection({
  config,
  chrome,
  campaignTitle,
  busy,
  locked,
  onImage,
  onClearImage,
  onVideo,
  onClearVideo,
}: {
  config: SlotConfig;
  chrome: ViewportCreativesChrome;
  campaignTitle: string;
  busy: boolean;
  locked: boolean;
  onImage: (file: File) => void;
  onClearImage: () => void;
  onVideo: (file: File) => void;
  onClearVideo: () => void;
}) {
  const imageInputId = useId();
  const videoInputId = useId();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const Icon = config.icon;
  const aspect = viewportAspectRatioFromLabel(config.ratioLabel);
  const imgSrc = resolvePublicMediaUrl(config.imageUrl) || config.imageUrl;
  const videoId = isStubVideoId(config.videoId) ? "" : config.videoId;
  const hasImage = Boolean(imgSrc);
  const hasVideo = Boolean(videoId);

  const takeImage = useCallback(
    (file: File | undefined | null) => {
      if (!file || locked) return;
      onImage(file);
      if (imageRef.current) imageRef.current.value = "";
    },
    [locked, onImage],
  );

  const takeVideo = useCallback(
    (file: File | undefined | null) => {
      if (!file || locked || !campaignTitle) return;
      onVideo(file);
      if (videoRef.current) videoRef.current.value = "";
    },
    [campaignTitle, locked, onVideo],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (locked) return;
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/")) {
        takeImage(file);
        return;
      }
      if (file.type.startsWith("video/") && campaignTitle) {
        takeVideo(file);
      }
    },
    [campaignTitle, locked, takeImage, takeVideo],
  );

  return (
    <section className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-panel)]/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[var(--dama-brand)]/10 p-1.5 text-[var(--dama-brand)]">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-[var(--dama-text)]">{config.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--dama-muted)]">
            {config.ratioLabel}
          </span>
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600">
            {chrome.viewport_optional_badge}
          </span>
        </div>
      </div>

      {aspect ? (
        <div
          className={cn(
            "relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-dashed border-[var(--dama-border)] bg-[var(--dama-card)]",
            busy && "opacity-80",
          )}
          style={{ aspectRatio: aspect }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {hasVideo ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/50 p-4 text-center">
              <Youtube className="h-8 w-8 text-red-500" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--dama-muted)]">
                {chrome.viewport_video_badge}
              </span>
              <span className="max-w-full truncate font-mono text-xs text-[var(--dama-text)]">
                {videoId}
              </span>
            </div>
          ) : hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-[var(--dama-muted)]/60">
              <Upload className="h-7 w-7" aria-hidden />
              <span className="text-[9px] font-bold uppercase tracking-widest">
                {chrome.viewport_preview_empty}
              </span>
            </div>
          )}

          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            </div>
          ) : null}

          {!locked && !hasVideo ? (
            <label
              htmlFor={imageInputId}
              className={cn(
                "absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100",
                !hasImage && "opacity-100 bg-transparent hover:bg-black/20",
              )}
            >
              <span className="sr-only">
                {hasImage
                  ? chrome.viewport_replace_image_action
                  : chrome.viewport_upload_image_action}
              </span>
              <input
                ref={imageRef}
                id={imageInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={locked}
                onChange={(e) => takeImage(e.target.files?.[0])}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-[var(--dama-text)]">{config.hint}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locked || hasVideo}
          onClick={() => imageRef.current?.click()}
        >
          {hasImage ? chrome.viewport_replace_image_action : chrome.viewport_upload_image_action}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locked || !campaignTitle}
          onClick={() => videoRef.current?.click()}
        >
          {chrome.viewport_upload_video_action}
        </Button>
        <input
          ref={videoRef}
          id={videoInputId}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          disabled={locked}
          onChange={(e) => takeVideo(e.target.files?.[0])}
        />
        {hasImage ? (
          <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={onClearImage}>
            {chrome.viewport_clear_action}
          </Button>
        ) : null}
        {hasVideo ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={locked}
            onClick={onClearVideo}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {chrome.viewport_clear_action}
          </Button>
        ) : null}
      </div>
      {hasImage && !hasVideo ? (
        <span className="inline-flex w-fit rounded-md border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-600">
          {chrome.viewport_image_badge}
        </span>
      ) : null}
    </section>
  );
}
