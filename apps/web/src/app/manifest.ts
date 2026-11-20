import { isAppShellChromeReady, loadAppShellChrome } from "@/lib/app-shell-chrome";
import type { MetadataRoute } from "next";

/** DB-driven PWA manifest (fail closed empty when app_shell_chrome unavailable). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shell = await loadAppShellChrome();
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
  return {
    name: shell.manifest_name.trim(),
    short_name: shell.manifest_short_name.trim(),
    description: shell.manifest_description.trim(),
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
        src: "/icon-512-light.png",
        sizes: "512x512",
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
