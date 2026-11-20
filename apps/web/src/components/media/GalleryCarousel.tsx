"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type GalleryCarouselProps = {
  images: string[];
  ariaLabel: string;
  intervalMs?: number;
  className?: string;
  prevAriaLabel?: string;
  nextAriaLabel?: string;
  goToAriaTemplate?: string;
};

const SWIPE_PX = 50;

/**
 * Autoplay gallery with prev/next + drag/swipe (smart-menu DishCard / PublicDishCard).
 * Slides are viewport-sized wrappers (not bare imgs) so intrinsic image width cannot
 * bleed the next frame into the rounded media well.
 */
export function GalleryCarousel({
  images,
  ariaLabel,
  intervalMs = 3000,
  className,
  prevAriaLabel,
  nextAriaLabel,
  goToAriaTemplate,
}: GalleryCarouselProps) {
  const slides = images.filter((url) => typeof url === "string" && url.trim().length > 0);
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [viewportW, setViewportW] = useState(0);
  const slideKey = slides.join("\0");
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const pauseUntil = useRef(0);

  useLayoutEffect(() => {
    void slideKey;
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth || 0);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [slideKey]);

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
    pointerStart.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointerStart.current || slides.length <= 1) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      pointerStart.current = null;
      setDragging(false);
      setDragPx(0);
      return;
    }
    setDragPx(dx);
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
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--dama-surface)]/40",
          className,
        )}
        aria-hidden
      >
        <Star className="h-4 w-4 text-[var(--dama-muted)]/20" aria-hidden />
      </div>
    );
  }

  const measured = viewportW > 0;
  const width = measured ? viewportW : 1;
  const trackX = -(index * width) + dragPx;

  return (
    <section
      ref={rootRef}
      className={cn(
        "group/carousel relative h-full w-full min-w-0 touch-pan-y overflow-hidden",
        className,
      )}
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Defer track until measured - avoids adjacent-slide peek at viewportW=0. */}
      <div
        className={cn("flex h-full will-change-transform", !measured && "invisible")}
        style={{
          width: measured ? viewportW * slides.length : undefined,
          transform: measured ? `translate3d(${trackX}px, 0, 0)` : undefined,
          transition: dragging ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {slides.map((url, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: carousel slides may share urls
            key={`${url}::${i}`}
            className="relative h-full shrink-0 grow-0 overflow-hidden"
            style={{
              width: measured ? viewportW : "100%",
              flexBasis: measured ? viewportW : "100%",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
            />
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label={(prevAriaLabel || "").trim() || ariaLabel}
            // DishCard: dark translucent disc + white chevron - readable on any photo/theme.
            className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-black/55 text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-[2px]"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ChevronLeft className="h-3.5 w-3.5 text-white" strokeWidth={2.75} />
          </button>
          <button
            type="button"
            aria-label={(nextAriaLabel || "").trim() || ariaLabel}
            className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-black/55 text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-[2px]"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={2.75} />
          </button>
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1">
            {slides.map((url, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: carousel dots may share urls
                key={`${url}::dot::${i}`}
                type="button"
                aria-label={
                  (goToAriaTemplate || "").replace("{n}", String(i + 1)).trim() || ariaLabel
                }
                className={`pointer-events-auto h-[3px] w-[3px] rounded-full transition-opacity ${
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
