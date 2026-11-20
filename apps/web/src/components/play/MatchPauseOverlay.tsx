"use client";

import { MatchIntroOverlay, type MatchIntroPlayer } from "@/components/chat/MatchIntroOverlay";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export type MatchPauseOverlayProps = {
  active: boolean;
  vsLabel: string;
  ariaLabel: string;
  /** Eyebrow: Player pause / Official pause (DB chrome). */
  statusLabel: string;
  /** Pause banner blurb on the blurred cover (official or player). */
  bannerLine?: string;
  /** Who paused (role · name). */
  byLine?: string;
  reasonLine?: string;
  noteLine?: string;
  sinceLine?: string;
  /** Static footer (e.g. official until-resume). */
  footerLine?: string;
  /** Player pause: play_chrome.pause_remaining_fmt with `{time}` → m:ss. */
  footerLineFmt?: string;
  expiresAtUnixMs?: number;
  top: MatchIntroPlayer;
  bottom: MatchIntroPlayer;
  nameMaxChars?: string;
  nameSuffix?: string;
  className?: string;
};

function formatRemainingMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Persistent board cover while a match is paused (player or official).
 * Same blur / VS / seats language as MatchIntroOverlay; stays until resume.
 */
export function MatchPauseOverlay({
  active,
  vsLabel,
  ariaLabel,
  statusLabel,
  bannerLine,
  byLine,
  reasonLine,
  noteLine,
  sinceLine,
  footerLine,
  footerLineFmt,
  expiresAtUnixMs,
  top,
  bottom,
  nameMaxChars,
  nameSuffix,
  className,
}: MatchPauseOverlayProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expires = Number(expiresAtUnixMs) || 0;
  const fmt = (footerLineFmt || "").trim();
  const tickCountdown = active && Boolean(fmt) && expires > 0;

  useEffect(() => {
    if (!tickCountdown) return;
    // Keep expires in deps so a new server deadline restarts the ticker.
    void expires;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [tickCountdown, expires]);

  const countdownLine = useMemo(() => {
    if (!tickCountdown || !fmt) return "";
    const remain = Math.max(0, expires - nowMs);
    return fmt.split("{time}").join(formatRemainingMs(remain)).trim();
  }, [expires, fmt, nowMs, tickCountdown]);

  const status = (statusLabel || "").trim();
  const banner = (bannerLine || "").trim();
  const by = (byLine || "").trim();
  const reason = (reasonLine || "").trim();
  const note = (noteLine || "").trim();
  const since = (sinceLine || "").trim();
  const footer = (countdownLine || (footerLine || "").trim()).trim();
  const vs = (vsLabel || "").trim();
  const aria = (ariaLabel || "").trim();

  if (!active || !vs || !aria || !status) return null;

  const metaLines = [banner, by, reason, note, since].filter(Boolean);
  const hasDetails = metaLines.length > 0 || Boolean(footer);

  return (
    <div className={cn("absolute inset-0 z-40", className)}>
      <MatchIntroOverlay
        active
        persistent
        vsLabel={vs}
        ariaLabel={aria}
        startingLabel={status}
        durationMs={0}
        top={top}
        bottom={bottom}
        nameMaxChars={nameMaxChars}
        nameSuffix={nameSuffix}
      />
      {hasDetails ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-5">
          <div
            aria-live="polite"
            className="max-w-md rounded-lg border-2 border-[var(--dama-border)] bg-[var(--dama-card)] px-3.5 py-2.5 text-center shadow-[0_8px_28px_color-mix(in_srgb,var(--dama-text)_18%,transparent)]"
          >
            <ul className="space-y-1 text-xs sm:text-sm">
              {metaLines.map((line) => (
                <li
                  key={line}
                  className="leading-snug font-semibold tracking-tight text-[var(--dama-text)]"
                >
                  {line}
                </li>
              ))}
              {footer ? (
                <li className="leading-snug font-bold tabular-nums tracking-tight text-[var(--dama-brand)] dark:text-[var(--dama-text)]">
                  {footer}
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
