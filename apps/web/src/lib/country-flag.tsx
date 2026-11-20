"use client";

import {
  isCountryFlagChromeReady,
  useCountryFlagChromeQuery,
} from "@/hooks/query/useCountryFlagChromeQuery";
import { cn } from "@/lib/utils";

/** Normalize ISO-3166 alpha-2 from API; empty when missing/invalid (never invent). */
export function normalizeCountryCode(code?: string | null): string {
  const cc = (code || "").trim().toUpperCase();
  if (cc.length !== 2) return "";
  const a = cc.charCodeAt(0);
  const b = cc.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return cc;
}

/**
 * Build colored flag image URL from DB chrome template + ISO-2.
 * Template must contain `{code}` (e.g. from `country_flag_chrome.image_url_template`).
 */
export function countryFlagImageUrl(
  code?: string | null,
  imageUrlTemplate?: string | null,
): string {
  const cc = normalizeCountryCode(code);
  const tmpl = (imageUrlTemplate || "").trim();
  if (!cc || !tmpl.includes("{code}")) return "";
  return tmpl.replaceAll("{code}", cc.toLowerCase());
}

type CountryFlagProps = {
  code?: string | null;
  className?: string;
  /** Visual size; Chess.com list flags are ~16×12 (4:3). */
  size?: "sm" | "md";
  /**
   * Optional DB template from an already-loaded chrome blob
   * (`country_flag_image_url_template` / `image_url_template`).
   * When omitted, loads `GET /public/country-flag-chrome` (fail closed).
   */
  imageUrlTemplate?: string | null;
};

/** Inline colored country flag after username/rating. Renders nothing without ISO-2 + DB template. */
export function CountryFlag({ code, className, size = "sm", imageUrlTemplate }: CountryFlagProps) {
  const needFetch = !(imageUrlTemplate || "").trim().includes("{code}");
  const chromeQuery = useCountryFlagChromeQuery(needFetch);
  const tmpl = needFetch
    ? isCountryFlagChromeReady(chromeQuery.data)
      ? chromeQuery.data.image_url_template
      : ""
    : (imageUrlTemplate || "").trim();
  const src = countryFlagImageUrl(code, tmpl);
  if (!src) return null;
  const dims =
    size === "md"
      ? { width: 22, height: 16, className: "h-4 w-[1.375rem]" }
      : { width: 18, height: 13, className: "h-[0.85em] w-[1.15em]" };
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote ISO flag from DB template URL
    <img
      src={src}
      alt=""
      title={normalizeCountryCode(code)}
      width={dims.width}
      height={dims.height}
      loading="lazy"
      decoding="async"
      className={cn(
        "inline-block shrink-0 rounded-[1px] object-cover align-[-0.12em]",
        dims.className,
        className,
      )}
    />
  );
}
