"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { useOptionalMatchmakingRealtime } from "@/components/matchmaking/MatchmakingRealtimeProvider";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import {
  type PlayerSearchSuggestion,
  PlayerSearchTypeahead,
} from "@/components/play-rail/PlayerSearchTypeahead";
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
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useSendInviteMutation } from "@/hooks/mutation/useSendInviteMutation";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { MatchClockPreset } from "@/types/platform";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Check, Copy, Link2, Swords, Timer, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type ChallengeOpponent = {
  id?: string;
  username: string;
  rating?: number;
  countryCode?: string | null;
  avatarThumbUrl?: string | null;
  online?: boolean;
  playing?: boolean;
  hostTrustBadge?: string | null;
  hostTrustTier?: string | null;
};

type Props = {
  chrome: PlayRailChromeReady;
  initialOpponent?: ChallengeOpponent | null;
  onClearOpponent?: () => void;
  signedIn: boolean;
  /** @deprecated Prefer global SignInModal; kept for call-site compat. */
  loginHref?: string;
  /** DB match_clock.presets - required for picker (no client invent). */
  timeControlPresets: MatchClockPreset[];
  /** True while progression/match_clock is still fetching. */
  timeControlsLoading?: boolean;
  defaultClockSeconds?: number;
  blurb?: string;
};

