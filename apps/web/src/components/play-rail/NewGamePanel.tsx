"use client";

import {
  type ChallengeOpponent,
  CreateChallengeForm,
} from "@/components/play-rail/CreateChallengeForm";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import { OfficialPauseBanner } from "@/components/play/OfficialPauseBanner";
import { PlayPauseStopActions } from "@/components/play/PlayPauseStopActions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  playRailInnerListScrollClass,
  playRailPanelClass,
  playRailStickySubClass,
} from "@/lib/player-shell-ui";
import { cn } from "@/lib/utils";
import type { MatchClockPreset } from "@/types/platform";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Bot, Swords, Timer } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type NewSub = "ai" | "challenge";

type Props = {
  chrome: PlayRailChromeReady;
  sub: NewSub;
  onSubChange: (sub: NewSub) => void;
  clockSeconds?: number;
  timeControlPresets: MatchClockPreset[];
  timeControlsLoading?: boolean;
  /** Live AI session bits from HomePlayHub embed. */
  liveActive: boolean;
  liveNodes?: {
    resultNode?: ReactNode;
    historyNode?: ReactNode;
    metaNode?: ReactNode;
    stopLabel?: string;
    stopPending?: boolean;
    stopPendingLabel?: string;
    openStopConfirm?: () => void;
    paused?: boolean;
    pauseLabel?: string;
    pausePending?: boolean;
    pausePendingLabel?: string;
    onPause?: () => void;
    resumeLabel?: string;
    resumePending?: boolean;
    resumePendingLabel?: string;
    onResume?: () => void;
    pausedBlurb?: string;
    pauseRemainingMs?: number;
    pauseExpiresAtUnixMs?: number;
    pauseRemainingFmt?: string;
    officialPauseBannerLines?: string[];
    practiceBlurb?: string;
  };
  vsAi: boolean;
  aiLabel: string;
  practiceBlurb?: string;
  practiceUnavailable?: string;
  depths: number[];
  activeDepth: number | null;
  depthPrefix?: string;
  onDepthChange: (d: number) => void;
  /** Challenge-parity: selected match_clock.presets seconds. */
  onStartAi: (timeControlSeconds: number) => void;
  /** True while guest token / AI start handoff is in flight. */
  startAiBusy?: boolean;
  startAiPendingLabel?: string;
  colorsBlock: ReactNode;
  signedIn: boolean;
  matchLabel: string;
  matchBlurb?: string;
  challengeOpponent?: ChallengeOpponent | null;
  onClearChallengeOpponent?: () => void;
  loginHref?: string;
};

