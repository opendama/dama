import { isAppShellChromeReady, loadAppShellChrome } from "@/lib/app-shell-chrome";
import type { MetadataRoute } from "next";

type ConsoleNavMeta = {
  brand_title?: string;
  meta_description?: string;
};

async function loadConsoleNavMeta(): Promise<ConsoleNavMeta | null> {
  const base = (process.env.NEXT_PUBLIC_REST_URL || "").trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/platform/console-nav`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ConsoleNavMeta;
  } catch {
    return null;
  }
}

/** DB-driven console PWA manifest (fail closed empty when chrome unavailable). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [shell, nav] = await Promise.all([loadAppShellChrome(), loadConsoleNavMeta()]);
  if (!isAppShellChromeReady(shell)) {
    return {
      name: "",
      short_name: "",
      description: "",
      start_url: "/",
      display: "standalone",
      icons: [],
    };
  }
  const brandTitle = (nav?.brand_title || "").trim();
  const description = (nav?.meta_description || "").trim() || shell.manifest_description.trim();
  if (!brandTitle || !description) {
    return {
      name: "",
      short_name: "",
      description: "",
      start_url: "/",
      display: "standalone",
      icons: [],
    };
  }
  return {
    name: brandTitle,
    short_name: brandTitle,
    description,
    start_url: "/",
    display: "standalone",
    background_color: shell.manifest_background_color_dark.trim(),
    theme_color: shell.manifest_theme_color.trim(),
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-dark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
