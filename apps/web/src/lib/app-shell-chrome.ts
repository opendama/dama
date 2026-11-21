export type AppShellChrome = {
  source?: string;
  app_shell_unavailable?: string;
  splash_hold_ms?: string;
  splash_unavailable?: string;
  splash_background_color?: string;
  splash_logo_ink?: string;
  brand_mark_alt?: string;
  not_found_code?: string;
  not_found_title?: string;
  not_found_blurb?: string;
  not_found_home_action?: string;
  not_found_home_href?: string;
  onboarding_unavailable?: string;
  skip_action?: string;
  next_action?: string;
  done_action?: string;
  slide_1_title?: string;
  slide_1_blurb?: string;
  slide_2_title?: string;
  slide_2_blurb?: string;
  slide_3_title?: string;
  slide_3_blurb?: string;
  og_image_path?: string;
  favicon_light_path?: string;
  favicon_dark_path?: string;
  apple_touch_icon_path?: string;
  manifest_name?: string;
  manifest_short_name?: string;
  manifest_description?: string;
  manifest_theme_color?: string;
  manifest_background_color_light?: string;
  manifest_background_color_dark?: string;
  twitter_card?: string;
  robots_index?: string;
  admin_robots?: string;
  admin_not_found_home_href?: string;
  mobile_android_application_id?: string;
  mobile_ios_bundle_id?: string;
  mobile_display_name?: string;
  mobile_oauth_scheme?: string;
  mobile_oauth_host?: string;
  mobile_oauth_redirect_url?: string;
  seo_locale?: string;
  seo_og_type?: string;
  seo_robots_allow?: string;
  seo_robots_disallow?: string;
  seo_sitemap?: string;
};

const REQUIRED = [
  "app_shell_unavailable",
  "not_found_code",
  "not_found_title",
  "not_found_blurb",
  "not_found_home_action",
  "not_found_home_href",
  "og_image_path",
  "favicon_light_path",
  "favicon_dark_path",
  "apple_touch_icon_path",
  "manifest_name",
  "manifest_short_name",
  "manifest_description",
  "manifest_theme_color",
  "manifest_background_color_light",
  "manifest_background_color_dark",
  "twitter_card",
  "robots_index",
  "brand_mark_alt",
  "seo_locale",
  "seo_og_type",
  "seo_robots_allow",
  "seo_robots_disallow",
  "seo_sitemap",
] as const;

export function isAppShellChromeReady(
  chrome: AppShellChrome | null | undefined,
): chrome is Required<Pick<AppShellChrome, (typeof REQUIRED)[number]>> & AppShellChrome {
  if (!chrome) return false;
  return REQUIRED.every(
    (k) => typeof chrome[k] === "string" && (chrome[k] || "").trim().length > 0,
  );
}

export async function loadAppShellChrome(): Promise<AppShellChrome | null> {
  const base = (process.env.NEXT_PUBLIC_REST_URL || "").trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/public/app-shell-chrome`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppShellChrome;
  } catch {
    return null;
  }
}

/** Parse DB robots_index like "index, follow" into Next Metadata robots. */
export function parseRobotsIndex(raw: string): { index: boolean; follow: boolean } {
  const parts = raw
    .toLowerCase()
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    index: parts.includes("index") && !parts.includes("noindex"),
    follow: parts.includes("follow") && !parts.includes("nofollow"),
  };
}

/** Split DB newline path lists (seo_robots_allow / seo_robots_disallow). */
export function parseSeoPathList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export type SeoSitemapEntry = {
  path: string;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
};

const SITEMAP_FREQ = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
]);

/** Parse DB seo_sitemap lines: path|changefreq|priority */
export function parseSeoSitemap(raw: string): SeoSitemapEntry[] {
  const out: SeoSitemapEntry[] = [];
  for (const line of parseSeoPathList(raw)) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length !== 3) continue;
    const [path, freq, priRaw] = parts;
    if (!path.startsWith("/") || path.startsWith("//")) continue;
    if (!SITEMAP_FREQ.has(freq)) continue;
    const priority = Number(priRaw);
    if (!Number.isFinite(priority) || priority < 0 || priority > 1) continue;
    out.push({
      path,
      changeFrequency: freq as SeoSitemapEntry["changeFrequency"],
      priority,
    });
  }
  return out;
}
