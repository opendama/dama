"use client";

import { InMatchAdOverlay } from "@/components/ads/InMatchAdOverlay";
import { SignInLink } from "@/components/auth/SignInLink";
import { GameChatPanel } from "@/components/chat/GameChatPanel";
import { MatchIntroOverlay } from "@/components/chat/MatchIntroOverlay";
import { MatchResultOverlay } from "@/components/chat/MatchResultOverlay";
import { GameMoveHistory } from "@/components/game/GameMoveHistory";
import { MatchScoreLine } from "@/components/game/MatchScoreLine";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayRailAside } from "@/components/play-rail/PlayRailAside";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { BoardSeatBar } from "@/components/play/BoardSeatBar";
import { PlayBoardColumn } from "@/components/play/PlayBoardColumn";
import { MatchPauseOverlay } from "@/components/play/MatchPauseOverlay";
import { OfficialPauseActivityStrip } from "@/components/play/OfficialPauseActivityStrip";
import { OfficialPauseBanner } from "@/components/play/OfficialPauseBanner";
import { PlayPauseStopActions } from "@/components/play/PlayPauseStopActions";
import { useServerMatchClocks } from "@/components/player/MatchClock";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BoardAreaSkeleton,
  BoardSeatBarSkeleton,
  FormCardSkeleton,
  PlayHubSkeleton,
  ShimmerBlock,
} from "@/components/ui/shimmer-skeletons";
import { useAbandonGameMutation } from "@/hooks/mutation/useAbandonGameMutation";
import { usePauseGameMutation } from "@/hooks/mutation/usePauseGameMutation";
import { useResumeGameMutation } from "@/hooks/mutation/useResumeGameMutation";
import { useStartGameMutation } from "@/hooks/mutation/useStartGameMutation";
import { useBoardRulesQuery } from "@/hooks/query/useBoardRulesQuery";
import { useGameChatQuery } from "@/hooks/query/useGameChatQuery";
import { gameStateQueryKey, useGameStateQuery } from "@/hooks/query/useGameStateQuery";
import { useOfficialPauseChromeQuery } from "@/hooks/query/useOfficialPauseChromeQuery";
import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { useProgressionQuery } from "@/hooks/query/useProgressionQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { useMaxLg } from "@/hooks/useMaxLg";
import { authHeaders, resolveWsUrl, restClient } from "@/lib/api";
import { isApiClientError } from "@/lib/api-client-error";
import { applyOptimisticDraughtsMove } from "@/lib/applyOptimisticDraughtsMove";
import { playGameNotify } from "@/lib/audio-notify";
import { patchAvatarEverywhere } from "@/lib/avatar-cache-patch";
import { pieceSeatNames, usePiecePalette } from "@/lib/board-palette";
import { useBoardViewMode } from "@/lib/board-view";
import { notifyIncomingChatMessage } from "@/lib/chat-message-notify";
import { CountryFlag } from "@/lib/country-flag";
import { formatDmUnreadBadge } from "@/lib/dm-unread-badge";
import { getMatchCaptureScores } from "@/lib/game-board-stats";
import { fireGameDefeatPulse, fireGameVictoryCelebration } from "@/lib/game-victory";
import { mergeBoardStateAfterPlayerMove, mergeRemoteBoardState } from "@/lib/gameBoardStateMerge";
import {
  activeClockPlayer,
  isBoardPlySynced,
  isTerminalBoardSynced,
  syncTerminalBoard,
  withResolvedOutcome,
} from "@/lib/gameOutcome";
import { invalidateAvatarSurfaces, invalidateFeatureFlags } from "@/lib/invalidate";
import { isOtpSessionVerified, subscribeOtpSession } from "@/lib/otp-session";
import {
  applyOfficialPauseFmt,
  buildOfficialPausedBannerLines,
  buildPauseOverlayCopy,
  isOfficialPause,
  officialPauseRoleLabel,
} from "@/lib/official-pause-display";
import {
  getActivePlayBoardGameId,
  isLeavePauseSilentError,
  isPauseInflight,
  markManualResume,
  pauseFailureLabel,
  pauseGameOnLeave,
  setActivePlayBoardGameId,
  takeManualResume,
} from "@/lib/pause-active-game";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import {
  clearStoredPlaySession,
  isPlayerPlaySurface,
  patchStoredPlayPaused,
  readStoredPlaySession,
  storePlaySession,
} from "@/lib/play-session-storage";
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
import { ensurePracticeToken } from "@/lib/practice-token";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useShellChromeStore } from "@/store/shell-chrome";
import type { BoardCell, GamePayload, GameWsMessage } from "@/types/game";
import { isOfficialPauseChromeReady } from "@/types/official-pause-chrome";
import { isPlayChromeReady } from "@/types/play-chrome";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Check, Layers, RefreshCw, Share2, Timer } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

// No loading skeleton: remount/keep-alive must not flash BoardAreaSkeleton (lists/tables parity).
const DraughtsScene3D = dynamic(() => import("@/components/game/DraughtsScene3D"), {
  ssr: false,
  loading: () => null,
});
const DraughtsBoard2D = dynamic(() => import("@/components/game/DraughtsBoard2D"), {
  ssr: false,
  loading: () => null,
});

/** DB `id_truncate_chars` + `id_truncate_suffix` - never invent a fixed slice length. */
function formatGameIdDisplay(id: string, charsRaw: string, suffix: string): string {
  const n = Number.parseInt(charsRaw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return id;
  if (id.length <= n) return id;
  return `${id.slice(0, n)}${suffix}`;
}

function countSidePieces(board: BoardCell[][], player: number): number {
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.p === player) n += 1;
    }
  }
  return n;
}

/** Turn chrome beside the seat title: `Name (Your turn)`. */
function seatTurnParen(hint?: string): string {
  const inner = (hint || "").trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
  return inner;
}

