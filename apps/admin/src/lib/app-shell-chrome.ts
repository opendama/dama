export type AppShellChrome = {
  source?: string;
  app_shell_unavailable?: string;
  brand_mark_alt?: string;
  not_found_code?: string;
  not_found_title?: string;
  not_found_blurb?: string;
  not_found_home_action?: string;
  not_found_home_href?: string;
  admin_not_found_home_href?: string;
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
  admin_robots?: string;
};

const REQUIRED = [
  "app_shell_unavailable",
  "not_found_code",
  "not_found_title",
  "not_found_blurb",
  "not_found_home_action",
  "not_found_home_href",
  "admin_not_found_home_href",
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
  "admin_robots",
  "brand_mark_alt",
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
