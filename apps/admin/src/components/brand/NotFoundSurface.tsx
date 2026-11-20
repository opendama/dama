"use client";

import { DamaWordmark } from "@/components/brand/dama-wordmark";
import { Button } from "@/components/ui/button";
import { isAppShellChromeReady, type AppShellChrome } from "@/lib/app-shell-chrome";
import Link from "next/link";
import { useEffect, useState } from "react";

function restBase(): string {
  return (process.env.NEXT_PUBLIC_REST_URL || "").trim().replace(/\/$/, "");
}

/** Branded console 404 surface (DB app_shell_chrome, fail closed). */
export function NotFoundSurface() {
  const [chrome, setChrome] = useState<AppShellChrome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const base = restBase();
    if (!base) {
      setLoading(false);
      return;
    }
    void fetch(`${base}/public/app-shell-chrome`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as AppShellChrome;
      })
      .then((doc) => {
        if (!cancelled) setChrome(doc);
      })
      .catch(() => {
        if (!cancelled) setChrome(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 py-16">
        <DamaWordmark size="xl" alt="" priority />
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--dama-surface)]" aria-hidden />
      </main>
    );
  }

  if (!isAppShellChromeReady(chrome)) {
    const unavailable = (chrome?.app_shell_unavailable || "").trim();
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <DamaWordmark size="xl" alt="" priority />
        {unavailable ? <p className="text-sm text-[var(--dama-muted)]">{unavailable}</p> : null}
      </main>
    );
  }

  const href = chrome.admin_not_found_home_href.trim();
  const markAlt = chrome.brand_mark_alt.trim();

  return (
    <main className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(163,29,56,0.18),transparent_60%)]"
        aria-hidden
      />
      <div className="relative flex max-w-md flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-3">
          <DamaWordmark size="xl" alt={markAlt} priority />
          {markAlt ? (
            <p className="font-display text-2xl font-bold tracking-tight text-[var(--dama-text)]">
              {markAlt}
            </p>
          ) : null}
        </div>
        <p className="font-mono text-sm tracking-[0.2em] text-[var(--dama-brand)]">
          {chrome.not_found_code.trim()}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--dama-text)]">
          {chrome.not_found_title.trim()}
        </h1>
        <p className="text-sm leading-relaxed text-[var(--dama-muted)]">
          {chrome.not_found_blurb.trim()}
        </p>
        {href.startsWith("/") && !href.startsWith("//") ? (
          <Button asChild className="mt-2">
            <Link href={href}>{chrome.not_found_home_action.trim()}</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
