import { NotFoundSurface } from "@/components/brand/NotFoundSurface";
import { isAppShellChromeReady, loadAppShellChrome } from "@/lib/app-shell-chrome";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await loadAppShellChrome();
  if (!isAppShellChromeReady(chrome)) {
    return { title: "", robots: { index: false, follow: false } };
  }
  return {
    title: chrome.not_found_title.trim(),
    robots: { index: false, follow: false },
  };
}

export default function NotFound() {
  return <NotFoundSurface />;
}
