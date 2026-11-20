import { NotFoundSurface } from "@/components/brand/NotFoundSurface";
import { isAppShellChromeReady, loadAppShellChrome } from "@/lib/app-shell-chrome";
import { resolveMetadataOrigin } from "@/lib/site-url";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const [chrome, origin] = await Promise.all([loadAppShellChrome(), resolveMetadataOrigin()]);
  const base = origin ? { metadataBase: new URL(origin) } : {};
  if (!isAppShellChromeReady(chrome)) {
    return { ...base, title: "", robots: { index: false, follow: false } };
  }
  return {
    ...base,
    title: chrome.not_found_title.trim(),
    robots: { index: false, follow: false },
  };
}

export default function NotFound() {
  return <NotFoundSurface />;
}
