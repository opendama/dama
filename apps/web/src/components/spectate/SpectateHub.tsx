"use client";

import { GameChatPanel } from "@/components/chat/GameChatPanel";
import { GameMoveHistory } from "@/components/game/GameMoveHistory";
import { HomePreviewBoard } from "@/components/home/HomePreviewBoard";
import { BoardColorsPopover } from "@/components/play-rail/BoardColorsPopover";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayRailAside } from "@/components/play-rail/PlayRailAside";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import { BoardSeatBar } from "@/components/play/BoardSeatBar";
import { MatchPauseOverlay } from "@/components/play/MatchPauseOverlay";
import { PlayBoardColumn } from "@/components/play/PlayBoardColumn";
import { useServerMatchClocks } from "@/components/player/MatchClock";
import { MatchVotePanel } from "@/components/spectate/MatchVotePanel";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  BoardAreaSkeleton,
  BoardSeatBarSkeleton,
  MatchVoteSkeleton,
  PlayHubSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useBoardRulesQuery } from "@/hooks/query/useBoardRulesQuery";
import { useGameChatQuery } from "@/hooks/query/useGameChatQuery";
import { gameStateQueryKey, useGameStateQuery } from "@/hooks/query/useGameStateQuery";
import { type MatchVotesPayload, matchVotesQueryKey } from "@/hooks/query/useMatchVotesQuery";
import { useOfficialPauseChromeQuery } from "@/hooks/query/useOfficialPauseChromeQuery";
import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { useProgressionQuery } from "@/hooks/query/useProgressionQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { useSpectateChromeQuery } from "@/hooks/query/useSpectateChromeQuery";
import {
  applyOfficialPauseFmt,
  buildOfficialPausedBannerLines,
  buildPauseOverlayCopy,
  isPlayerPause,
  officialPauseRoleLabel,
} from "@/lib/official-pause-display";
import { OfficialPauseActivityStrip } from "@/components/play/OfficialPauseActivityStrip";
import { OfficialPauseBanner } from "@/components/play/OfficialPauseBanner";
import { useMaxLg } from "@/hooks/useMaxLg";
import { playGameNotify } from "@/lib/audio-notify";
import { patchAvatarEverywhere } from "@/lib/avatar-cache-patch";
import { pieceSeatNames, usePiecePalette } from "@/lib/board-palette";
import { formatMoveAlgebraic } from "@/lib/board-square";
import { useBoardViewMode } from "@/lib/board-view";
import { notifyIncomingChatMessage } from "@/lib/chat-message-notify";
import {
  softSpectateEventLogTitle,
  softSpectateNoEvents,
} from "@/lib/community-player-chrome-soft";
import { CountryFlag } from "@/lib/country-flag";
import { formatDmUnreadBadge } from "@/lib/dm-unread-badge";
import { apiWsUrl } from "@/lib/env";
import { getMatchCaptureScores } from "@/lib/game-board-stats";
import { mergeRemoteBoardState } from "@/lib/gameBoardStateMerge";
import { activeClockPlayer } from "@/lib/gameOutcome";
import { buildInitialBoard } from "@/lib/initial-board";
import { invalidateAvatarSurfaces } from "@/lib/invalidate";
import {
  mobilePlayBoardColumnClass,
  mobilePlayBoardMaxHeightClass,
  mobilePlayBoardStandaloneHeightClass,
  playHubDesktopHeightClass,
  playHubFillHeightClass,
  playRailInnerListScrollClass,
  playRailStickyMainClass,
  playRailStickySubClass,
} from "@/lib/player-shell-ui";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useShellChromeStore } from "@/store/shell-chrome";
import type { BoardCell, GamePayload, GameWsMessage, MoveHistoryEntry } from "@/types/game";
import { isOfficialPauseChromeReady } from "@/types/official-pause-chrome";
import { isPlayChromeReady } from "@/types/play-chrome";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import { isSpectateChromeReady } from "@/types/spectate-chrome";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Eye,
  Layers,
  RefreshCw,
  Share2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// No loading skeleton: remount/keep-alive must not flash BoardAreaSkeleton.
const DraughtsScene3D = dynamic(() => import("@/components/game/DraughtsScene3D"), {
  ssr: false,
  loading: () => null,
});
const DraughtsBoard2D = dynamic(() => import("@/components/game/DraughtsBoard2D"), {
  ssr: false,
  loading: () => null,
});

function seatTurnParen(hint?: string): string {
  const inner = (hint || "").trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
  return inner;
}

function SeatRow({
  label,
  hint,
  clock,
  tone,
  captures,
  pieceSide = "light",
  online,
  playing,
  layout = "side",
  avatarThumbUrl,
  countryCode,
}: {
  label: string;
  hint?: string;
  clock?: ReactNode;
  tone: "muted" | "strong";
  captures?: number;
  pieceSide?: "light" | "dark";
  /** When set, show Chess.com presence triad on the seat avatar. */
  online?: boolean;
  playing?: boolean;
  layout?: "bar" | "side";
  avatarThumbUrl?: string | null;
  countryCode?: string | null;
}) {
  const clockText = typeof clock === "string" ? clock.trim() : "";
  const turn = seatTurnParen(hint);
  const showPresence = online != null || playing != null;
  const a11y = [label, turn ? `(${turn})` : ""].filter(Boolean).join(" ");
  const thumb = (avatarThumbUrl || "").trim();
  const avatar = (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-black/20",
        layout === "side"
          ? "h-8 w-8 text-[11px] sm:h-9 sm:w-9 sm:text-xs"
          : "h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm",
      )}
      style={
        thumb
          ? undefined
          : {
              background:
                pieceSide === "light" ? "var(--dama-piece-light)" : "var(--dama-piece-dark)",
            }
      }
      aria-hidden
    >
      <DamaUserAvatar
        src={avatarThumbUrl}
        pieceSide={pieceSide}
        showMarkPlate={Boolean(thumb)}
        className="absolute inset-0 h-full w-full rounded-full"
      />
      {showPresence ? (
        <OnlineStatusDot
          online={online}
          playing={playing}
          className="shadow-[0_0_0_2px_var(--dama-surface)]"
        />
      ) : null}
    </span>
  );
  const clockNode = clockText ? (
    <span className="max-w-full truncate rounded-md bg-[var(--dama-panel)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[var(--dama-text)] sm:text-[11px]">
      {clockText}
    </span>
  ) : clock && !clockText ? (
    <div className="max-w-full shrink-0">{clock}</div>
  ) : null;

  if (layout === "side") {
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-md px-0.5 py-1 text-center",
          tone === "strong" ? "bg-[var(--dama-surface)]" : "bg-[var(--dama-surface)]/60",
        )}
        title={a11y}
        aria-label={a11y}
      >
        {avatar}
        {clockNode}
        {typeof captures === "number" ? (
          <span className="rounded bg-[var(--dama-panel)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--dama-muted)]">
            {captures}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-[14rem] items-center justify-between gap-2 rounded-md px-2.5 py-1.5 sm:max-w-[16rem]",
        tone === "strong" ? "bg-[var(--dama-surface)]" : "bg-[var(--dama-surface)]/60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {avatar}
        <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-[var(--dama-text)]">
          <span className="min-w-0 truncate">{label}</span>
          {turn ? (
            <span className="shrink-0 text-[11px] font-normal text-[var(--dama-muted)]">
              ({turn})
            </span>
          ) : null}
          <CountryFlag code={countryCode} />
        </p>
        {typeof captures === "number" ? (
          <span className="shrink-0 rounded-md bg-[var(--dama-panel)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--dama-muted)]">
            {captures}
          </span>
        ) : null}
      </div>
      {clockNode}
    </div>
  );
}

