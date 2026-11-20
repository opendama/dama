"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { useMatchmakingRealtime } from "@/components/matchmaking/MatchmakingRealtimeProvider";
import { PlayerSearchTypeahead } from "@/components/play-rail/PlayerSearchTypeahead";
import { MatchSeatAvatars } from "@/components/player/MatchSeatAvatars";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchmakingQueueSkeleton, ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  useMatchmakingJoinMutation,
  useMatchmakingLeaveMutation,
  useSendInviteMutation,
} from "@/hooks/mutation";
import { useMatchmakingChromeQuery } from "@/hooks/query/useMatchmakingChromeQuery";
import { useMatchmakingStatusQuery } from "@/hooks/query/useMatchmakingStatusQuery";
import {
  isPlayRailChromeReady,
  usePlayRailChromeQuery,
} from "@/hooks/query/usePlayRailChromeQuery";
import { useProgressionQuery } from "@/hooks/query/useProgressionQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { CountryFlag } from "@/lib/country-flag";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { isMatchmakingChromeReady } from "@/types/matchmaking-chrome";
import type { MatchmakingSelfCard } from "@/types/player";
import { Swords, Timer } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

/** SSR + hydrate pass stay on skeleton; client snapshot can paint cache-first chrome. */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function MatchmakingPage() {
  const isClient = useIsClient();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const chromeQuery = useMatchmakingChromeQuery(true);
  // Prefer cached chrome immediately (Play hub already warms this query) - after hydrate only.
  const chrome = isMatchmakingChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const railChromeQuery = usePlayRailChromeQuery(true);
  const railChrome = isPlayRailChromeReady(railChromeQuery.data) ? railChromeQuery.data : undefined;
  const progressionQuery = useProgressionQuery();
  const presets = useMemo(() => {
    const raw = progressionQuery.data?.match_clock?.presets;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p) => typeof p?.seconds === "number" && p.seconds > 0 && (p.label || "").trim(),
    );
  }, [progressionQuery.data?.match_clock?.presets]);
  const defaultClockSeconds = progressionQuery.data?.match_clock?.initial_seconds ?? 0;
  const [clockSeconds, setClockSeconds] = useState(0);
  const [rated, setRated] = useState(true);
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  useEffect(() => {
    if (presets.length === 0) {
      setClockSeconds(0);
      return;
    }
    setClockSeconds((prev) => {
      if (prev > 0 && presets.some((p) => p.seconds === prev)) return prev;
      if (defaultClockSeconds > 0 && presets.some((p) => p.seconds === defaultClockSeconds)) {
        return defaultClockSeconds;
      }
      return presets[0]?.seconds ?? 0;
    });
  }, [defaultClockSeconds, presets]);
  const realtime = useMatchmakingRealtime();
  const [queueSize, setQueueSize] = useState<number | null>(null);
  const [queued, setQueued] = useState(false);
  const [selfCard, setSelfCard] = useState<MatchmakingSelfCard | null>(null);
  const publicSelfQuery = usePublicPlayerQuery(user?.id, Boolean(user?.id));
  const {
    data: statusData,
    refetch: refetchStatus,
    isLoading: statusLoading,
    isError: statusError,
    isFetched: statusFetched,
  } = useMatchmakingStatusQuery(token);
  const joinMutation = useMatchmakingJoinMutation(token);
  const leaveMutation = useMatchmakingLeaveMutation(token);
  const inviteMutation = useSendInviteMutation(token);
  const [inviteTo, setInviteTo] = useState("");
  const busy = joinMutation.isPending || leaveMutation.isPending || inviteMutation.isPending;

  useEffect(() => {
    if (!statusData) return;
    if (typeof statusData.size === "number") setQueueSize(statusData.size);
    setQueued(statusData.queued);
  }, [statusData]);

  useEffect(() => {
    if (typeof realtime.queueSize === "number") setQueueSize(realtime.queueSize);
  }, [realtime.queueSize]);

  useEffect(() => {
    if (realtime.lastMatch) setQueued(false);
  }, [realtime.lastMatch]);

  useEffect(() => {
    const res = publicSelfQuery.data;
    if (!res) return;
    // Prefer auth write-through (upload / WS) over cached public-player.
    const liveThumb =
      (user?.avatarThumbUrl || "").trim() ||
      (user?.avatarFullUrl || "").trim() ||
      (res.player.avatar_thumb_url || "").trim() ||
      null;
    setSelfCard({
      id: res.player.id,
      username: res.player.username,
      rating: res.player.rating,
      avatar_thumb_url: liveThumb,
      country_code: res.player.country_code,
      host_trust_tier: res.player.host_trust_tier ?? null,
      host_trust_badge: res.player.host_trust_badge ?? null,
    });
  }, [publicSelfQuery.data, user?.avatarThumbUrl, user?.avatarFullUrl]);

  // Hydration-stable: server HTML + hydrate pass always use the skeleton root.
  // After hydrate, cache-first chrome from Play hub paints without remount flicker.
  if (!isClient || !chrome) {
    if (isClient && chromeQuery.isError) {
      const unavailable = (chromeQuery.data?.matchmaking_chrome_unavailable || "").trim();
      return (
        <div className="w-full space-y-4">
          {unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null}
        </div>
      );
    }
    return <MatchmakingQueueSkeleton />;
  }

  const signedIn = hydrated && Boolean(token);
  const matchedSeats = realtime.lastMatch
    ? { p1: realtime.lastMatch.player1Id, p2: realtime.lastMatch.player2Id }
    : null;

  return (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">{chrome.title}</h1>
        <p className="text-sm text-[var(--dama-muted)]">{chrome.blurb}</p>

        {selfCard ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
            <DamaUserAvatar src={selfCard.avatar_thumb_url} className="h-12 w-12 rounded-full" />
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="truncate">{selfCard.username}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
                  ({selfCard.rating})
                </span>
                <CountryFlag code={selfCard.country_code} />
              </p>
              <HostTrustBadge
                label={selfCard.host_trust_badge}
                tier={selfCard.host_trust_tier}
                className="mt-1 text-[9px]"
              />
            </div>
          </div>
        ) : signedIn && statusLoading ? (
          <ShimmerBlock className="h-20 w-full rounded-xl" />
        ) : null}

        {matchedSeats ? (
          <MatchSeatAvatars player1Id={matchedSeats.p1} player2Id={matchedSeats.p2} />
        ) : null}

        {signedIn ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gold"
              disabled={busy || queued || Boolean(realtime.outgoing)}
              isLoading={joinMutation.isPending}
              pendingLabel={chrome.join_pending}
              onClick={() => {
                joinMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    setQueued(true);
                    if (typeof data.queue_size === "number") setQueueSize(data.queue_size);
                    else void refetchStatus();
                    const msg = (chrome.toast_waiting_opponent || "").trim();
                    if (msg) toast.message(msg);
                  },
                  onError: () => {
                    toast.error(chrome.toast_join_failed);
                  },
                });
              }}
            >
              {queued
                ? `${chrome.find_match_action}${chrome.searching_suffix}`
                : chrome.find_match_action}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !queued}
              isLoading={leaveMutation.isPending}
              pendingLabel={chrome.leave_pending}
              onClick={() => {
                leaveMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    setQueued(false);
                    if (typeof data.queue_size === "number") setQueueSize(data.queue_size);
                  },
                });
              }}
            >
              {chrome.leave_queue_action}
            </Button>
          </div>
        ) : hydrated ? (
          <p className="text-sm">
            <SignInLink className="text-[var(--dama-brand)] underline underline-offset-2" />
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
        <h2 className="font-semibold text-[var(--dama-gold)]">{chrome.players_waiting_title}</h2>
        {queueSize == null && statusLoading ? (
          <ShimmerBlock className="mt-3 h-10 w-16 rounded-md" />
        ) : queueSize == null && (statusError || statusFetched) ? (
          <p className="mt-3 font-display text-4xl font-bold text-[var(--dama-muted)]">-</p>
        ) : (
          <p className="mt-3 font-display text-4xl font-bold text-[var(--dama-gold)]">
            {queueSize ?? 0}
          </p>
        )}
        <p className="mt-2 text-sm text-[var(--dama-muted)]">
          {queued ? chrome.queued_yes : chrome.queued_no}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 lg:col-span-2">
        <h2 className="font-semibold text-[var(--dama-gold)]">{chrome.direct_invite_title}</h2>
        <p className="text-sm text-[var(--dama-muted)]">{chrome.direct_invite_blurb}</p>
        {signedIn ? (
          <div className="space-y-3">
            <Field id="matchmaking-invite" label={chrome.invite_placeholder} className="min-w-0">
              {railChrome ? (
                <PlayerSearchTypeahead
                  id="matchmaking-invite"
                  chrome={railChrome}
                  value={inviteTo}
                  onValueChange={setInviteTo}
                  placeholder={chrome.invite_placeholder}
                  enabled={Boolean(token)}
                  serverSearch
                  autoComplete="username"
                  inputClassName="h-11 pl-9"
                  onSelect={(p) => setInviteTo(p.username)}
                />
              ) : (
                <div aria-busy="true" aria-label={chrome.invite_placeholder}>
                  <ShimmerBlock className="h-11 w-full rounded-md" />
                </div>
              )}
            </Field>
            {presets.length > 0 && railChrome ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--dama-muted-foreground)]">
                  {railChrome.label_time}
                </p>
                <div className="relative">
                  <Timer
                    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--dama-online)]"
                    aria-hidden
                  />
                  <Select
                    value={String(clockSeconds)}
                    onValueChange={(v) => setClockSeconds(Number(v))}
                  >
                    <SelectTrigger className="h-11 w-full pl-9" aria-label={railChrome.label_time}>
                      <SelectValue placeholder={railChrome.label_time} />
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
            ) : progressionQuery.isLoading && !progressionQuery.data ? (
              <div
                className="space-y-1.5"
                aria-busy="true"
                aria-label={railChrome?.label_time || chrome.direct_invite_blurb}
              >
                <ShimmerBlock className="h-3 w-16" />
                <ShimmerBlock className="h-11 w-full rounded-md" />
              </div>
            ) : railChrome?.toast_time_control_unavailable ? (
              <p className="text-sm text-[var(--dama-muted)]">
                {railChrome.toast_time_control_unavailable}
              </p>
            ) : null}
            {railChrome ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--dama-text)]">{railChrome.label_rated}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rated}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      rated ? "bg-[var(--dama-brand)]" : "bg-[var(--dama-border)]",
                    )}
                    onClick={() => setRated((v) => !v)}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                        rated ? "left-5" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--dama-text)]">
                    {railChrome.label_i_play_as}
                  </span>
                  <div
                    className="flex gap-1.5"
                    // biome-ignore lint/a11y/useSemanticElements: color choice toolbar
                    role="group"
                    aria-label={railChrome.label_i_play_as}
                  >
                    {(
                      [
                        {
                          id: "white" as const,
                          aria: railChrome.aria_color_white,
                          className: "bg-[var(--dama-piece-light)]",
                        },
                        {
                          id: "random" as const,
                          aria: railChrome.aria_color_random,
                          className:
                            "bg-[linear-gradient(135deg,var(--dama-piece-light)_50%,var(--dama-piece-dark)_50%)]",
                        },
                        {
                          id: "black" as const,
                          aria: railChrome.aria_color_black,
                          className: "bg-[var(--dama-piece-dark)]",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-label={opt.aria}
                        aria-pressed={color === opt.id}
                        className={cn(
                          "h-9 w-9 rounded-md ring-offset-2 ring-offset-[var(--dama-panel)]",
                          opt.className,
                          color === opt.id
                            ? "ring-2 ring-[var(--dama-brand)]"
                            : "opacity-80 hover:opacity-100",
                        )}
                        onClick={() => setColor(opt.id)}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-[var(--dama-muted)]">{railChrome.color_pref_note}</p>
              </>
            ) : null}
            <Button
              variant="gold"
              className="gap-2"
              disabled={
                busy ||
                !inviteTo.trim() ||
                Boolean(realtime.outgoing) ||
                !railChrome ||
                presets.length === 0 ||
                !(clockSeconds > 0)
              }
              isLoading={inviteMutation.isPending}
              pendingLabel={chrome.send_invite_pending}
              onClick={() => {
                const to = inviteTo.trim();
                if (!railChrome || presets.length === 0 || !(clockSeconds > 0)) {
                  const tcMsg = (railChrome?.toast_time_control_unavailable || "").trim();
                  if (tcMsg) toast.error(tcMsg);
                  return;
                }
                const myName = (user?.username || "").trim().toLowerCase();
                const myId = (user?.id || "").trim().toLowerCase();
                const toNorm = to.toLowerCase();
                if ((myName && toNorm === myName) || (myId && toNorm === myId)) {
                  toast.error(chrome.toast_invite_yourself);
                  return;
                }
                inviteMutation.mutate(
                  {
                    toUser: to,
                    rated,
                    preferredColor: color,
                    timeControlSeconds: clockSeconds,
                  },
                  {
                    onSuccess: (data) => {
                      toast.success(chrome.toast_invite_sent);
                      if (data?.invite?.id) {
                        realtime.noteOutgoing({ id: data.invite.id, toUsername: to });
                      }
                      setInviteTo("");
                    },
                    onError: () => {
                      toast.error(chrome.toast_invite_failed);
                    },
                  },
                );
              }}
            >
              <Swords className="h-4 w-4" aria-hidden />
              {chrome.send_invite_action}
            </Button>
          </div>
        ) : hydrated ? (
          <p className="text-sm">
            <SignInLink className="text-[var(--dama-brand)] underline underline-offset-2" />
          </p>
        ) : null}
      </div>
    </div>
  );
}