export function NewGamePanel({
  chrome,
  sub,
  onSubChange,
  clockSeconds,
  timeControlPresets,
  timeControlsLoading,
  liveActive,
  liveNodes,
  vsAi,
  aiLabel,
  practiceBlurb,
  practiceUnavailable,
  depths,
  activeDepth,
  depthPrefix,
  onDepthChange,
  onStartAi,
  startAiBusy,
  startAiPendingLabel,
  colorsBlock,
  signedIn,
  matchLabel,
  matchBlurb,
  challengeOpponent,
  onClearChallengeOpponent,
  loginHref,
}: Props) {
  const presets = useMemo(
    () =>
      (timeControlPresets || []).filter(
        (p) => typeof p.seconds === "number" && p.seconds > 0 && (p.label || "").trim(),
      ),
    [timeControlPresets],
  );
  const [aiClockSeconds, setAiClockSeconds] = useState(() => {
    const def = clockSeconds && clockSeconds > 0 ? clockSeconds : 0;
    if (def && presets.some((p) => p.seconds === def)) return def;
    return presets[0]?.seconds ?? 0;
  });
  useEffect(() => {
    if (presets.length === 0) return;
    if (!presets.some((p) => p.seconds === aiClockSeconds)) {
      const def = clockSeconds && clockSeconds > 0 ? clockSeconds : 0;
      setAiClockSeconds(presets.some((p) => p.seconds === def) ? def : (presets[0]?.seconds ?? 0));
    }
  }, [aiClockSeconds, clockSeconds, presets]);

  return (
    <div className={playRailPanelClass}>
      {!liveActive ? (
        <div
          className={cn(playRailStickySubClass, "grid grid-cols-2")}
          role="tablist"
          aria-label={chrome.new_game_modes_aria}
        >
          <button
            type="button"
            role="tab"
            aria-selected={sub === "ai"}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold sm:text-sm",
              sub === "ai"
                ? "border-b-2 border-[var(--dama-text)] text-[var(--dama-text)]"
                : "border-b-2 border-transparent text-[var(--dama-muted-foreground)] hover:text-[var(--dama-text)]",
            )}
            onClick={() => onSubChange("ai")}
          >
            <Bot className="h-3.5 w-3.5" aria-hidden />
            {chrome.sub_play_ai}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sub === "challenge"}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold sm:text-sm",
              sub === "challenge"
                ? "border-b-2 border-[var(--dama-text)] text-[var(--dama-text)]"
                : "border-b-2 border-transparent text-[var(--dama-muted-foreground)] hover:text-[var(--dama-text)]",
            )}
            onClick={() => onSubChange("challenge")}
          >
            <Swords className="h-3.5 w-3.5" aria-hidden />
            {chrome.sub_challenge}
          </button>
        </div>
      ) : null}

      <PlayRailScrollPort>
        <div
          className={cn(
            "flex flex-col",
            liveActive && liveNodes ? "gap-0" : "gap-3 p-4 pb-6 sm:p-5",
          )}
        >
          {liveActive && liveNodes ? (
            <>
              <div className="shrink-0 space-y-3 border-b border-[var(--dama-border)]/60 bg-[var(--dama-panel)] p-4 pb-3 sm:px-5">
                {(liveNodes.practiceBlurb || practiceBlurb || "").trim() ? (
                  <p className="text-sm text-[var(--dama-muted-foreground)]">
                    {(liveNodes.practiceBlurb || practiceBlurb || "").trim()}
                  </p>
                ) : null}
                {liveNodes.resultNode}
                {(liveNodes.officialPauseBannerLines?.length ?? 0) > 0 ||
                liveNodes.openStopConfirm ||
                liveNodes.onPause ||
                liveNodes.onResume ? (
                  <div className="space-y-2">
                    <OfficialPauseBanner lines={liveNodes.officialPauseBannerLines || []} />
                    {liveNodes.openStopConfirm || liveNodes.onPause || liveNodes.onResume ? (
                      <PlayPauseStopActions
                        paused={Boolean(liveNodes.paused)}
                        pauseLabel={liveNodes.pauseLabel}
                        pausePending={liveNodes.pausePending}
                        pausePendingLabel={liveNodes.pausePendingLabel}
                        onPause={liveNodes.onPause}
                        resumeLabel={liveNodes.resumeLabel}
                        resumePending={liveNodes.resumePending}
                        resumePendingLabel={liveNodes.resumePendingLabel}
                        onResume={liveNodes.onResume}
                        stopLabel={liveNodes.stopLabel}
                        stopPending={liveNodes.stopPending}
                        stopPendingLabel={liveNodes.stopPendingLabel}
                        onStop={liveNodes.openStopConfirm}
                        pausedBlurb={liveNodes.pausedBlurb}
                        pauseRemainingMs={liveNodes.pauseRemainingMs}
                        pauseExpiresAtUnixMs={liveNodes.pauseExpiresAtUnixMs}
                        pauseRemainingFmt={liveNodes.pauseRemainingFmt}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              {liveNodes.historyNode ? (
                <div
                  className={cn(playRailInnerListScrollClass, "min-w-0 shrink-0 px-4 pt-2 sm:px-5")}
                >
                  {liveNodes.historyNode}
                </div>
              ) : null}
              <div className="shrink-0 space-y-3 border-t border-[var(--dama-border)]/60 bg-[var(--dama-panel)] p-4 pb-6 sm:px-5">
                {liveNodes.metaNode ? <div className="min-w-0">{liveNodes.metaNode}</div> : null}
                {colorsBlock}
              </div>
            </>
          ) : sub === "ai" ? (
            !vsAi ? (
              <>
                <p className="text-sm text-[var(--dama-muted)]">{practiceUnavailable}</p>
                {colorsBlock}
              </>
            ) : (
              <>
                {(practiceBlurb || "").trim() ? (
                  <p className="text-sm text-[var(--dama-muted-foreground)]">{practiceBlurb}</p>
                ) : null}
                {depths.length > 0 ? (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="rail-ai-depth"
                      className="text-xs font-medium text-[var(--dama-muted-foreground)]"
                    >
                      {(depthPrefix || "").trim()}
                    </label>
                    <Select
                      value={activeDepth != null ? String(activeDepth) : undefined}
                      onValueChange={(v) => onDepthChange(Number(v))}
                    >
                      <SelectTrigger id="rail-ai-depth" className="h-11">
                        <SelectValue placeholder={(depthPrefix || "").trim() || undefined} />
                      </SelectTrigger>
                      <SelectContent>
                        {depths.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {depthPrefix ? `${depthPrefix} ${d}` : String(d)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {presets.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--dama-muted-foreground)]">
                      {chrome.label_time}
                    </p>
                    <div className="relative">
                      <Timer
                        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--dama-online)]"
                        aria-hidden
                      />
                      <Select
                        value={aiClockSeconds > 0 ? String(aiClockSeconds) : undefined}
                        onValueChange={(v) => setAiClockSeconds(Number(v))}
                      >
                        <SelectTrigger
                          id="rail-ai-time"
                          className="h-11 pl-9"
                          aria-label={chrome.label_time}
                        >
                          <SelectValue placeholder={chrome.label_time} />
                        </SelectTrigger>
                        <SelectContent>
                          {presets.map((p) => (
                            <SelectItem key={p.seconds} value={String(p.seconds)}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : timeControlsLoading ? (
                  <div className="space-y-1.5" aria-busy="true" aria-label={chrome.label_time}>
                    <ShimmerBlock className="h-3 w-16" />
                    <ShimmerBlock className="h-11 w-full rounded-md" />
                  </div>
                ) : (
                  <p className="text-sm text-[var(--dama-muted)]">
                    {chrome.toast_time_control_unavailable}
                  </p>
                )}
                <Button
                  type="button"
                  variant="play"
                  size="lg"
                  className="h-12 w-full text-base"
                  isLoading={Boolean(startAiBusy)}
                  pendingLabel={startAiPendingLabel}
                  disabled={!depths.length || activeDepth == null || !(aiClockSeconds > 0)}
                  onClick={() => {
                    if (presets.length === 0 || !(aiClockSeconds > 0)) {
                      toast.error(chrome.toast_time_control_unavailable);
                      return;
                    }
                    onStartAi(aiClockSeconds);
                  }}
                >
                  {aiLabel}
                </Button>
                {colorsBlock}
              </>
            )
          ) : (
            <>
              <CreateChallengeForm
                chrome={chrome}
                signedIn={signedIn}
                loginHref={loginHref}
                timeControlPresets={timeControlPresets}
                timeControlsLoading={timeControlsLoading}
                defaultClockSeconds={clockSeconds}
                blurb={matchBlurb}
                initialOpponent={challengeOpponent}
                onClearOpponent={onClearChallengeOpponent}
              />
              <div className="border-t border-[var(--dama-border)] pt-3">
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href="/?view=match">{matchLabel || chrome.find_matchmaking_action}</Link>
                </Button>
              </div>
              {colorsBlock}
            </>
          )}
        </div>
      </PlayRailScrollPort>
    </div>
  );
}
