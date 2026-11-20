"use client";

import { ComposeMessageModal, type MessageTarget } from "@/components/chat/ComposeMessageModal";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerInspectSkeleton } from "@/components/ui/shimmer-skeletons";
import { SkipPagination } from "@/components/ui/skip-pagination";
import {
  useAddFriendMutation,
  useFriendRequestsQuery,
  useFriendsQuery,
  useRemoveFriendMutation,
} from "@/hooks/query/useFriendsQuery";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { useProfileInspectChromeQuery } from "@/hooks/query/useProfileInspectChromeQuery";
import {
  usePublicPlayerMatchesQuery,
  usePublicPlayerPlacementsQuery,
} from "@/hooks/query/usePublicPlayerListsQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { CountryFlag } from "@/lib/country-flag";
import { hostReputationLine } from "@/lib/host-reputation-line";
import { useAuthStore } from "@/store/auth";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import type { PublicPlayerCard } from "@/types/player";
import {
  type ProfileInspectChrome,
  isProfileInspectChromeReady,
} from "@/types/profile-inspect-chrome";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { Eye, Mail, Swords, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: PublicPlayerCard | null;
  /** Prefer Create Game flow (opponent chip + TC / rated / color). */
  onChallenge?: (player: PublicPlayerCard) => void;
};