function LiveSeatBar({
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
  /** Tracks live piece palette (`--dama-piece-light` / `--dama-piece-dark`). */
  pieceSide?: "light" | "dark";
  online?: boolean;
  playing?: boolean;
  layout?: "bar" | "side";
  avatarThumbUrl?: string | null;
  countryCode?: string | null;
}) {
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
        {clock ? (
          <div className="max-w-full shrink-0 [&_*]:text-[10px] sm:[&_*]:text-[11px]">{clock}</div>
        ) : null}
        {typeof captures === "number" ? (
          <span className="rounded bg-[var(--dama-panel)] px-1 py-px text-[9px] font-semibold tabular-nums text-[var(--dama-muted)]">
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
      {clock ? <div className="shrink-0">{clock}</div> : null}
    </div>
  );
}

export type LivePlayEmbedApi = {
  phase: "menu" | "playing" | "finished";
  game: GamePayload | null;
  busy: boolean;
  bootstrapping: boolean;
  yourName: string;
  opponentName: string;
  /** Seat hover card player (avatar+name); null when no public id (e.g. AI). */
  yourHoverPlayer?: RailPlayer | null;
  opponentHoverPlayer?: RailPlayer | null;
  yourAvatarThumbUrl?: string | null;
  opponentAvatarThumbUrl?: string | null;
  yourCountryCode?: string | null;
  opponentCountryCode?: string | null;
  yourRating?: number | null;
  opponentRating?: number | null;
  yourTurnHint: string;
  oppTurnHint?: string;
  /** Whose clock should be white (Chess.com active timer; follows animating ply). */
  isYourTurn?: boolean;
  /** Visual clock seat - true while your clock is lit (may lag server turn during ply anim). */
  yourClockActive?: boolean;
  yourCaptures: number;
  opponentCaptures: number;
  /** 1 = light (bottom default), 2 = dark (flipped seat). */
  yourPlayer: 1 | 2 | null;
  /** Presence from GET /players (undefined = hide dot; AI opponent omits). */
  yourOnline?: boolean;
  yourPlaying?: boolean;
  opponentOnline?: boolean;
  opponentPlaying?: boolean;
  /** Your seat clock label (authoritative + interpolated). */
  seatClock: ReactNode;
  /** Opponent seat clock label (authoritative + interpolated). */
  opponentSeatClock?: ReactNode;
  boardNode: ReactNode;
  /** Intro/result covering full seat+board column (not board-square only). */
  boardCoverOverlay?: ReactNode;
  /** Flip + share + 2D/3D (same toolbar as standalone LivePlayHub). */
  boardControls: ReactNode;
  /** Scrollable move list for the right rail (not under the board). */
  historyNode: ReactNode;
  metaNode: ReactNode;
  resultNode: ReactNode;
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
  /** Official pause notice lines (DB chrome); empty when not official. */
  officialPauseBannerLines?: string[];
  endLocalSession: () => void;
  restartAi: () => void;
  stopLabel: string;
  stopPending: boolean;
  stopPendingLabel: string;
  practiceBlurb: string;
};

export type LivePlayHubProps = {
  /** Start AI in-place on `/` without changing the URL. */
  embed?: {
    mode: "ai" | "practice";
    depth: number | null;
    /** Required for AI start - match_clock.presets seconds (Challenge parity). */
    timeControlSeconds?: number;
  };
  onExitToLobby?: () => void;
  /** Keep HomePlayHub chrome; only inject board + live rail bits. */
  renderEmbedded?: (api: LivePlayEmbedApi) => ReactNode;
  /** When true (marketing `/` shell), fill parent height instead of 100dvh calc. */
  fillHeight?: boolean;
  /**
   * Keep-alive resume id when the URL dropped `gameId` (e.g. navigated to spectate).
   * HomePlayHub hides this hub instead of unmounting so the board does not re-shimmer.
   */
  forceGameId?: string | null;
  /** False while keep-alive hub is hidden off the play surface. */
  surfaceActive?: boolean;
};

/** Live AI/PvP - full layout, or embedded into HomePlayHub via renderEmbedded. */
export function LivePlayHub({
  embed,
  onExitToLobby,
  renderEmbedded,
  fillHeight = false,
  forceGameId = null,
  surfaceActive = true,
}: LivePlayHubProps = {}) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const onPlaySurface = surfaceActive && isPlayerPlaySurface(pathname, searchParams);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const [piecePalette] = usePiecePalette();
  const qc = useQueryClient();
  const gameEndFxRef = useRef(false);
  const gameIdParam =
    (forceGameId || "").trim() || searchParams.get("gameId") || searchParams.get("game_id");
  const modeParam = embed?.mode ?? searchParams.get("mode");
  const depthParam = embed?.depth != null ? String(embed.depth) : searchParams.get("depth");
  const tcParam =
    embed?.timeControlSeconds != null && embed.timeControlSeconds > 0
      ? String(embed.timeControlSeconds)
      : searchParams.get("tc") || searchParams.get("time");
  // Resume with gameId: honor explicit mode only (never invent AI for PvP history).
  // New practice without gameId: default AI when mode omitted.
  const isAiMode = gameIdParam
    ? (modeParam || "").toLowerCase() === "ai"
    : (modeParam || "ai").toLowerCase() !== "pvp";
  const embedded = Boolean(embed);
  const [practiceToken, setPracticeToken] = useState<string | null>(null);
  const effectiveToken = token || practiceToken;
  /** Real account (not guest practice JWT). */
  const isAccount = Boolean(token);

  const chromeQuery = usePlayChromeQuery(true);
  const chrome = isPlayChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const officialPauseChromeQuery = useOfficialPauseChromeQuery(true);
  const officialPauseChrome = isOfficialPauseChromeReady(officialPauseChromeQuery.data)
    ? officialPauseChromeQuery.data
    : undefined;
  const railChromeQuery = usePlayRailChromeQuery(true);
  const railChrome = isPlayRailChromeReady(railChromeQuery.data) ? railChromeQuery.data : undefined;

  const flagsQuery = useRestFeatureFlagsQuery();
  const progressionQuery = useProgressionQuery();
  const boardRulesQuery = useBoardRulesQuery();
  const [boardView, setBoardView] = useBoardViewMode();
  /** Manual flip overrides seat-based orientation (Chess.com flip control). */
  const [flipManual, setFlipManual] = useState<boolean | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [resumeBanner, setResumeBanner] = useState("");
  const [watchTab, setWatchTab] = useState<"moves" | "chat" | "info">("moves");
  const maxLg = useMaxLg();
  const gameChatBadgeQuery = useGameChatQuery(gameIdParam, isAccount && Boolean(gameIdParam));
  const chatUnread = gameChatBadgeQuery.data?.unread_count ?? 0;
  const setImmersiveChat = useShellChromeStore((s) => s.setImmersiveChat);
  // Hide bottom nav on chat; max-lg aside stays the scrollport (do not freeze overflow).
  useEffect(() => {
    setImmersiveChat(watchTab === "chat");
    return () => setImmersiveChat(false);
  }, [watchTab, setImmersiveChat]);
  const [matchIntroActive, setMatchIntroActive] = useState(false);
  const [matchResultActive, setMatchResultActive] = useState(false);
  const matchIntroSeenRef = useRef<string | null>(null);
  const resumeQuery = useGameStateQuery(gameIdParam, hydrated && Boolean(gameIdParam));
  const startGameMutation = useStartGameMutation(effectiveToken);
  const abandonGameMutation = useAbandonGameMutation(effectiveToken);
  const pauseGameMutation = usePauseGameMutation(effectiveToken);
  const resumeGameMutation = useResumeGameMutation(effectiveToken);

  // Free VS-AI: mint ephemeral guest JWT when the player is not signed in.
  useEffect(() => {
    if (!hydrated || token) return;
    if (!isAiMode && !gameIdParam) return;
    let cancelled = false;
    void ensurePracticeToken().then((t) => {
      if (cancelled) return;
      if (t) {
        setPracticeToken(t);
        return;
      }
      const msg = (chrome?.toast_start_failed || "").trim();
      if (msg) toast.error(msg);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, isAiMode, gameIdParam, chrome?.toast_start_failed]);

  // Seed from React Query so leave→back (resume URL / tournament / PvP) paints without skeleton flash.
  const cachedResumeGame = gameIdParam
    ? (qc.getQueryData<GamePayload>(gameStateQueryKey(gameIdParam)) ?? null)
    : null;
  const [phase, setPhase] = useState<"menu" | "playing" | "finished">(() => {
    if (!cachedResumeGame) return "menu";
    if (cachedResumeGame.outcome != null || cachedResumeGame.draw) return "finished";
    return "playing";
  });
  const [game, setGame] = useState<GamePayload | null>(() => cachedResumeGame);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [depth, setDepth] = useState<number | null>(null);
  const [clockSeconds, setClockSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [practiceBootstrapping, setPracticeBootstrapping] = useState(false);
  const [gameStartedAtMs, setGameStartedAtMs] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [illegalShakeKey, setIllegalShakeKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const gameRef = useRef<GamePayload | null>(null);
  const initialBoardRef = useRef<BoardCell[][] | null>(null);
  const initialBoardGameIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  /** Re-renders when SessionSecurity marks OTP verified (unblocks AI auto-start). */
  const otpSessionOk = useSyncExternalStore(
    subscribeOtpSession,
    () => isOtpSessionVerified(userId),
    () => false,
  );
  const pendingLocalMoveRef = useRef(false);
  const moveWaitRef = useRef<{
    resolve: (g: GamePayload) => void;
    reject: (e: Error) => void;
  } | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!game?.id || !game.board?.length) return;
    if (initialBoardGameIdRef.current === game.id) return;
    initialBoardGameIdRef.current = game.id;
    // Opening snapshot: empty history ⇒ current board is the start position.
    if (!game.move_history?.length) {
      initialBoardRef.current = game.board.map((row) =>
        row.map((cell) => (cell ? { ...cell } : null)),
      );
    }
  }, [game?.id, game?.board, game?.move_history?.length]);

  const vsAiEnabled = flagsQuery.data?.vs_ai_enabled === true;
  const aiDepths = useMemo(
    () => (flagsQuery.data?.ai_depths?.length ? flagsQuery.data.ai_depths : []),
    [flagsQuery.data?.ai_depths],
  );
  const timeControlPresets = useMemo(() => {
    const raw = progressionQuery.data?.match_clock?.presets;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is { seconds: number; label: string } =>
        typeof p?.seconds === "number" &&
        p.seconds > 0 &&
        typeof p?.label === "string" &&
        p.label.trim().length > 0,
    );
  }, [progressionQuery.data?.match_clock?.presets]);
  const defaultClockSeconds =
    progressionQuery.data?.match_clock?.enabled &&
    typeof progressionQuery.data.match_clock.initial_seconds === "number" &&
    progressionQuery.data.match_clock.initial_seconds > 0
      ? progressionQuery.data.match_clock.initial_seconds
      : 0;

  // Enter finished only after the last ply board is visible (or after a short grace).
  // Avoids killing the land animation / hiding the result card on a stale grid.
  useEffect(() => {
    if (!game || (game.outcome == null && !game.draw)) return;
    if (isTerminalBoardSynced(game)) {
      setPhase("finished");
      return;
    }
    const grace = window.setTimeout(() => {
      setGame((prev) => (prev ? syncTerminalBoard(withResolvedOutcome(prev)) : prev));
      setPhase("finished");
    }, 2200);
    return () => window.clearTimeout(grace);
  }, [game]);

  const clockFlagToastGameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!game?.id) return;
    // Authoritative terminal: never keep session in "playing" (leave-pause would 400).
    if (game.outcome != null || game.draw || phase === "finished") {
      storePlaySession({
        gameId: game.id,
        mode: game.mode,
        phase: "finished",
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if (phase === "playing") {
      const serverPaused = Boolean(game.paused) || isPauseInflight(game.id);
      const expires = Number(game.pause_expires_at_unix_ms) || 0;
      // LeaveBoardPauseHost may pause while this hub is still mounted with stale
      // game.paused=false (WS not merged yet). Never clobber that session write
      // unless this screen still claims the active board seat.
      if (!serverPaused) {
        const onBoard = getActivePlayBoardGameId() === game.id;
        if (!onBoard) {
          const existing = readStoredPlaySession();
          if (existing?.gameId === game.id && existing.paused) return;
        }
      }
      storePlaySession({
        gameId: game.id,
        mode: game.mode,
        phase: "playing",
        paused: serverPaused,
        pauseExpiresAtUnixMs: serverPaused && expires > 0 ? expires : undefined,
        pauseKind: serverPaused ? (game.pause_kind || "").trim() || undefined : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [
    game?.id,
    game?.mode,
    game?.paused,
    game?.pause_kind,
    game?.pause_expires_at_unix_ms,
    game?.outcome,
    game?.draw,
    phase,
  ]);

  useEffect(() => {
    if (phase === "menu") clearStoredPlaySession();
  }, [phase]);

  const leavePauseRef = useRef({
    shouldPause: false,
    gameId: "",
    token: "",
    mode: "",
  });
  const pauseToastRef = useRef(chrome);
  leavePauseRef.current = {
    shouldPause:
      phase === "playing" &&
      progressionQuery.data?.match_clock?.pause_enabled === true &&
      Boolean(game?.id) &&
      !game?.paused &&
      game?.outcome == null &&
      !game?.draw,
    gameId: game?.id || "",
    token: effectiveToken || "",
    mode: game?.mode || "",
  };
  pauseToastRef.current = chrome;

  useLayoutEffect(() => {
    const id = phase === "playing" ? (game?.id || "").trim() : "";
    // Keep-alive / late unmount must not claim the board while browsing off-surface
    // (otherwise FloatingResumeFab stays hidden after leave-pause).
    if (!id || !onPlaySurface) {
      if (id && getActivePlayBoardGameId() === id) setActivePlayBoardGameId(null);
      return undefined;
    }
    setActivePlayBoardGameId(id);
    return () => {
      if (getActivePlayBoardGameId() === id) setActivePlayBoardGameId(null);
    };
  }, [phase, game?.id, onPlaySurface]);

  useEffect(() => {
    return () => {
      const snap = leavePauseRef.current;
      window.setTimeout(() => {
        if (!snap.shouldPause || !snap.gameId || !snap.token) return;
        if (getActivePlayBoardGameId() === snap.gameId) return;
        void pauseGameOnLeave(snap.token, snap.gameId, snap.mode)
          .then((payload) => {
            if (!payload) return;
            const msg = (pauseToastRef.current?.toast_paused || "").trim();
            if (msg) toast.success(msg);
          })
          .catch((err: unknown) => {
            const key = isApiClientError(err) ? err.errorKey || "" : "";
            if (isLeavePauseSilentError(key)) return;
            const msg = pauseFailureLabel(pauseToastRef.current, key, "pause");
            if (msg) toast.error(msg);
          });
      }, 0);
    };
  }, []);

  const prevPauseRef = useRef<{
    id: string;
    paused: boolean;
    pauseKind?: string;
    actorRole?: string;
    actorName?: string;
  } | null>(null);
  useEffect(() => {
    if (!game?.id) return;
    const paused = Boolean(game.paused);
    const pauseKind = (game.pause_kind || "").trim() || undefined;
    const prev = prevPauseRef.current;
    prevPauseRef.current = {
      id: game.id,
      paused,
      pauseKind,
      actorRole: (game.pause_actor_role || "").trim() || undefined,
      actorName: (game.pause_actor_display_name || "").trim() || undefined,
    };
    if (!prev || prev.id !== game.id) return;
    if (prev.paused && !paused) {
      patchStoredPlayPaused(false);
      if (takeManualResume()) return;
      if (prev.pauseKind === "official") {
        const role = officialPauseRoleLabel(prev.actorRole, officialPauseChrome);
        const name = prev.actorName || "";
        if (role && name) {
          const banner = applyOfficialPauseFmt(officialPauseChrome?.banner_resumed_fmt, {
            role,
            name,
          });
          if (banner) setResumeBanner(banner);
          const toastMsg = applyOfficialPauseFmt(chrome?.official_resumed_toast_fmt, {
            role,
            name,
          });
          if (toastMsg) toast.message(toastMsg);
        }
        return;
      }
      const msg = (chrome?.toast_auto_resumed || "").trim();
      if (msg) toast.message(msg);
      return;
    }
    if (!prev.paused && paused) {
      const expires = Number(game.pause_expires_at_unix_ms) || 0;
      patchStoredPlayPaused(true, expires > 0 ? expires : undefined, pauseKind);
    }
  }, [
    chrome,
    officialPauseChrome,
    game?.id,
    game?.paused,
    game?.pause_kind,
    game?.pause_actor_role,
    game?.pause_actor_display_name,
    game?.pause_expires_at_unix_ms,
  ]);

  const handlePauseGame = useCallback(() => {
    const id = (game?.id || "").trim();
    if (!id || !chrome) return;
    if (isOfficialPause(game)) {
      const msg = (chrome.err_officially_paused || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    pauseGameMutation.mutate(id, {
      onSuccess: (payload) => {
        setGame(payload);
        const expires = Number(payload.pause_expires_at_unix_ms) || 0;
        patchStoredPlayPaused(
          true,
          expires > 0 ? expires : undefined,
          (payload.pause_kind || "").trim() || undefined,
        );
        const msg = (chrome.toast_paused || "").trim();
        if (msg) toast.success(msg);
      },
      onError: (err) => {
        const key = isApiClientError(err) ? err.errorKey || "" : "";
        const msg = pauseFailureLabel(chrome, key, "pause");
        if (msg) toast.error(msg);
      },
    });
  }, [chrome, game, pauseGameMutation]);

  const handleResumeGame = useCallback(() => {
    const id = (game?.id || "").trim();
    if (!id || !chrome) return;
    if (isOfficialPause(game)) {
      const msg = (chrome.err_officially_paused || "").trim();
      if (msg) toast.error(msg);
      return;
    }
    markManualResume();
    resumeGameMutation.mutate(id, {
      onSuccess: (payload) => {
        setGame(payload);
        patchStoredPlayPaused(false);
        const msg = (chrome.toast_resumed || "").trim();
        if (msg) toast.success(msg);
      },
      onError: (err) => {
        takeManualResume();
        const key = isApiClientError(err) ? err.errorKey || "" : "";
        const msg = pauseFailureLabel(chrome, key, "resume");
        if (msg) toast.error(msg);
      },
    });
  }, [chrome, game, resumeGameMutation]);

  useEffect(() => {
    if (phase === "playing" && gameStartedAtMs == null) {
      setGameStartedAtMs(Date.now());
    }
    if (phase !== "playing") {
      setGameStartedAtMs(null);
    }
  }, [phase, gameStartedAtMs]);

  useEffect(() => {
    if (aiDepths.length === 0) {
      setDepth(null);
      return;
    }
    const fromUrl = depthParam != null ? Number(depthParam) : Number.NaN;
    if (Number.isFinite(fromUrl) && aiDepths.includes(fromUrl)) {
      if (depth !== fromUrl) setDepth(fromUrl);
      return;
    }
    if (depth == null || !aiDepths.includes(depth)) {
      setDepth(aiDepths[0] ?? null);
    }
  }, [aiDepths, depth, depthParam]);

  useEffect(() => {
    if (timeControlPresets.length === 0) {
      setClockSeconds(0);
      return;
    }
    const fromParam = tcParam != null ? Number(tcParam) : Number.NaN;
    if (Number.isFinite(fromParam) && timeControlPresets.some((p) => p.seconds === fromParam)) {
      if (clockSeconds !== fromParam) setClockSeconds(fromParam);
      return;
    }
    if (!timeControlPresets.some((p) => p.seconds === clockSeconds)) {
      const def =
        defaultClockSeconds > 0 && timeControlPresets.some((p) => p.seconds === defaultClockSeconds)
          ? defaultClockSeconds
          : (timeControlPresets[0]?.seconds ?? 0);
      setClockSeconds(def);
    }
  }, [timeControlPresets, tcParam, clockSeconds, defaultClockSeconds]);

  useEffect(() => {
    if (!chrome) return;
    if (!gameIdParam) return;
    if (resumeQuery.data) {
      const next = resumeQuery.data;
      setGame((prev) => (prev?.id === next.id && prev === next ? prev : next));
      setSelected(null);
      setPhase(next.outcome != null || next.draw ? "finished" : "playing");
      setBusy(false);
      return;
    }
    // Cache-seeded board already painted - do not flip busy/skeleton while RQ hydrates.
    if (resumeQuery.isLoading) {
      if (!game) setBusy(true);
      return;
    }
    if (resumeQuery.error) {
      setBusy(false);
      toast.error(
        resumeQuery.error instanceof Error ? resumeQuery.error.message : chrome.toast_load_failed,
      );
    }
  }, [chrome, game, gameIdParam, resumeQuery.data, resumeQuery.isLoading, resumeQuery.error]);

  useEffect(() => {
    if (!chrome) return;
    const activeId = game?.id || gameIdParam;
    if (!hydrated || !activeId || !effectiveToken) return;
    const url = resolveWsUrl(activeId, effectiveToken);
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as GameWsMessage;
        if (msg.type === "feature_flags") {
          void invalidateFeatureFlags(qc);
          if (msg.flags?.vs_ai_enabled === false) {
            toast.message(chrome.toast_computer_unavailable);
          }
          return;
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
            const selfId = useAuthStore.getState().user?.id;
            const sessionToken = useAuthStore.getState().token;
            if (selfId && uid === selfId && sessionToken) {
              const cur = useAuthStore.getState().user;
              if (cur) {
                useAuthStore.getState().setSession(sessionToken, {
                  ...cur,
                  avatarThumbUrl: nextThumb || null,
                  avatarFullUrl: nextFull || null,
                });
              }
            }
            patchAvatarEverywhere(qc, uid, nextThumb || null, nextFull || null);
          }
          void invalidateAvatarSurfaces(qc, uid || null);
          return;
        }
        if (msg.type === "ai_thinking") {
          setAiThinking(Boolean(msg.thinking));
          return;
        }
        if (msg.type === "error") {
          const key = String((msg as { error_key?: string }).error_key || "").trim();
          // Fail closed: WS pause rejects send error_key only (empty English).
          const pauseByKey = key === "err_officially_paused" || key === "err_game_paused";
          if (pauseByKey) {
            const official = key === "err_officially_paused";
            const label = (
              (official ? chrome.err_officially_paused : chrome.err_game_paused) || ""
            ).trim();
            // In-flight move: reject with chrome so catch toasts once (never sentinel English).
            if (moveWaitRef.current) {
              moveWaitRef.current.reject(new Error(label || chrome.toast_move_failed));
              moveWaitRef.current = null;
              return;
            }
            if (label) toast.error(label);
            return;
          }
          // Fail closed: never toast/reject with WS English body; chrome or error_key only.
          if (moveWaitRef.current) {
            moveWaitRef.current.reject(new Error((chrome.toast_move_failed || "").trim()));
            moveWaitRef.current = null;
            return;
          }
          if (
            key === "err_clock_still_running" ||
            key === "err_match_clock_inactive" ||
            key === "not_a_seat"
          ) {
            return;
          }
          if (
            key === "err_clock_flag" ||
            key === "err_clock_flag_failed" ||
            key === "clock_flag_failed"
          ) {
            const label = (chrome.toast_clock_flag_failed || "").trim();
            if (label) toast.error(label);
            return;
          }
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
          const gid = (msg.game_id || activeId || "").trim();
          if (gid) void qc.invalidateQueries({ queryKey: ["game-chat", gid] });
          return;
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
          void qc.invalidateQueries({ queryKey: ["dms"] });
          return;
        }
        if ((msg.type === "move_ack" || msg.type === "game_state") && msg.game) {
          setAiThinking(false);
          const prev = gameRef.current;
          const wasLocal = pendingLocalMoveRef.current || Boolean(moveWaitRef.current);
          const incoming = msg.game;
          const envRole =
            typeof (msg as { actor_role?: string }).actor_role === "string"
              ? String((msg as { actor_role?: string }).actor_role).trim()
              : "";
          const envName =
            typeof (msg as { actor_display_name?: string }).actor_display_name === "string"
              ? String((msg as { actor_display_name?: string }).actor_display_name).trim()
              : "";
          const wasOfficial =
            Boolean(prev?.paused) && (prev?.pause_kind || "").trim() === "official";
          // SpectateHub parity: envelope actor when resume game payload cleared pause fields.
          if (wasOfficial && !incoming.paused) {
            const role = officialPauseRoleLabel(
              envRole || prev?.pause_actor_role,
              officialPauseChrome,
            );
            const name = envName || (prev?.pause_actor_display_name || "").trim();
            if (role && name) {
              const banner = applyOfficialPauseFmt(officialPauseChrome?.banner_resumed_fmt, {
                role,
                name,
              });
              if (banner) setResumeBanner(banner);
            }
          }
          const merged = wasLocal
            ? mergeBoardStateAfterPlayerMove(prev, incoming)
            : mergeRemoteBoardState(prev, incoming);
          if (moveWaitRef.current) {
            moveWaitRef.current.resolve(incoming);
            moveWaitRef.current = null;
          }
          pendingLocalMoveRef.current = false;
          qc.setQueryData(gameStateQueryKey(incoming.id), incoming);
          setGame(merged);
          setSelected(null);
        }
      } catch {
        // ignore non-JSON
      }
    };
    ws.onerror = () => {
      if (moveWaitRef.current) {
        moveWaitRef.current.reject(new Error(chrome.toast_live_error));
        moveWaitRef.current = null;
      }
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [chrome, officialPauseChrome, hydrated, game?.id, gameIdParam, effectiveToken, qc]);

  const history = useMemo(() => game?.move_history ?? [], [game?.move_history]);
  const yourPlayer = useMemo(() => {
    if (!game) return null;
    if (userId && game.player1_id === userId) return 1;
    if (userId && game.player2_id === userId) return 2;
    if (game.mode === "ai") return 1;
    return null;
  }, [game, userId]);

  // DB play_chrome toast when server ends on flag-fall / clock draw (once per game id).
  // Seated: seat-aware on-time result copy. Unseated: ambient toast_clock_flag.
  useEffect(() => {
    if (!chrome || !game?.id) return;
    if (game.end_reason !== "clock_flag" && game.end_reason !== "clock_draw") return;
    if (game.outcome == null && !game.draw) return;
    if (clockFlagToastGameRef.current === game.id) return;
    clockFlagToastGameRef.current = game.id;
    let label = "";
    if (yourPlayer != null) {
      // Seated: on-time result copy only (fail closed - no generic toast invent).
      if (game.end_reason === "clock_draw" || game.draw) {
        label = (chrome.you_drew_on_time_message || "").trim();
      } else if (game.outcome === yourPlayer) {
        label = (chrome.you_won_on_time_message || "").trim();
      } else if (game.outcome === 1 || game.outcome === 2) {
        label = (chrome.you_lost_on_time_message || "").trim();
      }
    } else {
      label = (chrome.toast_clock_flag || "").trim();
    }
    if (label) toast.message(label);
  }, [chrome, game?.id, game?.end_reason, game?.outcome, game?.draw, yourPlayer]);

  const displayBoard = useMemo(() => {
    if (!game) return null;
    if (replayIndex == null) return game.board;
    if (replayIndex <= 0) return initialBoardRef.current ?? game.board;
    const entry = history[replayIndex - 1];
    return entry?.board_after?.length ? entry.board_after : game.board;
  }, [game, history, replayIndex]);

  const resetSessionState = useCallback(() => {
    setStopConfirmOpen(false);
    setMatchIntroActive(false);
    setMatchResultActive(false);
    matchIntroSeenRef.current = null;
    setStopConfirmOpen(false);
    setGame(null);
    setSelected(null);
    setReplayIndex(null);
    setPhase("menu");
    setBusy(false);
    initialBoardRef.current = null;
    initialBoardGameIdRef.current = null;
    autoStartedRef.current = false;
    gameEndFxRef.current = false;
    clearStoredPlaySession();
  }, []);

  /** Leave live board → home Play lobby (stay on `/`, no ?mode= URL). */
  const endLocalSession = useCallback(() => {
    resetSessionState();
    if (onExitToLobby) {
      onExitToLobby();
      return;
    }
    if (!embedded) router.replace("/");
  }, [resetSessionState, router, onExitToLobby, embedded]);

  const handlePlyAnimated = useCallback((boardAfter: BoardCell[][]) => {
    if (!boardAfter?.length) return;
    setGame((prev) => {
      if (!prev) return prev;
      const next = withResolvedOutcome({ ...prev, board: boardAfter });
      return next;
    });
  }, []);

  const statusText = useMemo(() => {
    if (!chrome) return "";
    if (!game) {
      if (gameIdParam) return "";
      return chrome.choose_mode_hint;
    }
    // Clock endings (incl. pre-finished grace): seat-aware on-time DB copy only -
    // never generic White/Red wins / turn hints while end_reason is clock-owned.
    const onTime = game.end_reason === "clock_flag" || game.end_reason === "clock_draw";
    if (onTime) {
      if (game.draw || game.end_reason === "clock_draw") {
        return (chrome.you_drew_on_time_message || "").trim();
      }
      if (yourPlayer != null && game.outcome != null) {
        if (game.outcome === yourPlayer) {
          return (chrome.you_won_on_time_message || "").trim();
        }
        if (game.outcome === 1 || game.outcome === 2) {
          return (chrome.you_lost_on_time_message || "").trim();
        }
      }
      // Fail closed until ForcedOutcome arrives - do not invent status_*_wins / turn copy.
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
    if (game.must_continue) return chrome.status_multi_capture;
    // Seat-relative: your/opponent (smart-menu), not white/black labels.
    if (yourPlayer != null) {
      return game.turn === yourPlayer ? chrome.status_your_turn : chrome.status_opponent_turn;
    }
    return game.turn === 1 ? chrome.status_white_to_move : chrome.status_black_to_move;
  }, [chrome, game, gameIdParam, yourPlayer]);

  const gameOfficiallyPaused = isOfficialPause(game);

  useEffect(() => {
    if (gameOfficiallyPaused) setStopConfirmOpen(false);
  }, [gameOfficiallyPaused]);
  const officialPauseBannerLines = useMemo(
    () => buildOfficialPausedBannerLines(game, chrome, officialPauseChrome),
    [chrome, game, officialPauseChrome],
  );
  const pauseOverlayCopy = useMemo(
    () => buildPauseOverlayCopy(game, chrome, officialPauseChrome),
    [chrome, game, officialPauseChrome],
  );
  const pauseActivityRefreshKey = [
    game?.id || "",
    game?.paused ? "1" : "0",
    (game?.pause_kind || "").trim(),
    (game?.pause_reason_key || "").trim(),
    (game?.pause_note || "").trim(),
    String(Number(game?.paused_at_unix_ms) || 0),
  ].join("|");
  const playerPauseControlsEnabled = phase === "playing" && Boolean(game) && !gameOfficiallyPaused;

  const { yourCaptures, opponentCaptures } = useMemo(() => {
    if (!game || yourPlayer == null) {
      return { yourCaptures: 0, opponentCaptures: 0 };
    }
    return getMatchCaptureScores(
      game,
      yourPlayer,
      replayIndex,
      boardRulesQuery.data?.pieces_per_side ?? 20,
    );
  }, [boardRulesQuery.data?.pieces_per_side, game, replayIndex, yourPlayer]);

  // Clock-owned endings are not "your turn" even if ForcedOutcome is briefly delayed.
  const clockOwnedEnd = game?.end_reason === "clock_flag" || game?.end_reason === "clock_draw";
  const isYourTurn =
    Boolean(game) &&
    yourPlayer != null &&
    game?.outcome == null &&
    !game?.draw &&
    !clockOwnedEnd &&
    game?.turn === yourPlayer;

  // Hide legal/must-continue/selection until the piece lands (same sync clocks use).
  // Otherwise server turn/legals flash onto a still-frozen pre-ply board.
  const boardPlySynced = useMemo(() => isBoardPlySynced(game), [game]);
  const showMoveHighlights = Boolean(isYourTurn && boardPlySynced);

  // Clock color follows animating ply (not raw server turn) so AI/opponent slides
  // don't flash your timer white before the piece lands.
  const clockPlayer = useMemo(() => activeClockPlayer(game), [game]);
  const yourClockActive =
    phase === "playing" && !game?.paused && yourPlayer != null && clockPlayer === yourPlayer;
  const opponentClockActive =
    phase === "playing" &&
    !game?.paused &&
    clockPlayer != null &&
    yourPlayer != null &&
    clockPlayer !== yourPlayer;

  const youSeatId =
    yourPlayer === 1 ? game?.player1_id : yourPlayer === 2 ? game?.player2_id : null;
  const oppSeatId =
    yourPlayer === 1 ? game?.player2_id : yourPlayer === 2 ? game?.player1_id : null;
  const youPlayerQuery = usePublicPlayerQuery(youSeatId, Boolean(youSeatId));
  const oppPlayerQuery = usePublicPlayerQuery(
    oppSeatId,
    Boolean(oppSeatId && game?.mode === "pvp"),
  );

  // Clear piece selection when seat turn / forced capture chain changes (smart-menu).
  useEffect(() => {
    void game?.turn;
    void game?.must_continue?.[0];
    void game?.must_continue?.[1];
    void game?.id;
    setSelected(null);
  }, [game?.turn, game?.must_continue?.[0], game?.must_continue?.[1], game?.id]);

  const outcomeMessage = useMemo(() => {
    if (!chrome || !game || phase !== "finished") return null;
    const onTime = game.end_reason === "clock_flag" || game.end_reason === "clock_draw";
    // Fail closed on clock endings: on-time DB copy only (never generic You won / status_*_wins).
    if (onTime) {
      if (game.draw || game.end_reason === "clock_draw") {
        return (chrome.you_drew_on_time_message || "").trim() || null;
      }
      if (yourPlayer != null) {
        if (game.outcome === yourPlayer) {
          return (chrome.you_won_on_time_message || "").trim() || null;
        }
        if (game.outcome === 1 || game.outcome === 2) {
          return (chrome.you_lost_on_time_message || "").trim() || null;
        }
      }
      // Unseated ambient toast already uses toast_clock_flag; status line stays empty.
      return null;
    }
    if (game.draw) {
      const reason = (game.draw_reason || "").trim();
      if (reason === "rematch" || (game.end_reason || "").trim() === "rematch") {
        return chrome.status_draw;
      }
      return reason
        ? `${chrome.status_draw_reason_prefix}${chrome.status_draw_reason_open}${reason}${chrome.status_draw_reason_close}`
        : chrome.status_draw;
    }
    if (yourPlayer != null) {
      if (game.outcome === yourPlayer) return chrome.you_won_message;
      if (game.outcome === 1 || game.outcome === 2) return chrome.you_lost_message;
    }
    if (game.outcome === 1) return chrome.status_p1_wins;
    if (game.outcome === 2) return chrome.status_p2_wins;
    return chrome.game_over_title;
  }, [chrome, game, phase, yourPlayer]);

  const youWon = Boolean(game) && yourPlayer != null && game?.outcome === yourPlayer && !game?.draw;
  const youLost =
    Boolean(game) &&
    yourPlayer != null &&
    !game?.draw &&
    (game?.outcome === 1 || game?.outcome === 2) &&
    game?.outcome !== yourPlayer;

  // Standard end-of-match FX once the result card is shown (after last land).
  useEffect(() => {
    if (phase !== "finished" || !game) return;
    if (game.outcome == null && !game.draw) return;
    if (gameEndFxRef.current) return;
    gameEndFxRef.current = true;
    // Never stack VS intro on top of the result cinematic.
    setMatchIntroActive(false);
    setMatchResultActive(true);
    if (game.draw) {
      void playGameNotify("info");
      return;
    }
    if (youWon) {
      void playGameNotify("win");
      void fireGameVictoryCelebration();
      return;
    }
    if (youLost) {
      void playGameNotify("loss");
      void fireGameDefeatPulse();
      return;
    }
    void playGameNotify(game.outcome === 1 ? "win" : "loss");
  }, [phase, game, youWon, youLost]);

  const startAi = useCallback(async () => {
    if (!chrome) return false;
    if (!vsAiEnabled) {
      toast.error(chrome.toast_computer_unavailable);
      return false;
    }
    if (!aiDepths.length || depth == null) {
      toast.error(chrome.toast_difficulty_unavailable);
      return false;
    }
    if (
      timeControlPresets.length === 0 ||
      !(clockSeconds > 0) ||
      !timeControlPresets.some((p) => p.seconds === clockSeconds)
    ) {
      toast.error(
        (railChrome?.toast_time_control_unavailable || chrome.toast_start_failed || "").trim(),
      );
      return false;
    }
    setBusy(true);
    try {
      const session = await startGameMutation.mutateAsync({
        mode: "ai",
        ai_search_depth: depth,
        time_control_seconds: clockSeconds,
      });
      setGame(session);
      setSelected(null);
      setPhase("playing");
      toast.success(chrome.toast_practice_started);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : chrome.toast_start_failed;
      // Zombie account JWT: clear and fall back to guest practice (AI is public).
      if (
        isAiMode &&
        token &&
        (msg === "unauthorized" || /unauthor/i.test(msg) || /verification required/i.test(msg))
      ) {
        useAuthStore.getState().clearSession();
        autoStartedRef.current = false;
        setBusy(false);
        return false;
      }
      toast.error(chrome.toast_start_failed);
      // Allow retry after OTP verify / transient failure.
      autoStartedRef.current = false;
      return false;
    } finally {
      setBusy(false);
    }
  }, [
    chrome,
    railChrome?.toast_time_control_unavailable,
    depth,
    clockSeconds,
    timeControlPresets,
    vsAiEnabled,
    aiDepths.length,
    startGameMutation,
    isAiMode,
    token,
  ]);

  // Training / practice: auto-start AI board (mobile MatchBoardPage parity).
  useEffect(() => {
    if (!hydrated || !effectiveToken || !chrome) return;
    if (gameIdParam) return;
    if (game || busy || autoStartedRef.current) return;
    if (flagsQuery.isLoading || !vsAiEnabled) return;
    if (!aiDepths.length || depth == null) return;
    if (!(clockSeconds > 0) || timeControlPresets.length === 0) return;
    // Signed-in OTP only - guest practice JWTs skip OTP.
    if (token && userId && flagsQuery.data?.otp_required && !otpSessionOk) return;
    const mode = (modeParam || "ai").toLowerCase();
    if (mode !== "ai" && mode !== "practice") return;
    autoStartedRef.current = true;
    setPracticeBootstrapping(true);
    void startAi().then((ok) => {
      setPracticeBootstrapping(false);
      if (!ok) autoStartedRef.current = false;
    });
  }, [
    hydrated,
    effectiveToken,
    token,
    userId,
    chrome,
    gameIdParam,
    game,
    busy,
    flagsQuery.isLoading,
    flagsQuery.data?.otp_required,
    otpSessionOk,
    vsAiEnabled,
    clockSeconds,
    timeControlPresets.length,
    aiDepths.length,
    depth,
    modeParam,
    startAi,
  ]);

  const onSelectSquare = useCallback(
    (row: number, col: number) => {
      if (!chrome || !game || busy || game.outcome != null || game.draw || game.paused) {
        if (chrome && game?.paused) {
          const raw = isOfficialPause(game) ? chrome.err_officially_paused : chrome.err_game_paused;
          const label = (raw || "").trim();
          if (label) toast.message(label);
        }
        return;
      }
      if (yourPlayer == null || game.turn !== yourPlayer) return;
      if (game.mode === "ai" && game.ai_player != null && game.turn === game.ai_player) return;

      const cell = game.board[row]?.[col];
      const captureMoves = game.legal_moves.filter((m) => (m.captures?.length ?? 0) > 0);
      const forcedCaptures =
        captureMoves.length > 0 && captureMoves.length === game.legal_moves.length;
      const canSelectPiece = (r: number, c: number) => {
        if (game.must_continue) {
          return game.must_continue[0] === r && game.must_continue[1] === c;
        }
        if (forcedCaptures) {
          return captureMoves.some((m) => m.from[0] === r && m.from[1] === c);
        }
        return true;
      };

      if (!selected) {
        if (cell && cell.p === yourPlayer && canSelectPiece(row, col)) {
          setSelected([row, col]);
        }
        return;
      }

      if (selected[0] === row && selected[1] === col) {
        if (!game.must_continue) setSelected(null);
        return;
      }

      if (cell && cell.p === yourPlayer && canSelectPiece(row, col)) {
        setSelected([row, col]);
        return;
      }

      const legal = game.legal_moves.find(
        (m) =>
          m.from[0] === selected[0] &&
          m.from[1] === selected[1] &&
          m.to[0] === row &&
          m.to[1] === col,
      );
      if (!legal) {
        setIllegalShakeKey((k) => k + 1);
        toast.message(chrome.toast_illegal_square);
        return;
      }

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.error(chrome.toast_live_required);
        return;
      }

      const seat =
        userId && game.player1_id === userId
          ? 1
          : userId && game.player2_id === userId
            ? 2
            : game.mode === "ai"
              ? 1
              : game.turn;
      const from = selected;
      const optimistic = applyOptimisticDraughtsMove(game, selected, [row, col], seat);
      if (optimistic) {
        pendingLocalMoveRef.current = true;
        setGame(optimistic);
        setSelected(null);
        // Place SFX on board land phase only (not when the piece starts moving).
      } else {
        setSelected(null);
      }

      // Do not hold global `busy` for WS/AI RTT - that froze the UI after put-down.
      // Scene animation + turn/must_continue gate input; pendingLocalMoveRef merges WS.
      const waitPromise = new Promise<GamePayload>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          if (moveWaitRef.current) {
            moveWaitRef.current = null;
            pendingLocalMoveRef.current = false;
            reject(new Error(chrome.toast_move_timeout));
          }
        }, 8000);
        moveWaitRef.current = {
          resolve: (g) => {
            window.clearTimeout(timer);
            resolve(g);
          },
          reject: (e) => {
            window.clearTimeout(timer);
            reject(e);
          },
        };
        ws.send(
          JSON.stringify({
            type: "move",
            game_id: game.id,
            from,
            to: [row, col],
          }),
        );
      });
      void waitPromise.catch((err: unknown) => {
        pendingLocalMoveRef.current = false;
        // Winning ply already painted (optimistic or late game_state) - never contradict with Move failed.
        if (gameRef.current?.outcome != null || gameRef.current?.draw) return;
        const raw = err instanceof Error ? err.message.trim() : "";
        if (raw && raw === chrome.toast_move_timeout) {
          toast.error(chrome.toast_move_timeout);
          return;
        }
        toast.error(raw || chrome.toast_move_failed);
      });
    },
    [busy, chrome, game, selected, userId, yourPlayer],
  );

  // Honor URL mode and live game.mode - AI resume must not stay stuck as PvP.
  const isPvpSession = game?.mode === "ai" ? false : !isAiMode || game?.mode === "pvp";

  // Must stay above chrome/token early-returns (Rules of Hooks).
  useEffect(() => {
    const id = (game?.id || "").trim();
    const mode = (game?.mode || "").trim().toLowerCase();
    // AI practice + friends/PvP/tournament seats all get the esports VS intro.
    if (!id || phase !== "playing") return;
    if (mode !== "pvp" && mode !== "ai") return;
    if (matchIntroSeenRef.current === id) return;
    // Match-start only: require explicit move_count === 0 (missing count → no intro).
    if (typeof game?.move_count !== "number") return;
    if (game.move_count > 0) {
      matchIntroSeenRef.current = id;
      return;
    }
    // Wait for seat bios so VS intro shows real avatar/flag/name (DB-driven).
    if (youSeatId && youPlayerQuery.isLoading) return;
    if (mode === "pvp") {
      const oppId = userId && game.player1_id === userId ? game.player2_id : game.player1_id;
      if (oppId && oppPlayerQuery.isLoading) return;
    }
    matchIntroSeenRef.current = id;
    setMatchResultActive(false);
    setMatchIntroActive(true);
  }, [
    game?.id,
    game?.mode,
    game?.move_count,
    game?.player1_id,
    game?.player2_id,
    phase,
    userId,
    youSeatId,
    youPlayerQuery.isLoading,
    oppPlayerQuery.isLoading,
  ]);

  // Must stay above chrome/token early-returns (Rules of Hooks).
  // Dual authoritative clocks from server; local tick only interpolates between syncs.
  // Trust game.clock_active only - server already fail-closed when match_clock is off/unarmed.
  const clockEnabled = Boolean(game?.clock_active);
  const claimClockFlag = useCallback(() => {
    const ws = wsRef.current;
    const gid = (gameRef.current?.id || "").trim();
    if (!gid) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "clock_flag", game_id: gid }));
      return;
    }
    // REST fallback when the game socket is down (server still authoritative).
    const tok = useAuthStore.getState().token;
    if (!tok) return;
    void restClient
      .post(`/games/${gid}/clock-flag`, {}, { headers: authHeaders(tok) })
      .then((res) => {
        const payload = res.data as GamePayload | undefined;
        if (!payload?.id) return;
        qc.setQueryData(gameStateQueryKey(payload.id), payload);
        setGame(payload);
      })
      .catch(() => {
        /* fail closed; next tick / hydrate retries */
      });
  }, [qc]);
  const { p1Label, p2Label } = useServerMatchClocks({
    gameKey: game?.id || "",
    enabled: clockEnabled,
    p1RemainingMs: typeof game?.clock_p1_remaining_ms === "number" ? game.clock_p1_remaining_ms : 0,
    p2RemainingMs: typeof game?.clock_p2_remaining_ms === "number" ? game.clock_p2_remaining_ms : 0,
    serverNowMs: typeof game?.clock_server_now_ms === "number" ? game.clock_server_now_ms : 0,
    // Follow animating ply (activeClockPlayer) so seats don't flash mid-slide.
    turn: clockPlayer ?? (game?.turn === 1 || game?.turn === 2 ? game.turn : 1),
    running:
      phase === "playing" &&
      !game?.paused &&
      game?.outcome == null &&
      !game?.draw &&
      clockPlayer != null,
    paused: Boolean(game?.paused),
    onFlag: claimClockFlag,
  });
  const seatClock = yourPlayer === 2 ? p2Label : p1Label;
  const opponentSeatClock = yourPlayer === 2 ? p1Label : p2Label;

  // isLoading = no cached chrome yet. Soft refetch (isFetching) keeps painting.
  if (chromeQuery.isLoading && !chrome) {
    // Embedded: keep HomePlayHub shell - never replace it with a second full-hub skeleton.
    if (renderEmbedded) {
      return (
        <>
          {renderEmbedded({
            phase: "menu",
            game: null,
            busy: true,
            bootstrapping: true,
            yourName: "",
            opponentName: "",
            yourTurnHint: "",
            yourCaptures: 0,
            opponentCaptures: 0,
            yourPlayer: null,
            seatClock: null,
            opponentSeatClock: null,
            boardNode: <BoardAreaSkeleton />,
            boardControls: null,
            historyNode: null,
            metaNode: null,
            resultNode: null,
            openStopConfirm: () => undefined,
            endLocalSession: () => undefined,
            restartAi: () => undefined,
            stopLabel: "",
            stopPending: false,
            stopPendingLabel: "",
            practiceBlurb: "",
          })}
        </>
      );
    }
    // Standalone: one PlayHubSkeleton until chrome+board are ready (see below).
    return <PlayHubSkeleton />;
  }

  if (chromeQuery.isError || !chrome) {
    const unavailable =
      (chromeQuery.data?.play_chrome_unavailable || "").trim() ||
      (chromeQuery.error instanceof Error ? chromeQuery.error.message : "").trim();
    // Never keep board skeleton when chrome failed closed / empty.
    return (
      <div className="w-full space-y-4">
        {unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null}
      </div>
    );
  }

  // PvP / resume require a real account. VS-AI is free via guest practice JWT.
  if (hydrated && !token && !isAiMode) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="font-display text-3xl font-bold">{chrome.page_title}</h1>
        <p className="text-sm text-[var(--dama-muted)]">{chrome.choose_mode_hint}</p>
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      </div>
    );
  }
  // Resume with cached/hydrated board: paint immediately while practice JWT mints.
  // Only block on a blank lobby when there is no board to show yet.
  if (hydrated && isAiMode && !effectiveToken && !game && !resumeQuery.data) {
    if (renderEmbedded) {
      return (
        <>
          {renderEmbedded({
            phase: "menu",
            game: null,
            busy: true,
            bootstrapping: true,
            yourName: "",
            opponentName: "",
            yourTurnHint: "",
            yourCaptures: 0,
            opponentCaptures: 0,
            yourPlayer: null,
            seatClock: null,
            opponentSeatClock: null,
            boardNode: <BoardAreaSkeleton />,
            boardControls: null,
            historyNode: null,
            metaNode: null,
            resultNode: null,
            openStopConfirm: () => undefined,
            endLocalSession: () => undefined,
            restartAi: () => undefined,
            stopLabel: "",
            stopPending: false,
            stopPendingLabel: "",
            practiceBlurb: "",
          })}
        </>
      );
    }
    return <PlayHubSkeleton />;
  }

  const guestSeats = pieceSeatNames(piecePalette);
  const nameMax = railChrome?.live_player_name_max_chars;
  const nameSuffix = railChrome?.name_truncate_suffix;
  const yourNameRaw =
    (youPlayerQuery.data?.player?.username || "").trim() ||
    (isAccount ? (chrome.label_white || "").trim() : guestSeats.light);
  const opponentNameRaw =
    game?.mode === "ai"
      ? (chrome.play_computer_action || "").trim()
      : (oppPlayerQuery.data?.player?.username || "").trim() ||
        (isAccount ? (chrome.label_black || "").trim() : guestSeats.dark);
  const yourName =
    nameMax != null && nameSuffix
      ? formatPlayerNameDisplay(yourNameRaw, nameMax, nameSuffix)
      : yourNameRaw;
  const opponentName =
    nameMax != null && nameSuffix
      ? formatPlayerNameDisplay(opponentNameRaw, nameMax, nameSuffix)
      : opponentNameRaw;

  const toSeatHover = (
    id: string | null | undefined,
    username: string,
    data: typeof youPlayerQuery.data,
    playingFallback?: boolean,
  ): RailPlayer | null => {
    const pid = (id || "").trim();
    const name = (data?.player?.username || username || "").trim();
    if (!pid || !name) return null;
    const p = data?.player;
    return {
      id: pid,
      username: name,
      rating: typeof p?.rating === "number" ? p.rating : 0,
      xp: typeof p?.xp === "number" ? p.xp : 0,
      wins: typeof p?.wins === "number" ? p.wins : 0,
      losses: typeof p?.losses === "number" ? p.losses : 0,
      draws: typeof p?.draws === "number" ? p.draws : 0,
      countryCode: p?.country_code,
      avatarThumbUrl: p?.avatar_thumb_url,
      avatarFullUrl: p?.avatar_full_url,
      online: p?.online ?? data?.online,
      playing: p?.playing ?? data?.playing ?? playingFallback,
      playingGameId: p?.playing_game_id ?? data?.playing_game_id ?? game?.id ?? null,
      hostTrustBadge: p?.host_trust_badge ?? null,
      hostTrustTier: p?.host_trust_tier ?? null,
    };
  };
  const yourHoverPlayer = toSeatHover(
    youSeatId,
    yourNameRaw,
    youPlayerQuery.data,
    phase === "playing" && Boolean(youSeatId),
  );
  const opponentHoverPlayer =
    game?.mode === "pvp"
      ? toSeatHover(
          oppSeatId,
          opponentNameRaw,
          oppPlayerQuery.data,
          phase === "playing" && Boolean(oppSeatId),
        )
      : null;

  const seatFlip = Boolean(userId && game?.player2_id === userId);
  const flipBoard = flipManual ?? seatFlip;

  const shareGameUrl = async () => {
    const id = (game?.id || gameIdParam || "").trim();
    if (!id || !railChrome) return;
    // Share is for watchers - same spectate deep-link as SpectateHub (not seat resume).
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

  // One compact seat-trailing row (lobby parity) - never stack flip/2D/3D or the
  // measured board square shrinks and leaves L/R + T/B gutters.
  const boardViewToggle = railChrome ? (
    <div className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
        aria-label={railChrome.flip_board_aria}
        onClick={() => setFlipManual((v) => !(v ?? seatFlip))}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] text-[var(--dama-muted)] hover:text-[var(--dama-text)]"
        aria-label={railChrome.share_game_aria}
        onClick={() => void shareGameUrl()}
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

  // Paint session-tier cache immediately (lists/tables parity). Never skeleton on
  // isFetching / auth rehydrate when a board is already seeded from React Query.
  const showBoardSkeleton =
    Boolean(gameIdParam && !game && !hydrated && !resumeQuery.data) ||
    (busy && !game) ||
    (practiceBootstrapping && !game) ||
    (startGameMutation.isPending && !game) ||
    (resumeQuery.isLoading && !game && !resumeQuery.data) ||
    Boolean(gameIdParam && !game && !resumeQuery.data && hydrated) ||
    Boolean(game && !(displayBoard && displayBoard.length > 0)) ||
    Boolean(
      !isPvpSession &&
        phase === "menu" &&
        effectiveToken &&
        vsAiEnabled &&
        !game &&
        !flagsQuery.isLoading,
    );

  // Standalone only: keep the SAME PlayHubSkeleton until a real board can paint.
  // Swapping PlayHubSkeleton → BoardColumnSkeleton remounted the column at a new size (old→new flash).
  const fullColumnSkeleton = showBoardSkeleton && !(game && phase !== "menu");
  if (!renderEmbedded && fullColumnSkeleton) {
    return <PlayHubSkeleton />;
  }

  const onTimeResult = game?.end_reason === "clock_flag" || game?.end_reason === "clock_draw";
  const yourTurnHint =
    phase === "finished"
      ? onTimeResult
        ? outcomeMessage || ""
        : outcomeMessage || chrome.game_over_title
      : replayIndex != null
        ? (chrome.status_replay || chrome.label_moves || "").trim()
        : phase === "playing" && game?.paused
          ? ""
          : phase === "playing" && game
            ? onTimeResult
              ? // Land-animation grace: reuse on-time statusText (never Your turn / opponent turn).
                statusText
              : isYourTurn
                ? chrome.status_your_turn
                : game.mode === "ai" &&
                    (aiThinking || (game.ai_player != null && game.turn === game.ai_player))
                  ? chrome.status_opponent_turn
                  : chrome.status_opponent_turn
            : statusText;

  const oppTurnHint =
    phase === "playing" &&
    game &&
    !game.paused &&
    !onTimeResult &&
    !isYourTurn &&
    game.mode === "ai"
      ? chrome.status_opponent_turn
      : undefined;

  // Fill PlayBoardColumn’s square host (same as spectate / standalone) - never stack
  // extra chrome under the board inside the square (that reads as L/R/T/B padding).
  const introVs = (railChrome?.match_intro_vs_label || chrome.match_intro_vs_label || "").trim();
  const introAria = (railChrome?.match_intro_aria || chrome.match_intro_aria || "").trim();
  const introStarting = (
    railChrome?.match_intro_starting_label ||
    chrome.match_intro_starting_label ||
    ""
  ).trim();
  const introDurationMs = Number.parseInt(
    (railChrome?.match_intro_duration_ms || chrome.match_intro_duration_ms || "").trim(),
    10,
  );
  const resultDurationMs = Number.parseInt(
    (railChrome?.match_result_duration_ms || chrome.match_result_duration_ms || "").trim(),
    10,
  );
  const resultTone = game?.draw ? "draw" : youWon ? "win" : youLost ? "loss" : "draw";
  // Clock endings: on-time aria only (never generic You won / You lost aria).
  const resultAria =
    (onTimeResult
      ? resultTone === "win"
        ? railChrome?.match_result_win_on_time_aria || chrome.match_result_win_on_time_aria
        : resultTone === "loss"
          ? railChrome?.match_result_loss_on_time_aria || chrome.match_result_loss_on_time_aria
          : railChrome?.match_result_draw_on_time_aria || chrome.match_result_draw_on_time_aria
      : resultTone === "win"
        ? railChrome?.match_result_win_aria || chrome.match_result_win_aria
        : resultTone === "loss"
          ? railChrome?.match_result_loss_aria || chrome.match_result_loss_aria
          : railChrome?.match_result_draw_aria || chrome.match_result_draw_aria
    )?.trim() || "";

  const boardNode =
    game && displayBoard && displayBoard.length > 0 ? (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden",
          replayIndex != null ? "opacity-90" : busy ? "pointer-events-none opacity-60" : undefined,
        )}
      >
        {boardView === "2d" ? (
          <DraughtsBoard2D
            board={displayBoard}
            legalMoves={
              phase !== "playing" || game.paused || replayIndex != null || !showMoveHighlights
                ? []
                : (game.legal_moves ?? [])
            }
            selected={
              phase !== "playing" || game.paused || replayIndex != null || !showMoveHighlights
                ? null
                : selected
            }
            onSelectSquare={onSelectSquare}
            interactive={
              phase === "playing" &&
              !busy &&
              !game.paused &&
              replayIndex == null &&
              showMoveHighlights
            }
            mustContinue={
              phase !== "playing" || game.paused || replayIndex != null || !showMoveHighlights
                ? null
                : game.must_continue
            }
            flipBoard={flipBoard}
            moveHistory={replayIndex != null ? [] : history}
            yourPlayer={yourPlayer}
            replayMode={replayIndex != null}
            illegalShakeKey={illegalShakeKey}
            onPlyAnimated={
              replayIndex == null && phase === "playing" ? handlePlyAnimated : undefined
            }
          />
        ) : (
          <DraughtsScene3D
            board={displayBoard}
            legalMoves={
              phase !== "playing" || game.paused || replayIndex != null || !showMoveHighlights
                ? []
                : (game.legal_moves ?? [])
            }
            selected={
              phase !== "playing" || game.paused || replayIndex != null || !showMoveHighlights
                ? null
                : selected
            }
            onSelectSquare={onSelectSquare}
            interactive={
              phase === "playing" &&
              !busy &&
              !game.paused &&
              replayIndex == null &&
              showMoveHighlights
            }
            mustContinue={
              phase !== "playing" || game.paused || replayIndex != null || !showMoveHighlights
                ? null
                : game.must_continue
            }
            flipBoard={flipBoard}
            moveHistory={replayIndex != null ? [] : history}
            yourPlayer={yourPlayer}
            replayMode={replayIndex != null}
            illegalShakeKey={illegalShakeKey}
            onPlyAnimated={
              replayIndex == null && phase === "playing" ? handlePlyAnimated : undefined
            }
          />
        )}
        {phase === "playing" && showMoveHighlights && game.must_continue ? (
          <p
            className="pointer-events-none absolute inset-x-0 bottom-1 z-10 px-2 text-center text-xs text-[var(--dama-muted)]"
            aria-live="polite"
          >
            {chrome.status_multi_capture}
          </p>
        ) : null}
      </div>
    ) : showBoardSkeleton ? (
      <BoardAreaSkeleton />
    ) : (
      <div className="flex aspect-square w-full items-center justify-center border border-dashed border-[var(--dama-border)] bg-[var(--dama-card)]">
        <p className="text-sm text-[var(--dama-muted)]">{chrome.board_waiting}</p>
      </div>
    );

  const pauseOverlaySeats = {
    top: {
      username: opponentNameRaw,
      avatarUrl:
        game?.mode === "pvp"
          ? oppPlayerQuery.data?.player?.avatar_full_url ||
            oppPlayerQuery.data?.player?.avatar_thumb_url
          : undefined,
      countryCode: game?.mode === "pvp" ? oppPlayerQuery.data?.player?.country_code : undefined,
      hostTrustBadge:
        game?.mode === "pvp" ? (oppPlayerQuery.data?.player?.host_trust_badge ?? null) : null,
      hostTrustTier:
        game?.mode === "pvp" ? (oppPlayerQuery.data?.player?.host_trust_tier ?? null) : null,
    },
    bottom: {
      username: yourNameRaw,
      avatarUrl:
        youPlayerQuery.data?.player?.avatar_full_url ||
        youPlayerQuery.data?.player?.avatar_thumb_url,
      countryCode: youPlayerQuery.data?.player?.country_code,
      hostTrustBadge: youPlayerQuery.data?.player?.host_trust_badge ?? null,
      hostTrustTier: youPlayerQuery.data?.player?.host_trust_tier ?? null,
    },
  };

  // Square board plane only (seats stay visible around the cinematic).
  // Pause cover wins over intro so reconnect mid-pause stays clear.
  const boardCoverOverlay =
    phase === "playing" && game?.paused && pauseOverlayCopy && introVs ? (
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
        top={pauseOverlaySeats.top}
        bottom={pauseOverlaySeats.bottom}
      />
    ) : introVs && introAria && matchIntroActive && !game?.paused ? (
      <MatchIntroOverlay
        active={matchIntroActive}
        vsLabel={introVs}
        ariaLabel={introAria}
        startingLabel={introStarting}
        durationMs={introDurationMs}
        nameMaxChars={nameMax}
        nameSuffix={nameSuffix}
        top={pauseOverlaySeats.top}
        bottom={pauseOverlaySeats.bottom}
        onShow={() => {
          void playGameNotify("game_start");
        }}
        onDone={() => setMatchIntroActive(false)}
      />
    ) : phase === "finished" &&
      matchResultActive &&
      (onTimeResult
        ? Boolean(outcomeMessage)
        : Boolean(outcomeMessage || chrome.game_over_title)) ? (
      <MatchResultOverlay
        active={matchResultActive}
        tone={resultTone}
        title={(chrome.game_over_title || "").trim()}
        message={(
          (onTimeResult ? outcomeMessage : outcomeMessage || chrome.game_over_title) || ""
        ).trim()}
        ariaLabel={(resultAria || outcomeMessage || "").trim()}
        durationMs={resultDurationMs}
        onDone={() => setMatchResultActive(false)}
      />
    ) : null;

  const historyNode =
    game && history.length > 0 ? (
      <GameMoveHistory
        layout="sidebar"
        moves={history}
        boardSize={game.size}
        replayIndex={replayIndex}
        onSelectLive={() => setReplayIndex(null)}
        onSelectMove={(idx) => setReplayIndex(idx)}
        liveLabel={(chrome.live_label || "").trim()}
        historyLabel={(chrome.history_label || chrome.label_moves || "").trim()}
        skipLabels={{
          first_action_label: chrome.history_skip_first,
          prev_action_label: chrome.history_skip_prev,
          next_action_label: chrome.history_skip_next,
          last_action_label: chrome.history_skip_last,
          skip_to_action_label: chrome.history_skip_go,
          page_summary_fmt: chrome.history_skip_page_of,
        }}
      />
    ) : null;

  const modeDisplay = (() => {
    const m = (game?.mode || "").trim().toLowerCase();
    if (m === "ai") return (railChrome?.mode_ai || "").trim();
    if (m === "pvp") return (railChrome?.mode_pvp || "").trim();
    return "";
  })();

  const metaNode = game ? (
    <div className="space-y-2 border-t border-[var(--dama-border)] pt-4 text-sm">
      {modeDisplay ? (
        <p className="text-[var(--dama-muted-foreground)]">
          {chrome.label_mode}
          {chrome.label_value_separator}
          <span className="text-[var(--dama-text)]">{modeDisplay}</span>
        </p>
      ) : null}
      <p className="text-[var(--dama-muted-foreground)]">
        {chrome.label_game}
        {chrome.label_value_separator}
        <span className="text-[var(--dama-text)]">
          {formatGameIdDisplay(game.id, chrome.id_truncate_chars, chrome.id_truncate_suffix)}
        </span>
      </p>
      <p className="text-[var(--dama-muted-foreground)]">
        {chrome.label_moves}
        {chrome.label_value_separator}
        <span className="text-[var(--dama-text)]">{game.move_count}</span>
      </p>
      <p className="text-[var(--dama-muted-foreground)]">
        {chrome.label_halfmove}
        {chrome.label_value_separator}
        <span className="text-[var(--dama-text)]">{game.halfmove_clock}</span>
      </p>
      {boardRulesQuery.data ? (
        <p className="text-[var(--dama-muted-foreground)]">
          {chrome.label_rules}
          {chrome.label_value_separator}
          <span className="text-[var(--dama-text)]">
            {boardRulesQuery.data.variant}
            {chrome.seat_meta_separator}
            {boardRulesQuery.data.size}
            {chrome.board_size_separator}
            {boardRulesQuery.data.size}
          </span>
        </p>
      ) : null}
      <p className="text-[var(--dama-muted-foreground)]">
        {chrome.label_pieces}
        {chrome.label_value_separator}
        <span className="text-[var(--dama-text)]">
          {isAccount ? chrome.label_white : guestSeats.light}
          {chrome.piece_count_separator}
          {countSidePieces(game.board, 1)}
          {chrome.seat_meta_separator}
          {isAccount ? chrome.label_black : guestSeats.dark}
          {chrome.piece_count_separator}
          {countSidePieces(game.board, 2)}
        </span>
      </p>
    </div>
  ) : null;

  const resultNode =
    phase === "finished" && game && (game.outcome != null || game.draw) ? (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{chrome.game_over_title}</h3>
          {outcomeMessage ? (
            <p className="mt-1 text-xs text-[var(--dama-muted)]">{outcomeMessage}</p>
          ) : null}
        </div>
        <MatchScoreLine
          yourLabel={yourName}
          opponentLabel={opponentName}
          yourCaptures={yourCaptures}
          opponentCaptures={opponentCaptures}
          yourCapturesLabel={chrome.captures_your_label}
          opponentCapturesLabel={chrome.captures_opponent_label}
          vsSeparator={chrome.seat_meta_separator || ""}
        />
        {!isPvpSession ? (
          <Button
            type="button"
            variant="play"
            className="h-12 w-full"
            isLoading={startGameMutation.isPending}
            pendingLabel={chrome.practice_start_pending}
            onClick={() => {
              resetSessionState();
              void startAi();
            }}
          >
            {chrome.restart_action}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => endLocalSession()}
        >
          {chrome.new_setup_action}
        </Button>
      </div>
    ) : null;

  const confirmAndAds = (
    <>
      <InMatchAdOverlay active={phase === "playing"} gameStartedAtMs={gameStartedAtMs} />
      <ConfirmDialog
        open={stopConfirmOpen}
        onOpenChange={(open) => {
          if (!abandonGameMutation.isPending) setStopConfirmOpen(open);
        }}
        title={chrome.stop_game_confirm_title}
        description={chrome.stop_game_confirm_description}
        cancelLabel={chrome.stop_game_confirm_cancel}
        confirmLabel={chrome.stop_game_confirm_confirm}
        pendingLabel={chrome.stop_game_pending}
        isPending={abandonGameMutation.isPending}
        destructive
        onConfirm={() => {
          if (isOfficialPause(game)) {
            setStopConfirmOpen(false);
            const msg = (chrome.err_officially_paused || "").trim();
            if (msg) toast.error(msg);
            return;
          }
          const id = game?.id;
          if (!id) {
            endLocalSession();
            return;
          }
          abandonGameMutation.mutate(id, {
            onSuccess: (payload) => {
              setGame(payload);
              setPhase("finished");
              setStopConfirmOpen(false);
              clearStoredPlaySession();
              toast.success(chrome.stop_game_success);
              // Embedded VS-AI: return to Play lobby (board + New Game), not a browse view.
              if (embedded && isAiMode) {
                endLocalSession();
              }
            },
            onError: (err) => {
              const key = isApiClientError(err) ? err.errorKey || "" : "";
              // Stay on board under official pause (including race where game already shows official).
              if (key === "err_officially_paused" || isOfficialPause(game)) {
                setStopConfirmOpen(false);
                const msg = (chrome.err_officially_paused || "").trim();
                if (msg) toast.error(msg);
                return;
              }
              // Stop failures are resign errors - never reuse toast_load_failed ("Failed to load match").
              const stopFail = (chrome.stop_game_failed || "").trim();
              if (stopFail) toast.error(stopFail);
              endLocalSession();
              setStopConfirmOpen(false);
            },
          });
        }}
      />
    </>
  );

  if (renderEmbedded) {
    return (
      <>
        {confirmAndAds}
        {renderEmbedded({
          phase,
          game,
          busy,
          bootstrapping: practiceBootstrapping || startGameMutation.isPending,
          yourName,
          opponentName,
          yourHoverPlayer,
          opponentHoverPlayer,
          yourAvatarThumbUrl: youPlayerQuery.data?.player?.avatar_thumb_url,
          opponentAvatarThumbUrl:
            game?.mode === "pvp" ? oppPlayerQuery.data?.player?.avatar_thumb_url : undefined,
          yourCountryCode: youPlayerQuery.data?.player?.country_code,
          opponentCountryCode:
            game?.mode === "pvp" ? oppPlayerQuery.data?.player?.country_code : undefined,
          yourRating: youPlayerQuery.data?.player?.rating,
          opponentRating: game?.mode === "pvp" ? oppPlayerQuery.data?.player?.rating : undefined,
          yourTurnHint: yourTurnHint || "",
          oppTurnHint,
          isYourTurn: phase === "playing" && isYourTurn,
          yourClockActive,
          yourCaptures,
          opponentCaptures,
          yourPlayer,
          yourOnline: youPlayerQuery.data?.player?.online,
          yourPlaying:
            youPlayerQuery.data?.player?.playing ??
            (phase === "playing" && Boolean(youSeatId) ? true : undefined),
          opponentOnline: game?.mode === "pvp" ? oppPlayerQuery.data?.player?.online : undefined,
          opponentPlaying:
            game?.mode === "pvp"
              ? (oppPlayerQuery.data?.player?.playing ??
                (phase === "playing" && Boolean(oppSeatId) ? true : undefined))
              : undefined,
          seatClock,
          opponentSeatClock,
          boardNode,
          boardCoverOverlay,
          boardControls: boardViewToggle,
          historyNode,
          metaNode,
          resultNode,
          openStopConfirm: gameOfficiallyPaused ? undefined : () => setStopConfirmOpen(true),
          paused: Boolean(game?.paused),
          pauseLabel: chrome.pause_game_action,
          pausePending: pauseGameMutation.isPending,
          pausePendingLabel: chrome.pause_game_pending,
          onPause:
            playerPauseControlsEnabled && progressionQuery.data?.match_clock?.pause_enabled === true
              ? handlePauseGame
              : undefined,
          resumeLabel: gameOfficiallyPaused ? undefined : chrome.resume_game_action,
          resumePending: resumeGameMutation.isPending,
          resumePendingLabel: chrome.resume_game_pending,
          onResume: gameOfficiallyPaused ? undefined : handleResumeGame,
          // Overlay owns blurb/countdown when MatchPauseOverlay is active (player + official).
          pausedBlurb: pauseOverlayCopy ? undefined : chrome.game_paused_blurb,
          pauseRemainingMs: pauseOverlayCopy ? 0 : Number(game?.pause_remaining_ms) || 0,
          pauseExpiresAtUnixMs: pauseOverlayCopy ? 0 : Number(game?.pause_expires_at_unix_ms) || 0,
          pauseRemainingFmt: pauseOverlayCopy ? undefined : chrome.pause_remaining_fmt,
          officialPauseBannerLines: pauseOverlayCopy ? undefined : officialPauseBannerLines,
          endLocalSession,
          restartAi: () => {
            resetSessionState();
            void startAi();
          },
          stopLabel: gameOfficiallyPaused ? "" : chrome.stop_game_action,
          stopPending: abandonGameMutation.isPending,
          stopPendingLabel: chrome.stop_game_pending,
          practiceBlurb: isPvpSession ? chrome.pvp_blurb : chrome.practice_blurb,
        })}
      </>
    );
  }

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
      {confirmAndAds}

      {/* Match seats: opponent above board, you below; 2D/3D beside top seat (desktop). */}
      <div
        className={cn(
          "order-1 flex min-h-0 min-w-0 flex-col overflow-hidden lg:flex-1 lg:justify-center",
          mobilePlayBoardMaxHeightClass,
        )}
      >
        <FetchProgressBar active={busy || startGameMutation.isPending} />
        <PlayBoardColumn
          desktopHeader={
            game && phase !== "menu" ? (
              <BoardSeatBar
                label={opponentName}
                hint={oppTurnHint}
                rating={game?.mode === "pvp" ? oppPlayerQuery.data?.player?.rating : undefined}
                ratingParenOpen={railChrome?.rating_paren_open}
                ratingParenClose={railChrome?.rating_paren_close}
                clock={opponentSeatClock}
                tone="muted"
                clockActive={opponentClockActive}
                pieceSide={yourPlayer === 2 ? "light" : "dark"}
                avatarThumbUrl={
                  game?.mode === "pvp" ? oppPlayerQuery.data?.player?.avatar_thumb_url : undefined
                }
                countryCode={
                  game?.mode === "pvp" ? oppPlayerQuery.data?.player?.country_code : undefined
                }
                captures={
                  game && (phase === "playing" || phase === "finished")
                    ? opponentCaptures
                    : undefined
                }
                online={game?.mode === "pvp" ? oppPlayerQuery.data?.player?.online : undefined}
                playing={
                  game?.mode === "pvp"
                    ? (oppPlayerQuery.data?.player?.playing ??
                      (phase === "playing" && Boolean(oppSeatId) ? true : undefined))
                    : undefined
                }
                trailing={boardViewToggle}
                hoverPlayer={opponentHoverPlayer}
                railChrome={railChrome}
                signedIn={isAccount}
              />
            ) : showBoardSkeleton ? (
              <BoardSeatBarSkeleton showTrailing clockActive={false} />
            ) : null
          }
          desktopFooter={
            game && phase !== "menu" ? (
              <BoardSeatBar
                label={yourName}
                hint={yourTurnHint || undefined}
                rating={youPlayerQuery.data?.player?.rating}
                ratingParenOpen={railChrome?.rating_paren_open}
                ratingParenClose={railChrome?.rating_paren_close}
                clock={seatClock}
                tone="muted"
                clockActive={yourClockActive}
                pieceSide={yourPlayer === 2 ? "dark" : "light"}
                avatarThumbUrl={youPlayerQuery.data?.player?.avatar_thumb_url}
                countryCode={youPlayerQuery.data?.player?.country_code}
                captures={
                  game && (phase === "playing" || phase === "finished") ? yourCaptures : undefined
                }
                online={youPlayerQuery.data?.player?.online}
                playing={
                  youPlayerQuery.data?.player?.playing ??
                  (phase === "playing" && Boolean(youSeatId) ? true : undefined)
                }
                hoverPlayer={yourHoverPlayer}
                railChrome={railChrome}
                signedIn={isAccount}
              />
            ) : showBoardSkeleton ? (
              <BoardSeatBarSkeleton clockActive={false} />
            ) : null
          }
          board={boardNode}
          coverOverlay={boardCoverOverlay}
        />
      </div>

      {/* lg+: frozen chrome. max-lg: tabs scroll with the rail body. */}
      <PlayRailAside>
        <div className={cn(playRailStickyMainClass, "px-4 py-3.5 sm:px-5")} data-dama-rail-main="">
          <h2 className="text-sm font-semibold text-[var(--dama-text)]">
            {(chrome.setup_title || "").trim()}
          </h2>
        </div>
        {(phase === "playing" || phase === "finished") &&
        game &&
        railChrome &&
        game.mode === "pvp" ? (
          <>
            <div className="shrink-0 space-y-3 border-b border-[var(--dama-border)]/60 p-4 pb-3 sm:px-5">
              <p className="text-sm text-[var(--dama-muted-foreground)]">{chrome.pvp_blurb}</p>
              {phase === "finished" && (game.outcome != null || game.draw) ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{chrome.game_over_title}</h3>
                    {outcomeMessage ? (
                      <p className="mt-1 text-xs text-[var(--dama-muted)]">{outcomeMessage}</p>
                    ) : null}
                  </div>
                  <MatchScoreLine
                    yourLabel={yourName}
                    opponentLabel={opponentName}
                    yourCaptures={yourCaptures}
                    opponentCaptures={opponentCaptures}
                    yourCapturesLabel={chrome.captures_your_label}
                    opponentCapturesLabel={chrome.captures_opponent_label}
                    vsSeparator={chrome.seat_meta_separator || ""}
                  />
                  <OfficialPauseActivityStrip
                    token={token}
                    gameId={game.id}
                    chrome={officialPauseChrome}
                    enabled
                    refreshKey={pauseActivityRefreshKey}
                  />
                </div>
              ) : null}
              {phase === "playing" && game ? (
                <div className="space-y-2">
                  {resumeBanner ? (
                    <div className="flex items-start justify-between gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-2 py-1.5">
                      <p
                        className="text-sm font-medium text-[var(--dama-brand)]"
                        aria-live="polite"
                      >
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
                  {/* Overlay owns official copy when MatchPauseOverlay is active. */}
                  <OfficialPauseBanner lines={pauseOverlayCopy ? [] : officialPauseBannerLines} />
                  <OfficialPauseActivityStrip
                    token={token}
                    gameId={game.id}
                    chrome={officialPauseChrome}
                    enabled={Boolean(
                      game.paused || Boolean(resumeBanner) || game.outcome != null || game.draw,
                    )}
                    refreshKey={pauseActivityRefreshKey}
                  />
                  <PlayPauseStopActions
                    paused={Boolean(game.paused)}
                    pauseLabel={chrome.pause_game_action}
                    pausePending={pauseGameMutation.isPending}
                    pausePendingLabel={chrome.pause_game_pending}
                    onPause={
                      playerPauseControlsEnabled &&
                      progressionQuery.data?.match_clock?.pause_enabled === true
                        ? handlePauseGame
                        : undefined
                    }
                    resumeLabel={gameOfficiallyPaused ? undefined : chrome.resume_game_action}
                    resumePending={resumeGameMutation.isPending}
                    resumePendingLabel={chrome.resume_game_pending}
                    onResume={gameOfficiallyPaused ? undefined : handleResumeGame}
                    stopLabel={gameOfficiallyPaused ? undefined : chrome.stop_game_action}
                    stopPending={abandonGameMutation.isPending}
                    stopPendingLabel={chrome.stop_game_pending}
                    onStop={gameOfficiallyPaused ? undefined : () => setStopConfirmOpen(true)}
                    pausedBlurb={pauseOverlayCopy ? undefined : chrome.game_paused_blurb}
                    pauseRemainingMs={pauseOverlayCopy ? 0 : Number(game.pause_remaining_ms) || 0}
                    pauseExpiresAtUnixMs={
                      pauseOverlayCopy ? 0 : Number(game.pause_expires_at_unix_ms) || 0
                    }
                    pauseRemainingFmt={pauseOverlayCopy ? undefined : chrome.pause_remaining_fmt}
                  />
                </div>
              ) : null}
            </div>
            <div className={cn(playRailStickySubClass, "grid grid-cols-3")} role="tablist">
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
                  onClick={() => setWatchTab(t.id)}
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    {t.label}
                    {t.id === "chat" && chatUnread > 0 && railChrome ? (
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
            <PlayRailScrollPort chat={watchTab === "chat" && !maxLg ? "contain" : "auto"}>
              {watchTab === "moves" ? (
                <div className={cn(playRailInnerListScrollClass, "px-4 pt-2 sm:px-5")}>
                  {historyNode}
                </div>
              ) : null}
              {watchTab === "chat" ? (
                <GameChatPanel
                  chrome={railChrome}
                  gameId={game.id}
                  signedIn={isAccount}
                  observing={{
                    p1Name: yourPlayer === 1 ? yourNameRaw : opponentNameRaw,
                    p1Rating:
                      yourPlayer === 1
                        ? youPlayerQuery.data?.player?.rating
                        : oppPlayerQuery.data?.player?.rating,
                    p1Country:
                      yourPlayer === 1
                        ? youPlayerQuery.data?.player?.country_code
                        : oppPlayerQuery.data?.player?.country_code,
                    p2Name: yourPlayer === 2 ? yourNameRaw : opponentNameRaw,
                    p2Rating:
                      yourPlayer === 2
                        ? youPlayerQuery.data?.player?.rating
                        : oppPlayerQuery.data?.player?.rating,
                    p2Country:
                      yourPlayer === 2
                        ? youPlayerQuery.data?.player?.country_code
                        : oppPlayerQuery.data?.player?.country_code,
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
                <div className={cn(playRailInnerListScrollClass, "space-y-2 p-4 text-sm")}>
                  {metaNode}
                </div>
              ) : null}
            </PlayRailScrollPort>
          </>
        ) : (
          <PlayRailScrollPort>
            <div
              className={cn(
                "flex flex-col",
                !(phase === "playing" && historyNode) && "gap-3 p-4 pb-6 sm:p-5",
              )}
            >
              <div
                className={cn(
                  "space-y-3",
                  phase === "playing" &&
                    historyNode &&
                    "shrink-0 border-b border-[var(--dama-border)]/60 p-4 pb-3 sm:px-5",
                )}
              >
                {isPvpSession ? (
                  <p className="text-sm text-[var(--dama-muted-foreground)]">{chrome.pvp_blurb}</p>
                ) : (
                  <p className="text-sm text-[var(--dama-muted-foreground)]">
                    {chrome.practice_blurb}
                  </p>
                )}

                {phase === "finished" && game && (game.outcome != null || game.draw) ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">{chrome.game_over_title}</h3>
                      {outcomeMessage ? (
                        <p className="mt-1 text-xs text-[var(--dama-muted)]">{outcomeMessage}</p>
                      ) : null}
                    </div>
                    <MatchScoreLine
                      yourLabel={yourName}
                      opponentLabel={opponentName}
                      yourCaptures={yourCaptures}
                      opponentCaptures={opponentCaptures}
                      yourCapturesLabel={chrome.captures_your_label}
                      opponentCapturesLabel={chrome.captures_opponent_label}
                      vsSeparator={chrome.seat_meta_separator || ""}
                    />
                    <OfficialPauseActivityStrip
                      token={token}
                      gameId={game.id}
                      chrome={officialPauseChrome}
                      enabled
                      refreshKey={pauseActivityRefreshKey}
                    />
                    {!isPvpSession ? (
                      <Button
                        type="button"
                        variant="play"
                        className="h-12 w-full"
                        isLoading={startGameMutation.isPending}
                        pendingLabel={chrome.practice_start_pending}
                        onClick={() => {
                          resetSessionState();
                          void startAi();
                        }}
                      >
                        {chrome.restart_action}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {!isPvpSession && phase !== "playing" && phase !== "finished" ? (
                  flagsQuery.isLoading ||
                  practiceBootstrapping ||
                  startGameMutation.isPending ||
                  (Boolean(flagsQuery.data?.otp_required) && token && !otpSessionOk) ? (
                    <FormCardSkeleton />
                  ) : vsAiEnabled ? (
                    <>
                      <Field id="play-ai-depth" label={chrome.ai_depth_label}>
                        <Select
                          value={depth != null ? String(depth) : undefined}
                          onValueChange={(v) => {
                            const next = Number(v);
                            setDepth(Number.isFinite(next) ? next : null);
                          }}
                          disabled={!aiDepths.length}
                        >
                          <SelectTrigger id="play-ai-depth" className="mt-1 h-11">
                            <SelectValue placeholder={chrome.depths_waiting} />
                          </SelectTrigger>
                          <SelectContent>
                            {aiDepths.map((d) => (
                              <SelectItem key={d} value={String(d)}>
                                {chrome.depth_option_prefix} {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      {(() => {
                        const timeLabel = (railChrome?.label_time || "").trim();
                        if (timeControlPresets.length > 0 && timeLabel) {
                          return (
                            <Field id="play-ai-time" label={timeLabel}>
                              <div className="relative mt-1">
                                <Timer
                                  className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--dama-online)]"
                                  aria-hidden
                                />
                                <Select
                                  value={clockSeconds > 0 ? String(clockSeconds) : undefined}
                                  onValueChange={(v) => setClockSeconds(Number(v))}
                                >
                                  <SelectTrigger
                                    id="play-ai-time"
                                    className="h-11 pl-9"
                                    aria-label={timeLabel}
                                  >
                                    <SelectValue placeholder={timeLabel} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeControlPresets.map((p) => (
                                      <SelectItem key={p.seconds} value={String(p.seconds)}>
                                        {p.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </Field>
                          );
                        }
                        if (progressionQuery.isLoading || progressionQuery.isFetching) {
                          return (
                            <div className="space-y-1.5" aria-busy="true">
                              <ShimmerBlock className="h-3 w-16" />
                              <ShimmerBlock className="h-11 w-full rounded-md" />
                            </div>
                          );
                        }
                        return (
                          <p className="text-sm text-[var(--dama-muted)]">
                            {(railChrome?.toast_time_control_unavailable || "").trim()}
                          </p>
                        );
                      })()}
                      <Button
                        className="h-12 w-full text-base"
                        variant="play"
                        disabled={busy || depth == null || !aiDepths.length || !(clockSeconds > 0)}
                        isLoading={startGameMutation.isPending}
                        pendingLabel={chrome.practice_start_pending}
                        onClick={() => void startAi()}
                      >
                        {chrome.play_computer_action}
                      </Button>
                    </>
                  ) : (
                    <p className="border border-[var(--dama-border)] p-3 text-sm text-[var(--dama-muted)]">
                      {chrome.practice_unavailable}
                    </p>
                  )
                ) : null}

                {phase === "playing" && game ? (
                  <div className="space-y-2">
                    {resumeBanner ? (
                      <div className="flex items-start justify-between gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-2 py-1.5">
                        <p
                          className="text-sm font-medium text-[var(--dama-brand)]"
                          aria-live="polite"
                        >
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
                    <OfficialPauseBanner lines={pauseOverlayCopy ? [] : officialPauseBannerLines} />
                    <OfficialPauseActivityStrip
                      token={token}
                      gameId={game.id}
                      chrome={officialPauseChrome}
                      enabled={Boolean(
                        game.paused || Boolean(resumeBanner) || game.outcome != null || game.draw,
                      )}
                      refreshKey={pauseActivityRefreshKey}
                    />
                    <PlayPauseStopActions
                      paused={Boolean(game.paused)}
                      pauseLabel={chrome.pause_game_action}
                      pausePending={pauseGameMutation.isPending}
                      pausePendingLabel={chrome.pause_game_pending}
                      onPause={
                        playerPauseControlsEnabled &&
                        progressionQuery.data?.match_clock?.pause_enabled === true
                          ? handlePauseGame
                          : undefined
                      }
                      resumeLabel={gameOfficiallyPaused ? undefined : chrome.resume_game_action}
                      resumePending={resumeGameMutation.isPending}
                      resumePendingLabel={chrome.resume_game_pending}
                      onResume={gameOfficiallyPaused ? undefined : handleResumeGame}
                      stopLabel={gameOfficiallyPaused ? undefined : chrome.stop_game_action}
                      stopPending={abandonGameMutation.isPending}
                      stopPendingLabel={chrome.stop_game_pending}
                      onStop={gameOfficiallyPaused ? undefined : () => setStopConfirmOpen(true)}
                      pausedBlurb={pauseOverlayCopy ? undefined : chrome.game_paused_blurb}
                      pauseRemainingMs={pauseOverlayCopy ? 0 : Number(game.pause_remaining_ms) || 0}
                      pauseExpiresAtUnixMs={
                        pauseOverlayCopy ? 0 : Number(game.pause_expires_at_unix_ms) || 0
                      }
                      pauseRemainingFmt={pauseOverlayCopy ? undefined : chrome.pause_remaining_fmt}
                    />
                  </div>
                ) : null}
              </div>

              {historyNode ? (
                <div
                  className={cn(
                    "flex min-w-0 flex-col",
                    phase === "playing" && cn(playRailInnerListScrollClass, "px-4 pt-2 sm:px-5"),
                  )}
                >
                  {historyNode}
                </div>
              ) : null}

              {game ? (
                <div
                  className={cn(
                    "shrink-0 space-y-2 text-sm",
                    phase === "playing" && historyNode
                      ? "border-t border-[var(--dama-border)]/60 p-4 pb-6 sm:px-5"
                      : "border-t border-[var(--dama-border)] pt-4",
                  )}
                >
                  {modeDisplay ? (
                    <p className="text-[var(--dama-muted-foreground)]">
                      {chrome.label_mode}
                      {chrome.label_value_separator}
                      <span className="text-[var(--dama-text)]">{modeDisplay}</span>
                    </p>
                  ) : null}
                  <p className="text-[var(--dama-muted-foreground)]">
                    {chrome.label_game}
                    {chrome.label_value_separator}
                    <span className="text-[var(--dama-text)]">
                      {formatGameIdDisplay(
                        game.id,
                        chrome.id_truncate_chars,
                        chrome.id_truncate_suffix,
                      )}
                    </span>
                  </p>
                  <p className="text-[var(--dama-muted-foreground)]">
                    {chrome.label_moves}
                    {chrome.label_value_separator}
                    <span className="text-[var(--dama-text)]">{game.move_count}</span>
                  </p>
                  <p className="text-[var(--dama-muted-foreground)]">
                    {chrome.label_halfmove}
                    {chrome.label_value_separator}
                    <span className="text-[var(--dama-text)]">{game.halfmove_clock}</span>
                  </p>
                  {boardRulesQuery.data ? (
                    <p className="text-[var(--dama-muted-foreground)]">
                      {chrome.label_rules}
                      {chrome.label_value_separator}
                      <span className="text-[var(--dama-text)]">
                        {boardRulesQuery.data.variant}
                        {chrome.seat_meta_separator}
                        {boardRulesQuery.data.size}
                        {chrome.board_size_separator}
                        {boardRulesQuery.data.size}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-[var(--dama-muted-foreground)]">
                    {chrome.label_pieces}
                    {chrome.label_value_separator}
                    <span className="text-[var(--dama-text)]">
                      {isAccount ? chrome.label_white : guestSeats.light}
                      {chrome.piece_count_separator}
                      {countSidePieces(game.board, 1)}
                      {chrome.seat_meta_separator}
                      {isAccount ? chrome.label_black : guestSeats.dark}
                      {chrome.piece_count_separator}
                      {countSidePieces(game.board, 2)}
                    </span>
                  </p>
                  {!isPvpSession && phase !== "playing" ? (
                    <Button
                      className="mt-3 w-full"
                      variant="outline"
                      onClick={() => endLocalSession()}
                    >
                      {chrome.new_setup_action}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </PlayRailScrollPort>
        )}
      </PlayRailAside>
    </div>
  );
}