export function CreateChallengeForm({
  chrome,
  initialOpponent,
  onClearOpponent,
  signedIn,
  loginHref: _loginHref,
  timeControlPresets,
  timeControlsLoading = false,
  defaultClockSeconds,
  blurb,
}: Props) {
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const signInModal = useOptionalSignInModal();
  const pathname = usePathname() || "/";
  const realtime = useOptionalMatchmakingRealtime();
  const sendInvite = useSendInviteMutation(token);
  const [query, setQuery] = useState("");
  const [opponent, setOpponent] = useState<ChallengeOpponent | null>(initialOpponent ?? null);
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  const [rated, setRated] = useState(true);
  const presets = useMemo(
    () =>
      (timeControlPresets || []).filter(
        (p) => typeof p.seconds === "number" && p.seconds > 0 && (p.label || "").trim(),
      ),
    [timeControlPresets],
  );
  const [opponentAttempted, setOpponentAttempted] = useState(false);
  const [clockSeconds, setClockSeconds] = useState(() => {
    const def = defaultClockSeconds && defaultClockSeconds > 0 ? defaultClockSeconds : 0;
    if (def && presets.some((p) => p.seconds === def)) return def;
    return presets[0]?.seconds ?? 0;
  });

  useEffect(() => {
    if (initialOpponent) setOpponent(initialOpponent);
  }, [initialOpponent]);

  const liveOpponent = usePublicPlayerQuery(opponent?.id, Boolean((opponent?.id || "").trim()));
  const opponentThumb = (
    liveOpponent.data?.player?.avatar_thumb_url ||
    liveOpponent.data?.player?.avatar_full_url ||
    opponent?.avatarThumbUrl ||
    ""
  ).trim();
  const opponentHostTrustBadge = (
    liveOpponent.data?.player?.host_trust_badge ||
    opponent?.hostTrustBadge ||
    ""
  ).trim();
  const opponentHostTrustTier = (
    liveOpponent.data?.player?.host_trust_tier ||
    opponent?.hostTrustTier ||
    ""
  ).trim();

  useEffect(() => {
    if (presets.length === 0) return;
    if (!presets.some((p) => p.seconds === clockSeconds)) {
      const def = defaultClockSeconds && defaultClockSeconds > 0 ? defaultClockSeconds : 0;
      setClockSeconds(presets.some((p) => p.seconds === def) ? def : (presets[0]?.seconds ?? 0));
    }
  }, [clockSeconds, defaultClockSeconds, presets]);

  const challengeLink =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/?challenge=${encodeURIComponent(shareToken)}`
      : "";

  const send = useCallback(
    async (openLink = false) => {
      const target = (opponent?.username || query).trim();
      if (!openLink && !target) {
        setOpponentAttempted(true);
        toast.error(chrome.toast_enter_username);
        return;
      }
      setOpponentAttempted(false);
      if (!signedIn || !token) {
        toast.error(chrome.toast_sign_in_challenge);
        return;
      }
      if (presets.length === 0 || !(clockSeconds > 0)) {
        toast.error(chrome.toast_time_control_unavailable);
        return;
      }
      if (!openLink) {
        const myName = (me?.username || "").trim().toLowerCase();
        const myId = (me?.id || "").trim().toLowerCase();
        const targetNorm = target.toLowerCase();
        const oppId = (opponent?.id || "").trim().toLowerCase();
        if (
          (myName && targetNorm === myName) ||
          (myId && (targetNorm === myId || (oppId && oppId === myId)))
        ) {
          toast.error(chrome.toast_invite_yourself);
          return;
        }
      }
      try {
        const res = await sendInvite.mutateAsync({
          toUser: openLink ? undefined : target,
          openLink,
          rated,
          preferredColor: color,
          timeControlSeconds: clockSeconds,
        });
        const id = res.invite?.id;
        const tok = res.invite?.share_token;
        if (tok) setShareToken(tok);
        // Arm outgoing wait for both targeted and open challenge links so the
        // challenger sees accept/join (WS invite_accepted + cancel dialog).
        if (id) {
          realtime?.noteOutgoing({
            id,
            toUsername: openLink ? undefined : target,
          });
        }
        if (!opponent && target) setOpponent({ username: target });
        if (openLink && tok) {
          const url = `${window.location.origin}/?challenge=${encodeURIComponent(tok)}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
            toast.success(chrome.copied_share_blurb);
          } catch {
            toast.error(chrome.toast_copy_failed);
          }
        } else if (!openLink) {
          toast.success(`${chrome.toast_challenge_sent_prefix} ${target}`.trim());
        }
      } catch {
        toast.error(chrome.toast_challenge_failed);
      }
    },
    [
      chrome,
      clockSeconds,
      color,
      me?.id,
      me?.username,
      opponent,
      presets.length,
      query,
      rated,
      realtime,
      sendInvite,
      signedIn,
      token,
    ],
  );

  const copyLink = async () => {
    if (!challengeLink) {
      await send(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(challengeLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success(chrome.copied_share_blurb);
    } catch {
      toast.error(chrome.toast_copy_failed);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-semibold text-[var(--dama-text)]">
        {chrome.create_game_title}
      </p>
      {blurb ? <p className="text-sm text-[var(--dama-muted-foreground)]">{blurb}</p> : null}

      {!opponent ? (
        <Field
          id="create-challenge-opponent"
          label={chrome.label_opponent}
          error={opponentAttempted && !query.trim() ? chrome.toast_enter_username : undefined}
        >
          <PlayerSearchTypeahead
            id="create-challenge-opponent"
            chrome={chrome}
            value={query}
            invalid={opponentAttempted && !query.trim()}
            onValueChange={(v) => {
              setQuery(v);
              if (opponentAttempted && v.trim()) setOpponentAttempted(false);
            }}
            placeholder={chrome.search_opponent_placeholder}
            disabled={!signedIn}
            enabled={signedIn}
            serverSearch
            inputClassName="h-11 pl-9"
            onEnterWithoutSelection={() => void send(false)}
            onSelect={(p: PlayerSearchSuggestion) => {
              setOpponent({
                id: p.id,
                username: p.username,
                rating: p.rating,
                countryCode: p.country_code,
                avatarThumbUrl: p.avatar_thumb_url,
                online: p.online,
                playing: p.playing,
                hostTrustBadge: p.host_trust_badge ?? null,
                hostTrustTier: p.host_trust_tier ?? null,
              });
              setQuery("");
              setOpponentAttempted(false);
            }}
          />
        </Field>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--dama-muted-foreground)]">
            {chrome.label_opponent}
          </p>
          <div className="flex items-center gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)] px-2.5 py-2">
            <span className="relative h-8 w-8 shrink-0 rounded-md">
              <DamaUserAvatar src={opponentThumb} className="h-8 w-8 rounded-md" />
              <OnlineStatusDot online={opponent.online} playing={opponent.playing} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
                <span className="truncate">
                  {formatPlayerNameDisplay(
                    opponent.username,
                    chrome.live_player_name_max_chars,
                    chrome.name_truncate_suffix,
                  )}
                </span>
                {opponent.rating != null ? (
                  <span className="shrink-0 font-normal tabular-nums text-[var(--dama-muted)]">
                    {chrome.rating_paren_open}
                    {opponent.rating}
                    {chrome.rating_paren_close}
                  </span>
                ) : null}
                <CountryFlag code={opponent.countryCode} />
              </span>
              <HostTrustBadge
                label={opponentHostTrustBadge}
                tier={opponentHostTrustTier}
                className="mt-0.5 text-[9px]"
              />
            </span>
            <button
              type="button"
              className="rounded-md p-1 text-[var(--dama-muted)] hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
              aria-label={chrome.label_opponent}
              onClick={() => {
                setOpponent(null);
                onClearOpponent?.();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
              value={clockSeconds > 0 ? String(clockSeconds) : undefined}
              onValueChange={(v) => setClockSeconds(Number(v))}
              disabled={!signedIn}
            >
              <SelectTrigger className="h-11 pl-9" aria-label={chrome.label_time}>
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
        <p className="text-sm text-[var(--dama-muted)]">{chrome.toast_time_control_unavailable}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--dama-text)]">{chrome.label_rated}</span>
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
        <span className="text-sm text-[var(--dama-text)]">{chrome.label_i_play_as}</span>
        <div
          className="flex gap-1.5"
          // biome-ignore lint/a11y/useSemanticElements: color choice toolbar
          role="group"
          aria-label={chrome.label_i_play_as}
        >
          {(
            [
              {
                id: "white" as const,
                aria: chrome.aria_color_white,
                className: "bg-[var(--dama-piece-light)]",
              },
              {
                id: "random" as const,
                aria: chrome.aria_color_random,
                className:
                  "bg-[linear-gradient(135deg,var(--dama-piece-light)_50%,var(--dama-piece-dark)_50%)]",
              },
              {
                id: "black" as const,
                aria: chrome.aria_color_black,
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
      <p className="text-[11px] text-[var(--dama-muted)]">{chrome.color_pref_note}</p>

      {!signedIn ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full"
          onClick={() =>
            signInModal?.openSignIn(
              pathname.startsWith("/auth/") ? undefined : { nextPath: pathname },
            )
          }
        >
          {chrome.sign_in_to_challenge}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="play"
            size="lg"
            className="h-12 w-full gap-2 text-base"
            disabled={presets.length === 0 || !(opponent?.username || query).trim()}
            isLoading={sendInvite.isPending}
            pendingLabel={chrome.sending_challenge}
            onClick={() => void send(false)}
          >
            <Swords className="h-4 w-4" aria-hidden />
            {chrome.send_challenge_action}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={() => void copyLink()}
            disabled={sendInvite.isPending || presets.length === 0}
            isLoading={sendInvite.isPending && !challengeLink}
            pendingLabel={chrome.sending_challenge}
          >
            {copied ? (
              <Check className="h-4 w-4 text-[var(--dama-online)]" aria-hidden />
            ) : (
              <Link2 className="h-4 w-4" aria-hidden />
            )}
            {copied ? chrome.copied_action : chrome.challenge_link_action}
            {!copied ? <Copy className="h-3.5 w-3.5 opacity-60" aria-hidden /> : null}
          </Button>
          {copied ? (
            <p className="text-center text-xs text-[var(--dama-muted)]">
              {chrome.copied_share_blurb}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
