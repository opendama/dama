"use client";

import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { cn } from "@/lib/utils";
import { Camera, Loader2, Plus, Upload, X } from "lucide-react";
import { useCallback, useId, useRef } from "react";

export type EntityMediaEditorChrome = {
  thumbnail_label: string;
  gallery_label: string;
  gallery_empty: string;
  gallery_add_action: string;
  gallery_max_slots: string;
  gallery_slots_fmt: string;
  thumbnail_main_badge: string;
  thumbnail_empty_hint: string;
  thumbnail_hint: string;
  gallery_limit_reached: string;
  uploading_label: string;
  remove_action: string;
};

export type EntityMediaEditorProps = {
  chrome: EntityMediaEditorChrome;
  thumbnailUrl?: string | null;
  galleryUrls?: string[] | null;
  busyThumbnail?: boolean;
  busyGallery?: boolean;
  disabled?: boolean;
  className?: string;
  onThumbnail: (file: File) => void | Promise<void>;
  onClearThumbnail?: () => void | Promise<void>;
  onGalleryFiles: (files: File[]) => void | Promise<void>;
  onRemoveGallery?: (index: number) => void | Promise<void>;
};

function parseMaxSlots(raw: string): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function slotsLabel(fmt: string, count: number, max: number): string {
  const t = (fmt || "").trim();
  if (!t.includes("{count}") || !t.includes("{max}")) return "";
  return t.replaceAll("{count}", String(count)).replaceAll("{max}", String(max));
}

/**
 * Smart-menu item-modal parity: large thumbnail hero + 80px gallery tiles with multi-select +.
 * Uploads immediately (Dama entity endpoints); drafts are not held until save.
 */
export function EntityMediaEditor({
  chrome,
  thumbnailUrl,
  galleryUrls,
  busyThumbnail = false,
  busyGallery = false,
  disabled = false,
  className,
  onThumbnail,
  onClearThumbnail,
  onGalleryFiles,
  onRemoveGallery,
}: EntityMediaEditorProps) {
  const thumbInputId = useId();
  const galleryInputId = useId();
  const thumbRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const thumbSrc = resolvePublicMediaUrl((thumbnailUrl || "").trim()) || "";
  const gallery = (galleryUrls ?? [])
    .map((u) => (u || "").trim())
    .filter(Boolean)
    .map((u) => ({ raw: u, src: resolvePublicMediaUrl(u) || u }));
  const maxSlots = parseMaxSlots(chrome.gallery_max_slots);
  const slotsReady = maxSlots > 0;
  const canAdd = slotsReady && gallery.length < maxSlots && !busyGallery && !disabled;
  const locked = disabled || busyThumbnail || busyGallery;
  const slotsText = slotsReady
    ? slotsLabel(chrome.gallery_slots_fmt, gallery.length, maxSlots)
    : "";

  const takeThumb = useCallback(
    async (file: File | undefined | null) => {
      if (!file || locked) return;
      await onThumbnail(file);
      if (thumbRef.current) thumbRef.current.value = "";
    },
    [locked, onThumbnail],
  );

  const takeGallery = useCallback(
    async (list: FileList | File[] | null | undefined) => {
      if (!list || locked || !slotsReady) return;
      const remaining = maxSlots - gallery.length;
      if (remaining <= 0) return;
      const files = Array.from(list as ArrayLike<File>)
        .filter((f) => f?.type.startsWith("image/"))
        .slice(0, remaining);
      if (files.length === 0) return;
      await onGalleryFiles(files);
      if (galleryRef.current) galleryRef.current.value = "";
    },
    [gallery.length, locked, maxSlots, onGalleryFiles, slotsReady],
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[var(--dama-brand)]/10 p-1.5 text-[var(--dama-brand)]">
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-[var(--dama-text)]">
              {chrome.thumbnail_label}
            </span>
          </div>
          <span className="w-fit rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600">
            {chrome.thumbnail_main_badge}
          </span>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-[var(--dama-border)] bg-[var(--dama-panel)]">
          <div className="relative h-44 w-full sm:h-52">
            {thumbSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--dama-muted)]/50">
                <Upload className="h-7 w-7" aria-hidden />
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  {chrome.thumbnail_empty_hint}
                </span>
              </div>
            )}

            <label
              htmlFor={thumbInputId}
              className={cn(
                "absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-all hover:opacity-100",
                busyThumbnail && "cursor-wait opacity-100 bg-black/60",
                (disabled || busyGallery) && !busyThumbnail && "pointer-events-none",
              )}
            >
              {busyThumbnail ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
              ) : (
                <Camera className="h-6 w-6 text-white" aria-hidden />
              )}
              <input
                ref={thumbRef}
                id={thumbInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled || busyThumbnail || busyGallery}
                onChange={(e) => {
                  void takeThumb(e.target.files?.[0]);
                }}
              />
            </label>

            {thumbSrc && !busyThumbnail && onClearThumbnail ? (
              <button
                type="button"
                aria-label={chrome.remove_action}
                disabled={locked}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onClearThumbnail();
                }}
                className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md ring-2 ring-[var(--dama-card)] transition-transform hover:scale-105 hover:bg-red-500 disabled:opacity-50"
              >
                <X className="h-3 w-3" strokeWidth={3} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <p className="text-xs font-medium leading-relaxed text-[var(--dama-text)]">
          {chrome.thumbnail_hint}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-500">
              <Upload className="h-3.5 w-3.5" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-[var(--dama-text)]">
              {chrome.gallery_label}
            </span>
          </div>
          {slotsText ? (
            <span className="w-fit rounded-full border border-[var(--dama-border)] bg-[var(--dama-panel)] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[var(--dama-muted)]">
              {slotsText}
            </span>
          ) : null}
        </div>

        {gallery.length === 0 && !busyGallery ? (
          <p className="text-xs text-[var(--dama-muted)]">{chrome.gallery_empty}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {gallery.map((item, idx) => (
            <div
              key={`${item.raw}-${idx}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--dama-border)] bg-[var(--dama-panel)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" className="h-full w-full object-cover" />
              {onRemoveGallery ? (
                <button
                  type="button"
                  aria-label={chrome.remove_action}
                  disabled={locked}
                  onClick={() => {
                    void onRemoveGallery(idx);
                  }}
                  className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md ring-2 ring-[var(--dama-card)] transition-transform hover:scale-105 hover:bg-red-500 disabled:opacity-50"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                </button>
              ) : null}
            </div>
          ))}

          {busyGallery ? (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[var(--dama-border)] bg-[var(--dama-panel)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--dama-muted)]" aria-hidden />
              <span className="sr-only">{chrome.uploading_label}</span>
            </div>
          ) : null}

          {canAdd ? (
            <label
              htmlFor={galleryInputId}
              title={chrome.gallery_add_action}
              className={cn(
                "flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[var(--dama-border)] text-[var(--dama-text)] transition-all",
                "hover:border-[var(--dama-brand)]/50 hover:bg-[var(--dama-panel)]",
              )}
            >
              <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
              <span className="sr-only">{chrome.gallery_add_action}</span>
              <input
                ref={galleryRef}
                id={galleryInputId}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={!canAdd}
                onChange={(e) => {
                  void takeGallery(e.target.files);
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
