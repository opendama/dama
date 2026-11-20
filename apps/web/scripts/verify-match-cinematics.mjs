import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(__dirname, "..");
const dama = path.join(web, "..");
const fails = [];
const must = (cond, msg) => {
  if (!cond) fails.push(msg);
};
const read = (p) => fs.readFileSync(p, "utf8");

const hub = read(path.join(web, "src/components/play/LivePlayHub.tsx"));
must(hub.includes("MatchIntroOverlay"), "hub missing MatchIntroOverlay");
must(hub.includes("MatchPauseOverlay"), "hub missing MatchPauseOverlay");
must(hub.includes("buildPauseOverlayCopy"), "hub missing buildPauseOverlayCopy");
must(hub.includes("MatchResultOverlay"), "hub missing MatchResultOverlay");
must(hub.includes('mode !== "pvp" && mode !== "ai"'), "hub mode gate");
must(hub.includes('playGameNotify("game_start")'), "hub game_start");
must(hub.includes("fireGameVictoryCelebration"), "hub victory");
must(hub.includes("fireGameDefeatPulse"), "hub defeat");
must(hub.includes('playGameNotify("win")'), "hub win sfx");
must(hub.includes('playGameNotify("loss")'), "hub loss sfx");
must(hub.includes("boardNode"), "hub boardNode hosts overlays");
must(
  hub.indexOf("Must stay above chrome/token early-returns") <
    hub.indexOf("if (chromeQuery.isLoading && !chrome)"),
  "intro useEffect must be above chrome early-return (Rules of Hooks)",
);

const pc = read(path.join(web, "src/types/play-chrome.ts"));
const pr = read(path.join(web, "src/types/play-rail-chrome.ts"));
for (const k of [
  "match_intro_starting_label",
  "match_result_duration_ms",
  "match_result_win_aria",
  "match_result_loss_aria",
  "match_result_draw_aria",
]) {
  must(pc.includes(k), `play-chrome missing ${k}`);
  must(pr.includes(k), `play-rail missing ${k}`);
}
for (const k of [
  "you_won_on_time_message",
  "you_lost_on_time_message",
  "you_drew_on_time_message",
  "match_result_win_on_time_aria",
  "match_result_loss_on_time_aria",
  "match_result_draw_on_time_aria",
]) {
  must(pc.includes(k), `play-chrome missing ${k}`);
  must(pc.includes(`"${k}"`), `play-chrome KEYS missing ${k}`);
}
must(hub.includes('end_reason === "clock_flag"'), "hub clock_flag outcome branch");
must(hub.includes("you_won_on_time_message"), "hub on-time win copy");
must(
  hub.includes("Land-animation grace: reuse on-time statusText"),
  "hub statusText on-time during grace",
);
must(
  hub.includes("Clock endings (incl. pre-finished grace)"),
  "hub statusText clock endings use on-time DB copy",
);
const gameOutcome = read(path.join(web, "src/lib/gameOutcome.ts"));
must(
  gameOutcome.includes('endReason === "clock_flag"') ||
    gameOutcome.includes('endReason === "clock_flag" || endReason === "clock_draw"'),
  "withResolvedOutcome skips wipe on clock endings",
);
const boardMerge = read(path.join(web, "src/lib/gameBoardStateMerge.ts"));
must(
  boardMerge.includes("incoming.end_reason ?? previous.end_reason"),
  "board merge preserves end_reason for on-time framing",
);
const mig438 = read(path.join(dama, "api/migrations/438_clock_flag_on_time_chrome.sql"));
must(mig438.includes("you_won_on_time_message"), "mig 438 you_won_on_time");

const sql = read(path.join(dama, "api/migrations/154_match_cinematic_chrome.sql"));
must(sql.includes("match_intro_starting_label"), "mig starting");
must(sql.includes("match_result_duration_ms"), "mig result duration");
must(sql.includes("play_rail_chrome"), "mig rail");
must(sql.includes("play_chrome"), "mig play");

must(fs.statSync(path.join(web, "public/sounds/game-start.mp3")).size > 1000, "web game-start.mp3");
must(
  fs.statSync(path.join(dama, "mobile/assets/sounds/game-start.mp3")).size > 1000,
  "mobile game-start.mp3",
);

