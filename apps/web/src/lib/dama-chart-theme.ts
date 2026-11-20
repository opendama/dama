"use client";

import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

/** Trim admin-chart-theme parity - paint colors from live CSS tokens only (fail closed). */
export type DamaChartTheme = {
  grid: string;
  axis: string;
  axisLine: string;
  muted: string;
  subtle: string;
  border: string;
  popover: string;
  popoverFg: string;
  fg: string;
  floatShadow: string;
  ready: boolean;
};

function readCssVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readTheme(): DamaChartTheme {
  const border = readCssVar("--dama-border");
  const muted = readCssVar("--dama-muted");
  const fg = readCssVar("--dama-text");
  const popover = readCssVar("--dama-card");
  const floatShadow = readCssVar("--dama-card-shadow") || readCssVar("--dama-float-shadow");
  const ready = Boolean(border && muted && fg && popover);
  return {
    grid: border,
    axis: muted,
    axisLine: border,
    muted,
    subtle: muted,
    border,
    popover,
    popoverFg: fg,
    fg,
    floatShadow,
    ready,
  };
}

function themeEqual(a: DamaChartTheme, b: DamaChartTheme): boolean {
  return (
    a.ready === b.ready &&
    a.grid === b.grid &&
    a.axis === b.axis &&
    a.axisLine === b.axisLine &&
    a.muted === b.muted &&
    a.subtle === b.subtle &&
    a.border === b.border &&
    a.popover === b.popover &&
    a.popoverFg === b.popoverFg &&
    a.fg === b.fg &&
    a.floatShadow === b.floatShadow
  );
}

let cached: DamaChartTheme | null = null;

function getTheme(): DamaChartTheme {
  const next = readTheme();
  if (cached && themeEqual(cached, next)) return cached;
  cached = next;
  return cached;
}

const SSR: DamaChartTheme = {
  grid: "",
  axis: "",
  axisLine: "",
  muted: "",
  subtle: "",
  border: "",
  popover: "",
  popoverFg: "",
  fg: "",
  floatShadow: "",
  ready: false,
};

function subscribe(onStoreChange: () => void) {
  if (typeof document === "undefined") return () => {};
  const obs = new MutationObserver(onStoreChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  queueMicrotask(onStoreChange);
  return () => obs.disconnect();
}

export function useDamaChartTheme(): DamaChartTheme {
  return useSyncExternalStore(subscribe, getTheme, () => SSR);
}

export function damaChartTooltipStyle(t: DamaChartTheme): CSSProperties {
  return {
    background: t.popover,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.popoverFg,
    boxShadow: t.floatShadow || undefined,
  };
}

/**
 * Resolve DB chrome series color to a paint color.
 * Accepts `var(--dama-*)` or legacy `bg-[var(--dama-*)]`. Empty = fail closed.
 */
export function resolveSeriesColor(raw: string): string {
  const s = (raw || "").trim();
  if (!s || typeof window === "undefined") return "";
  const fromBg = s.match(/bg-\[var\((--[a-z0-9-]+)\)\]/i);
  const fromVar = s.match(/^var\((--[a-z0-9-]+)\)$/i);
  const token = fromBg?.[1] || fromVar?.[1];
  if (!token) {
    if (/^(#|hsl\(|rgb\(|oklch\()/i.test(s)) return s;
    return "";
  }
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    const t = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
    return `${t.replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    const v = n / 1_000;
    const t = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
    return `${t.replace(/\.0$/, "")}k`;
  }
  return String(Math.round(n));
}

/**
 * Trim formatDateShort parity for UTC YYYY-MM-DD buckets - includes year.
 * Fixed `en-US` locale (never `undefined`) so SSR + client hydrate identically
 * and period switches do not remount from locale mismatch flicker.
 */
export function formatBucketDayLabel(bucket: string): string {
  const raw = (bucket || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [ys, ms, ds] = raw.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(dt);
  } catch {
    return "";
  }
}

/** Month label for YYYY-MM (heatmap peak_month / calendar headers). */
export function formatBucketMonthLabel(ym: string): string {
  const raw = (ym || "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return "";
  const [ys, ms] = raw.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return "";
  const dt = new Date(Date.UTC(y, m - 1, 1));
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(dt);
  } catch {
    return "";
  }
}

export function sharePct(part: number, total: number): number | undefined {
  if (!(total > 0) || !Number.isFinite(part)) return undefined;
  return Math.round((part / total) * 1000) / 10;
}

function readCssVarOnClient(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Pie slice colors from live Dama tokens (fail closed on empty reads). */
export function chartPiePalette(): string[] {
  const gold = readCssVarOnClient("--dama-gold");
  const text = readCssVarOnClient("--dama-text");
  const muted = readCssVarOnClient("--dama-muted");
  const border = readCssVarOnClient("--dama-border");
  const brand = readCssVarOnClient("--dama-brand");
  const out = [gold, text, muted, brand, border].filter(Boolean);
  return out.length > 0 ? out : [text || muted].filter(Boolean);
}

/** Outcome bar fills (decisive / draw). */
export function chartOutcomeColors(): { success: string; error: string } {
  const gold = readCssVarOnClient("--dama-gold");
  const danger = readCssVarOnClient("--dama-danger");
  const muted = readCssVarOnClient("--dama-muted");
  return {
    success: gold || muted,
    error: danger || muted,
  };
}