/** Human-readable WS event line (algebraic last ply when game_state has history). */
function formatSpectateEventLine(msg: GameWsMessage, boardSize: number): string {
  const kind = (msg.type || "").trim() || "update";
  if (kind === "game_state" && msg.game) {
    const hist = msg.game.move_history;
    const n = msg.game.move_count ?? hist?.length ?? 0;
    if (hist && hist.length > 0 && boardSize > 0) {
      const last = hist[hist.length - 1];
      if (last) {
        const caps = last.captures?.length ?? 0;
        const alg = formatMoveAlgebraic(last.from, last.to, boardSize, caps);
        const ply = Math.ceil(hist.length / 2);
        if (alg) {
          return `${kind} · ${ply}. ${alg}`;
        }
      }
    }
    return n > 0 ? `${kind} · ${n}` : kind;
  }
  if (kind === "vote_update") return kind;
  if (msg.error) return `${kind}: ${String(msg.error)}`;
  return kind;
}

export type SpectateHubProps = {
  /** When true (marketing `/` shell), fill parent height instead of 100dvh calc. */
  fillHeight?: boolean;
};

/**
 * Spectate in the same Chess.com Play shell as HomePlayHub:
 * left-rail seats + board (2D/3D) + flat connect/history panel.
 */
export default function SpectateHub({ fillHeight = false }: SpectateHubProps = {}) {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);
  const signedIn = hydrated && Boolean(token);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const chromeQuery = useSpectateChromeQuery(true);
  const chrome = isSpectateChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const playChromeQuery = usePlayChromeQuery(true);
  const playChrome = isPlayChromeReady(playChromeQuery.data) ? playChromeQuery.data : undefined;
  const officialPauseChromeQuery = useOfficialPauseChromeQuery(true);
  const officialPauseChrome = isOfficialPauseChromeReady(officialPauseChromeQuery.data)
    ? officialPauseChromeQuery.data
    : undefined;
  const railChromeQuery = usePlayRailChromeQuery(true);
  const railChrome = isPlayRailChromeReady(railChromeQuery.data) ? railChromeQuery.data : undefined;
  const progressionQuery = useProgressionQuery();
  const boardRulesQuery = useBoardRulesQuery();
  const [boardView, setBoardView] = useBoardViewMode();
  const [watchTab, setWatchTab] = useState<"moves" | "chat" | "info">("moves");
  /** Focus: collapse vote/share so Moves/Chat/Info use the rail; Back restores overview. */
  const [watchFocus, setWatchFocus] = useState(false);
  const maxLg = useMaxLg();
  const [piecePalette] = usePiecePalette();
  const [colorsOpen, setColorsOpen] = useState(false);
  const [flipBoard, setFlipBoard] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [resumeBanner, setResumeBanner] = useState("");
  const lastOfficialActorRef = useRef<{ role: string; name: string } | null>(null);
  const wasOfficiallyPausedRef = useRef(false);

  const initialSpectateGameId = (
    searchParams.get("gameId") ||
    searchParams.get("game_id") ||
    ""
  ).trim();
  const [gameId, setGameId] = useState(initialSpectateGameId);
  const [connected, setConnected] = useState(Boolean(initialSpectateGameId));
  const gameChatBadgeQuery = useGameChatQuery(gameId, signedIn && Boolean(gameId) && connected);
  const chatUnread = gameChatBadgeQuery.data?.unread_count ?? 0;
  const setImmersiveChat = useShellChromeStore((s) => s.setImmersiveChat);
  useEffect(() => {
    setImmersiveChat(watchTab === "chat");
    return () => setImmersiveChat(false);
  }, [watchTab, setImmersiveChat]);
  // Seed from React Query so leave→back paints the board without a forced REST flash.
  const [game, setGame] = useState<GamePayload | null>(() => {
    if (!initialSpectateGameId) return null;
    return queryClient.getQueryData<GamePayload>(gameStateQueryKey(initialSpectateGameId)) ?? null;
  });
  const [events, setEvents] = useState<GameWsMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [urlBootstrapped, setUrlBootstrapped] = useState(Boolean(initialSpectateGameId));

  const hydrateQuery = useGameStateQuery(gameId, hydrated && connected && Boolean(gameId));

  const history = useMemo(
    () => (game?.move_history ?? []) as MoveHistoryEntry[],
    [game?.move_history],
  );

  const displayBoard = useMemo(() => {
    if (!game) return null;
    if (replayIndex == null) return game.board;
    if (replayIndex <= 0) return game.board;
    const entry = history[replayIndex - 1];
    return entry?.board_after?.length ? entry.board_after : game.board;
  }, [game, history, replayIndex]);

  const previewBoard = useMemo(() => {
    const size = boardRulesQuery.data?.size ?? 10;
    const setup = boardRulesQuery.data?.setup_rows ?? 4;
    return buildInitialBoard(size, setup);
  }, [boardRulesQuery.data?.size, boardRulesQuery.data?.setup_rows]);

  const p1Query = usePublicPlayerQuery(game?.player1_id, Boolean(game?.player1_id));
  const p2Query = usePublicPlayerQuery(game?.player2_id, Boolean(game?.player2_id));
  const guestSeats = pieceSeatNames(piecePalette);
  const whiteFallback = signedIn ? (playChrome?.label_white || "").trim() : guestSeats.light;
  const blackFallback = signedIn ? (playChrome?.label_black || "").trim() : guestSeats.dark;
  const whiteName = (p1Query.data?.player?.username || "").trim() || whiteFallback;
  const blackName = (p2Query.data?.player?.username || "").trim() || blackFallback;
  // Only paint presence after public-player resolves (avoid Offline flash while pending).
  const whitePresenceReady = Boolean(p1Query.data);
  const blackPresenceReady = Boolean(p2Query.data);
  const whiteOnline = whitePresenceReady
    ? Boolean(p1Query.data?.player?.online ?? p1Query.data?.online)
    : undefined;
  const whitePlaying = whitePresenceReady
    ? Boolean(p1Query.data?.player?.playing ?? p1Query.data?.playing)
    : undefined;
  const blackOnline = blackPresenceReady
    ? Boolean(p2Query.data?.player?.online ?? p2Query.data?.online)
    : undefined;
  const blackPlaying = blackPresenceReady
    ? Boolean(p2Query.data?.player?.playing ?? p2Query.data?.playing)
    : undefined;

  const { yourCaptures, opponentCaptures } = useMemo(() => {
    if (!game) return { yourCaptures: 0, opponentCaptures: 0 };
    return getMatchCaptureScores(game, 1, replayIndex, boardRulesQuery.data?.pieces_per_side ?? 20);
  }, [boardRulesQuery.data?.pieces_per_side, game, replayIndex]);

  const handlePlyAnimated = useCallback(
    (boardAfter: BoardCell[][]) => {
      if (!boardAfter?.length || replayIndex != null) return;
      setGame((prev) => (prev ? { ...prev, board: boardAfter } : prev));
    },
    [replayIndex],
  );

  const pauseOverlayCopy = useMemo(
    () => buildPauseOverlayCopy(game, playChrome, officialPauseChrome),
    [game, playChrome, officialPauseChrome],
  );
  // Rail fallback when board-cover chrome/VS is incomplete (play LivePlayHub parity).
  const spectateOfficialPauseBannerLines = useMemo(
    () =>
      game?.paused && !pauseOverlayCopy
        ? buildOfficialPausedBannerLines(game, playChrome, officialPauseChrome)
        : [],
    [game, playChrome, officialPauseChrome, pauseOverlayCopy],
  );
  const spectatePlayerPauseBlurb =
    game?.paused && !pauseOverlayCopy && isPlayerPause(game)
      ? (playChrome?.game_paused_blurb || "").trim()
      : "";

  const statusText = useMemo(() => {
    if (!chrome) return "";
    if (!game) return connected ? chrome.waiting_game_state : chrome.enter_game_prompt;
    const onTime = game.end_reason === "clock_flag" || game.end_reason === "clock_draw";
    // Clock endings: on-time DB status only (never turn/move copy while outcome is delayed).
    if (onTime) {
      if (game.draw || game.end_reason === "clock_draw") {
        return (chrome.status_draw_on_time || "").trim();
      }
      if (game.outcome === 1) return (chrome.status_p1_wins_on_time || "").trim();
      if (game.outcome === 2) return (chrome.status_p2_wins_on_time || "").trim();
      return "";
    }
    if (game.draw) {
      const reason = (game.draw_reason || "").trim();
      // Fail closed: rematch abandon is ops terminal, not a labeled draw reason in chrome.
      if (reason === "rematch" || (game.end_reason || "").trim() === "rematch") {
        return chrome.status_draw;
      }
      return reason
        ? `${chrome.status_draw_reason_prefix}${chrome.status_draw_reason_open}${reason}${chrome.status_draw_reason_close}`
        : chrome.status_draw;
    }
    if (game.outcome === 1) return chrome.status_p1_wins;
    if (game.outcome === 2) return chrome.status_p2_wins;
    if (game.paused) {
      // Overlay owns pause copy when ready. When overlay chrome is incomplete,
      // keep rail empty (fail-closed: do not show pause blurbs on an uncovered board).
      return "";
    }
    return game.turn === 1 ? chrome.status_white_to_move : chrome.status_black_to_move;
  }, [game, connected, chrome]);

  const livePlaying =
    Boolean(game) &&
    !game?.paused &&
    game?.outcome == null &&
    !game?.draw &&
    game?.end_reason !== "clock_flag" &&
    game?.end_reason !== "clock_draw";

  const whiteHint = useMemo(() => {
    if (!chrome || !game) return undefined;
    if (replayIndex != null) return (chrome.status_replay || chrome.history_label || "").trim();
    if (!livePlaying) {
      if (game.outcome === 1 || game.draw) return statusText;
      return undefined;
    }
    return game.turn === 1
      ? (chrome.status_your_turn || chrome.status_white_to_move || "").trim()
      : undefined;
  }, [chrome, game, livePlaying, replayIndex, statusText]);

  const blackHint = useMemo(() => {
    if (!chrome || !game) return undefined;
    if (replayIndex != null) return undefined;
    if (!livePlaying) {
      if (game.outcome === 2) return statusText;
      return undefined;
    }
    return game.turn === 2
      ? (chrome.status_opponent_turn || chrome.status_black_to_move || "").trim()
      : undefined;
  }, [chrome, game, livePlaying, replayIndex, statusText]);

  // Deep-link: /?view=spectate&gameId=… (or game_id). Do not invalidate on remount -
  // session-tier cache + WS keep the board fresh like other pages.
  useEffect(() => {
    if (urlBootstrapped) return;
    const fromUrl = (searchParams.get("gameId") || searchParams.get("game_id") || "").trim();
    if (!fromUrl) {
      setUrlBootstrapped(true);
      return;
    }
    setGameId(fromUrl);
    setConnected(true);
    setUrlBootstrapped(true);
  }, [searchParams, urlBootstrapped]);

  // Re-apply REST hydrate whenever we (re)connect - cached query data may not change
  // identity after connect() clears local `game`, which previously left a forever skeleton.
  useEffect(() => {
    if (!connected) return;
    if (hydrateQuery.data) {
      setGame(hydrateQuery.data);
      setError(null);
      return;
    }
    if (hydrateQuery.error && chrome) {
      setError(
        hydrateQuery.error instanceof Error ? hydrateQuery.error.message : chrome.load_game_failed,
      );
    }
  }, [connected, hydrateQuery.data, hydrateQuery.error, chrome]);

  useEffect(() => {
    if (!hydrated || !connected || !gameId) return;

    const wsRoot = apiWsUrl()
      .replace(/\/game\/?$/, "")
      .replace(/\/$/, "");
    const q = new URLSearchParams({ game_id: gameId });
    if (token) q.set("token", token);
    const ws = new WebSocket(`${wsRoot}/spectate?${q.toString()}`);
    let lastMoves = -1;
    let disposed = false;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as GameWsMessage;
        setEvents((prev) => [msg, ...prev].slice(0, 40));
        if (msg.type === "game_state" && msg.game) {
          const incoming = msg.game;
          const moves = incoming.move_count ?? 0;
          if (incoming.outcome != null) {
            void playGameNotify("info");
          } else if (moves > lastMoves && lastMoves >= 0) {
            void playGameNotify("your_turn");
          }
          lastMoves = moves;
          const eventName =
            typeof (msg as { event?: string }).event === "string"
              ? String((msg as { event?: string }).event).trim()
              : "";
          const actorRole =
            typeof (msg as { actor_role?: string }).actor_role === "string"
              ? String((msg as { actor_role?: string }).actor_role).trim()
              : (incoming.pause_actor_role || "").trim();
          const actorName =
            typeof (msg as { actor_display_name?: string }).actor_display_name === "string"
              ? String((msg as { actor_display_name?: string }).actor_display_name).trim()
              : (incoming.pause_actor_display_name || "").trim();
          if (incoming.paused && (incoming.pause_kind || "").trim() === "official") {
            wasOfficiallyPausedRef.current = true;
            if (actorRole || actorName) {
              lastOfficialActorRef.current = { role: actorRole, name: actorName };
            }
          } else if (
            !incoming.paused &&
            (eventName === "match.resumed" || wasOfficiallyPausedRef.current)
          ) {
            const snap = lastOfficialActorRef.current;
            const roleLabel = officialPauseRoleLabel(
              typeof (msg as { actor_role?: string }).actor_role === "string"
                ? String((msg as { actor_role?: string }).actor_role)
                : snap?.role,
              officialPauseChrome,
            );
            const name =
              typeof (msg as { actor_display_name?: string }).actor_display_name === "string"
                ? String((msg as { actor_display_name?: string }).actor_display_name).trim()
                : (snap?.name || "").trim();
            // Fail closed: never show hollow "Resumed by ·" (fmt needs both role and name).
            if (roleLabel && name) {
              const fmt = (officialPauseChrome?.banner_resumed_fmt || "").trim();
              const line = applyOfficialPauseFmt(fmt, { role: roleLabel, name });
              if (line) setResumeBanner(line);
            }
            wasOfficiallyPausedRef.current = false;
            lastOfficialActorRef.current = null;
          }
          // Freeze board while history grows so ply anim + seat clock stay in sync.
          setGame((prev) => mergeRemoteBoardState(prev, incoming));
          setError(null);
        }
        if (msg.type === "vote_update" && "votes" in msg && msg.votes && gameId) {
          const incoming = msg.votes as MatchVotesPayload;
          const authKey = (token || "").trim();
          queryClient.setQueryData(
            matchVotesQueryKey(gameId, authKey),
            (prev: MatchVotesPayload | undefined) => ({
              ...incoming,
              // Preserve this client's pick - room broadcast must not overwrite my_vote.
              my_vote: prev?.my_vote ?? null,
              has_my_vote: Boolean(prev?.has_my_vote),
            }),
          );
        }
        if (msg.type === "avatar_updated") {
          const uid = typeof msg.user_id === "string" ? msg.user_id.trim() : "";
          const thumbRaw = msg.avatar_thumb_url;
          const fullRaw = msg.avatar_full_url;
          const thumb =
            typeof thumbRaw === "string" ? thumbRaw.trim() : thumbRaw === null ? "" : undefined;
          const full =
            typeof fullRaw === "string" ? fullRaw.trim() : fullRaw === null ? "" : undefined;
          if (uid && (thumb !== undefined || full !== undefined)) {
            const nextThumb = thumb ?? "";
            const nextFull = full ?? "";
            patchAvatarEverywhere(queryClient, uid, nextThumb || null, nextFull || null);
          }
          void invalidateAvatarSurfaces(queryClient, uid || null);
        }
        if (
          msg.type === "game_chat_message" ||
          msg.type === "game_chat_toggle" ||
          msg.type === "game_chat_reaction" ||
          msg.type === "game_chat_read"
        ) {
          if (msg.type === "game_chat_message") {
            notifyIncomingChatMessage({
              myUserId: useAuthStore.getState().user?.id,
              payload: msg,
            });
          }
          const gid = (msg.game_id || gameId || "").trim();
          if (gid) void queryClient.invalidateQueries({ queryKey: ["game-chat", gid] });
        }
        if (
          msg.type === "dm_request" ||
          msg.type === "dm_message" ||
          msg.type === "dm_request_updated" ||
          msg.type === "dm_reaction" ||
          msg.type === "dm_read"
        ) {
          if (msg.type === "dm_message") {
            notifyIncomingChatMessage({
              myUserId: useAuthStore.getState().user?.id,
              payload: msg,
            });
          }
          void queryClient.invalidateQueries({ queryKey: ["dms"] });
        }
      } catch {
        /* ignore */
      }
    };
    // LivePlayHub parity: do not drop `connected` on teardown close (Strict Mode /
    // dep churn would clear connect mid-hydrate and strand the UI).
    ws.onerror = () => {
      if (!disposed && chrome) setError(chrome.unable_to_spectate);
    };
    return () => {
      disposed = true;
      ws.close();
    };
  }, [hydrated, connected, gameId, token, queryClient, chrome, officialPauseChrome]);

  // Must stay above chrome early-returns (Rules of Hooks).
  // Dual authoritative clocks; spectators interpolate only (no flag claim).
  const gameFinished = Boolean(game && (game.outcome != null || game.draw));
  // Trust server clock_active (armed from DB match_clock); do not wait on progression hydrate.
  const clockEnabled = Boolean(game?.clock_active);
  // Follow animating ply so remote moves don't flash the next seat's clock mid-slide.
  const clockPlayer = activeClockPlayer(game);
  const { p1Label, p2Label } = useServerMatchClocks({
    gameKey: game?.id || "",
    enabled: clockEnabled,
    p1RemainingMs: typeof game?.clock_p1_remaining_ms === "number" ? game.clock_p1_remaining_ms : 0,
    p2RemainingMs: typeof game?.clock_p2_remaining_ms === "number" ? game.clock_p2_remaining_ms : 0,
    serverNowMs: typeof game?.clock_server_now_ms === "number" ? game.clock_server_now_ms : 0,
    turn: clockPlayer ?? (game?.turn === 1 || game?.turn === 2 ? game.turn : 1),
    running:
      connected && !gameFinished && !game?.paused && replayIndex == null && clockPlayer != null,
    paused: Boolean(game?.paused),
  });

  const connect = () => {
    if (!chrome) return;
    const id = gameId.trim();
    if (!id) {
      setError(chrome.game_id_required);
      return;
    }
    setEvents([]);
    setError(null);
    setReplayIndex(null);
    // Keep painting session cache while reconnecting (nav-back / lists parity).
    const cached = queryClient.getQueryData<GamePayload>(gameStateQueryKey(id));
    if (cached) setGame(cached);
    setConnected(true);
    // Soft refetch - do not wipe local board; WS remains the live source.
    void queryClient.refetchQueries({ queryKey: gameStateQueryKey(id) });
  };

  const disconnect = () => {
    setConnected(false);
    setWatchFocus(false);
    setReplayIndex(null);
    // Fail-closed: drop board/vote seats so a gameId edit cannot pair new votes with stale seats.
    setGame(null);
    setEvents([]);
  };

  const enterWatchFocus = (tab: "moves" | "chat" | "info") => {
    setWatchTab(tab);
    setWatchFocus(true);
  };

  const leaveWatchFocus = () => setWatchFocus(false);

  // Cache-first: only skeleton when there is no chrome yet (soft refetch must not remount).
  if (
    !game &&
    ((chromeQuery.isLoading && !chromeQuery.data) ||
      (playChromeQuery.isLoading && !playChromeQuery.data) ||
      (railChromeQuery.isLoading && !railChromeQuery.data) ||
      (boardRulesQuery.isLoading && !boardRulesQuery.data))
  ) {
    return <PlayHubSkeleton />;
  }

  if (!chrome || !railChrome) {
    // Soft-refetch / first paint: wait instead of empty error flash.
    if (
      (chromeQuery.isLoading && !chromeQuery.data) ||
      (playChromeQuery.isLoading && !playChromeQuery.data) ||
      (railChromeQuery.isLoading && !railChromeQuery.data) ||
      (boardRulesQuery.isLoading && !boardRulesQuery.data)
    ) {
      return <PlayHubSkeleton />;
    }
    const unavailable =
      (chromeQuery.data?.spectate_chrome_unavailable || "").trim() ||
      (railChromeQuery.data?.play_rail_chrome_unavailable || "").trim() ||
      (chromeQuery.error instanceof Error ? chromeQuery.error.message : "").trim() ||
      (railChromeQuery.error instanceof Error ? railChromeQuery.error.message : "").trim();
    return (
      <div className="w-full">
        <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p>
      </div>
    );
  }

  const panelTitle = (chrome.connect_title || chrome.page_title || "").trim();

  const shareSpectateUrl = async () => {
    const id = gameId.trim();
    if (!id) return;
    const url = `${window.location.origin}/?view=spectate&gameId=${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
      toast.success(railChrome.copied_action);
    } catch {
      toast.error(railChrome.toast_copy_failed);
    }
  };

  // One compact seat-trailing row (LivePlayHub parity) - never stack flip/2D/3D or the
  // measured board square shrinks and leaves L/R + T/B gutters.
  const boardViewToggle = railChrome ? (
    <div className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
        aria-label={railChrome.flip_board_aria}
        onClick={() => setFlipBoard((v) => !v)}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
        aria-label={railChrome.share_game_aria}
        onClick={() => void shareSpectateUrl()}
        disabled={!gameId.trim()}
      >
        {shareCopied ? (
          <Check className="h-3.5 w-3.5 text-[var(--dama-online)]" aria-hidden />
        ) : (
          <Share2 className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
      <div
        className="inline-flex flex-row gap-0.5 rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] p-0.5"
        // biome-ignore lint/a11y/useSemanticElements: board view segmented toggle
        role="group"
        aria-label={railChrome.label_board}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold",
            boardView === "2d"
              ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
              : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
          )}
          aria-pressed={boardView === "2d"}
          onClick={() => setBoardView("2d")}
        >
          <Box className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {railChrome.board_view_2d}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold",
            boardView === "3d"
              ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
              : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
          )}
          aria-pressed={boardView === "3d"}
          onClick={() => setBoardView("3d")}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {railChrome.board_view_3d}
        </button>
      </div>
    </div>
  ) : null;

  const colorsBlock = railChrome ? (
    <BoardColorsPopover
      open={colorsOpen}
      onOpenChange={setColorsOpen}
      triggerId="spectate-colors"
      colorsLabel={railChrome.label_colors}
      boardLabel={railChrome.label_board}
      piecesLabel={railChrome.label_pieces}
    />
  ) : null;

  const showLiveBoard = Boolean(game && displayBoard && displayBoard.length > 0);
  // Board-column only (never full-page) so Connect/Disconnect stay reachable while hydrating.
  // Do not skeleton when session cache already has a board (nav back parity with lists).
  const showBoardSkeleton =
    (connected && !showLiveBoard && !hydrateQuery.data) ||
    (hydrateQuery.isLoading && connected && !game && !hydrateQuery.data);

  // Fill PlayBoardColumn’s square host (LivePlayHub parity) - never stack extra chrome
  // under the board inside the square (that reads as L/R/T/B padding).
  let boardInner: ReactNode;
  if (showLiveBoard && displayBoard) {
    boardInner =
      boardView === "2d" ? (
        <DraughtsBoard2D
          board={displayBoard}
          legalMoves={[]}
          selected={null}
          onSelectSquare={() => undefined}
          interactive={false}
          mustContinue={null}
          flipBoard={flipBoard}
          moveHistory={replayIndex != null ? [] : history}
          yourPlayer={1}
          replayMode={replayIndex != null}
          onPlyAnimated={replayIndex == null ? handlePlyAnimated : undefined}
        />
      ) : (
        <DraughtsScene3D
          board={displayBoard}
          legalMoves={[]}
          selected={null}
          onSelectSquare={() => undefined}
          interactive={false}
          mustContinue={null}
          flipBoard={flipBoard}
          moveHistory={replayIndex != null ? [] : history}
          yourPlayer={1}
          replayMode={replayIndex != null}
          onPlyAnimated={replayIndex == null ? handlePlyAnimated : undefined}
        />
      );
  } else if (showBoardSkeleton) {
    boardInner = <BoardAreaSkeleton />;
  } else if (boardView === "2d") {
    boardInner = <HomePreviewBoard opponentLabel="" playerLabel="" clockLabel="" />;
  } else if (previewBoard.length > 0) {
    boardInner = (
      <DraughtsScene3D
        board={previewBoard}
        legalMoves={[]}
        selected={null}
        onSelectSquare={() => undefined}
        interactive={false}
        mustContinue={null}
        flipBoard={false}
        moveHistory={[]}
        yourPlayer={1}
        replayMode
      />
    );
  } else {
    boardInner = <BoardAreaSkeleton />;
  }

  const boardNode =
    showLiveBoard && displayBoard ? (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden",
          replayIndex != null ? "opacity-90" : undefined,
        )}
      >
        {boardInner}
      </div>
    ) : (
      boardInner
    );

  const introVs = (
    railChrome?.match_intro_vs_label ||
    playChrome?.match_intro_vs_label ||
    ""
  ).trim();
  const nameMax = railChrome?.live_player_name_max_chars;
  const nameSuffix = railChrome?.name_truncate_suffix;
  const boardCoverOverlay =
    showLiveBoard && game?.paused && pauseOverlayCopy && introVs ? (
      <MatchPauseOverlay
        active
        vsLabel={introVs}
        ariaLabel={pauseOverlayCopy.ariaLabel}
        statusLabel={pauseOverlayCopy.statusLabel}
        bannerLine={pauseOverlayCopy.bannerLine}
        byLine={pauseOverlayCopy.byLine}
        reasonLine={pauseOverlayCopy.reasonLine}
        noteLine={pauseOverlayCopy.noteLine}
        sinceLine={pauseOverlayCopy.sinceLine}
        footerLine={pauseOverlayCopy.footerLine}
        footerLineFmt={pauseOverlayCopy.footerLineFmt}
        expiresAtUnixMs={pauseOverlayCopy.expiresAtUnixMs}
        nameMaxChars={nameMax}
        nameSuffix={nameSuffix}
        top={{
          username: blackName,
          avatarUrl:
            p2Query.data?.player?.avatar_full_url || p2Query.data?.player?.avatar_thumb_url,
          countryCode: p2Query.data?.player?.country_code,
          hostTrustBadge: p2Query.data?.player?.host_trust_badge ?? null,
          hostTrustTier: p2Query.data?.player?.host_trust_tier ?? null,
        }}
        bottom={{
          username: whiteName,
          avatarUrl:
            p1Query.data?.player?.avatar_full_url || p1Query.data?.player?.avatar_thumb_url,
          countryCode: p1Query.data?.player?.country_code,
          hostTrustBadge: p1Query.data?.player?.host_trust_badge ?? null,
          hostTrustTier: p1Query.data?.player?.host_trust_tier ?? null,
        }}
      />
    ) : null;

  return (
    <div
      className={cn(
        "grid w-full items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:gap-4",
        fillHeight
          ? playHubFillHeightClass
          : cn(playHubDesktopHeightClass, mobilePlayBoardStandaloneHeightClass),
        mobilePlayBoardColumnClass,
      )}
    >
      {/* Match seats: opponent above board, you below; 2D/3D beside top seat (desktop). */}
      <div
        className={cn(
          "order-1 flex min-h-0 min-w-0 flex-col overflow-hidden lg:flex-1 lg:justify-center",
          mobilePlayBoardMaxHeightClass,
        )}
      >
        <PlayBoardColumn
          desktopHeader={
            game ? (
              <BoardSeatBar
                label={blackName}
                hint={blackHint}
                rating={p2Query.data?.player?.rating}
                ratingParenOpen={railChrome?.rating_paren_open}
                ratingParenClose={railChrome?.rating_paren_close}
                clock={p2Label}
                tone="muted"
                clockActive={Boolean(
                  !gameFinished && !game?.paused && replayIndex == null && clockPlayer === 2,
                )}
                captures={opponentCaptures}
                pieceSide="dark"
                online={blackOnline}
                playing={blackPlaying}
                avatarThumbUrl={p2Query.data?.player?.avatar_thumb_url}
                countryCode={p2Query.data?.player?.country_code}
                trailing={boardViewToggle}
                hoverPlayer={
                  game?.player2_id && (p2Query.data?.player?.username || blackName)
                    ? {
                        id: game.player2_id,
                        username: p2Query.data?.player?.username || blackName,
                        rating:
                          typeof p2Query.data?.player?.rating === "number"
                            ? p2Query.data.player.rating
                            : Number.NaN,
                        xp:
                          typeof p2Query.data?.player?.xp === "number"
                            ? p2Query.data.player.xp
                            : Number.NaN,
                        wins:
                          typeof p2Query.data?.player?.wins === "number"
                            ? p2Query.data.player.wins
                            : Number.NaN,
                        losses:
                          typeof p2Query.data?.player?.losses === "number"
                            ? p2Query.data.player.losses
                            : Number.NaN,
                        draws:
                          typeof p2Query.data?.player?.draws === "number"
                            ? p2Query.data.player.draws
                            : undefined,
                        countryCode: p2Query.data?.player?.country_code,
                        avatarThumbUrl: p2Query.data?.player?.avatar_thumb_url,
                        avatarFullUrl: p2Query.data?.player?.avatar_full_url,
                        hostTrustBadge: p2Query.data?.player?.host_trust_badge ?? null,
                        hostTrustTier: p2Query.data?.player?.host_trust_tier ?? null,
                        online: blackOnline,
                        playing: blackPlaying,
                        playingGameId: game.id,
                      }
                    : null
                }
                railChrome={railChrome}
                signedIn={signedIn}
              />
            ) : showBoardSkeleton ? (
              <BoardSeatBarSkeleton showTrailing clockActive={false} />
            ) : boardViewToggle ? (
              <div className="flex w-full justify-end">{boardViewToggle}</div>
            ) : null
          }
          desktopFooter={
            game ? (
              <BoardSeatBar
                label={whiteName}
                hint={whiteHint}
                rating={p1Query.data?.player?.rating}
                ratingParenOpen={railChrome?.rating_paren_open}
                ratingParenClose={railChrome?.rating_paren_close}
                clock={p1Label}
                tone="muted"
                clockActive={Boolean(
                  !gameFinished && !game?.paused && replayIndex == null && clockPlayer === 1,
                )}
                captures={yourCaptures}
                pieceSide="light"
                online={whiteOnline}
                playing={whitePlaying}
                avatarThumbUrl={p1Query.data?.player?.avatar_thumb_url}
                countryCode={p1Query.data?.player?.country_code}
                hoverPlayer={
                  game?.player1_id && (p1Query.data?.player?.username || whiteName)
                    ? {
                        id: game.player1_id,
                        username: p1Query.data?.player?.username || whiteName,
                        rating:
                          typeof p1Query.data?.player?.rating === "number"
                            ? p1Query.data.player.rating
                            : Number.NaN,
                        xp:
                          typeof p1Query.data?.player?.xp === "number"
                            ? p1Query.data.player.xp
                            : Number.NaN,
                        wins:
                          typeof p1Query.data?.player?.wins === "number"
                            ? p1Query.data.player.wins
                            : Number.NaN,
                        losses:
                          typeof p1Query.data?.player?.losses === "number"
                            ? p1Query.data.player.losses
                            : Number.NaN,
                        draws:
                          typeof p1Query.data?.player?.draws === "number"
                            ? p1Query.data.player.draws
                            : undefined,
                        countryCode: p1Query.data?.player?.country_code,
                        avatarThumbUrl: p1Query.data?.player?.avatar_thumb_url,
                        avatarFullUrl: p1Query.data?.player?.avatar_full_url,
                        hostTrustBadge: p1Query.data?.player?.host_trust_badge ?? null,
                        hostTrustTier: p1Query.data?.player?.host_trust_tier ?? null,
                        online: whiteOnline,
                        playing: whitePlaying,
                        playingGameId: game.id,
                      }
                    : null
                }
                railChrome={railChrome}
                signedIn={signedIn}
              />
            ) : showBoardSkeleton ? (
              <BoardSeatBarSkeleton clockActive={false} />
            ) : null
          }
          board={boardNode}
          coverOverlay={boardCoverOverlay}
        />
      </div>

      <PlayRailAside>
        <div
          className={cn(
            playRailStickyMainClass,
            "flex items-center justify-center gap-2 px-3 py-3.5",
          )}
          data-dama-rail-main=""
          role="tablist"
          aria-label={panelTitle}
        >
          <Eye className="h-4 w-4 shrink-0 text-[var(--dama-brand)]" aria-hidden />
          <span className="truncate text-sm font-semibold text-[var(--dama-text)]">
            {panelTitle}
          </span>
        </div>

        <div className="shrink-0 space-y-3 border-b border-[var(--dama-border)]/60 p-4 pb-3 sm:p-5 sm:pb-3">
          {(chrome.page_blurb_web || chrome.page_blurb || "").trim() ? (
            <p className="text-sm text-[var(--dama-muted-foreground)]">
              {(chrome.page_blurb_web || chrome.page_blurb || "").trim()}
            </p>
          ) : null}

          {(!livePlaying && statusText) || (game?.paused && statusText) ? (
            <p
              className={cn(
                "text-sm",
                game?.paused ? "font-medium text-[var(--dama-brand)]" : "text-[var(--dama-muted)]",
              )}
              aria-live="polite"
            >
              {statusText}
            </p>
          ) : null}
          {spectateOfficialPauseBannerLines.length > 0 ? (
            <OfficialPauseBanner lines={spectateOfficialPauseBannerLines} />
          ) : null}
          {spectatePlayerPauseBlurb ? (
            <p className="text-sm text-[var(--dama-muted)]" aria-live="polite">
              {spectatePlayerPauseBlurb}
            </p>
          ) : null}
          {resumeBanner ? (
            <div className="flex items-start justify-between gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-2 py-1.5">
              <p className="text-sm font-medium text-[var(--dama-brand)]" aria-live="polite">
                {resumeBanner}
              </p>
              {(officialPauseChrome?.confirm_cancel || "").trim() ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setResumeBanner("")}
                >
                  {(officialPauseChrome?.confirm_cancel || "").trim()}
                </Button>
              ) : null}
            </div>
          ) : null}
          <OfficialPauseActivityStrip
            token={token}
            gameId={game?.id || gameId}
            chrome={officialPauseChrome}
            // API authz decides seats vs operators; pure spectators get 403 and strip hides.
            enabled={Boolean(
              connected &&
                token &&
                (game?.paused || Boolean(resumeBanner) || game?.outcome != null || game?.draw),
            )}
            refreshKey={[
              game?.id || "",
              game?.paused ? "1" : "0",
              (game?.pause_kind || "").trim(),
              (game?.pause_reason_key || "").trim(),
              (game?.pause_note || "").trim(),
              String(Number(game?.paused_at_unix_ms) || 0),
            ].join("|")}
          />
          {error ? <p className="text-sm text-[var(--dama-danger)]">{error}</p> : null}

          <Field id="spectate-game-id" label={chrome.game_id_label || chrome.game_id_placeholder}>
            <Input
              id="spectate-game-id"
              placeholder={chrome.game_id_placeholder}
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              disabled={connected}
              autoComplete="off"
              className="h-11"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="play"
              size="lg"
              className="h-12 w-full text-base"
              onClick={connect}
              disabled={!gameId.trim() || connected}
              isLoading={connected && !game && !error}
              pendingLabel={chrome.connecting_status}
            >
              {connected ? chrome.listening_action : chrome.connect_action}
            </Button>
            {connected ? (
              <Button type="button" variant="outline" className="w-full" onClick={disconnect}>
                {chrome.disconnect_action}
              </Button>
            ) : null}
          </div>
        </div>

        {game && railChrome ? (
          <>
            <div className="shrink-0 space-y-3 border-b border-[var(--dama-border)]/60 px-4 py-3 sm:px-5">
              {chrome && connected && gameId.trim() && game?.player1_id && game?.player2_id
                ? (() => {
                    const p1Id = (game.player1_id || "").trim();
                    const p2Id = (game.player2_id || "").trim();
                    if (!p1Id || !p2Id) return null;
                    const voteP1 = (p1Query.data?.player?.username || "").trim();
                    const voteP2 = (p2Query.data?.player?.username || "").trim();
                    const seatIds = [p1Id, p2Id];
                    const viewerIsSeated = Boolean(
                      myId && seatIds.some((id) => id === myId.trim()),
                    );
                    const canCastSkeleton = signedIn && !viewerIsSeated && livePlaying;
                    const seatsLoading =
                      p1Query.isLoading ||
                      p2Query.isLoading ||
                      p1Query.isPlaceholderData ||
                      p2Query.isPlaceholderData;
                    if (seatsLoading && (!voteP1 || !voteP2)) {
                      if (watchFocus) {
                        return (
                          <div className="rounded-lg border border-[var(--dama-border)]/60 bg-[var(--dama-card)] px-3 py-2">
                            <p className="truncate text-xs font-medium text-[var(--dama-muted)]">
                              {chrome.vote_section_title}
                            </p>
                          </div>
                        );
                      }
                      return <MatchVoteSkeleton showCastButtons={canCastSkeleton} />;
                    }
                    if (!voteP1 || !voteP2) {
                      return (
                        <section className="rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4">
                          <p className="text-sm text-[var(--dama-danger)]">
                            {chrome.vote_unavailable}
                          </p>
                        </section>
                      );
                    }
                    return (
                      <MatchVotePanel
                        chrome={chrome}
                        gameId={gameId.trim()}
                        railChrome={railChrome}
                        compact={watchFocus}
                        player1={{
                          id: p1Id,
                          username: voteP1,
                          avatarThumbUrl: p1Query.data?.player.avatar_thumb_url,
                          avatarFullUrl: p1Query.data?.player.avatar_full_url,
                          rating: p1Query.data?.player.rating,
                          wins: p1Query.data?.player.wins,
                          losses: p1Query.data?.player.losses,
                          draws: p1Query.data?.player.draws,
                          countryCode: p1Query.data?.player.country_code,
                          online: p1Query.data?.player.online,
                          playing: p1Query.data?.player.playing,
                          hostTrustBadge: p1Query.data?.player.host_trust_badge ?? null,
                          hostTrustTier: p1Query.data?.player.host_trust_tier ?? null,
                        }}
                        player2={{
                          id: p2Id,
                          username: voteP2,
                          avatarThumbUrl: p2Query.data?.player.avatar_thumb_url,
                          avatarFullUrl: p2Query.data?.player.avatar_full_url,
                          rating: p2Query.data?.player.rating,
                          wins: p2Query.data?.player.wins,
                          losses: p2Query.data?.player.losses,
                          draws: p2Query.data?.player.draws,
                          countryCode: p2Query.data?.player.country_code,
                          online: p2Query.data?.player.online,
                          playing: p2Query.data?.player.playing,
                          hostTrustBadge: p2Query.data?.player.host_trust_badge ?? null,
                          hostTrustTier: p2Query.data?.player.host_trust_tier ?? null,
                        }}
                        finished={!livePlaying}
                        paused={Boolean(game?.paused)}
                      />
                    );
                  })()
                : null}
              {!watchFocus ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2"
                  onClick={() => void shareSpectateUrl()}
                  disabled={!gameId.trim()}
                >
                  {shareCopied ? (
                    <Check className="h-4 w-4 text-[var(--dama-online)]" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  {shareCopied ? railChrome.copied_action : railChrome.share_watch_action}
                </Button>
              ) : null}
            </div>
            <div className={cn(playRailStickySubClass, "flex items-stretch")}>
              {watchFocus ? (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-0.5 border-b-2 border-transparent px-2 py-2.5 text-xs font-semibold text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
                  aria-label={railChrome.watch_panel_back_aria}
                  onClick={leaveWatchFocus}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">
                    {railChrome.watch_panel_back_action}
                  </span>
                </button>
              ) : null}
              <div className="grid min-w-0 flex-1 grid-cols-3" role="tablist">
                {(
                  [
                    { id: "moves" as const, label: railChrome.watch_tab_moves },
                    { id: "chat" as const, label: railChrome.watch_tab_chat },
                    { id: "info" as const, label: railChrome.watch_tab_info },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={watchTab === t.id}
                    className={cn(
                      "px-2 py-2.5 text-xs font-semibold",
                      watchTab === t.id
                        ? "border-b-2 border-[var(--dama-text)] text-[var(--dama-text)]"
                        : "border-b-2 border-transparent text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
                    )}
                    onClick={() => enterWatchFocus(t.id)}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {t.label}
                      {t.id === "chat" && chatUnread > 0 ? (
                        <span
                          className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--dama-brand)] px-1 text-[10px] font-semibold tabular-nums text-white"
                          aria-hidden
                        >
                          {formatDmUnreadBadge(
                            chatUnread,
                            railChrome.dm_unread_badge_max,
                            railChrome.dm_unread_badge_overflow_fmt,
                          )}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <PlayRailScrollPort chat={watchTab === "chat" && !maxLg ? "contain" : "auto"}>
              {watchTab === "moves" && history.length > 0 ? (
                <GameMoveHistory
                  layout="sidebar"
                  moves={history}
                  boardSize={game?.size ?? 0}
                  replayIndex={replayIndex}
                  onSelectLive={() => setReplayIndex(null)}
                  onSelectMove={(idx) => setReplayIndex(idx)}
                  liveLabel={(chrome.live_label || "").trim()}
                  historyLabel={(chrome.history_label || "").trim()}
                  skipLabels={
                    playChrome
                      ? {
                          first_action_label: playChrome.history_skip_first,
                          prev_action_label: playChrome.history_skip_prev,
                          next_action_label: playChrome.history_skip_next,
                          last_action_label: playChrome.history_skip_last,
                          skip_to_action_label: playChrome.history_skip_go,
                          page_summary_fmt: playChrome.history_skip_page_of,
                        }
                      : undefined
                  }
                />
              ) : null}
              {watchTab === "chat" ? (
                <GameChatPanel
                  chrome={railChrome}
                  gameId={game.id}
                  signedIn={signedIn}
                  observing={{
                    p1Name: (p1Query.data?.player?.username || "").trim(),
                    p1Rating: p1Query.data?.player?.rating,
                    p1Country: p1Query.data?.player?.country_code,
                    p2Name: (p2Query.data?.player?.username || "").trim(),
                    p2Rating: p2Query.data?.player?.rating,
                    p2Country: p2Query.data?.player?.country_code,
                    timeLabel: (() => {
                      const sec =
                        typeof game.time_control_seconds === "number" &&
                        game.time_control_seconds > 0
                          ? game.time_control_seconds
                          : 0;
                      if (!sec) return undefined;
                      const presets = progressionQuery.data?.match_clock?.presets;
                      if (!Array.isArray(presets)) return undefined;
                      const hit = presets.find(
                        (p) =>
                          typeof p?.seconds === "number" &&
                          p.seconds === sec &&
                          typeof p?.label === "string" &&
                          p.label.trim().length > 0,
                      );
                      return hit?.label?.trim() || undefined;
                    })(),
                  }}
                />
              ) : null}
              {watchTab === "info" ? (
                <div className="space-y-3 p-3 text-xs text-[var(--dama-muted)]">
                  {colorsBlock}
                  <div className="space-y-2">
                    <p className="font-semibold text-[var(--dama-text)]">
                      {softSpectateEventLogTitle(chrome.event_log_title)}
                    </p>
                    <ul className="space-y-1">
                      {events.length === 0 ? (
                        <li>{softSpectateNoEvents(chrome.no_events)}</li>
                      ) : (
                        events.map((ev, i) => (
                          <li
                            key={`${i}-${ev.type}`}
                            className="rounded border border-[var(--dama-border)]/60 bg-[var(--dama-panel)] px-2 py-1 tabular-nums"
                          >
                            {formatSpectateEventLine(ev, game.size ?? 0)}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}
            </PlayRailScrollPort>
          </>
        ) : (
          <PlayRailScrollPort>
            <div className="flex flex-col gap-3 p-4 pb-6 sm:p-5">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2"
                onClick={() => void shareSpectateUrl()}
                disabled={!gameId.trim()}
              >
                {shareCopied ? (
                  <Check className="h-4 w-4 text-[var(--dama-online)]" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {shareCopied ? railChrome.copied_action : railChrome.share_watch_action}
              </Button>
              {history.length > 0 ? (
                <div className="w-full rounded-md border border-[var(--dama-border)] p-3">
                  <GameMoveHistory
                    layout="sidebar"
                    moves={history}
                    boardSize={game?.size ?? 0}
                    replayIndex={replayIndex}
                    onSelectLive={() => setReplayIndex(null)}
                    onSelectMove={(idx) => setReplayIndex(idx)}
                    liveLabel={(chrome.live_label || "").trim()}
                    historyLabel={(chrome.history_label || "").trim()}
                    skipLabels={
                      playChrome
                        ? {
                            first_action_label: playChrome.history_skip_first,
                            prev_action_label: playChrome.history_skip_prev,
                            next_action_label: playChrome.history_skip_next,
                            last_action_label: playChrome.history_skip_last,
                            skip_to_action_label: playChrome.history_skip_go,
                            page_summary_fmt: playChrome.history_skip_page_of,
                          }
                        : undefined
                    }
                  />
                </div>
              ) : null}
              {colorsBlock}
              <details className="group shrink-0 rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)]/40">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[var(--dama-muted-foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronDown
                      className="h-3.5 w-3.5 transition group-open:rotate-180"
                      aria-hidden
                    />
                    {softSpectateEventLogTitle(chrome.event_log_title)}
                  </span>
                </summary>
                <ul className="space-y-1.5 border-t border-[var(--dama-border)] px-3 py-2 text-[10px] tabular-nums">
                  {events.length === 0 ? (
                    <li className="text-[var(--dama-muted)]">
                      {softSpectateNoEvents(chrome.no_events)}
                    </li>
                  ) : (
                    events.map((e, i) => {
                      const label = formatSpectateEventLine(e, game?.size ?? 0);
                      return (
                        <li
                          key={`${e.type}-${i}`}
                          className="rounded border border-[var(--dama-border)]/60 bg-[var(--dama-panel)] px-2 py-1 text-[var(--dama-muted)]"
                        >
                          {label}
                        </li>
                      );
                    })
                  )}
                </ul>
              </details>
            </div>
          </PlayRailScrollPort>
        )}

        {/* Bell/theme/user live in marketing PlayerMobileChrome (persistent all breakpoints). */}
      </PlayRailAside>
    </div>
  );
}
