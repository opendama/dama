"use client";

import { type RefObject, useLayoutEffect } from "react";

/** Publishes an element height to a CSS custom property on :root (smart-menu pattern). */
export function usePublishHeightCssVar(
  ref: RefObject<HTMLElement | null>,
  cssVarName: string,
  active = true,
) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    if (!active) {
      root.style.removeProperty(cssVarName);
      return;
    }

    let observer: ResizeObserver | null = null;
    let observed: HTMLElement | null = null;

    const syncHeight = (el: HTMLElement) => {
      const h = el.offsetHeight;
      // Never publish 0 - explicit `0px` disables `var(--x, fallback)` and collapses
      // bottom-nav clearance so page content hides under the fixed bar.
      if (h < 8) {
        root.style.removeProperty(cssVarName);
        return;
      }
      root.style.setProperty(cssVarName, `${h}px`);
    };

    const attach = () => {
      const el = ref.current;
      if (!el) {
        observer?.disconnect();
        observer = null;
        observed = null;
        root.style.removeProperty(cssVarName);
        return;
      }
      if (el !== observed) {
        observer?.disconnect();
        observed = el;
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            if (ref.current) syncHeight(ref.current);
          });
          observer.observe(el);
        }
      }
      syncHeight(el);
    };

    attach();
    // BottomNavBar portals after mount (skeleton → portal). Re-attach when the
    // underlying node swaps; ResizeObserver alone stays on the detached element.
    const intervalId = window.setInterval(attach, 250);

    return () => {
      window.clearInterval(intervalId);
      observer?.disconnect();
      root.style.removeProperty(cssVarName);
    };
  }, [ref, cssVarName, active]);
}
