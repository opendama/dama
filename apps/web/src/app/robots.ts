import {
  isAppShellChromeReady,
  loadAppShellChrome,
  parseSeoPathList,
} from "@/lib/app-shell-chrome";
import { siteOrigin } from "@/lib/site-url";
import type { MetadataRoute } from "next";

/** DB-driven robots.txt from app_shell_chrome (fail closed empty when chrome incomplete). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = siteOrigin();
  const shell = await loadAppShellChrome();
  if (!isAppShellChromeReady(shell)) {
    return { rules: [] };
  }
  const allow = parseSeoPathList(shell.seo_robots_allow.trim());
  const disallow = parseSeoPathList(shell.seo_robots_disallow.trim());
  if (allow.length === 0 && disallow.length === 0) {
    return { rules: [] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        ...(allow.length ? { allow } : {}),
        ...(disallow.length ? { disallow } : {}),
      },
    ],
    ...(origin
      ? {
          sitemap: `${origin}/sitemap.xml`,
          host: origin.replace(/^https?:\/\//, ""),
        }
      : {}),
  };
}
