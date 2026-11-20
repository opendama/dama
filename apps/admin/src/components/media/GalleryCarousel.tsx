"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type GalleryCarouselProps = {
  images: string[];
  ariaLabel: string;
  intervalMs?: number;
  className?: string;
};

const SWIPE_PX = 50;

/** Autoplay gallery with prev/next + drag/swipe (aligned with player GalleryCarousel). */
export function GalleryCarousel({
  images,
  ariaLabel,
  intervalMs = 3000,
  className = "relative aspect-[16/10] w-full max-w-md overflow-hidden rounded-lg bg-[var(--dama-surface)]",
}: GalleryCarouselProps) {
  const slides = images.filter((url) => typeof url === "string" && url.trim().length > 0);
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const slideKey = slides.join("\0");
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const widthRef = useRef(1);
  const rootRef = useRef<HTMLElement>(null);
  const pauseUntil = useRef(0);

  useEffect(() => {
    void slideKey;
    setIndex(0);
    setDragPx(0);
  }, [slideKey]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (slides.length <= 1) return;
      pauseUntil.current = Date.now() + intervalMs * 2;
      setIndex((prev) => (prev + dir + slides.length) % slides.length);
      setDragPx(0);
    },
    [slides.length, intervalMs],
  );

  useEffect(() => {
    void slideKey;
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current || pointerStart.current) return;
      setIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs, slideKey]);

  function onPointerDown(e: React.PointerEvent) {
    if (slides.length <= 1) return;
    const el = rootRef.current;
    widthRef.current = el?.clientWidth || 1;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointerStart.current || slides.length <= 1) return;
    setDragPx(e.clientX - pointerStart.current.x);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointerStart.current || slides.length <= 1) {
      pointerStart.current = null;
      setDragging(false);
      setDragPx(0);
      return;
    }
    const dx = e.clientX - pointerStart.current.x;
    pointerStart.current = null;
    setDragging(false);
    if (dx <= -SWIPE_PX) go(1);
    else if (dx >= SWIPE_PX) go(-1);
    else setDragPx(0);
  }

  if (slides.length === 0) {
    return <div className={className} aria-hidden />;
  }

  const offsetPct = -index * 100;
  const dragPct = (dragPx / widthRef.current) * 100;

  return (
    <section
      ref={rootRef}
      className={cn(className, "group/carousel touch-pan-y")}
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="flex h-full w-full"
        style={{
          transform: `translate3d(calc(${offsetPct}% + ${dragPct}%), 0, 0)`,
          transition: dragging ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {slides.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // biome-ignore lint/suspicious/noArrayIndexKey: carousel slides may share urls
            key={`${url}::${i}`}
            src={url}
            alt=""
            draggable={false}
            className="h-full w-full shrink-0 grow-0 basis-full object-cover select-none"
          />
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className="absolute left-1.5 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-100 backdrop-blur-[4px] transition-opacity sm:opacity-0 sm:group-hover/carousel:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ChevronLeft className="h-2.5 w-2.5 stroke-[3]" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            className="absolute right-1.5 top-1/2 z-10 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-100 backdrop-blur-[4px] transition-opacity sm:opacity-0 sm:group-hover/carousel:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ChevronRight className="h-2.5 w-2.5 stroke-[3]" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1">
            {slides.map((url, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: carousel dots may share urls
                key={`${url}::dot::${i}`}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                className={`h-[3px] w-[3px] rounded-full transition-opacity ${
                  i === index ? "bg-white opacity-100" : "bg-white opacity-50"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  pauseUntil.current = Date.now() + intervalMs * 2;
                  setIndex(i);
                  setDragPx(0);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
