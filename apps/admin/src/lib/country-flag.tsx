"use client";

import { restClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

/** Normalize ISO-3166 alpha-2 from API; empty when missing/invalid (never invent). */
export function normalizeCountryCode(code?: string | null): string {
  const cc = (code || "").trim().toUpperCase();
  if (cc.length !== 2) return "";
  const a = cc.charCodeAt(0);
  const b = cc.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return cc;
}

export function countryFlagImageUrl(
  code?: string | null,
  imageUrlTemplate?: string | null,
): string {
  const cc = normalizeCountryCode(code);
  const tmpl = (imageUrlTemplate || "").trim();
  if (!cc || !tmpl.includes("{code}")) return "";
  return tmpl.replaceAll("{code}", cc.toLowerCase());
}

type CountryFlagChrome = {
  image_url_template?: string;
};

function useFlagTemplate(override?: string | null) {
  const needFetch = !(override || "").trim().includes("{code}");
  const q = useQuery({
    queryKey: ["public", "country-flag-chrome"] as const,
    enabled: needFetch,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await restClient.get<CountryFlagChrome>("/public/country-flag-chrome");
      return data;
    },
  });
  if (!needFetch) return (override || "").trim();
  const tmpl = (q.data?.image_url_template || "").trim();
  return tmpl.includes("{code}") ? tmpl : "";
}

type CountryFlagProps = {
  code?: string | null;
  className?: string;
  imageUrlTemplate?: string | null;
};

/** Inline colored country flag. Renders nothing without ISO-2 + DB template. */
export function CountryFlag({ code, className, imageUrlTemplate }: CountryFlagProps) {
  const tmpl = useFlagTemplate(imageUrlTemplate);
  const src = countryFlagImageUrl(code, tmpl);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      title={normalizeCountryCode(code)}
      width={18}
      height={13}
      loading="lazy"
      decoding="async"
      className={cn(
        "inline-block h-[0.85em] w-[1.15em] shrink-0 rounded-[1px] object-cover align-[-0.12em]",
        className,
      )}
    />
  );
}