const mb = read(path.join(dama, "mobile/lib/features/game/match_board_page.dart"));
must(mb.includes("MatchIntroOverlay"), "flutter intro");
must(mb.includes("MatchPauseOverlay"), "flutter pause overlay");
must(mb.includes("gamePausedBlurb"), "flutter player pause banner blurb");
must(mb.includes("officialPausedBlurb"), "flutter official pause banner blurb");
must(mb.includes("MatchResultOverlay"), "flutter result");
must(mb.includes("widget.mode == 'pvp' || widget.mode == 'ai'"), "flutter mode gate");
must(mb.includes("GameNotify.play('game_start')"), "flutter game_start");
must(mb.includes("GameNotify.play(youWon ? 'win' : 'loss')"), "flutter win/loss");
must(mb.includes("youWonOnTimeMessage"), "flutter on-time win copy");
must(mb.includes("_endReason"), "flutter persists endReason");

const pauseCopy = read(path.join(web, "src/lib/official-pause-display.ts"));
must(pauseCopy.includes("buildPauseOverlayCopy"), "pause copy helper");
must(pauseCopy.includes("game_paused_blurb"), "pause copy player banner");
must(pauseCopy.includes("official_paused_blurb"), "pause copy official banner");
must(pauseCopy.includes("pause_remaining_fmt"), "pause copy player countdown fmt");
must(
  pauseCopy.includes("Official only: player pause uses countdown footer"),
  "pause copy gates wall-clock since to official",
);

const spectate = read(path.join(web, "src/components/spectate/SpectateHub.tsx"));
must(spectate.includes("MatchPauseOverlay"), "spectate MatchPauseOverlay");
must(spectate.includes("buildPauseOverlayCopy"), "spectate buildPauseOverlayCopy");
must(spectate.includes("game_paused_blurb"), "spectate player pause rail fallback blurb");

must(pc.includes("game_paused_blurb"), "play-chrome missing game_paused_blurb");
must(pc.includes('"game_paused_blurb"'), "play-chrome KEYS missing game_paused_blurb");
must(pc.includes("official_paused_blurb"), "play-chrome missing official_paused_blurb");
must(pc.includes('"official_paused_blurb"'), "play-chrome KEYS missing official_paused_blurb");
must(pc.includes("pause_overlay_aria"), "play-chrome missing pause_overlay_aria");
must(pc.includes('"pause_overlay_aria"'), "play-chrome KEYS missing pause_overlay_aria");

const flutterPlayChrome = read(path.join(dama, "mobile/lib/core/types/play_chrome.dart"));
must(
  flutterPlayChrome.includes("gamePausedBlurb.isNotEmpty"),
  "flutter play chrome ready requires gamePausedBlurb",
);

const rail = read(path.join(dama, "mobile/lib/core/types/play_rail_chrome.dart"));
must(rail.includes("matchIntroStartingLabel.isNotEmpty"), "flutter rail requires starting");
must(rail.includes("matchResultDurationMs.isNotEmpty"), "flutter rail requires result duration");

const home = read(path.join(web, "src/components/home/HomePlayHub.tsx"));
must(home.includes("<LivePlayHub"), "home uses LivePlayHub");
must(home.includes('embed={{ mode: "ai"'), "home AI embed");
must(home.includes("showResumeLive"), "home pvp resume");

for (const e of [
  "mobile/lib/features/home/home_page.dart",
  "mobile/lib/features/game/matchmaking_page.dart",
  "mobile/lib/features/game/matchmaking_realtime.dart",
  "mobile/lib/features/notifications/notification_href_nav.dart",
  "mobile/lib/features/home/play_rail_panel.dart",
]) {
  must(read(path.join(dama, e)).includes("MatchBoardPage"), `${e} opens MatchBoardPage`);
}

if (fails.length) {
  console.error(`FAIL\n${fails.join("\n")}`);
  process.exit(1);
}
console.log(
  "PASS: cinematic wiring - AI+PvP web LivePlayHub; MatchPauseOverlay parity (official+player banners); spectate pause cover; HomePlayHub AI embed + PvP resume; Flutter MatchBoardPage + all openers; chrome keys + migration 154; game-start assets",
);
