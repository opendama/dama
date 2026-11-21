import {
  isAppShellChromeReady,
  loadAppShellChrome,
  parseSeoSitemap,
} from "@/lib/app-shell-chrome";
import { siteOrigin } from "@/lib/site-url";
import type { MetadataRoute } from "next";

/** DB-driven sitemap from app_shell_chrome.seo_sitemap (fail closed empty). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  if (!origin) return [];
  const shell = await loadAppShellChrome();
  if (!isAppShellChromeReady(shell)) return [];
  const entries = parseSeoSitemap(shell.seo_sitemap.trim());
  if (entries.length === 0) return [];
  const lastModified = new Date();
  return entries.map(({ path, changeFrequency, priority }) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