export function PlayerProfileModal({ open, onOpenChange, player, onChallenge }: Props) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);
  const chromeQuery = useProfileInspectChromeQuery(open);
  const railChromeQuery = usePlayRailChromeQuery(open);
  const chrome = isProfileInspectChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const railChrome = isPlayRailChromeReady(railChromeQuery.data) ? railChromeQuery.data : undefined;
  const { data, isLoading, error } = usePublicPlayerQuery(player?.id, open && Boolean(player?.id));
  const [matchesSkip, setMatchesSkip] = useState(0);
  const [placementsSkip, setPlacementsSkip] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset pagination when modal target/open changes
  useEffect(() => {
    setMatchesSkip(0);
    setPlacementsSkip(0);
  }, [player?.id, open]);
  const listPageSize = parseListPageSize(chrome?.list_page_size);
  const matchesQuery = usePublicPlayerMatchesQuery(
    player?.id,
    matchesSkip,
    listPageSize,
    open && Boolean(player?.id) && listPageSize > 0,
  );
  const placementsQuery = usePublicPlayerPlacementsQuery(
    player?.id,
    placementsSkip,
    listPageSize,
    open && Boolean(player?.id) && listPageSize > 0,
  );
  // Modal lifetime is short - one fetch is enough; avoid stacking polls with the rail.
  const friendsQuery = useFriendsQuery(open && token ? token : null, { poll: false });
  const requestsQuery = useFriendRequestsQuery(open && token ? token : null, { poll: false });
  const addFriend = useAddFriendMutation(token);
  const removeFriend = useRemoveFriendMutation(token);
  const friendIds = useMemo(
    () => new Set((friendsQuery.data ?? []).map((f) => f.id)),
    [friendsQuery.data],
  );
  const outgoingPendingIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of requestsQuery.data?.outgoing ?? []) {
      if (row.status === "pending" && row.to_user_id) set.add(row.to_user_id);
    }
    return set;
  }, [requestsQuery.data?.outgoing]);

  const hydrated: PublicPlayerCard | null = data
    ? {
        id: data.player.id,
        username: data.player.username,
        rating: data.player.rating,
        xp: data.player.xp,
        wins: data.player.wins,
        losses: data.player.losses,
        region: data.player.region,
        countryCode: data.player.country_code ?? player?.countryCode,
        avatarFullUrl: data.player.avatar_full_url,
        avatarThumbUrl: data.player.avatar_thumb_url,
        online: Boolean(data.player.online ?? data.online ?? player?.online),
        playing: Boolean(data.player.playing ?? data.playing ?? player?.playing),
        playingGameId:
          data.player.playing_game_id ?? data.playing_game_id ?? player?.playingGameId ?? null,
        regionalRank: data.regional_rank,
        regionLabel: data.region_label || player?.regionLabel,
        levelLabel: data.player.level_label ?? player?.levelLabel,
        phoneKycVerified: data.player.phone_kyc_verified === true,
        documentKycVerified: data.player.document_kyc_verified === true,
        hostTrustTier: data.player.host_trust_tier ?? player?.hostTrustTier ?? null,
        hostTrustBadge: data.player.host_trust_badge ?? player?.hostTrustBadge ?? null,
        hostFinishedPaidCups:
          data.player.host_finished_paid_cups ?? player?.hostFinishedPaidCups ?? null,
        hostCancelledPaidCups:
          data.player.host_cancelled_paid_cups ?? player?.hostCancelledPaidCups ?? null,
        hostOpenReports: data.player.host_open_reports ?? player?.hostOpenReports ?? null,
      }
    : error
      ? null
      : player && !isLoading
        ? player
        : null;

  const matches = matchesQuery.data?.matches ?? [];
  const placements = placementsQuery.data?.placements ?? [];
  const matchesMeta = matchesQuery.data?.meta ?? null;
  const placementsMeta = placementsQuery.data?.meta ?? null;
  const errorMessage =
    (error instanceof Error ? error.message : "").trim() ||
    (error && chrome ? chrome.load_failed : null) ||
    (chromeQuery.isError
      ? (chromeQuery.data?.profile_inspect_chrome_unavailable || "").trim() ||
        (chromeQuery.error instanceof Error ? chromeQuery.error.message : "").trim()
      : null);

  const view = hydrated;
  const chromeReady = Boolean(chrome && railChrome);
  const chromeLoading =
    open && (chromeQuery.isLoading || railChromeQuery.isLoading) && !chromeReady;

  return (
    <>
      {/* Nested Dialog must sit outside DialogContent (Radix portal + flatten key collision). */}
      {chrome && railChrome ? (
        <ComposeMessageModal
          chrome={railChrome}
          open={Boolean(messageTarget)}
          onOpenChange={(v) => {
            if (!v) setMessageTarget(null);
          }}
          target={messageTarget}
          onComposeStarted={() => {
            setMessageTarget(null);
            router.push("/?rail=players&sub=dms");
          }}
          onOpenedThread={({ threadId }) => {
            setMessageTarget(null);
            const tid = threadId.trim();
            if (!tid) return;
            router.push(`/?rail=players&sub=dms&thread=${encodeURIComponent(tid)}`);
          }}
        />
      ) : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl sm:max-w-2xl"
          closeLabel={(chrome?.sr_description || "").trim() || undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex min-w-0 flex-wrap items-center gap-1.5 pr-2 text-lg font-semibold tracking-tight">
              <span className="truncate">
                {(view?.username || player?.username || "").trim() ||
                  (chrome?.empty_value || "").trim()}
              </span>
              {typeof view?.rating === "number" ? (
                <span className="shrink-0 text-sm font-normal tabular-nums text-[var(--dama-muted)]">
                  ({view.rating})
                </span>
              ) : null}
              <CountryFlag code={view?.countryCode ?? player?.countryCode} />
              <HostTrustBadge
                label={view?.hostTrustBadge || player?.hostTrustBadge}
                tier={view?.hostTrustTier || player?.hostTrustTier}
                className="shrink-0"
              />
            </DialogTitle>
            {chrome
              ? (() => {
                  const rep = hostReputationLine({
                    finished: view?.hostFinishedPaidCups,
                    cancelled: view?.hostCancelledPaidCups,
                    openReports: view?.hostOpenReports,
                    finishedLabel: chrome.host_rep_finished_label,
                    cancelledLabel: chrome.host_rep_cancelled_label,
                    reportsLabel: chrome.host_rep_reports_label,
                    separator: chrome.host_rep_meta_separator,
                  });
                  return rep ? <p className="text-[11px] text-[var(--dama-muted)]">{rep}</p> : null;
                })()
              : null}
            {chrome ? (
              <DialogDescription className="sr-only">{chrome.sr_description}</DialogDescription>
            ) : null}
          </DialogHeader>

          {chromeLoading ? <PlayerInspectSkeleton /> : null}

          {open && !chromeLoading && !chromeReady ? (
            <p className="text-sm text-[var(--dama-muted)]">
              {(chromeQuery.data?.profile_inspect_chrome_unavailable || "").trim() ||
                (railChromeQuery.data?.play_rail_chrome_unavailable || "").trim()}
            </p>
          ) : null}

          {chrome && railChrome ? (
            <>
              {isLoading ? <PlayerInspectSkeleton /> : null}
              {errorMessage ? (
                <p className="text-sm text-[var(--dama-danger)]">{errorMessage}</p>
              ) : null}

              {view && !isLoading ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <AvatarZoom
                      chrome={chrome}
                      src={view.avatarFullUrl || view.avatarThumbUrl}
                      username={view.username}
                      online={view.online}
                      playing={Boolean(data?.player?.playing ?? data?.playing ?? player?.playing)}
                    />
                    <div className="min-w-0 flex-1 space-y-4">
                      {token && view.id !== myId ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {view.playing && (view.playingGameId || "").trim() ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 w-full gap-2 sm:w-auto sm:min-w-[9rem] sm:flex-1"
                              onClick={() => {
                                const gid = (view.playingGameId || "").trim();
                                onOpenChange(false);
                                router.push(`/?view=spectate&gameId=${encodeURIComponent(gid)}`);
                              }}
                            >
                              <Eye className="h-4 w-4 shrink-0" aria-hidden />
                              <span className="min-w-0 truncate">
                                {railChrome.watch_game_action}
                              </span>
                            </Button>
                          ) : null}
                          {friendsQuery.isSuccess && !outgoingPendingIds.has(view.id) ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 w-full min-w-0 gap-2 sm:w-auto sm:min-w-[9rem] sm:flex-1"
                              aria-label={
                                friendIds.has(view.id)
                                  ? railChrome.remove_friend_action
                                  : railChrome.send_friend_request_action
                              }
                              disabled={addFriend.isPending || removeFriend.isPending}
                              isLoading={
                                (addFriend.isPending && addFriend.variables === view.id) ||
                                (removeFriend.isPending && removeFriend.variables === view.id)
                              }
                              pendingLabel={
                                friendIds.has(view.id)
                                  ? railChrome.removing_friend
                                  : railChrome.sending_friend_request
                              }
                              onClick={() => {
                                void (async () => {
                                  try {
                                    if (friendIds.has(view.id)) {
                                      await removeFriend.mutateAsync(view.id);
                                      toast.success(railChrome.toast_friend_removed);
                                    } else {
                                      await addFriend.mutateAsync(view.id);
                                      toast.success(railChrome.toast_friend_request_sent);
                                    }
                                  } catch (e) {
                                    const msg =
                                      e && typeof e === "object" && "response" in e
                                        ? String(
                                            (e as { response?: { data?: { error?: string } } })
                                              .response?.data?.error ?? "",
                                          )
                                        : "";
                                    if (msg === "already_friends") {
                                      toast.error(railChrome.friend_request_already_friends);
                                    } else if (friendIds.has(view.id)) {
                                      toast.error(railChrome.toast_friend_failed);
                                    } else {
                                      toast.error(railChrome.toast_friend_request_failed);
                                    }
                                  }
                                })();
                              }}
                            >
                              {friendIds.has(view.id) ? (
                                <UserMinus className="h-4 w-4 shrink-0" aria-hidden />
                              ) : (
                                <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                              )}
                              <span className="min-w-0 truncate">
                                {friendIds.has(view.id)
                                  ? railChrome.remove_friend_action
                                  : railChrome.send_friend_request_action}
                              </span>
                            </Button>
                          ) : outgoingPendingIds.has(view.id) ? (
                            <span className="inline-flex h-10 items-center px-2 text-xs font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                              {railChrome.friend_request_outgoing_label}
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full min-w-0 gap-2 sm:w-auto sm:min-w-[9rem] sm:flex-1"
                            onClick={() =>
                              setMessageTarget({
                                id: view.id,
                                username: view.username,
                                avatarThumbUrl: view.avatarThumbUrl,
                                avatarFullUrl: view.avatarFullUrl,
                              })
                            }
                          >
                            <Mail className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="min-w-0 truncate">{railChrome.message_action}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="play"
                            className="h-10 w-full min-w-0 gap-2 sm:w-auto sm:min-w-[9rem] sm:flex-1"
                            onClick={() => {
                              onOpenChange(false);
                              if (onChallenge) {
                                onChallenge(view);
                                return;
                              }
                              const q = new URLSearchParams({
                                opponent: view.username,
                              });
                              if (view.id) q.set("opponentId", view.id);
                              if (view.rating != null) q.set("opponentRating", String(view.rating));
                              router.push(`/?${q.toString()}`);
                            }}
                          >
                            <Swords className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="min-w-0 truncate">{railChrome.challenge_action}</span>
                          </Button>
                        </div>
                      ) : null}
                      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                        <Stat label={chrome.label_rating} value={String(view.rating)} />
                        <Stat label={chrome.label_xp} value={String(view.xp)} />
                        {view.levelLabel ? (
                          <Stat label={chrome.label_level} value={view.levelLabel} />
                        ) : null}
                        <Stat label={chrome.label_wins} value={String(view.wins)} />
                        <Stat label={chrome.label_losses} value={String(view.losses)} />
                        {view.countryCode ? (
                          <Stat
                            label={chrome.label_country}
                            value={
                              <span className="inline-flex items-center gap-1.5">
                                <CountryFlag code={view.countryCode} />
                                <span>
                                  {chrome.flag_code_separator}
                                  {view.countryCode}
                                </span>
                              </span>
                            }
                          />
                        ) : null}
                        {view.region ? (
                          <Stat label={chrome.label_region} value={view.region} />
                        ) : null}
                        {view.regionalRank != null && view.regionalRank > 0 ? (
                          <Stat
                            label={chrome.label_regional_rank}
                            value={
                              view.regionLabel
                                ? `${chrome.top_prefix}${chrome.rank_parts_separator}${view.regionalRank}${chrome.rank_parts_separator}${view.regionLabel}`
                                : `${chrome.top_prefix}${chrome.rank_parts_separator}${view.regionalRank}`
                            }
                          />
                        ) : null}
                      </dl>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--dama-gold)]">
                        {chrome.recent_matches_title}
                      </h3>
                      {matches.length === 0 && !matchesQuery.isFetching ? (
                        <p className="mt-2 text-sm text-[var(--dama-muted)]">{chrome.no_matches}</p>
                      ) : (
                        <>
                          <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain text-sm">
                            {matches.map((m) => {
                              let outcome = "";
                              if (m.is_draw) outcome = chrome.outcome_draw;
                              else if (m.winner_id === view.id) outcome = chrome.outcome_win;
                              else if (m.winner_id) outcome = chrome.outcome_loss;
                              return (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between rounded-md border border-[var(--dama-border)] px-3 py-2"
                                >
                                  <span className="truncate text-[var(--dama-muted)]">
                                    {m.mode || m.id}
                                  </span>
                                  {outcome ? (
                                    <span className="shrink-0 font-mono text-[var(--dama-gold)]">
                                      {outcome}
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                          <SkipPagination
                            className="mt-2"
                            meta={matchesMeta}
                            disabled={matchesQuery.isFetching}
                            onPrev={setMatchesSkip}
                            onNext={setMatchesSkip}
                          />
                        </>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--dama-gold)]">
                        {chrome.tournament_placements_title}
                      </h3>
                      {placements.length === 0 && !placementsQuery.isFetching ? (
                        <p className="mt-2 text-sm text-[var(--dama-muted)]">
                          {chrome.no_placements}
                        </p>
                      ) : (
                        <>
                          <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain text-sm">
                            {placements.map((p) => (
                              <li
                                key={`${p.tournament_id}-${p.joined_at ?? p.title}`}
                                className="flex items-center justify-between rounded-md border border-[var(--dama-border)] px-3 py-2"
                              >
                                <span className="truncate text-[var(--dama-muted)]">{p.title}</span>
                                <span className="shrink-0 font-mono text-[var(--dama-gold)]">
                                  {p.entry_status}
                                  {p.is_free ? chrome.free_suffix : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <SkipPagination
                            className="mt-2"
                            meta={placementsMeta}
                            disabled={placementsQuery.isFetching}
                            onPrev={setPlacementsSkip}
                            onNext={setPlacementsSkip}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)]/40 p-2.5">
      <dt className="text-xs text-[var(--dama-muted)]">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-[var(--dama-gold)]">{value}</dd>
    </div>
  );
}

function AvatarZoom({
  chrome,
  src,
  username,
  online,
  playing,
}: {
  chrome: ProfileInspectChrome;
  src?: string | null;
  username: string;
  online?: boolean;
  playing?: boolean;
}) {
  const [scale, setScale] = useState(1);
  const pinchDist = useRef<number | null>(null);
  const clamp = (v: number) => Math.min(4, Math.max(1, v));

  return (
    <div
      className="relative mx-auto aspect-square w-36 shrink-0 touch-none overflow-hidden rounded-lg bg-[var(--dama-surface)] sm:mx-0 sm:w-44"
      title={chrome.zoom_title}
      onWheel={(e) => {
        e.preventDefault();
        setScale((s) => clamp(s + (e.deltaY < 0 ? 0.15 : -0.15)));
      }}
      onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2))}
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          const a = e.touches.item(0);
          const b = e.touches.item(1);
          if (!a || !b) return;
          pinchDist.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length !== 2 || pinchDist.current == null) return;
        const a = e.touches.item(0);
        const b = e.touches.item(1);
        if (!a || !b) return;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const delta = (dist - pinchDist.current) / 120;
        pinchDist.current = dist;
        setScale((s) => clamp(s + delta));
      }}
      onTouchEnd={() => {
        pinchDist.current = null;
      }}
    >
      <div
        className="h-full w-full transition-transform duration-75"
        style={{ transform: `scale(${scale})` }}
      >
        <DamaUserAvatar
          src={src}
          alt={`${username} ${chrome.avatar_alt_suffix}`.trim()}
          className="h-full w-full rounded-none"
          showMarkPlate={false}
        />
      </div>
      {online != null || playing ? (
        <OnlineStatusDot
          online={online}
          playing={playing}
          size="md"
          className="bottom-2 right-2 shadow-[0_0_0_2px_var(--dama-card)]"
        />
      ) : null}
    </div>
  );
}
