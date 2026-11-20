"use client";

import MatchmakingPage from "@/app/(player)/matchmaking/page";
import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { HomePreviewBoard } from "@/components/home/HomePreviewBoard";
import { PlatformStatsPage } from "@/components/home/PlatformStatsPage";
import { GeoAdSlot } from "@/components/ads/GeoAdSlot";
import { BoardColorsPopover } from "@/components/play-rail/BoardColorsPopover";
import type { ChallengeOpponent } from "@/components/play-rail/CreateChallengeForm";
import { GamesPanel } from "@/components/play-rail/GamesPanel";
import { NewGamePanel } from "@/components/play-rail/NewGamePanel";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayRailAside } from "@/components/play-rail/PlayRailAside";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { PlayersPanel } from "@/components/play-rail/PlayersPanel";
import { BoardSeatBar } from "@/components/play/BoardSeatBar";
import { type LivePlayEmbedApi, LivePlayHub } from "@/components/play/LivePlayHub";
import { PlayBoardColumn } from "@/components/play/PlayBoardColumn";
import { CompetitionTournamentsHub } from "@/components/tournaments/CompetitionTournamentsHub";
import { TournamentCupLobby } from "@/components/tournaments/TournamentCupLobby";
import { Button } from "@/components/ui/button";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  BoardAreaSkeleton,
  BoardColumnSkeleton,
  LeaderboardPageSkeleton,
  PlatformStatsPageSkeleton,
  PlayHubSkeleton,
  TournamentsHubSkeleton,
  TournamentsPlayHubSkeleton,
} from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useBoardRulesQuery } from "@/hooks/query/useBoardRulesQuery";
import { useDetectBrowserCountryQuery } from "@/hooks/query/useDetectBrowserCountryQuery";
import { useEventsCatalogQuery } from "@/hooks/query/useEventsCatalogQuery";
import { useEventsPlayerChromeQuery } from "@/hooks/query/useEventsPlayerChromeQuery";
import { useEventsPublicListQuery } from "@/hooks/query/useEventsPublicListQuery";
import { useHomeChromeQuery } from "@/hooks/query/useHomeChromeQuery";
import { useMatchmakingChromeQuery } from "@/hooks/query/useMatchmakingChromeQuery";
import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import {
  isPlayRailChromeReady,
  usePlayRailChromeQuery,
} from "@/hooks/query/usePlayRailChromeQuery";
import { useProgressionQuery } from "@/hooks/query/useProgressionQuery";
import { useRestFeatureFlagsQuery } from "@/hooks/query/useRestFeatureFlagsQuery";
import { useSpectateChromeQuery } from "@/hooks/query/useSpectateChromeQuery";
import { useTournamentDetailQuery } from "@/hooks/query/useTournamentDetailQuery";
import { useTournamentsPlayerChromeQuery } from "@/hooks/query/useTournamentsPlayerChromeQuery";
import { useTournamentsQuery } from "@/hooks/query/useTournamentsQuery";
import { useDeferredDialogSelection } from "@/hooks/use-deferred-dialog-selection";
import { useMaxLg } from "@/hooks/useMaxLg";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { restClient } from "@/lib/api";
import { resolveLoginPath } from "@/lib/auth-providers";
import { pieceSeatNames, usePiecePalette } from "@/lib/board-palette";
import { useBoardViewMode } from "@/lib/board-view";
import { tournamentsHrefFromEventsView } from "@/lib/competition-cup-source";
import { buildInitialBoard } from "@/lib/initial-board";
import { isOtpSessionVerified, subscribeOtpSession } from "@/lib/otp-session";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import {
  mobilePlayBoardColumnClass,
  mobilePlayBoardMaxHeightClass,
  playHubFillHeightClass,
  playRailImmersiveChatFillClass,
  playRailPanelSlotClass,
  playRailPanelStackClass,
  playRailStickyMainClass,
  tournamentMiniCardGridClass,
} from "@/lib/player-shell-ui";
import { PLAY_SESSION_EVENT, readStoredPlaySession } from "@/lib/play-session-storage";
import { ensurePracticeToken } from "@/lib/practice-token";
import {
  shouldOpenTournamentCupLobby,
  takeEnrolledTournamentLatch,
} from "@/lib/tournament-cup-lobby";
import { hrefWithQueryPatch } from "@/lib/url-skip";
import { cn } from "@/lib/utils";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useShellChromeStore } from "@/store/shell-chrome";
import { isEventsPlayerChromeReady } from "@/types/events-player-chrome";
import { isHomeSurfaceChromeReady } from "@/types/home-chrome";
import { isMatchmakingChromeReady } from "@/types/matchmaking-chrome";
import { isPlayChromeReady } from "@/types/play-chrome";
import type { Tournament } from "@/types/tournament";
import { isTournamentsPlayerChromeReady } from "@/types/tournaments-player-chrome";
import { Box, Grid3X3, Layers, Plus, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

const DraughtsScene3D = dynamic(() => import("@/components/game/DraughtsScene3D"), {
  ssr: false,
  // Keep-alive / remount must not flash a board shimmer (lists/tables parity).
  loading: () => null,
});
const LeaderboardPage = dynamic(() => import("@/app/(player)/leaderboard/page"), {
  ssr: false,
  loading: () => <LeaderboardPageSkeleton />,
});
const SpectateHub = dynamic(() => import("@/components/spectate/SpectateHub"), {
  ssr: false,
  // SpectateHub owns PlayHubSkeleton - avoid a second remount (wide→correct flash).
  loading: () => null,
});

function useStoredPlayGameId(): string {
  return useSyncExternalStore(
    (onStore) => {
      if (typeof window === "undefined") return () => undefined;
      const tick = () => onStore();
      window.addEventListener(PLAY_SESSION_EVENT, tick);
      window.addEventListener("focus", tick);
      return () => {
        window.removeEventListener(PLAY_SESSION_EVENT, tick);
        window.removeEventListener("focus", tick);
      };
    },
    () => (readStoredPlaySession()?.gameId || "").trim(),
    () => "",
  );
}

type RailTab = "new" | "games" | "players";
type NewSub = "ai" | "challenge";
type PublicView = "leaderboard" | "spectate" | "match" | "tournaments" | "events" | "status" | "";

/** In-memory latch when sessionStorage is unavailable (private mode / Strict Mode). */
const challengeAcceptInFlight = new Set<string>();

/** Center tournaments opens from left/bottom nav `/?view=tournaments`. */

type HomePlayHubProps = {
  brand?: string;
  eyebrow?: string;
  blurb?: string;
  onEnrollTournament?: (t: Tournament) => void;
  /** Set by parent PaymentEnrollModal after paid enroll (avoids re-opening enroll on deep-link). */
  enrolledTournamentIdLatch?: string | null;
};

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Turn chrome beside the seat title: `Name (Your turn)`. */
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
}: {
  label: string;
  hint?: string;
  clock?: ReactNode;
  tone: "muted" | "strong";
  captures?: number;
  /** Tracks live piece palette (`--dama-piece-light` / `--dama-piece-dark`). */
  pieceSide?: "light" | "dark";
  /** When set, show Chess.com presence triad on the seat avatar. */
  online?: boolean;
  playing?: boolean;
  layout?: "bar" | "side";
  avatarThumbUrl?: string | null;
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
    <div className="max-w-full shrink-0 [&_*]:text-[10px] sm:[&_*]:text-[11px]">{clock}</div>
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
        <p className="flex min-w-0 items-baseline gap-1 text-sm font-medium text-[var(--dama-text)]">
          <span className="min-w-0 truncate">{label}</span>
          {turn ? (
            <span className="shrink-0 text-[11px] font-normal text-[var(--dama-muted)]">
              ({turn})
            </span>
          ) : null}
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

/**
 * Chess.com Play shell: board (2D default / 3D toggle) + New Game rail.
 * AI is free (guest practice JWT). Match soft-gates. Tournaments swap the center.
 */
export function HomePlayHub({
  brand,
  eyebrow,
  blurb: heroBlurb,
  onEnrollTournament,
  enrolledTournamentIdLatch,
}: HomePlayHubProps) {
  const [railTab, setRailTab] = useState<RailTab>("new");
  const immersiveChat = useShellChromeStore((s) => s.immersiveChat);
  /** Players panel sub from notification deep-link `sub=`. */
  const [playersSub, setPlayersSub] = useState<"friends" | "requests" | "dms" | "all">("all");
  const [dmDeepLink, setDmDeepLink] = useState<{ dm?: string; thread?: string }>({});
  const [newSub, setNewSub] = useState<NewSub>("ai");
  const [challengeOpponent, setChallengeOpponent] = useState<ChallengeOpponent | null>(null);
  const [boardView, setBoardView] = useBoardViewMode();
  const [piecePalette] = usePiecePalette();
  const [colorsOpen, setColorsOpen] = useState(false);
  /** Center tournaments grid (not a rail tab). */
  const [showTournaments, setShowTournaments] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const providersQuery = useAuthProvidersQuery();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const otpSessionOk = useSyncExternalStore(
    subscribeOtpSession,
    () => isOtpSessionVerified(userId),
    () => false,
  );
  const playQuery = usePlayChromeQuery(true);
  const railChromeQuery = usePlayRailChromeQuery(true);
  const mmQuery = useMatchmakingChromeQuery(true);
  // Warm spectate chrome while on Play hub so first Spectate latch does not PlayHubSkeleton.
  useSpectateChromeQuery(true);
  const flagsQuery = useRestFeatureFlagsQuery();
  const progressionQuery = useProgressionQuery();
  const rulesQuery = useBoardRulesQuery();
  const homeChromeQuery = useHomeChromeQuery(true);
  const tournamentsChromeQuery = useTournamentsPlayerChromeQuery(true);
  // Keep Events chrome/catalog/list warm while on Play hub (tournaments parity - no cold refetch flash).
  // Prefetch page 1 only when Events hub is not mounted - hub owns URL `events_skip` while open.
  const eventsChromeQuery = useEventsPlayerChromeQuery(true);
  const eventsCatalogQuery = useEventsCatalogQuery(true);
  const eventsChrome = isEventsPlayerChromeReady(eventsChromeQuery.data)
    ? eventsChromeQuery.data
    : undefined;
  const eventsPageSize = parseListPageSize(eventsChrome?.list_page_size);
  const eventsViewActive = (searchParams.get("view") || "").trim() === "events";
  useEventsPublicListQuery(
    !eventsViewActive &&
      Boolean(eventsChrome) &&
      eventsPageSize > 0 &&
      eventsCatalogQuery.data?.public_events_enabled === true,
    0,
    eventsPageSize,
    "all",
    "",
  );
  const tournamentsChrome = isTournamentsPlayerChromeReady(tournamentsChromeQuery.data)
    ? tournamentsChromeQuery.data
    : undefined;
  const tournamentsPageSize = parseListPageSize(tournamentsChrome?.list_page_size);
  // Focus/enroll latch only - Official|Community browse lives in CompetitionTournamentsHub.
  const [tournamentsSkip] = useUrlSkip("tournaments_skip");
  const tournamentsQuery = useTournamentsQuery(
    tournamentsSkip,
    tournamentsPageSize,
    Boolean(tournamentsChrome) && tournamentsPageSize > 0,
    "all",
    "",
    token,
  );
  /** Notification deep-link `/?view=tournaments&id=` - lobby or enroll once per id. */
  const focusedTournamentIdRef = useRef<string | null>(null);
  /** Keep tournamentId until close animation ends (wallet/events deferred-dialog parity). */
  const cupLobby = useDeferredDialogSelection();
  const [localEnrolledIds, setLocalEnrolledIds] = useState<Set<string>>(() => new Set());
  const markLocalEnrolled = useCallback((tournamentId: string) => {
    const next = tournamentId.trim();
    if (!next) return;
    setLocalEnrolledIds((prev) => {
      if (prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
  }, []);
  const play = isPlayChromeReady(playQuery.data) ? playQuery.data : undefined;
  const railChrome = isPlayRailChromeReady(railChromeQuery.data) ? railChromeQuery.data : undefined;
  const mm = isMatchmakingChromeReady(mmQuery.data) ? mmQuery.data : undefined;
  const homeChrome = isHomeSurfaceChromeReady(homeChromeQuery.data)
    ? homeChromeQuery.data
    : undefined;
  const vsAi = flagsQuery.data?.vs_ai_enabled === true;
  const signedIn = hydrated && Boolean(token);
  // Persist verified GeoIP → users.country_code while play hub is open (OAuth may miss private IPs).
  useDetectBrowserCountryQuery(signedIn);
  const signInModal = useOptionalSignInModal();

  const aiLabel = (play?.play_computer_action || "").trim();
  const matchLabel = (play?.find_1v1_action || mm?.find_match_action || "").trim();
  const panelTitle = (play?.lobby_title || play?.page_title || "").trim();
  void brand;
  void eyebrow;
  void heroBlurb;
  const depths = useMemo(
    () => (Array.isArray(flagsQuery.data?.ai_depths) ? flagsQuery.data.ai_depths : []),
    [flagsQuery.data?.ai_depths],
  );
  const [depth, setDepth] = useState<number | null>(null);
  const activeDepth = useMemo(() => {
    if (depth != null && depths.includes(depth)) return depth;
    return depths[0] ?? null;
  }, [depth, depths]);

  const clockSeconds = progressionQuery.data?.match_clock?.enabled
    ? progressionQuery.data.match_clock.initial_seconds
    : 0;
  const clockLabel = formatClock(clockSeconds);
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
  const timeControlLabel = useCallback(
    (seconds: number) => timeControlPresets.find((p) => p.seconds === seconds)?.label || "",
    [timeControlPresets],
  );

  const openMatch = useCallback(
    (gameId: string, mode?: string) => {
      const id = gameId.trim();
      if (!id) return;
      const m = (mode || "").trim().toLowerCase();
      // DB mode required - never invent pvp/ai for history resume.
      if (m !== "ai" && m !== "pvp") return;
      const q = new URLSearchParams({ gameId: id, mode: m });
      router.push(`/?${q.toString()}`);
    },
    [router],
  );

  // Deep-link: /?challenge=<share_token> - wait for OTP; never burn token on verification.
  useEffect(() => {
    const tok = (searchParams.get("challenge") || "").trim();
    if (!tok || !hydrated || !token || !railChrome) return;
    const otpRequired = flagsQuery.data?.otp_required === true;
    if (otpRequired && !otpSessionOk) return;
    const guardKey = `dama.chal.accept:${tok}`;
    // Only `done` is durable - never sticky-`pending` (reload mid-accept must retry).
    // Concurrent Strict Mode / double-effect uses in-memory latch only.
    try {
      if (sessionStorage.getItem(guardKey) === "done") return;
    } catch {
      /* private mode */
    }
    if (challengeAcceptInFlight.has(tok)) return;
    challengeAcceptInFlight.add(tok);
    void (async () => {
      try {
        const { data } = await restClient.post<{
          match?: { game_id?: string };
        }>(
          `/invites/token/${encodeURIComponent(tok)}/accept`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const gid = data.match?.game_id;
        try {
          sessionStorage.setItem(guardKey, "done");
        } catch {
          /* ignore */
        }
        if (gid) {
          router.replace(`/?gameId=${encodeURIComponent(gid)}&mode=pvp`);
          return;
        }
        challengeAcceptInFlight.delete(tok);
        try {
          sessionStorage.removeItem(guardKey);
        } catch {
          /* ignore */
        }
        toast.error(railChrome.toast_challenge_accept_failed);
        router.replace("/", { scroll: false });
        setRailTab("new");
        setNewSub("challenge");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const needsOtp = /verification required/i.test(msg);
        challengeAcceptInFlight.delete(tok);
        if (needsOtp) {
          // Keep ?challenge=; SessionSecurity OTP overlay; effect retries after verify.
          return;
        }
        toast.error(railChrome.toast_challenge_accept_failed);
        router.replace("/", { scroll: false });
        setRailTab("new");
        setNewSub("challenge");
      }
    })();
  }, [
    flagsQuery.data?.otp_required,
    hydrated,
    otpSessionOk,
    railChrome,
    router,
    searchParams,
    token,
  ]);

  // Deep-link: /?opponent=… → Create Game chip (persist across Strict Mode URL strip).
  useEffect(() => {
    if (!hydrated) return;
    const OPP_KEY = "dama.create.opponent";
    const opponent = (searchParams.get("opponent") || "").trim();
    if (opponent) {
      const opponentId = (searchParams.get("opponentId") || "").trim();
      const ratingRaw = (searchParams.get("opponentRating") || "").trim();
      const rating = ratingRaw ? Number(ratingRaw) : undefined;
      const trustBadge = (searchParams.get("opponentHostTrustBadge") || "").trim();
      const trustTier = (searchParams.get("opponentHostTrustTier") || "").trim();
      const chip: ChallengeOpponent = {
        username: opponent,
        id: opponentId || undefined,
        rating: Number.isFinite(rating) ? rating : undefined,
        hostTrustBadge: trustBadge || null,
        hostTrustTier: trustTier || null,
      };
      try {
        sessionStorage.setItem(OPP_KEY, JSON.stringify(chip));
      } catch {
        /* ignore */
      }
      setChallengeOpponent(chip);
      setRailTab("new");
      setNewSub("challenge");
      setShowTournaments(false);
      router.replace("/", { scroll: false });
      return;
    }
    try {
      const raw = sessionStorage.getItem(OPP_KEY);
      if (!raw) return;
      const chip = JSON.parse(raw) as ChallengeOpponent;
      if (!(chip?.username || "").trim()) return;
      setChallengeOpponent(chip);
      // Restore chip only - do not force the New tab (steals Games/Players clicks).
    } catch {
      /* ignore */
    }
  }, [hydrated, router, searchParams]);

  const viewParam = (searchParams.get("view") || "").trim() as PublicView | string;
  const modeParam = (searchParams.get("mode") || "").toLowerCase();
  const depthParam = searchParams.get("depth");
  const tcParam = searchParams.get("tc") || searchParams.get("time");
  const gameIdParam = searchParams.get("gameId") || searchParams.get("game_id");
  const challengeParam = (searchParams.get("challenge") || "").trim();
  const opponentParam = (searchParams.get("opponent") || "").trim();
  /** Matchmaking full page only when nav asks for it - not Create Game / challenge-link flows. */
  const showMatchmakingPage = viewParam === "match" && !challengeParam && !opponentParam;
  const publicView =
    viewParam === "leaderboard" ||
    viewParam === "spectate" ||
    (viewParam === "match" && showMatchmakingPage) ||
    viewParam === "tournaments" ||
    viewParam === "events" ||
    viewParam === "status"
      ? viewParam
      : "";
  /** In-place AI session on `/` - never navigate to `/?mode=ai`. */
  const [aiLive, setAiLive] = useState<{
    depth: number | null;
    timeControlSeconds: number;
  } | null>(null);
  const [startAiBusy, setStartAiBusy] = useState(false);
  const clearAiLive = useCallback(() => setAiLive(null), []);
  const aiDeepLinkLatchRef = useRef(false);
  /** Keep LivePlayHub / SpectateHub mounted across view switches (matchmaking keep-alive parity). */
  const [playBoardLatched, setPlayBoardLatched] = useState(false);
  const [spectateLatched, setSpectateLatched] = useState(false);
  const storedPlayGameId = useStoredPlayGameId();

  /** URL view=tournaments must paint list immediately (do not wait for useEffect latch). */
  const centerTournaments = publicView === "tournaments" || showTournaments;
  /** Legacy view=events redirects to tournaments Community; treat as browse until replace. */
  const centerEvents = publicView === "events";
  /** VS-AI / live practice always uses the Play board center (leave tournaments/events browse). */
  const centerBrowse = !aiLive && (centerTournaments || centerEvents);
  /** Phone/tablet tournaments browse: play rail is a FAB → right sheet (center scrolls alone). */
  const maxLg = useMaxLg();
  const compactPlayRail = centerBrowse && maxLg;
  const [playRailSheetOpen, setPlayRailSheetOpen] = useState(false);

  useEffect(() => {
    if (!compactPlayRail) setPlayRailSheetOpen(false);
  }, [compactPlayRail]);

  useEffect(() => {
    if (publicView !== "events") return;
    router.replace(tournamentsHrefFromEventsView(searchParams.toString()), { scroll: false });
  }, [publicView, router, searchParams]);
  const tournamentFocusId = (searchParams.get("id") || "").trim();
  // Public GET /tournaments/{id} - guests need detail for finished lobby deep links.
  const tournamentFocusDetail = useTournamentDetailQuery(
    token,
    tournamentFocusId,
    viewParam === "tournaments" && Boolean(tournamentFocusId),
  );

  // Prefetch guest practice JWT so VS-AI is ready for anyone (no account).
  useEffect(() => {
    if (!hydrated || token || !vsAi) return;
    void ensurePracticeToken();
  }, [hydrated, token, vsAi]);

  // Legacy deep links `/?mode=ai&depth=&tc=` → start in-place and strip the query.
  // Latch + skip gameId resume so we never setAiLive in a render loop while
  // `depths` / `activeDepth` settle or while `/?gameId=` LivePlayHub is mounted.
  useEffect(() => {
    if (publicView) return;
    if (modeParam !== "ai" && modeParam !== "practice") {
      aiDeepLinkLatchRef.current = false;
      return;
    }
    if (gameIdParam) return;
    if (aiDeepLinkLatchRef.current) return;
    aiDeepLinkLatchRef.current = true;
    const d = depthParam != null ? Number(depthParam) : Number.NaN;
    const nextDepth = Number.isFinite(d) && depths.includes(d) ? d : activeDepth;
    const rawTc = tcParam != null ? Number(tcParam) : Number.NaN;
    const defTc = clockSeconds > 0 ? clockSeconds : 0;
    const nextTc =
      Number.isFinite(rawTc) && timeControlPresets.some((p) => p.seconds === rawTc)
        ? rawTc
        : timeControlPresets.some((p) => p.seconds === defTc)
          ? defTc
          : (timeControlPresets[0]?.seconds ?? 0);
    setAiLive((prev) =>
      prev && prev.depth === nextDepth && prev.timeControlSeconds === nextTc
        ? prev
        : { depth: nextDepth, timeControlSeconds: nextTc },
    );
    router.replace("/", { scroll: false });
  }, [
    publicView,
    modeParam,
    depthParam,
    tcParam,
    depths,
    activeDepth,
    clockSeconds,
    timeControlPresets,
    router,
    gameIdParam,
  ]);

  // Full LivePlayHub only for PvP resume - AI stays inside this lobby shell.
  const showResumeLive = !publicView && (Boolean(gameIdParam) || modeParam === "pvp");
  const playBoardVisible = showResumeLive;
  const spectateVisible = publicView === "spectate";
  const keepPlayGameId = (gameIdParam || storedPlayGameId || "").trim();

  useEffect(() => {
    if (playBoardVisible || aiLive || keepPlayGameId) setPlayBoardLatched(true);
  }, [playBoardVisible, aiLive, keepPlayGameId]);

  useEffect(() => {
    if (spectateVisible) setSpectateLatched(true);
  }, [spectateVisible]);

  useEffect(() => {
    if (!playBoardVisible && !keepPlayGameId && !aiLive) setPlayBoardLatched(false);
  }, [playBoardVisible, keepPlayGameId, aiLive]);

  const clearPlayBoardLatch = useCallback(() => {
    clearAiLive();
    setPlayBoardLatched(false);
  }, [clearAiLive]);

  useEffect(() => {
    void searchParams;
    const rail = (searchParams.get("rail") || "").trim().toLowerCase();
    const sub = (searchParams.get("sub") || "").trim().toLowerCase();
    // Friend-request / games deep links must win even during embedded AI.
    if (rail === "players" || rail === "games" || rail === "new") {
      if (aiLive) setAiLive(null);
      setShowTournaments(false);
      if (rail === "players") {
        setRailTab("players");
        if (sub === "friends" || sub === "requests" || sub === "dms" || sub === "all") {
          setPlayersSub(sub);
        } else {
          setPlayersSub("requests");
        }
        const dm = (searchParams.get("dm") || "").trim();
        const thread = (searchParams.get("thread") || "").trim();
        setDmDeepLink({
          dm: dm || undefined,
          thread: thread || undefined,
        });
      } else if (rail === "games") {
        setRailTab("games");
      } else {
        setRailTab("new");
      }
      return;
    }
    // Leaving the play board surface (tournaments/spectate/…): drop AI keep-alive so
    // LeaveBoardPauseHost + floating Resume can run; board must not stay mounted.
    if (
      publicView === "tournaments" ||
      publicView === "events" ||
      publicView === "leaderboard" ||
      publicView === "spectate" ||
      publicView === "status" ||
      showMatchmakingPage
    ) {
      if (aiLive) setAiLive(null);
      if (publicView === "tournaments") {
        setShowTournaments(true);
        setRailTab("new");
      } else if (publicView === "events") {
        setShowTournaments(false);
        setRailTab("new");
      }
      return;
    }
    if (showResumeLive || aiLive) return;
    if (viewParam === "match" && !showMatchmakingPage) {
      // Challenge-link / Create Game deep-links stay on the Play hub.
      setShowTournaments(false);
      setRailTab("new");
      setNewSub("challenge");
    } else if (!publicView) {
      setShowTournaments(false);
    }
  }, [searchParams, showResumeLive, aiLive, publicView, showMatchmakingPage, viewParam]);

  const setRail = (next: RailTab) => {
    // Same-tab no-op (aiLive locks Games/Players via disabled buttons).
    if (next === railTab) return;
    setRailTab(next);
    setShowTournaments(false);
    setColorsOpen(false);
    // Clear deep-link rail params so URL sync cannot snap the tab back.
    const params = new URLSearchParams(searchParams.toString());
    let clearedRailQuery = false;
    for (const key of ["rail", "sub", "dm", "thread"] as const) {
      if (params.has(key)) {
        params.delete(key);
        clearedRailQuery = true;
      }
    }
    if (publicView === "tournaments" || publicView === "events" || publicView === "match") {
      // Leave browse views but keep skip params off the play hub URL.
      router.replace("/", { scroll: false });
    } else if (clearedRailQuery) {
      router.replace(hrefWithQueryPatch("/", params, {}), { scroll: false });
    }
  };

  const openWatch = (gameId: string) => {
    const id = gameId.trim();
    if (!id) return;
    router.push(`/?view=spectate&gameId=${encodeURIComponent(id)}`);
  };

  const openChallenge = (player: RailPlayer) => {
    setChallengeOpponent({
      id: player.id,
      username: player.username,
      rating: player.rating,
      countryCode: player.countryCode,
      avatarThumbUrl: player.avatarThumbUrl,
      online: player.online,
      playing: player.playing,
      hostTrustBadge: player.hostTrustBadge ?? null,
      hostTrustTier: player.hostTrustTier ?? null,
    });
    setRailTab("new");
    setNewSub("challenge");
    setShowTournaments(false);
  };

  const previewBoard = useMemo(() => {
    const size = rulesQuery.data?.size ?? 10;
    const setup = rulesQuery.data?.setup_rows ?? 4;
    return buildInitialBoard(size, setup);
  }, [rulesQuery.data?.size, rulesQuery.data?.setup_rows]);

  const tournaments = tournamentsQuery.data?.tournaments ?? [];

  useEffect(() => {
    const fromProp = (enrolledTournamentIdLatch || "").trim();
    const fromSession = takeEnrolledTournamentLatch();
    const latched = fromProp || fromSession;
    if (!latched) return;
    markLocalEnrolled(latched);
    focusedTournamentIdRef.current = latched;
    cupLobby.openWith(latched);
  }, [enrolledTournamentIdLatch, markLocalEnrolled, cupLobby.openWith]);

  useEffect(() => {
    if (publicView !== "tournaments") return;
    const focusId = tournamentFocusId;
    if (!focusId || focusedTournamentIdRef.current === focusId) return;
    const match = tournaments.find((t) => t.id === focusId) ?? tournamentFocusDetail.data;
    if (!match && tournamentFocusDetail.isLoading) return;
    if (!match) return;
    focusedTournamentIdRef.current = focusId;
    const enrolled = localEnrolledIds.has(focusId) || match.viewer_enrolled === true;
    // Finished / seated / live → lobby (works for guests; GET /tournaments/{id} is public).
    if (shouldOpenTournamentCupLobby(match, enrolled)) {
      cupLobby.openWith(focusId);
      return;
    }
    // Open-cup enroll needs auth - guests stop here (sign-in happens from CTA).
    if (!token) return;
    onEnrollTournament?.(match);
  }, [
    publicView,
    token,
    onEnrollTournament,
    tournamentFocusId,
    tournaments,
    tournamentFocusDetail.data,
    tournamentFocusDetail.isLoading,
    localEnrolledIds,
    cupLobby.openWith,
  ]);

  // After deep-link `id=` is stripped, clear latch so the same cup can reopen later.
  useEffect(() => {
    if (tournamentFocusId) return;
    focusedTournamentIdRef.current = null;
  }, [tournamentFocusId]);

  const closeCupLobby = useCallback(() => {
    // Hold deep-link latch until URL id is gone so replace cannot re-open mid-close.
    const openId = (cupLobby.selectedId || "").trim();
    if (openId) focusedTournamentIdRef.current = openId;
    // open→false first; selectedId clears after exit animation (no content flash).
    cupLobby.close();
    router.replace(hrefWithQueryPatch("/", searchParams, { view: "tournaments", id: null }), {
      scroll: false,
    });
  }, [cupLobby.close, cupLobby.selectedId, router, searchParams]);
  // Cache-first: soft refetch (isFetching) must not remount PlayHubSkeleton (lists/tables parity).
  const loading =
    (playQuery.isLoading && !playQuery.data) ||
    (railChromeQuery.isLoading && !railChromeQuery.data) ||
    (mmQuery.isLoading && !mmQuery.data) ||
    (flagsQuery.isLoading && !flagsQuery.data) ||
    (progressionQuery.isLoading && !progressionQuery.data) ||
    (rulesQuery.isLoading && !rulesQuery.data);

  // Match: keep-alive (hidden when not active) so nav does not remount / flicker.
  // Shell stays mounted underneath the same way tournaments keep the rail alive.
  const matchKeepAlive = (
    <div
      className={cn("min-h-0 w-full flex-1", showMatchmakingPage ? "flex" : "hidden")}
      aria-hidden={!showMatchmakingPage}
    >
      <MatchmakingPage />
    </div>
  );

  // Browse-away: same-render unmount for embedded AI (leave-pause); resume URL uses keep-alive.
  const leavePlayBrowse =
    publicView === "tournaments" || publicView === "events" || showMatchmakingPage;
  const embedAiActive = Boolean(aiLive && !leavePlayBrowse && !playBoardVisible);
  // Play + Spectate: hide instead of unmount (matchmaking keep-alive parity).
  const showPlayKeepAlive = playBoardLatched && !embedAiActive;
  const boardsKeepAlive = (
    <>
      {showPlayKeepAlive ? (
        <div
          className={cn("min-h-0 w-full flex-1", !playBoardVisible && "hidden")}
          aria-hidden={!playBoardVisible}
        >
          <LivePlayHub
            fillHeight
            forceGameId={keepPlayGameId || null}
            surfaceActive={playBoardVisible}
            onExitToLobby={clearPlayBoardLatch}
          />
        </div>
      ) : null}
      {spectateLatched ? (
        <div
          className={cn("min-h-0 w-full flex-1", !spectateVisible && "hidden")}
          aria-hidden={!spectateVisible}
        >
          <Suspense fallback={null}>
            <SpectateHub fillHeight />
          </Suspense>
        </div>
      ) : null}
    </>
  );

  // Board/spectate: keep boards + match mounted; fall through so lobby can stay warm below
  // (hidden) once chrome is ready - never unmount lobby on every board enter/leave.
  if (publicView === "leaderboard" && !playBoardVisible && !spectateVisible) {
    return (
      <>
        {boardsKeepAlive}
        <Suspense fallback={<LeaderboardPageSkeleton />}>
          <LeaderboardPage />
        </Suspense>
      </>
    );
  }

  if (publicView === "status" && !playBoardVisible && !spectateVisible) {
    return (
      <>
        {boardsKeepAlive}
        <Suspense fallback={<PlatformStatsPageSkeleton />}>
          <PlatformStatsPage />
        </Suspense>
      </>
    );
  }

  // Never cover a keep-alive board/spectate with lobby PlayHubSkeleton.
  if (loading && !showMatchmakingPage && !playBoardVisible && !spectateVisible) {
    if (centerBrowse) {
      return (
        <>
          {boardsKeepAlive}
          {matchKeepAlive}
          <TournamentsPlayHubSkeleton
            // Legacy view=events redirects to Community; same Tournament skeleton.
            center={<TournamentsHubSkeleton count={6} />}
          />
        </>
      );
    }
    return (
      <>
        {boardsKeepAlive}
        {matchKeepAlive}
        <PlayHubSkeleton />
      </>
    );
  }

  if (!play || !railChrome) {
    const unavailable =
      (railChromeQuery.data?.play_rail_chrome_unavailable || "").trim() ||
      (playQuery.data?.play_chrome_unavailable || "").trim() ||
      (playQuery.error instanceof Error ? playQuery.error.message : "").trim() ||
      (railChromeQuery.error instanceof Error ? railChromeQuery.error.message : "").trim();
    // Match can paint from its own chrome while play chrome is still resolving.
    if (showMatchmakingPage || playBoardVisible || spectateVisible) {
      return (
        <>
          {boardsKeepAlive}
          {matchKeepAlive}
        </>
      );
    }
    return (
      <>
        {boardsKeepAlive}
        {matchKeepAlive}
        {unavailable ? (
          <p className="text-center text-sm text-[var(--dama-danger)]">{unavailable}</p>
        ) : null}
      </>
    );
  }

  const depthPrefix = (play.depth_option_prefix || play.practice_depth_label || "").trim();
  const loginHref = resolveLoginPath(providersQuery.data);

  // Guests: seat titles follow the active piece palette (Ivory/Burgundy…), not chrome White/Black.
  const guestSeats = pieceSeatNames(piecePalette);
  const opponent = signedIn ? (play.label_black || "").trim() : guestSeats.dark;
  const player = signedIn ? (play.label_white || "").trim() : guestSeats.light;

  const boardViewToggle = (orientation: "vertical" | "horizontal") => (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] p-0.5",
        orientation === "vertical" ? "w-full flex-col gap-0.5" : "flex-row gap-0.5",
      )}
      // biome-ignore lint/a11y/useSemanticElements: segmented toolbar toggle
      role="group"
      aria-label={railChrome.board_view_2d}
    >
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-[5px] font-semibold",
          orientation === "vertical"
            ? "px-1.5 py-1.5 text-[11px] sm:text-xs"
            : "px-2.5 py-1.5 text-xs",
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
          "inline-flex items-center justify-center gap-1 rounded-[5px] font-semibold",
          orientation === "vertical"
            ? "px-1.5 py-1.5 text-[11px] sm:text-xs"
            : "px-2.5 py-1.5 text-xs",
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
  );

  const colorsBlock = (
    <BoardColorsPopover
      open={colorsOpen}
      onOpenChange={setColorsOpen}
      triggerId="home-colors"
      colorsLabel={railChrome.label_colors}
      boardLabel={railChrome.label_board}
      piecesLabel={railChrome.label_pieces}
    />
  );

  const renderShell = (live: LivePlayEmbedApi | null) => {
    const liveActive = Boolean(live && (live.game || live.bootstrapping || live.phase !== "menu"));
    const topLabel = liveActive ? live?.opponentName : opponent;
    const bottomLabel = liveActive ? live?.yourName : player;
    const topClock = liveActive
      ? (live?.opponentSeatClock ?? live?.seatClock)
      : clockLabel || undefined;
    const bottomClock = liveActive ? live?.seatClock : clockLabel || undefined;
    // Live boot without seat names yet: full column skeleton (never bare board = old flash).
    const liveBoardPending =
      liveActive &&
      Boolean(live?.bootstrapping || live?.busy || live?.phase === "menu" || !live?.game);

    const isPlayBoard = !centerBrowse;

    const playRailInner = (
      <>
        <div className="border-b border-[var(--dama-border)] px-3 py-3">
          <GeoAdSlot />
        </div>
        {/* Frozen main tabs (all breakpoints); body scrolls in PlayRailScrollPort. */}
        <div
          className={cn(playRailStickyMainClass, "grid grid-cols-3")}
          data-dama-rail-main=""
          role="tablist"
          aria-label={panelTitle || play.page_title}
        >
          {(
            [
              { id: "new" as const, label: railChrome.tab_new_game, icon: Plus },
              { id: "games" as const, label: railChrome.tab_games, icon: Grid3X3 },
              { id: "players" as const, label: railChrome.tab_players, icon: Users },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={railTab === t.id}
              disabled={liveActive && t.id !== "new"}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-center text-[10px] font-semibold sm:gap-1 sm:px-2 sm:text-xs",
                railTab === t.id
                  ? "bg-[var(--dama-surface)]/80 text-[var(--dama-text)] shadow-[inset_0_-2px_0_0_var(--dama-text)]"
                  : "text-[var(--dama-muted-foreground)] hover:text-[var(--dama-text)]",
                liveActive && t.id !== "new" && "pointer-events-none opacity-40",
              )}
              onClick={() => setRail(t.id)}
            >
              <t.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Keep-mounted slots: inactive = hidden. Immersive !flex must NOT apply to
              inactive slots - it would override `hidden` on max-lg and stack every panel. */}
        <div
          className={cn(playRailPanelStackClass, immersiveChat && playRailImmersiveChatFillClass)}
        >
          <div
            className={cn(
              playRailPanelSlotClass,
              immersiveChat && (railTab === "new" || liveActive) && playRailImmersiveChatFillClass,
              railTab === "new" || liveActive ? "z-10" : "hidden",
            )}
            aria-hidden={!(railTab === "new" || liveActive)}
          >
            <NewGamePanel
              chrome={railChrome}
              sub={newSub}
              onSubChange={setNewSub}
              clockSeconds={clockSeconds || undefined}
              timeControlPresets={timeControlPresets}
              timeControlsLoading={progressionQuery.isLoading || progressionQuery.isFetching}
              liveActive={liveActive}
              liveNodes={
                liveActive && live
                  ? {
                      resultNode: live.resultNode,
                      historyNode: live.historyNode,
                      metaNode: live.metaNode,
                      stopLabel: live.stopLabel,
                      stopPending: live.stopPending,
                      stopPendingLabel: live.stopPendingLabel,
                      openStopConfirm: live.phase === "playing" ? live.openStopConfirm : undefined,
                      paused: Boolean(live.game?.paused),
                      pauseLabel: live.pauseLabel,
                      pausePending: live.pausePending,
                      pausePendingLabel: live.pausePendingLabel,
                      onPause: live.phase === "playing" ? live.onPause : undefined,
                      resumeLabel: live.resumeLabel,
                      resumePending: live.resumePending,
                      resumePendingLabel: live.resumePendingLabel,
                      onResume: live.phase === "playing" ? live.onResume : undefined,
                      pausedBlurb: live.pausedBlurb,
                      pauseRemainingMs: live.pauseRemainingMs,
                      pauseExpiresAtUnixMs: live.pauseExpiresAtUnixMs,
                      pauseRemainingFmt: live.pauseRemainingFmt,
                      officialPauseBannerLines: live.officialPauseBannerLines,
                      practiceBlurb: live.practiceBlurb,
                    }
                  : undefined
              }
              vsAi={vsAi}
              aiLabel={aiLabel || play.play_computer_action}
              practiceBlurb={(live?.practiceBlurb || play.practice_blurb || "").trim()}
              practiceUnavailable={(
                play.practice_unavailable ||
                play.practice_unavailable_short ||
                ""
              ).trim()}
              depths={depths}
              activeDepth={activeDepth}
              depthPrefix={depthPrefix}
              onDepthChange={setDepth}
              startAiBusy={startAiBusy}
              startAiPendingLabel={(play.practice_start_pending || "").trim()}
              onStartAi={(timeControlSeconds) => {
                void (async () => {
                  setStartAiBusy(true);
                  try {
                    if (!(timeControlSeconds > 0)) {
                      toast.error((railChrome.toast_time_control_unavailable || "").trim());
                      return;
                    }
                    if (!token) {
                      const guest = await ensurePracticeToken();
                      if (!guest) {
                        toast.error((play.toast_start_failed || "").trim());
                        return;
                      }
                    }
                    // Leave tournaments/events/match browse so the Play board is visible.
                    setPlayRailSheetOpen(false);
                    setShowTournaments(false);
                    setRailTab("new");
                    setNewSub("ai");
                    if (
                      publicView === "tournaments" ||
                      publicView === "events" ||
                      publicView === "match"
                    ) {
                      router.replace("/", { scroll: false });
                    }
                    setAiLive({ depth: activeDepth, timeControlSeconds });
                  } finally {
                    setStartAiBusy(false);
                  }
                })();
              }}
              colorsBlock={colorsBlock}
              signedIn={signedIn}
              matchLabel={matchLabel}
              matchBlurb={(mm?.blurb || play.pvp_blurb || "").trim()}
              challengeOpponent={challengeOpponent}
              onClearChallengeOpponent={() => {
                try {
                  sessionStorage.removeItem("dama.create.opponent");
                } catch {
                  /* ignore */
                }
                setChallengeOpponent(null);
              }}
              loginHref={loginHref}
            />
          </div>

          <div
            className={cn(
              playRailPanelSlotClass,
              immersiveChat && railTab === "games" && !liveActive && playRailImmersiveChatFillClass,
              railTab === "games" && !liveActive ? "z-10" : "hidden",
            )}
            aria-hidden={railTab !== "games" || liveActive}
          >
            <GamesPanel
              chrome={railChrome}
              signedIn={signedIn}
              active={railTab === "games" && !liveActive}
              onWatch={openWatch}
              onOpenMatch={openMatch}
              onChallenge={openChallenge}
              timeControlLabel={timeControlLabel}
            />
          </div>

          <div
            className={cn(
              playRailPanelSlotClass,
              immersiveChat &&
                railTab === "players" &&
                !liveActive &&
                playRailImmersiveChatFillClass,
              railTab === "players" && !liveActive ? "z-10" : "hidden",
            )}
            aria-hidden={railTab !== "players" || liveActive}
          >
            <PlayersPanel
              chrome={railChrome}
              signedIn={signedIn}
              active={railTab === "players" && !liveActive}
              onChallenge={openChallenge}
              onWatch={openWatch}
              initialSub={playersSub}
              initialDmRequestId={dmDeepLink.dm}
              initialDmThreadId={dmDeepLink.thread}
            />
          </div>
        </div>

        {/* Bell/theme/user live in marketing PlayerMobileChrome (persistent all breakpoints). */}
      </>
    );

    return (
      <>
        <div
          className={cn(
            "grid w-full flex-1 items-stretch gap-3",
            // Desktop (and play board on any size): board + rail columns.
            // Compact tournaments browse: center column only; rail opens from FAB.
            !compactPlayRail && "lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:gap-4",
            // Fill locked home shell on play; tournaments/events scroll inside the center column.
            playHubFillHeightClass,
            isPlayBoard && mobilePlayBoardColumnClass,
          )}
        >
          <div
            className={cn(
              "dama-home-board-enter order-1 flex min-h-0 min-w-0 flex-col overflow-hidden lg:order-none",
              centerBrowse
                ? "justify-start pt-1"
                : // Phone/tablet: definite height budget so measure cannot shrink-loop; rail scrolls below.
                  cn(
                    mobilePlayBoardMaxHeightClass,
                    "lg:h-full lg:min-h-0 lg:flex-1 lg:justify-center",
                  ),
            )}
          >
            {centerBrowse ? (
              <CompetitionTournamentsHub
                onEnrollTournament={onEnrollTournament}
                onOpenOfficialLobby={(id) => cupLobby.openWith(id)}
                localEnrolledIds={localEnrolledIds}
              />
            ) : liveBoardPending ? (
              <BoardColumnSkeleton showTopTrailing bottomClockActive={false} />
            ) : (
              <PlayBoardColumn
                desktopHeader={
                  topLabel ? (
                    <BoardSeatBar
                      label={topLabel}
                      hint={liveActive ? live?.oppTurnHint : undefined}
                      rating={liveActive ? live?.opponentRating : undefined}
                      ratingParenOpen={railChrome.rating_paren_open}
                      ratingParenClose={railChrome.rating_paren_close}
                      clock={topClock}
                      tone="muted"
                      clockActive={Boolean(
                        liveActive &&
                          live?.phase === "playing" &&
                          (live?.yourClockActive != null
                            ? live.yourClockActive === false
                            : live?.isYourTurn === false),
                      )}
                      captures={liveActive ? live?.opponentCaptures : undefined}
                      pieceSide={liveActive && live?.yourPlayer === 2 ? "light" : "dark"}
                      online={liveActive ? live?.opponentOnline : undefined}
                      playing={liveActive ? live?.opponentPlaying : undefined}
                      avatarThumbUrl={liveActive ? live?.opponentAvatarThumbUrl : undefined}
                      countryCode={liveActive ? live?.opponentCountryCode : undefined}
                      trailing={
                        liveActive && live?.boardControls
                          ? live.boardControls
                          : boardViewToggle("horizontal")
                      }
                      hoverPlayer={liveActive ? live?.opponentHoverPlayer : null}
                      railChrome={railChrome}
                      signedIn={signedIn}
                    />
                  ) : (
                    <div className="flex w-full justify-end">{boardViewToggle("horizontal")}</div>
                  )
                }
                desktopFooter={
                  bottomLabel ? (
                    <BoardSeatBar
                      label={bottomLabel}
                      hint={liveActive ? live?.yourTurnHint || undefined : undefined}
                      rating={liveActive ? live?.yourRating : undefined}
                      ratingParenOpen={railChrome.rating_paren_open}
                      ratingParenClose={railChrome.rating_paren_close}
                      clock={bottomClock}
                      tone="muted"
                      clockActive={Boolean(
                        liveActive &&
                          live?.phase === "playing" &&
                          (live?.yourClockActive != null
                            ? live.yourClockActive === true
                            : Boolean(live?.isYourTurn)),
                      )}
                      captures={liveActive ? live?.yourCaptures : undefined}
                      pieceSide={liveActive && live?.yourPlayer === 2 ? "dark" : "light"}
                      online={liveActive ? live?.yourOnline : undefined}
                      playing={liveActive ? live?.yourPlaying : undefined}
                      avatarThumbUrl={liveActive ? live?.yourAvatarThumbUrl : undefined}
                      countryCode={liveActive ? live?.yourCountryCode : undefined}
                      hoverPlayer={liveActive ? live?.yourHoverPlayer : null}
                      railChrome={railChrome}
                      signedIn={signedIn}
                    />
                  ) : null
                }
                board={
                  liveActive && live ? (
                    live.boardNode
                  ) : boardView === "2d" ? (
                    <HomePreviewBoard opponentLabel="" playerLabel="" clockLabel="" />
                  ) : previewBoard.length > 0 ? (
                    <DraughtsScene3D
                      board={previewBoard}
                      legalMoves={[]}
                      selected={null}
                      onSelectSquare={() => {}}
                      interactive={false}
                      mustContinue={null}
                      flipBoard={false}
                      moveHistory={[]}
                      yourPlayer={1}
                      replayMode
                    />
                  ) : (
                    <BoardAreaSkeleton />
                  )
                }
                coverOverlay={liveActive ? live?.boardCoverOverlay : undefined}
              />
            )}
          </div>

          {!compactPlayRail ? <PlayRailAside>{playRailInner}</PlayRailAside> : null}
        </div>

        {compactPlayRail ? (
          <>
            <Sheet open={playRailSheetOpen} onOpenChange={setPlayRailSheetOpen}>
              <SheetContent
                side="right"
                className="w-[min(100%,440px)] max-w-[100vw] p-0 sm:max-w-[440px]"
                closeLabel={panelTitle || undefined}
              >
                <SheetTitle className="sr-only">{panelTitle || play.page_title}</SheetTitle>
                <PlayRailAside className="h-full max-h-full min-h-0 flex-1 border-0">
                  {playRailInner}
                </PlayRailAside>
              </SheetContent>
            </Sheet>
            {panelTitle ? (
              <div
                className="pointer-events-none fixed left-4 z-40 flex flex-col items-start gap-1 lg:hidden"
                style={{
                  bottom:
                    "calc(var(--dama-bottom-nav-height, 0px) + 0.75rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <Button
                  type="button"
                  variant="play"
                  className="pointer-events-auto h-12 rounded-full px-4 shadow-lg"
                  aria-label={panelTitle}
                  onClick={() => setPlayRailSheetOpen(true)}
                >
                  <Layers className="h-4 w-4 shrink-0" aria-hidden />
                  {panelTitle}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </>
    );
  };

  // Keep MatchmakingPage + play shell both mounted; toggle visibility only.
  // Remounting on every `/?view=match` nav was the flicker vs tournaments (center swap only).
  // Embedded AI unmounts on tournaments/events/matchmaking same-render; resume boards stay latched.
  // Lobby stays mounted (hidden) under board/spectate so Play nav-back never remount-shimmers.
  const lobbySurfaceVisible =
    !playBoardVisible && !spectateVisible && !showMatchmakingPage && !embedAiActive;

  if (embedAiActive && aiLive) {
    return (
      <>
        {boardsKeepAlive}
        {matchKeepAlive}
        <div
          className={cn("min-h-0 w-full flex-1", showMatchmakingPage && "hidden")}
          aria-hidden={showMatchmakingPage}
        >
          <LivePlayHub
            embed={{
              mode: "ai",
              depth: aiLive.depth,
              timeControlSeconds: aiLive.timeControlSeconds,
            }}
            onExitToLobby={clearPlayBoardLatch}
            renderEmbedded={(live) => renderShell(live)}
            fillHeight
          />
        </div>
      </>
    );
  }

  const cupLobbyOpenId = (cupLobby.selectedId || "").trim();
  const cupLobbyEnrolled =
    localEnrolledIds.has(cupLobbyOpenId) ||
    tournaments.find((t) => t.id === cupLobbyOpenId)?.viewer_enrolled === true;

  return (
    <>
      {boardsKeepAlive}
      {matchKeepAlive}
      <div
        className={cn("min-h-0 w-full flex-1", !lobbySurfaceVisible && "hidden")}
        aria-hidden={!lobbySurfaceVisible}
      >
        {renderShell(null)}
      </div>
      <TournamentCupLobby
        open={cupLobby.open}
        tournamentId={cupLobbyOpenId || null}
        chromeRaw={tournamentsChromeQuery.data}
        viewerEnrolled={cupLobbyEnrolled}
        onOpenChange={(next) => {
          if (next) {
            cupLobby.onOpenChange(true);
            return;
          }
          closeCupLobby();
        }}
      />
    </>
  );
}
