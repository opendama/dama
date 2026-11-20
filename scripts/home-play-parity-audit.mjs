/**
 * Fail-closed: Home=Play / Dashboard=ops checklist (web + Flutter + migration).
 * Run: node scripts/home-play-parity-audit.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fails = [];
const ok = [];

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else fails.push(msg);
}

const landing = read("apps/web/src/app/(marketing)/page.tsx");
const hub = read("apps/web/src/components/home/HomePlayHub.tsx");
const dash = read("apps/web/src/app/(player)/dashboard/page.tsx");
const layout = read("apps/web/src/app/(player)/layout.tsx");
const mktLayout = read("apps/web/src/app/(marketing)/layout.tsx");
const flutterHome = read("apps/mobile/lib/features/home/home_page.dart");
const playPage = read("apps/web/src/app/(player)/play/page.tsx");
const mig = "apps/api/migrations/092_home_play_dashboard_ops.sql";

assert(landing.includes("HomePlayHub"), "web /: HomePlayHub");
assert(!landing.includes("explore.flatMap"), "web /: no marketing CTA spam hero");
assert(hub.includes('PlayTab = "ai"') || hub.includes('"ai" | "match"'), "web hub: AI|Match tabs");
assert(hub.includes('"tournaments"'), "web hub: tournaments mode");
assert(hub.includes('htmlFor="home-colors"') || hub.includes("Colors"), "web hub: colors dropdown");
assert(hub.includes("usePiecePalette"), "web hub: piece palette hook");
assert(
  hub.includes("BOARD_PALETTES") && hub.includes("PIECE_PALETTES"),
  "web hub: board+piece in colors",
);
assert(!hub.includes("Trophy"), "web hub: no right-rail Tournaments button");
assert(
  hub.includes("view=tournaments") || hub.includes('setPlayView("tournaments")'),
  "web hub: left-nav tournaments view",
);
assert(hub.includes('tab === "tournaments" ? "justify-start'), "web hub: tournaments top-aligned");
assert(hub.includes("640px"), "web hub: board max width");
assert(
  read("apps/web/src/lib/player-nav.ts").includes("/?view=tournaments"),
  "web: left nav tournaments → home view",
);
assert(
  read("apps/web/src/lib/player-nav.ts").includes('key === "play") return "/"'),
  "web: left nav play → home hub /",
);
assert(
  read("apps/web/src/lib/player-nav.ts").includes("filterPlayerNavLinks"),
  "web: drop duplicate Home when Play present",
);
assert(
  existsSync(join(root, "apps/web/src/components/play/LivePlayHub.tsx")),
  "web: LivePlayHub on home",
);
assert(
  existsSync(join(root, "apps/api/migrations/095_play_nav_home_shell.sql")),
  "migration 095 play nav home",
);
assert(
  existsSync(join(root, "apps/api/migrations/096_public_nav_home_views.sql")),
  "migration 096 public nav home views",
);
assert(
  read("apps/web/src/lib/player-nav.ts").includes("OPS_ROUTE_KEYS"),
  "web: ops routes filtered from public rail",
);
assert(
  read("apps/web/src/lib/session-bounce.ts").includes("isPublicGuestPath"),
  "web: no login bounce on public paths",
);
assert(
  read("apps/web/src/lib/player-shell-ui.ts").includes("grid-cols-2") &&
    read("apps/web/src/lib/player-shell-ui.ts").includes("lg:grid-cols-4"),
  "web: Airbnb tournament grid density",
);
assert(
  read("apps/web/src/components/tournaments/TournamentMiniCard.tsx").includes("aspect-square"),
  "web: Airbnb square tournament media",
);
assert(hub.includes("grid-cols-2"), "web hub: AI|Match tabs only (no Tournaments tab)");
assert(hub.includes("DraughtsScene3D"), "web hub: 3D board restored");
assert(!hub.includes("border-4"), "web hub: no board frame border");
assert(!hub.includes("rounded-xl border"), "web hub: no rail card border");
assert(hub.includes("useRestFeatureFlagsQuery"), "web hub: REST feature flags");
assert(hub.includes("TournamentMiniCard"), "web hub: tournaments in center");
assert(hub.includes("play_computer_action"), "web hub: AI label from play_chrome");
assert(hub.includes("SignInLink"), "web hub: match soft-gate sign-in");
assert(hub.includes("lg:grid-cols-"), "web hub: board|modes two-column");
assert(hub.includes('role="tablist"'), "web hub: tablist rail");
assert(landing.includes("HomePlayHub"), "web /: hub mounted");
const preview = read("apps/web/src/components/home/HomePreviewBoard.tsx");
assert(!preview.includes("border-4"), "web preview board: no frame border");
const flagsCubit = read("apps/mobile/lib/features/game/cubit/feature_flags_cubit.dart");
assert(flagsCubit.includes("/feature-flags"), "flutter flags: REST /feature-flags");
assert(!flagsCubit.includes("GraphqlClient"), "flutter flags: not GraphQL-only");

const liveHub = read("apps/web/src/components/play/LivePlayHub.tsx");
assert(liveHub.includes("ensurePracticeToken"), "web play: guest practice token");
assert(liveHub.includes("effectiveToken"), "web play: effectiveToken for AI");
assert(liveHub.includes("isAiMode"), "web play: AI free without account gate");
assert(
  liveHub.includes("lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"),
  "web live: board|rail same as home",
);
assert(liveHub.includes("LiveSeatBar"), "web live: top/bottom seat bars");
assert(hub.includes("showResumeLive"), "web hub: LivePlayHub only for PvP resume");
assert(hub.includes("renderShell"), "web hub: lobby shell shared for live AI");
assert(hub.includes("setAiLive"), "web hub: AI start in-place on /");
assert(hub.includes("renderEmbedded"), "web hub: AI keeps lobby shell via renderEmbedded");
assert(hub.includes("colorsBlock"), "web hub: Colors stay mounted during live AI");

assert(existsSync(join(root, "apps/api/internal/rest/auth_handlers.go")), "api auth handlers");
assert(
  read("apps/api/internal/rest/auth_handlers.go").includes("GuestSession"),
  "api: GuestSession",
);
assert(read("apps/api/cmd/server/main.go").includes("/auth/guest"), "api: /auth/guest route");

assert(dash.includes("OPS_PANEL_KEYS"), "dashboard: ops panel allowlist");
assert(dash.includes("useMyMatchesQuery"), "dashboard: play history");
assert(!dash.includes("TournamentMiniCard"), "dashboard: no tournament carousel");
assert(layout.includes("requiresAuth"), "player layout: selective auth");
assert(layout.includes('pathname === "/dashboard"'), "player layout: dashboard gated");

assert(!mktLayout.includes("ClientSurfaceNav"), "marketing header: no top menus");
assert(!mktLayout.includes("ThemeToggle"), "marketing: no top ThemeToggle");
assert(!mktLayout.includes("<header"), "marketing: no top header bar");
assert(mktLayout.includes("PlayerDesktopRail"), "marketing: Chess.com left rail");
assert(mktLayout.includes("marketingLinks"), "marketing footer: Player/Play/Wallet/Ads");
assert(hub.includes("useBoardViewMode"), "web hub: 2D/3D board view");
assert(hub.includes("HomePreviewBoard"), "web hub: 2D default board");
assert(hub.includes("SelectTrigger"), "web hub: shadCN Select (not native)");
assert(!hub.includes("<select"), "web hub: no native select");
assert(hub.includes("ThemeToggle"), "web hub: theme in right rail");
assert(
  !/Find 1v1 match[\s\S]*Tournaments[\s\S]*Play against computer[\s\S]*Find 1v1/.test(hub) ||
    !hub.includes('onClick={() => setTab("tournaments")}'),
  "web hub: no duplicate mode CTAs under AI",
);

assert(flutterHome.includes("_HomePlayHub"), "flutter home: Play hub");
assert(flutterHome.includes("SegmentedButton"), "flutter home: AI|Match segments");
assert(flutterHome.includes("ensurePracticeToken"), "flutter home: free AI practice token");
assert(!flutterHome.includes("onTab(2)"), "flutter home: no right-rail tournaments button");
assert(flutterHome.includes("ExpansionTile"), "flutter home: colors dropdown");
assert(flutterHome.includes("board_palette_prefs"), "flutter home: board palette prefs import");
assert(
  existsSync(join(root, "apps/api/migrations/094_home_rail_public_nav.sql")),
  "migration 094 home rail",
);
assert(
  existsSync(join(root, "apps/mobile/lib/core/prefs/board_palette_prefs.dart")),
  "flutter: board_palette_prefs",
);
assert(flutterHome.includes("_liveAiToken"), "flutter home: AI in-place (no push)");
assert(flutterHome.includes("onClose:"), "flutter home: MatchBoardPage embed exit");
assert(flutterHome.includes("MatchBoardPage"), "flutter home: AI → board");
assert(flutterHome.includes("MatchmakingPage"), "flutter home: Match → queue");
assert(
  flutterHome.includes("DashboardPage(accessToken: dashToken)"),
  "flutter: Player footer → dashboard ops",
);
const flutterShell = read("apps/mobile/lib/features/home/player_shell.dart");
assert(
  flutterShell.includes("return DashboardPage(accessToken: token);"),
  "flutter shell: dashboard tab → ops hub",
);
assert(
  existsSync(join(root, "apps/mobile/lib/features/auth/practice_token.dart")),
  "flutter: practice_token",
);

assert(existsSync(join(root, mig)), "migration 092 present");
const migSql = read(mig);
assert(migSql.includes("dashboard_history_title"), "092: history chrome keys");
const mig093 = "apps/api/migrations/093_bottom_nav_home_play_prune.sql";
assert(existsSync(join(root, mig093)), "migration 093 present");

console.log(`PASS ${ok.length}`);
for (const m of ok) console.log(`  ✓ ${m}`);
if (fails.length) {
  console.error(`FAIL ${fails.length}`);
  for (const m of fails) console.error(`  ✗ ${m}`);
  process.exit(1);
}
console.log("home-play-parity-audit: OK");
