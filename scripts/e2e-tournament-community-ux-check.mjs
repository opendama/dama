/**
 * E2E: Tournament Official|Community UX (mig 376–414) - chrome, share, nav, wallet, points, QR prefix, refunds legal,
 * marketing footer Tournaments guest browse (mig 408), 045/184/187–194/201/236/409–414 seed no Event-sport mid-migrate,
 * player.event_* notif titles (no Event sport), report_title Tournament,
 * Official+Community shared standings_points_label / toast_points_awarded_fmt,
 * public_disabled fail-closed (web+Flutter+Go), join-error unmapped API scrub,
 * carousel/code/roster soft fail-open + Flutter tournaments chrome catch,
 * cup-lobby err softs (web+Flutter) + spectate activity softSpectate* (mig 394),
 * cup-lobby roster/success/check-in + arena standings/streak softs,
 * Flutter bracket SpectatePage parity + est-prize-share / ready waiting softs.
 * Player kick/cancel/reopen/auto_closed/finished Community hrefs verified via mig 390+412 SQL apply check.
 * Player start/join err chrome (mig 392–393) asserted on events-player-chrome.
 * Spectate activity log chrome (mig 394) asserted on spectate-chrome.
 * Player arena queue err chrome (mig 395 Community / 396 Official) asserted on both player chromes.
 * Arena notif hrefs (mig 397) asserted with points/lifecycle notifs when postgres is up.
 *
 * Hosting/player nav list icons: Trophy / emoji_events (not CalendarDays / Icons.event) - source lock below.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-tournament-community-ux-check.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function req(path, opts = {}) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const r = await fetch(base + path, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (![429, 502, 503].includes(r.status) || attempt === 8) return { status: r.status, body };
    await sleep(1000 * attempt);
  }
  return { status: 503, body: {} };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function noEventSport(label, s) {
  const v = String(s || "");
  assert(!/\bEvents?\b/i.test(v) || /\btournament/i.test(v), `${label} not Event-sport: ${v}`);
}

function assertNavTrophyIcons() {
  const rail = readFileSync(
    join(root, "apps/web/src/components/nav/EventsDesktopRail.tsx"),
    "utf8",
  );
  assert(/events_list:\s*Trophy/.test(rail), "web Hosting rail events_list Trophy");
  assert(!/events_list:\s*CalendarDays/.test(rail), "web Hosting rail no CalendarDays list icon");
  const bottom = readFileSync(join(root, "apps/web/src/components/nav/BottomNavBar.tsx"), "utf8");
  assert(/events_list:\s*Trophy/.test(bottom), "web bottom nav events_list Trophy");
  const shell = readFileSync(
    join(root, "apps/mobile/lib/features/events/events_shell.dart"),
    "utf8",
  );
  assert(/Icons\.emoji_events/.test(shell), "Flutter Hosting shell emoji_events");
  assert(
    !/case 'events_list':[\s\S]*Icons\.event[^_]/.test(shell),
    "Flutter Hosting shell no Icons.event list",
  );
  const player = readFileSync(
    join(root, "apps/mobile/lib/features/home/player_shell.dart"),
    "utf8",
  );
  assert(
    /case 'events_list':[\s\S]*Icons\.emoji_events/.test(player),
    "Flutter player shell events_list emoji_events",
  );
  const hub = readFileSync(
    join(root, "apps/web/src/components/events/EventsPlayerHub.tsx"),
    "utf8",
  );
  assert(
    /softCommunityPublicDisabled\(ready\.public_disabled\)/.test(hub),
    "web Community hub public-gate uses public_disabled soft",
  );
  const flutterHub = readFileSync(
    join(root, "apps/mobile/lib/features/events/player_events_hub.dart"),
    "utf8",
  );
  assert(
    /softCommunityPublicDisabled\(widget\.chrome\.publicDisabled\)/.test(flutterHub),
    "Flutter Community hub public-gate uses publicDisabled soft",
  );
  assert(
    /softCommunityFeatureDisabled\(widget\.chrome\.featureDisabled\)/.test(flutterHub),
    "Flutter Community hub hosted-gate uses featureDisabled soft",
  );
  assert(
    /softCommunityFeatureDisabled\(ready\.feature_disabled\)/.test(hub),
    "web Community hub hosted-gate uses feature_disabled soft",
  );
  const webTournaments = readFileSync(
    join(root, "apps/web/src/components/tournaments/CompetitionTournamentsHub.tsx"),
    "utf8",
  );
  assert(
    /catalogHostedFeatureOff\(/.test(webTournaments) && /!hostedKnownOff/.test(webTournaments),
    "web Host CTA gated via catalogHostedFeatureOff",
  );
  const hostList = readFileSync(
    join(root, "apps/web/src/app/(events)/events/events/page.tsx"),
    "utf8",
  );
  assert(
    /hosted_events_enabled === false/.test(hostList) &&
      /softHostingFeatureDisabled\(chrome\.feature_disabled\)/.test(hostList),
    "web Hosting list gated on hosted_events_enabled",
  );
  const hostDash = readFileSync(
    join(root, "apps/web/src/app/(events)/events/dashboard/page.tsx"),
    "utf8",
  );
  assert(
    /hosted_events_enabled === false/.test(hostDash) &&
      /softHostingFeatureDisabled\(chrome\.feature_disabled\)/.test(hostDash),
    "web Hosting dashboard gated on hosted_events_enabled",
  );
  const hostAnalytics = readFileSync(
    join(root, "apps/web/src/app/(events)/events/analytics/page.tsx"),
    "utf8",
  );
  assert(
    /hosted_events_enabled === false/.test(hostAnalytics) &&
      /softHostingFeatureDisabled\(chrome\.feature_disabled\)/.test(hostAnalytics),
    "web Hosting analytics gated on hosted_events_enabled",
  );
  const flutterHostList = readFileSync(
    join(root, "apps/mobile/lib/features/events/events_page.dart"),
    "utf8",
  );
  assert(
    /hostedEventsEnabled == false/.test(flutterHostList) &&
      /softHostingFeatureDisabled\((chrome|ready)\.featureDisabled\)/.test(flutterHostList),
    "Flutter Hosting list gated on hostedEventsEnabled",
  );
  const joinPanel = readFileSync(
    join(root, "apps/web/src/components/events/EventsJoinPanel.tsx"),
    "utf8",
  );
  assert(
    /catalogHostedFeatureOff\(/.test(joinPanel) &&
      /softCommunityFeatureDisabled\(chrome\.feature_disabled\)/.test(joinPanel),
    "web Hosting Join gated via catalogHostedFeatureOff",
  );
  assert(
    /softTournamentsFreeLabel\(/.test(joinPanel) &&
      /softTournamentsPlayersLabel\(/.test(joinPanel) &&
      /softTournamentsJoinAction\(/.test(joinPanel) &&
      /softCommunityJoinStatusMessage\(/.test(joinPanel),
    "web Hosting Join softs free/players/joinAction + join status",
  );
  const flutterJoin = readFileSync(
    join(root, "apps/mobile/lib/features/events/join_event_page.dart"),
    "utf8",
  );
  assert(
    /_catalogFeatureOff/.test(flutterJoin) &&
      /softCommunityFeatureDisabled\(chrome\.featureDisabled\)/.test(flutterJoin),
    "Flutter Hosting Join gated via catalogFeatureOff (incl. 503)",
  );
  assert(/softTournamentsJoinAction\(/.test(flutterJoin), "Flutter Hosting Join softs joinAction");
  assert(
    /softCommunityJoinStatusMessage\(/.test(flutterJoin) &&
      /softCommunityJoinStatusMessage\(\s*chrome\.pendingApproval\)/.test(flutterJoin),
    "Flutter Hosting Join softs alreadyJoined/approved/pending/rejected status",
  );
  const detailModal = readFileSync(
    join(root, "apps/web/src/components/events/EventDetailModal.tsx"),
    "utf8",
  );
  assert(
    /softTournamentsFreeLabel\(/.test(detailModal) &&
      /softTournamentsFilterEntryLabel\(/.test(detailModal) &&
      /softCommunityJoinStatusMessage\(/.test(detailModal),
    "web Event detail softs free/entry + join status",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(hub),
    "web Community hub softs join status toasts",
  );
  const payJoinModal = readFileSync(
    join(root, "apps/web/src/components/events/PaymentEventJoinModal.tsx"),
    "utf8",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(payJoinModal) &&
      /softPaymentModalTitle\(/.test(payJoinModal),
    "web Payment join modal softs join status toasts + title",
  );
  const flutterPayJoin = readFileSync(
    join(root, "apps/mobile/lib/features/events/payment_event_join_dialog.dart"),
    "utf8",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(flutterPayJoin) &&
      /softPaymentModalTitle\(/.test(flutterPayJoin) &&
      /message:\s*softCommunityLoadFailed\(joinChrome\.loadFailed\)/.test(flutterPayJoin),
    "Flutter Payment join softs title + join status + catch snack",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(flutterHub),
    "Flutter Community hub softs join status snacks",
  );
  const playerNavLib = readFileSync(join(root, "apps/web/src/lib/player-nav.ts"), "utf8");
  assert(
    /mapPlayerNavDisplayTitles\(/.test(playerNavLib) &&
      /softTournamentsPageTitle\(/.test(playerNavLib),
    "web player-nav mapPlayerNavDisplayTitles softs Tournaments tab",
  );
  const flutterPlayerShell = readFileSync(
    join(root, "apps/mobile/lib/features/home/player_shell.dart"),
    "utf8",
  );
  assert(
    /softTournamentsPageTitle\(/.test(flutterPlayerShell),
    "Flutter player shell softs Tournaments tab title",
  );
  const joinErr = readFileSync(join(root, "apps/web/src/lib/event-join-error.ts"), "utf8");
  assert(
    /softCommunityJoinStatusMessage\(/.test(joinErr),
    "web join-error softs seat/capacity messages",
  );
  assert(
    /softCommunityJoinStatusMessage\(apiMsg\)/.test(joinErr) &&
      !/if \(apiMsg\) return apiMsg/.test(joinErr),
    "web join-error scrubs unmapped API Event-sport text",
  );
  const flutterJoinErr = readFileSync(
    join(root, "apps/mobile/lib/features/events/event_join_error.dart"),
    "utf8",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(flutterJoinErr),
    "Flutter join-error softs seat/capacity messages",
  );
  assert(
    /softCommunityJoinStatusMessage\(apiMsg\)/.test(flutterJoinErr) &&
      !/if \(apiMsg\.isNotEmpty\) return apiMsg/.test(flutterJoinErr),
    "Flutter join-error scrubs unmapped API Event-sport text",
  );
  assert(
    /softCommunityCarouselAria\(ready\.carousel_aria\)/.test(hub),
    "web Community hub softs carousel_aria",
  );
  assert(
    /softCommunityCodeLabel\(ready\.code_label\)/.test(hub) &&
      /softCommunityCodePlaceholder\(ready\.code_placeholder\)/.test(hub),
    "web Community hub softs join-code field chrome",
  );
  assert(
    /softCommunityCarouselAria\(widget\.chrome\.carouselAria\)/.test(flutterHub) ||
      /softCommunityCarouselAria\(\s*chrome\.carouselAria/.test(flutterHub),
    "Flutter Community hub softs carouselAria",
  );
  assert(
    /softCommunityCodeLabel\(chrome\.codeLabel\)/.test(flutterHub) &&
      /softCommunityCodePlaceholder\(chrome\.codePlaceholder\)/.test(flutterHub),
    "Flutter Community hub softs join-code field chrome",
  );
  assert(
    /softCommunityChromeUnavailable\('Events unavailable'\)/.test(
      readFileSync(
        join(root, "apps/mobile/lib/features/tournaments/tournaments_page.dart"),
        "utf8",
      ),
    ),
    "Flutter tournaments chrome catch softs unavailable (not blank)",
  );
  const playerChromeType = readFileSync(
    join(root, "apps/web/src/types/events-player-chrome.ts"),
    "utf8",
  );
  assert(
    /public_disabled\?:/.test(playerChromeType) && /"public_disabled"/.test(playerChromeType),
    "web EventsPlayerChrome requires public_disabled",
  );
  const flutterPlayerChrome = readFileSync(
    join(root, "apps/mobile/lib/core/types/events_player_chrome.dart"),
    "utf8",
  );
  assert(
    /required this\.publicDisabled/.test(flutterPlayerChrome) &&
      /publicDisabled\.isNotEmpty/.test(flutterPlayerChrome) &&
      /publicDisabled: s\('public_disabled'\)/.test(flutterPlayerChrome),
    "Flutter EventsPlayerChrome requires publicDisabled",
  );
  assert(
    /"public_disabled"/.test(
      readFileSync(join(root, "apps/api/internal/rest/chrome_handlers.go"), "utf8"),
    ),
    "Go events player chrome fail-closed includes public_disabled",
  );
  const cupLobbyErr = readFileSync(join(root, "apps/web/src/lib/cup-lobby-player-err.ts"), "utf8");
  assert(
    /softCommunityJoinStatusMessage\(/.test(cupLobbyErr) &&
      /softCommunityLoadFailed\(/.test(cupLobbyErr),
    "web cup-lobby player err softs chrome + API messages",
  );
  const flutterOfficialLobbyErr = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournament_cup_lobby_sheet.dart"),
    "utf8",
  );
  const flutterCommunityLobbyErr = readFileSync(
    join(root, "apps/mobile/lib/features/events/event_cup_lobby_sheet.dart"),
    "utf8",
  );
  assert(
    /softCommunityJoinStatusMessage\(msg\)/.test(flutterOfficialLobbyErr) &&
      /softCommunityJoinStatusMessage\(chrome\.toastArenaQueueFailed\)/.test(
        flutterOfficialLobbyErr,
      ),
    "Flutter Official cup lobby softs API + arena queue errors",
  );
  assert(
    /softCommunityJoinStatusMessage\(msg\)/.test(flutterCommunityLobbyErr) &&
      /softCommunityJoinStatusMessage\(chrome\.toastArenaQueueFailed\)/.test(
        flutterCommunityLobbyErr,
      ),
    "Flutter Community cup lobby softs API + arena queue errors",
  );
  const spectateHub = readFileSync(
    join(root, "apps/web/src/components/spectate/SpectateHub.tsx"),
    "utf8",
  );
  assert(
    /softSpectateEventLogTitle\(chrome\.event_log_title\)/.test(spectateHub) &&
      /softSpectateNoEvents\(chrome\.no_events\)/.test(spectateHub),
    "web SpectateHub softs activity log chrome (mig 394 fail-open)",
  );
  const eventCupLobby = readFileSync(
    join(root, "apps/web/src/components/events/EventCupLobby.tsx"),
    "utf8",
  );
  const officialCupLobby = readFileSync(
    join(root, "apps/web/src/components/tournaments/TournamentCupLobby.tsx"),
    "utf8",
  );
  assert(
    /softCommunityRosterTitle\(lobbyChrome\.lobby_roster_title\)/.test(eventCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.check_in_success\)/.test(eventCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.ready_success\)/.test(eventCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.arena_queue_done\)/.test(eventCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.arena_left_blurb\)/.test(eventCupLobby) &&
      /softCommunityEstPrizeShareBlurb\(/.test(eventCupLobby) &&
      /softCommunityJoinStatusMessage\(\s*lobbyChrome\.ready_waiting_opponent/.test(eventCupLobby),
    "web Community cup lobby softs roster + success + est-prize + ready waiting",
  );
  assert(
    /softCommunityRosterTitle\(lobbyChrome\.lobby_roster_title\)/.test(officialCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.check_in_success\)/.test(officialCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.ready_success\)/.test(officialCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.arena_queue_done\)/.test(officialCupLobby) &&
      /softCommunityJoinStatusMessage\(lobbyChrome\.arena_left_blurb\)/.test(officialCupLobby) &&
      /softCommunityEstPrizeShareBlurb\(/.test(officialCupLobby) &&
      /softCommunityJoinStatusMessage\(\s*lobbyChrome\.ready_waiting_opponent/.test(
        officialCupLobby,
      ),
    "web Official cup lobby softs roster + success + est-prize + ready waiting",
  );
  assert(
    /softCommunityReportTitle\(/.test(eventCupLobby) &&
      /softCommunityReportTitle\(/.test(officialCupLobby),
    "web cup lobbies soft report_title via softCommunityReportTitle",
  );
  assert(
    /softCommunityRosterTitle\(chrome\.lobbyRosterTitle\)/.test(flutterCommunityLobbyErr) &&
      /softCommunityJoinStatusMessage\(widget\.chrome\.checkInSuccess\)/.test(
        flutterCommunityLobbyErr,
      ) &&
      /softCompetitionArenaStandingsTitle\(/.test(flutterCommunityLobbyErr) &&
      /SpectatePage\(/.test(flutterCommunityLobbyErr) &&
      /softCommunitySpectateAction\(\s*chrome\.spectateAction/.test(flutterCommunityLobbyErr) &&
      /softCommunityEstPrizeShareBlurb\(/.test(flutterCommunityLobbyErr),
    "Flutter Community cup lobby softs roster + spectate + est-prize",
  );
  assert(
    /softCommunityRosterTitle\(chrome\.lobbyRosterTitle\)/.test(flutterOfficialLobbyErr) &&
      /softCommunityJoinStatusMessage\(widget\.chrome\.checkInSuccess\)/.test(
        flutterOfficialLobbyErr,
      ) &&
      /softCompetitionArenaStandingsTitle\(/.test(flutterOfficialLobbyErr) &&
      /SpectatePage\(/.test(flutterOfficialLobbyErr) &&
      /softCommunitySpectateAction\(\s*chrome\.lobbySpectateAction/.test(flutterOfficialLobbyErr) &&
      /softCommunityEstPrizeShareBlurb\(/.test(flutterOfficialLobbyErr),
    "Flutter Official cup lobby softs roster + spectate + est-prize",
  );
  const arenaStandingsTableSoft = readFileSync(
    join(root, "apps/web/src/components/competition/ArenaStandingsTable.tsx"),
    "utf8",
  );
  assert(
    /softCompetitionArenaStandingsTitle\(/.test(arenaStandingsTableSoft) &&
      /softCompetitionArenaStreakLabel\(/.test(arenaStandingsTableSoft),
    "web ArenaStandingsTable softs standings title + streak",
  );
  assert(
    /softTournamentsPageTitle\(/.test(webTournaments) &&
      /<section[\s\S]*aria-label=\{tournamentsRegionLabel/.test(webTournaments),
    "web Tournament hub region uses softTournamentsPageTitle",
  );
  assert(
    /softTournamentsHostAction\(/.test(webTournaments) &&
      /softTournamentsHostBlurb\(/.test(webTournaments) &&
      /softTournamentsBadgeOfficial\(/.test(webTournaments) &&
      /softTournamentsBadgeCommunity\(/.test(webTournaments) &&
      /softTournamentsFilterSourceAll\(/.test(webTournaments) &&
      /softTournamentsFilterSourceOfficial\(/.test(webTournaments) &&
      /softTournamentsFilterSourceCommunity\(/.test(webTournaments) &&
      /softTournamentsFilterSourceLabel\(/.test(webTournaments) &&
      /softTournamentsFilterEntryAll\(/.test(webTournaments) &&
      /softTournamentsFilterEntryFree\(/.test(webTournaments) &&
      /softTournamentsFilterEntryPaid\(/.test(webTournaments) &&
      /softTournamentsFilterEntryLabel\(/.test(webTournaments) &&
      /softTournamentsFreeLabel\(/.test(webTournaments) &&
      /softTournamentsEnrollAction\(/.test(webTournaments) &&
      /softTournamentsJoinAction\(/.test(webTournaments) &&
      /softTournamentsFiltersToggleLabel\(/.test(webTournaments) &&
      /softTournamentsFiltersToggleShowAria\(/.test(webTournaments) &&
      /softTournamentsFiltersToggleHideAria\(/.test(webTournaments) &&
      /softTournamentsPlayersLabel\(/.test(webTournaments),
    "web Tournament hub softs Host CTA + badges + source/entry filters + join/enroll + toggle/aria/players",
  );
  assert(
    /softTournamentsJoinAction\(homeChrome\.join_cta\)/.test(webTournaments),
    "web Official hub softs seated join_cta fallback",
  );
  assert(
    /catalogHostedFeatureOff\(/.test(hub),
    "web Community hub gates feature via catalogHostedFeatureOff",
  );
  assert(
    /softCommunityChromeUnavailable\(/.test(webTournaments),
    "web Official hub softs home_chrome_unavailable",
  );
  assert(
    /!tournamentsChrome \?/.test(webTournaments) &&
      /tournamentsChromeQuery\.error/.test(webTournaments),
    "web Official hub paints soft unavailable when tournaments chrome fails",
  );
  const tournamentsChromeQuerySrc = readFileSync(
    join(root, "apps/web/src/hooks/query/useTournamentsPlayerChromeQuery.ts"),
    "utf8",
  );
  assert(
    /softCommunityChromeUnavailable\(/.test(tournamentsChromeQuerySrc),
    "web tournaments-player-chrome query softs unavailable throw",
  );
  const eventsPlayerChromeQuerySrc = readFileSync(
    join(root, "apps/web/src/hooks/query/useEventsPlayerChromeQuery.ts"),
    "utf8",
  );
  assert(
    /softCommunityChromeUnavailable\(/.test(eventsPlayerChromeQuerySrc),
    "web events-player-chrome query softs unavailable throw",
  );
  assert(
    /softTournamentsEmptyOfficial\(/.test(webTournaments) &&
      /softTournamentsEmpty\(/.test(webTournaments) &&
      /softCommunityEmpty\(/.test(webTournaments) &&
      /softCommunitySearchLabel\(/.test(webTournaments) &&
      /softCommunitySearchPlaceholder\(/.test(webTournaments),
    "web Tournament hub softs empty All/Official/Community + search chrome",
  );
  assert(
    /softCommunityShareAction\(/.test(
      readFileSync(join(root, "apps/web/src/components/events/EventDetailModal.tsx"), "utf8"),
    ),
    "web Community detail softs share_action",
  );
  assert(
    /Invite `\?code=` with omitted source/.test(webTournaments) &&
      /params\.set\("source", "community"\)/.test(webTournaments) &&
      /sourceRaw != null && sourceRaw\.trim\(\) !== ""/.test(webTournaments),
    "web invite ?code= with omitted source → Community",
  );
  const hostWallet = readFileSync(
    join(root, "apps/web/src/app/(events)/events/wallet/page.tsx"),
    "utf8",
  );
  const hostTx = readFileSync(
    join(root, "apps/web/src/app/(events)/events/transactions/page.tsx"),
    "utf8",
  );
  const hostReceipts = readFileSync(
    join(root, "apps/web/src/app/(events)/events/receipts/page.tsx"),
    "utf8",
  );
  assert(
    /softHostingChromeUnavailable\(/.test(hostWallet) &&
      /softHostingChromeUnavailable\(/.test(hostTx) &&
      /softHostingChromeUnavailable\(/.test(hostReceipts),
    "web Hosting wallet/transactions/receipts soft chrome unavailable",
  );
  assert(
    /softHostingChromeUnavailable\(/.test(flutterHostList),
    "Flutter Hosting list softs chrome unavailable",
  );
  const eventsLayout = readFileSync(join(root, "apps/web/src/app/(events)/layout.tsx"), "utf8");
  assert(
    /hideHostingChrome/.test(eventsLayout) &&
      /!hideHostingChrome \? <EventsDesktopRail/.test(eventsLayout),
    "guest /events/join hides Hosting chrome before Community redirect",
  );
  assert(/softTournamentsPlayersLabel\(/.test(flutterJoin), "Flutter join softs playersLabel");
  assert(
    /_catalogFeatureOff/.test(flutterHub) && /catalogFeatureOff:/.test(flutterHub),
    "Flutter Community hub tracks catalogFeatureOff for 503 gate",
  );
  const flutterTournamentsPage = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournaments_page.dart"),
    "utf8",
  );
  assert(
    /softCommunityChromeUnavailable\(/.test(flutterTournamentsPage),
    "Flutter tournaments page softs chrome unavailable",
  );
  assert(
    /softTournamentsHostAction\(/.test(flutterTournamentsPage) &&
      /softTournamentsHostBlurb\(/.test(flutterTournamentsPage) &&
      /softTournamentsBadgeOfficial\(/.test(flutterTournamentsPage) &&
      /softTournamentsBadgeCommunity\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterSourceAll\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterSourceOfficial\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterSourceCommunity\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterSourceLabel\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterEntryAll\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterEntryFree\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterEntryPaid\(/.test(flutterTournamentsPage) &&
      /softTournamentsFilterEntryLabel\(/.test(flutterTournamentsPage) &&
      /softTournamentsFreeLabel\(/.test(flutterTournamentsPage) &&
      /softTournamentsEnrollAction\(/.test(flutterTournamentsPage) &&
      /softTournamentsJoinAction\(/.test(flutterTournamentsPage) &&
      /softTournamentsFiltersToggleLabel\(/.test(flutterTournamentsPage) &&
      /softTournamentsFiltersToggleShowAria\(/.test(flutterTournamentsPage) &&
      /softTournamentsFiltersToggleHideAria\(/.test(flutterTournamentsPage) &&
      /softTournamentsPlayersLabel\(/.test(flutterTournamentsPage),
    "Flutter Tournament hub softs Host CTA + badges + source/entry filters + join/enroll + toggle/aria/players",
  );
  assert(
    /softTournamentsEmptyOfficial\(/.test(flutterTournamentsPage) &&
      /softTournamentsEmpty\(/.test(flutterTournamentsPage) &&
      /softCommunityEmpty\(/.test(flutterTournamentsPage) &&
      /softCommunitySearchLabel\(/.test(flutterTournamentsPage),
    "Flutter Tournament hub softs empty All/Official/Community + search label",
  );
  assert(
    /initialJoinCode/.test(flutterTournamentsPage) &&
      /_source == 'all'/.test(flutterTournamentsPage) &&
      /_source = 'community'/.test(flutterTournamentsPage),
    "Flutter invite joinCode with omitted source → Community",
  );
  assert(
    /softTournamentsJoinAction\(/.test(hub) &&
      /softTournamentsFilterEntryAll\(/.test(hub) &&
      /softTournamentsFilterEntryFree\(/.test(hub) &&
      /softTournamentsFilterEntryPaid\(/.test(hub) &&
      /softTournamentsFiltersToggleLabel\(/.test(hub) &&
      /softTournamentsPlayersLabel\(/.test(hub) &&
      /softTournamentsHostedByLabel\(/.test(hub),
    "web Community hub softs entry filters + join + toggle/players/hostedBy",
  );
  assert(
    /softTournamentsJoinAction\(/.test(flutterHub) &&
      /softTournamentsFilterEntryAll\(/.test(flutterHub) &&
      /softTournamentsFilterEntryFree\(/.test(flutterHub) &&
      /softTournamentsFilterEntryPaid\(/.test(flutterHub) &&
      /softTournamentsFilterEntryLabel\(/.test(flutterHub) &&
      /softTournamentsFiltersToggleLabel\(/.test(flutterHub) &&
      /softTournamentsPlayersLabel\(/.test(flutterHub) &&
      /softTournamentsHostedByLabel\(/.test(flutterHub),
    "Flutter Community hub softs entry filters + join + toggle/players/hostedBy",
  );
  const publicBrowse = readFileSync(
    join(root, "apps/web/src/components/events/PublicEventsBrowse.tsx"),
    "utf8",
  );
  assert(
    /softHostingPublicListEmpty\(/.test(publicBrowse),
    "web PublicEventsBrowse softs public_list_empty via softHostingPublicListEmpty",
  );
  assert(
    /softTournamentsPlayersLabel\(/.test(publicBrowse) &&
      /softTournamentsFilterEntryLabel\(/.test(publicBrowse) &&
      /softTournamentsFreeLabel\(/.test(publicBrowse) &&
      /softTournamentsHostedByLabel\(/.test(publicBrowse) &&
      /softTournamentsJoinAction\(/.test(publicBrowse),
    "web PublicEventsBrowse softs card players/entry/free/hostedBy/join",
  );
  assert(
    /softTournamentsFiltersToggleLabel\(/.test(publicBrowse) &&
      /softTournamentsFiltersToggleShowAria\(/.test(publicBrowse) &&
      /softTournamentsFiltersToggleHideAria\(/.test(publicBrowse),
    "web PublicEventsBrowse softs filters toggle + aria",
  );
  assert(
    /softCommunitySearchLabel\(/.test(publicBrowse) &&
      /softCommunitySearchPlaceholder\(/.test(publicBrowse),
    "web PublicEventsBrowse softs search label/placeholder",
  );
  assert(
    /softCommunityEmpty\(/.test(hub) &&
      /softCommunitySearchLabel\(/.test(hub) &&
      /softCommunitySearchPlaceholder\(/.test(hub),
    "web Community hub softs empty + search chrome",
  );
  assert(
    /softTournamentsFreeLabel\(chrome\.freeLabel\)/.test(flutterHub) &&
      /softTournamentsFilterEntryLabel\(chrome\.entryLabel\)/.test(flutterHub),
    "Flutter Community detail softs freeLabel + entryLabel",
  );
  const flutterPublicBrowse = readFileSync(
    join(root, "apps/mobile/lib/features/events/public_events_browse.dart"),
    "utf8",
  );
  assert(
    /softTournamentsPlayersLabel\(/.test(flutterPublicBrowse) &&
      /softTournamentsFilterEntryLabel\(/.test(flutterPublicBrowse) &&
      /softTournamentsFreeLabel\(/.test(flutterPublicBrowse) &&
      /softTournamentsHostedByLabel\(/.test(flutterPublicBrowse) &&
      /softTournamentsJoinAction\(/.test(flutterPublicBrowse),
    "Flutter PublicEventsBrowse softs card players/entry/free/hostedBy/join",
  );
  assert(
    /softTournamentsFiltersToggleLabel\(/.test(flutterPublicBrowse) &&
      /softTournamentsFilterEntryAll\(/.test(flutterPublicBrowse) &&
      /softTournamentsFilterEntryFree\(/.test(flutterPublicBrowse) &&
      /softTournamentsFilterEntryPaid\(/.test(flutterPublicBrowse),
    "Flutter PublicEventsBrowse softs filters toggle + entry chips",
  );
  assert(
    /softCommunitySearchLabel\(/.test(flutterPublicBrowse),
    "Flutter PublicEventsBrowse softs search label",
  );
  assert(
    /softCommunityEmpty\(/.test(flutterHub) && /softCommunitySearchLabel\(/.test(flutterHub),
    "Flutter Community hub softs empty + search label",
  );
  assert(
    /softCommunityJoinStatusMessage\(chrome\.insufficient_entry_fee\)/.test(joinPanel),
    "web Hosting Join softs insufficient_entry_fee paint",
  );
  assert(
    /softCommunityVisibilityPrivateBlurb\(/.test(joinPanel) &&
      /softCommunityVisibilityPublicBlurb\(/.test(joinPanel),
    "web Hosting Join softs visibility public+private blurbs",
  );
  assert(
    /softCommunityVisibilityPrivateBlurb\(/.test(flutterJoin) &&
      /softCommunityVisibilityPublicBlurb\(/.test(flutterJoin),
    "Flutter Hosting Join softs visibility public+private blurbs",
  );
  assert(
    /softCommunityJoinStatusMessage\(chrome\.insufficientEntryFee\)/.test(flutterJoin),
    "Flutter Hosting Join softs insufficientEntryFee paint",
  );
  assert(
    /softCommunityJoinStatusMessage\(ready\.insufficient_entry_fee\)/.test(hub) &&
      /softCommunityJoinStatusMessage\(chrome\.insufficient_entry_fee\)/.test(
        readFileSync(join(root, "apps/web/src/components/events/EventDetailModal.tsx"), "utf8"),
      ),
    "web Community hub/detail soft insufficient_entry_fee toasts",
  );
  assert(
    /softCommunityJoinCodeSectionTitle\(/.test(hub) &&
      /softCommunityJoinCodeSectionBlurb\(/.test(hub),
    "web Community join-code strip uses soft section title/blurb",
  );
  assert(
    /softCommunityJoinCodeSectionTitle\(/.test(flutterHub) &&
      /softCommunityJoinCodeSectionBlurb\(/.test(flutterHub),
    "Flutter Community join-code strip uses soft section title/blurb",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(hostList),
    "web Hosting list copy remaps invite via resolveEventInviteShareUrl",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(hostDash),
    "web Hosting dashboard share remaps via resolveEventInviteShareUrl",
  );
  const manageDlg = readFileSync(
    join(root, "apps/web/src/components/events/ManageEventDialog.tsx"),
    "utf8",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(manageDlg) && /inviteShareUrl/.test(manageDlg),
    "web Manage dialog invite remaps via resolveEventInviteShareUrl",
  );
  const eventDetailModal = readFileSync(
    join(root, "apps/web/src/components/events/EventDetailModal.tsx"),
    "utf8",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(eventDetailModal),
    "web Community detail invite remaps via resolveEventInviteShareUrl",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(flutterHub),
    "Flutter Community hub/detail invite remaps via resolveEventInviteShareUrl",
  );
  assert(
    existsSync(join(root, "apps/api/internal/rest/community_invite_share_path_test.go")) &&
      /TestCommunityInviteSharePathTemplate/.test(
        readFileSync(
          join(root, "apps/api/internal/rest/community_invite_share_path_test.go"),
          "utf8",
        ),
      ),
    "Go communityInviteSharePath unit test present",
  );
  const authProviders = readFileSync(join(root, "apps/web/src/lib/auth-providers.ts"), "utf8");
  assert(
    /sanitizeLoginNext/.test(authProviders) && /playerTournamentDiscoveryHref/.test(authProviders),
    "web sanitizeLoginNext remaps legacy Events browse via playerTournamentDiscoveryHref",
  );
  const nextConfig = readFileSync(join(root, "apps/web/next.config.ts"), "utf8");
  assert(
    /\/tournaments/.test(nextConfig) && /view=tournaments/.test(nextConfig),
    "web next.config remaps /tournaments → hub",
  );
  const flutterNotifNav = readFileSync(
    join(root, "apps/mobile/lib/features/notifications/notification_href_nav.dart"),
    "utf8",
  );
  assert(
    /view == 'events'/.test(flutterNotifNav) &&
      /sourceRaw == 'community'/.test(flutterNotifNav) &&
      /isCommunityDiscovery/.test(flutterNotifNav),
    "Flutter notification_href_nav remaps Events browse → Community",
  );
  assert(
    /softCommunityErrCodeRequired\(/.test(flutterHub) &&
      /softCommunityErrCodeRequired\(/.test(flutterJoin),
    "Flutter join-code empty validation softs softCommunityErrCodeRequired",
  );
  assert(
    /softHostingVisibilityPrivateBlurb\(/.test(manageDlg) &&
      /softHostingVisibilityPublicBlurb\(/.test(manageDlg),
    "web Manage dialog softs visibility public+private blurbs",
  );
  assert(
    /softHostingVisibilityPrivateBlurb\(/.test(flutterHostList) &&
      /softHostingVisibilityPublicBlurb\(/.test(flutterHostList),
    "Flutter Host create/manage softs visibility public+private blurbs",
  );
  assert(
    /softHostingVisibilityPrivateBlurb\(/.test(hostList) &&
      /softHostingVisibilityPublicBlurb\(/.test(hostList),
    "web Host create softs visibility public+private blurbs",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(hostList) &&
      /public_rated_on_blurb|public_rated_off_blurb|force_auto_approve_note/.test(hostList),
    "web Host create softs public rated + force_auto_approve notes",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(joinPanel) &&
      /public_rated_on_blurb|entry_fee_pay_blurb/.test(joinPanel),
    "web Hosting Join softs public rated + entry_fee_pay blurbs",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(flutterJoin) &&
      /publicRatedOnBlurb|entryFeePayBlurb/.test(flutterJoin),
    "Flutter Hosting Join softs public rated + entryFeePay blurbs",
  );
  assert(
    /softCommunityJoinStatusMessage\(/.test(flutterHub) &&
      /publicRatedOnBlurb|publicRatedOffBlurb/.test(flutterHub),
    "Flutter Community detail softs public rated blurbs",
  );
  assert(
    /softCommunityJoinStatusMessage\(chrome\.force_auto_approve_note\)/.test(manageDlg),
    "web Manage softs force_auto_approve_note",
  );
  assert(
    /softCommunityJoinStatusMessage\(chrome\.forceAutoApproveNote\)/.test(flutterHostList),
    "Flutter Host create/manage softs forceAutoApproveNote",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(flutterHostList),
    "Flutter Hosting list/manage invite remaps via resolveEventInviteShareUrl",
  );
  const flutterDash = readFileSync(
    join(root, "apps/mobile/lib/features/events/dashboard_page.dart"),
    "utf8",
  );
  assert(
    /resolveEventInviteShareUrl\(/.test(flutterDash) && /lastEventShareUrl/.test(flutterDash),
    "Flutter Hosting dashboard last-share remaps via resolveEventInviteShareUrl",
  );
  assert(
    /softHostingPortalPublicListLabel\(/.test(flutterHostList) &&
      /softHostingToastCreated\(/.test(flutterHostList),
    "Flutter Host create toast Community action uses softHostingPortalPublicListLabel",
  );
  const playerNav = readFileSync(join(root, "apps/web/src/lib/player-nav.ts"), "utf8");
  assert(
    /events_analytics/.test(playerNav) && /softHostingAnalyticsTitle/.test(playerNav),
    "web Hosting nav softs events_analytics title",
  );
  assert(
    /events_join/.test(playerNav) && /softCommunityJoinTitle/.test(playerNav),
    "web Hosting nav softs events_join via softCommunityJoinTitle",
  );
  assert(
    /events_analytics/.test(shell) && /softHostingAnalyticsTitle/.test(shell),
    "Flutter Hosting shell softs events_analytics title",
  );
  assert(
    /events_join/.test(shell) && /softCommunityJoinTitle/.test(shell),
    "Flutter Hosting shell softs events_join via softCommunityJoinTitle",
  );
  const marketingLayout = readFileSync(
    join(root, "apps/web/src/app/(marketing)/layout.tsx"),
    "utf8",
  );
  assert(
    /resolvePlayerNavHref\(/.test(marketingLayout) &&
      /softTournamentsPageTitle\(/.test(marketingLayout),
    "web marketing footer remaps href + softs Event-sport titles",
  );
  const startMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useStartHostedEventMutation.ts"),
    "utf8",
  );
  assert(/softHostingToastStarted\(/.test(startMut), "web start mutation softs toast_started");
  const closeMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useCloseHostedEventMutation.ts"),
    "utf8",
  );
  assert(/softHostingToastClosed\(/.test(closeMut), "web close mutation softs toast_closed");
  assert(
    /softHostingToastStarted\(/.test(flutterHostList) &&
      /softHostingToastClosed\(/.test(flutterHostList) &&
      /softHostingToastReopened\(/.test(flutterHostList),
    "Flutter Hosting lifecycle toasts use softHostingToast*",
  );
  const flutterHome = readFileSync(
    join(root, "apps/mobile/lib/features/home/home_page.dart"),
    "utf8",
  );
  assert(
    /softTournamentsPageTitle\(/.test(flutterHome) && /events_public/.test(flutterHome),
    "Flutter marketing footer softs titles + events_public → Community",
  );
  assert(
    /softTournamentsJoinAction\(/.test(flutterHome) &&
      /softTournamentsPlayersLabel\(/.test(flutterHome) &&
      /softTournamentsEnrollAction\(/.test(flutterHome),
    "Flutter home Official carousel softs join/enroll/players",
  );
  assert(
    /softCommunityChromeUnavailable\(/.test(flutterHome),
    "Flutter home softs home_chrome_unavailable strip",
  );
  assert(
    /dialog_close_label/.test(hostList) && /softHostingCancelAction\(/.test(hostList),
    "web Host create pay dismiss prefers dialog_close_label / soft cancel",
  );
  assert(
    /dialogCloseLabel/.test(flutterHostList) && /softHostingCancelAction\(/.test(flutterHostList),
    "Flutter Host create pay dismiss prefers dialogCloseLabel / soft cancel",
  );
  const patchMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/usePatchHostedEventMutation.ts"),
    "utf8",
  );
  assert(
    /softHostingToastSaved\(/.test(patchMut) && /softHostingToastSaveFailed\(/.test(patchMut),
    "web patch mutation softs toast_saved / toast_save_failed",
  );
  const entryKickMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useHostedEventEntryActionsMutation.ts"),
    "utf8",
  );
  assert(
    /softHostingToastSaveFailed\(/.test(entryKickMut),
    "web Hosting kick mutation softs toast_save_failed",
  );
  const uploadLogoMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useUploadHostedEventLogoMutation.ts"),
    "utf8",
  );
  assert(
    /softHostingUploadLogoFailed\(/.test(uploadLogoMut) &&
      /softHostingUploadSponsorFailed\(/.test(uploadLogoMut),
    "web Hosting logo/sponsor upload softs fail chrome",
  );
  assert(
    /softHostingUploadSponsorFailed\(chrome\.uploadSponsorFailed\)/.test(flutterHostList),
    "Flutter Hosting sponsor upload softs uploadSponsorFailed",
  );
  assert(
    /softHostingToastSaved\(/.test(flutterHostList) &&
      /softHostingToastSaveFailed\(/.test(flutterHostList),
    "Flutter Hosting save toasts use softHostingToastSaved/SaveFailed",
  );
  assert(
    /_entryAction[\s\S]*softHostingToastSaveFailed\(chrome\.toastSaveFailed\)/.test(
      flutterHostList,
    ),
    "Flutter Hosting kick softs toastSaveFailed",
  );
  const surfaceHome = readFileSync(
    join(root, "apps/web/src/components/nav/SurfaceHomeLink.tsx"),
    "utf8",
  );
  assert(/softHostingBrandName\(/.test(surfaceHome), "web SurfaceHomeLink softs Hosting brand");
  assert(/softHostingBrandName\(/.test(shell), "Flutter Hosting shell softs eventsBrandName");
  assert(
    /softHostingChromeUnavailable\(/.test(shell),
    "Flutter Hosting shell softs nav-unavailable body",
  );
  assert(
    /softHostingBrandName\(/.test(playerNav) && /pickOpsPlayerNavLinks/.test(playerNav),
    "web ops/hamburger Hosting brand uses softHostingBrandName",
  );
  assert(
    /softHostingToastStartFailed\(/.test(startMut) &&
      /softHostingToastCloseFailed\(/.test(closeMut),
    "web start/close mutations soft lifecycle failure toasts",
  );
  const reopenMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useReopenHostedEventMutation.ts"),
    "utf8",
  );
  assert(
    /softHostingToastReopenFailed\(/.test(reopenMut),
    "web reopen mutation softs toast_reopen_failed",
  );
  assert(
    /softHostingToastStartFailed\(/.test(flutterHostList) &&
      /softHostingToastCloseFailed\(/.test(flutterHostList) &&
      /softHostingToastReopenFailed\(/.test(flutterHostList),
    "Flutter Hosting lifecycle failure toasts softed",
  );
  const reportDlg = readFileSync(
    join(root, "apps/web/src/components/events/ReportEventDialog.tsx"),
    "utf8",
  );
  assert(
    /softHostingCancelAction\(/.test(reportDlg) &&
      /softHostingReportTitle\(/.test(reportDlg) &&
      /softCommunityReportSubmitAction\(/.test(reportDlg) &&
      /softCommunityReportReasonLabel\(/.test(reportDlg) &&
      /softCommunityReportNoteLabel\(/.test(reportDlg),
    "web Report dialog softs cancel + title + submit + reason/note",
  );
  const flutterTournReportDlg = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournament_report_dialog.dart"),
    "utf8",
  );
  assert(
    /softHostingReportTitle\(/.test(flutterTournReportDlg) &&
      /softCommunityReportSubmitAction\(/.test(flutterTournReportDlg) &&
      /softCommunityReportReasonLabel\(/.test(flutterTournReportDlg) &&
      /softCommunityReportNoteLabel\(/.test(flutterTournReportDlg),
    "Flutter Official report dialog softs title + submit + reason/note",
  );
  const flutterEventReportDlg = readFileSync(
    join(root, "apps/mobile/lib/features/events/event_report_dialog.dart"),
    "utf8",
  );
  assert(
    /softHostingReportTitle\(/.test(flutterEventReportDlg) &&
      /softCommunityReportSubmitAction\(/.test(flutterEventReportDlg) &&
      /softCommunityReportReasonLabel\(/.test(flutterEventReportDlg) &&
      /softCommunityReportNoteLabel\(/.test(flutterEventReportDlg),
    "Flutter Community report dialog softs title + submit + reason/note",
  );
  assert(
    /softTournamentsFilterEntryAll\(/.test(publicBrowse) &&
      /softTournamentsFilterEntryFree\(/.test(publicBrowse) &&
      /softTournamentsFilterEntryPaid\(/.test(publicBrowse),
    "web PublicEventsBrowse softs entry filter labels",
  );
  const payJoin = readFileSync(
    join(root, "apps/web/src/components/events/PaymentEventJoinModal.tsx"),
    "utf8",
  );
  assert(/softHostingCancelAction\(/.test(payJoin), "web Payment join modal softs cancel_action");
  const enrollPay = readFileSync(
    join(root, "apps/web/src/components/tournaments/PaymentEnrollModal.tsx"),
    "utf8",
  );
  assert(
    /softHostingCancelAction\(/.test(enrollPay) &&
      /softPaymentModalTitle\(/.test(enrollPay) &&
      /softCommunityJoinStatusMessage\(/.test(enrollPay),
    "web Official enroll modal softs cancel + title + enroll status",
  );
  const flutterEnrollPay = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/payment_enroll_dialog.dart"),
    "utf8",
  );
  assert(
    /softPaymentModalTitle\(/.test(flutterEnrollPay) &&
      /softCommunityJoinStatusMessage\(/.test(flutterEnrollPay),
    "Flutter Official enroll dialog softs title + enroll status",
  );
  assert(
    /softCommunityWinnersTitle\(/.test(joinPanel) &&
      /softCommunityShareResultAction\(/.test(joinPanel) &&
      /softCommunitySpectateAction\(/.test(joinPanel) &&
      /softCommunityResultCardShareImageAction\(/.test(joinPanel) &&
      /softCommunityResultCardDownloadAction\(/.test(joinPanel),
    "web Hosting Join softs winners/share/spectate/result-card image actions",
  );
  assert(
    /softCommunityWinnersTitle\(/.test(flutterJoin) &&
      /softCommunityShareResultAction\(/.test(flutterJoin) &&
      /softCommunitySpectateAction\(/.test(flutterJoin) &&
      /softCommunityResultCardShareImageAction\(/.test(flutterJoin) &&
      /softCommunityResultCardDownloadAction\(/.test(flutterJoin),
    "Flutter Hosting Join softs winners/share/spectate/result-card image actions",
  );
  const pointsToast = readFileSync(
    join(root, "apps/web/src/components/notifications/CompetitionPointsToast.tsx"),
    "utf8",
  );
  assert(
    /softCompetitionPointsLabel\(/.test(pointsToast),
    "web CompetitionPointsToast softs points label",
  );
  const standingsTable = readFileSync(
    join(root, "apps/web/src/components/events/EventStandingsTable.tsx"),
    "utf8",
  );
  assert(
    /softCompetitionPointsLabel\(/.test(standingsTable),
    "web EventStandingsTable softs standings_points_label",
  );
  const arenaTable = readFileSync(
    join(root, "apps/web/src/components/competition/ArenaStandingsTable.tsx"),
    "utf8",
  );
  assert(
    /softCompetitionPointsLabel\(/.test(arenaTable),
    "web ArenaStandingsTable softs arena_points_label",
  );
  const flutterStandingsView = readFileSync(
    join(root, "apps/mobile/lib/features/events/event_standings.dart"),
    "utf8",
  );
  assert(
    /softCompetitionPointsLabel\(/.test(flutterStandingsView),
    "Flutter EventStandingsView softs pointsLabel",
  );
  const flutterNotifBell = readFileSync(
    join(root, "apps/mobile/lib/features/notifications/notification_bell.dart"),
    "utf8",
  );
  assert(
    /softCompetitionPointsLabel\(/.test(flutterNotifBell),
    "Flutter notification bell softs points toast label",
  );
  const enrollErrLib = readFileSync(join(root, "apps/web/src/lib/tournament-free-join.ts"), "utf8");
  assert(
    /softCommunityJoinStatusMessage\(/.test(enrollErrLib),
    "web tournamentEnrollErrorChrome softs enroll messages",
  );
  const flutterEnroll = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/payment_enroll_dialog.dart"),
    "utf8",
  );
  assert(
    /softHostingCancelAction\(/.test(flutterEnroll),
    "Flutter Official enroll dialog softs cancelAction",
  );
  const flutterTournReport = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournament_report_dialog.dart"),
    "utf8",
  );
  assert(
    /softHostingCancelAction\(/.test(flutterTournReport),
    "Flutter Official report dialog softs cancelAction",
  );
  const cancelMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useCancelHostedEventMutation.ts"),
    "utf8",
  );
  assert(
    /softHostingToastSaveFailed\(/.test(cancelMut),
    "web cancel mutation softs toast_save_failed on error",
  );
  const eventLobby = readFileSync(
    join(root, "apps/web/src/components/events/EventCupLobby.tsx"),
    "utf8",
  );
  assert(
    /softCommunityBracketTitle\(/.test(eventLobby) &&
      /softCommunityPrizePendingBlurb\(/.test(eventLobby) &&
      /softCommunityArenaLobbyTitle\(/.test(eventLobby) &&
      /softCommunityLobbyBlurb\(/.test(eventLobby) &&
      /softCommunityArenaLobbyBlurb\(/.test(eventLobby),
    "web Community cup lobby softs bracket + prize pending + arena/lobby title/blurb",
  );
  assert(
    /softCommunityLobbyUnavailable\(/.test(eventLobby),
    "web Community cup lobby softs lobby_unavailable",
  );
  assert(
    /softCommunitySpectateAction\(/.test(eventLobby),
    "web Community cup lobby softs spectate_action",
  );
  const officialLobby = readFileSync(
    join(root, "apps/web/src/components/tournaments/TournamentCupLobby.tsx"),
    "utf8",
  );
  assert(
    /softCommunityBracketTitle\(/.test(officialLobby) &&
      /softCommunityPrizePendingBlurb\(/.test(officialLobby) &&
      /softCommunityArenaLobbyTitle\(/.test(officialLobby) &&
      /softCommunityLobbyBlurb\(/.test(officialLobby) &&
      /softCommunityArenaLobbyBlurb\(/.test(officialLobby),
    "web Official cup lobby softs bracket + prize pending + arena/lobby title/blurb",
  );
  assert(
    /softCommunityLobbyUnavailable\(/.test(officialLobby),
    "web Official cup lobby softs lobby_unavailable",
  );
  assert(
    /softCommunitySpectateAction\(/.test(officialLobby),
    "web Official cup lobby softs lobby_spectate_action",
  );
  assert(
    /softHostingReportAction\(/.test(officialLobby),
    "web Official cup lobby softs report_action via softHostingReportAction",
  );
  assert(
    /softCommunityKickedBlurb\(/.test(joinPanel) &&
      /softCommunityLoadFailed\(/.test(joinPanel) &&
      /softCommunityBracketTitle\(/.test(joinPanel),
    "web Hosting Join panel softs kicked/load_failed/bracket",
  );
  assert(/softCommunityLoadFailed\(/.test(hub), "web Community hub softs load_failed");
  assert(
    /softCommunityLoadFailed\(/.test(eventLobby) && /softCommunityLoadFailed\(/.test(officialLobby),
    "web cup lobbies soft load_failed",
  );
  assert(/softCommunityLoadFailed\(/.test(detailModal), "web Event detail modal softs load_failed");
  assert(/softCommunityLoadFailed\(/.test(flutterHub), "Flutter Community hub softs loadFailed");
  assert(
    /softCommunityLoadFailed\(\s*detail\.isNotEmpty \? detail/.test(flutterHub) &&
      !/\? widget\.chrome\.detailUnavailable\s*;/.test(flutterHub),
    "Flutter Community detail softs detailUnavailable via softCommunityLoadFailed",
  );
  assert(
    /softCommunityShareAction\(chrome\.shareAction\)/.test(flutterHub),
    "Flutter Community detail softs shareAction",
  );
  const flutterTournamentsCubit = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournaments_cubit.dart"),
    "utf8",
  );
  assert(
    /softCommunityJoinStatusMessage\(chrome\.enrollFailed\)/.test(flutterTournamentsCubit) &&
      /softCommunityJoinStatusMessage\(chrome\.joinedFree\)/.test(flutterTournamentsCubit) &&
      /softCommunityLoadFailed\(chrome\.loadFailed\)/.test(flutterTournamentsCubit),
    "Flutter Official TournamentsCubit softs enrollFailed + joinedFree + loadFailed",
  );
  assert(
    /softCommunityJoinStatusMessage\(\s*widget\.payChrome\?\.alreadyEnrolled/.test(
      flutterTournamentsPage,
    ) && /softCommunityJoinStatusMessage\(st\.enrollMessage!\)/.test(flutterTournamentsPage),
    "Flutter Official hub softs alreadyEnrolled + enrollMessage snacks",
  );
  const flutterEventLobby = readFileSync(
    join(root, "apps/mobile/lib/features/events/event_cup_lobby_sheet.dart"),
    "utf8",
  );
  assert(
    /softCommunityLoadFailed\(/.test(flutterEventLobby) &&
      /softCommunityPrizePendingBlurb\(/.test(flutterEventLobby) &&
      /softCommunityArenaLobbyTitle\(/.test(flutterEventLobby) &&
      /softCommunityLobbyBlurb\(/.test(flutterEventLobby) &&
      /softCommunityArenaLobbyBlurb\(/.test(flutterEventLobby),
    "Flutter Community lobby softs loadFailed + prize pending + arena/lobby title/blurb",
  );
  assert(
    /softCommunityLobbyUnavailable\(/.test(flutterEventLobby),
    "Flutter Community lobby softs lobbyUnavailable",
  );
  const flutterOfficialLobby = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournament_cup_lobby_sheet.dart"),
    "utf8",
  );
  assert(
    /softCommunityLoadFailed\(/.test(flutterOfficialLobby) &&
      /softCommunityPrizePendingBlurb\(/.test(flutterOfficialLobby) &&
      /softCommunityArenaLobbyTitle\(/.test(flutterOfficialLobby) &&
      /softCommunityLobbyBlurb\(/.test(flutterOfficialLobby) &&
      /softCommunityArenaLobbyBlurb\(/.test(flutterOfficialLobby),
    "Flutter Official lobby softs loadFailed + prize pending + arena/lobby title/blurb",
  );
  assert(
    /softCommunityLobbyUnavailable\(/.test(flutterOfficialLobby),
    "Flutter Official lobby softs lobbyUnavailable",
  );
  assert(
    /softCompetitionPointsLabel\(/.test(flutterEventLobby) &&
      /softCompetitionPointsLabel\(/.test(flutterOfficialLobby),
    "Flutter cup lobbies soft arenaPointsLabel",
  );
  assert(
    /softHostingReportAction\(/.test(flutterOfficialLobby),
    "Flutter Official lobby softs reportAction via softHostingReportAction",
  );
  assert(
    !/widget\.softCommunityLoadFailed\(/.test(flutterEventLobby) &&
      !/widget\.softCommunityLoadFailed\(/.test(flutterOfficialLobby),
    "Flutter cup lobbies have no corrupted widget.softCommunityLoadFailed calls",
  );
  assert(/softCommunityJoinBlurb\(/.test(joinPanel), "web Hosting Join panel softs join_blurb");
  const createHostMut = readFileSync(
    join(root, "apps/web/src/hooks/mutation/useCreateHostedEventMutation.ts"),
    "utf8",
  );
  assert(
    /softHostingToastCreateFailed\(/.test(createHostMut),
    "web create mutation softs toast_create_failed",
  );
  assert(
    /softCommunityJoinBlurb\(/.test(flutterJoin) && /softCommunityBracketTitle\(/.test(flutterJoin),
    "Flutter Join page softs joinBlurb + bracketTitle",
  );
  assert(
    /softHostingToastCreateFailed\(/.test(flutterHostList),
    "Flutter Host create softs toastCreateFailed",
  );
  assert(
    /softHostingChromeUnavailable\(chrome\.unavailable\)/.test(flutterHostList),
    "Flutter Host create shell-fail softs chrome.unavailable",
  );
  assert(
    /softCommunityBracketTitle\(/.test(manageDlg) && /softHostingTitleLabel\(/.test(manageDlg),
    "web Manage dialog softs bracket_title + title_label",
  );
  assert(
    /softCommunityWinnersTitle\(/.test(manageDlg) &&
      /softCommunityShareResultAction\(/.test(manageDlg) &&
      /softCommunityResultCardShareImageAction\(/.test(manageDlg) &&
      /softCommunityResultCardDownloadAction\(/.test(manageDlg),
    "web Manage dialog softs winners/share/result-card image actions",
  );
  assert(
    /softCommunityBracketTitle\(/.test(flutterHostList) &&
      /softHostingTitleLabel\(/.test(flutterHostList),
    "Flutter Host manage softs bracketTitle + titleLabel",
  );
  assert(
    /softCommunityWinnersTitle\(/.test(flutterHostList) &&
      /softCommunityShareResultAction\(/.test(flutterHostList) &&
      /softCommunityResultCardShareImageAction\(/.test(flutterHostList) &&
      /softCommunityResultCardDownloadAction\(/.test(flutterHostList),
    "Flutter Host manage softs winners/share/result-card image actions",
  );
  assert(/softHostingTitleLabel\(/.test(hostList), "web Host create softs title_label");
}

async function main() {
  assertNavTrophyIcons();
  const tpc = await req("/public/tournaments-player-chrome");
  assert(tpc.status === 200, `tournaments-player-chrome ${tpc.status}`);
  const t = tpc.body || {};
  assert((t.filter_source_official_label || "").trim() === "Official", "filter Official");
  assert((t.filter_source_community_label || "").trim() === "Community", "filter Community");
  assert((t.filter_source_all_label || "").trim() === "All", "filter All");
  assert((t.badge_official_label || "").trim() === "Official", "badge Official");
  assert((t.badge_community_label || "").trim() === "Community", "badge Community");
  assert((t.filter_free_label || "").trim().length > 0, "filter free label");
  assert((t.filter_paid_label || "").trim().length > 0, "filter paid label");
  assert((t.host_tournament_action || "").trim() === "Host a tournament", "Host CTA");
  assert(
    (t.host_tournament_href || "").trim() === "/events/events?create=1",
    "Host → create portal (?create=1)",
  );
  assert(
    (t.host_tournament_blurb || "").toLowerCase().includes("community"),
    "Host blurb community tournament",
  );
  assert(!(t.page_title || "").toLowerCase().includes("event"), "page_title Tournament");
  assert(
    !(t.est_prize_share_blurb || "").toLowerCase().includes("event ends"),
    "est share blurb not event ends",
  );
  assert(
    (t.empty_community || "").toLowerCase().includes("community"),
    "empty_community Community wording",
  );
  noEventSport("empty_community", t.empty_community);
  noEventSport("empty_official", t.empty_official);

  // Mig 400: Refund Policy tournament entry - no Event-sport wording on /refunds.
  const refundsDoc = await req("/public/legal/refunds");
  assert(refundsDoc.status === 200, `public/legal/refunds ${refundsDoc.status}`);
  const refundBodies = (refundsDoc.body?.sections || [])
    .map((s) => String(s?.body || ""))
    .join("\n");
  assert(refundBodies.length > 0, "refunds legal sections present");
  assert(
    !/the event has started/i.test(refundBodies),
    "refunds Tournament entry not Event-sport (the event has started)",
  );
  assert(
    /the tournament has started/i.test(refundBodies) || !/has started/i.test(refundBodies),
    "refunds tournament-started wording when present",
  );

  // Mig 396: Official arena queue/leave writeTournamentsPlayerErr toast keys (+ error_key).
  assert((t.toast_arena_queue_failed || "").trim().length > 0, "official toast_arena_queue_failed");
  noEventSport("official toast_arena_queue_failed", t.toast_arena_queue_failed);
  assert((t.toast_arena_start_failed || "").trim().length > 0, "official toast_arena_start_failed");
  noEventSport("official toast_arena_start_failed", t.toast_arena_start_failed);
  // Allowlist: Official Ready/Open Play keys reachable on chrome GET.
  assert((t.err_match_not_ready || "").trim().length > 0, "official err_match_not_ready allowlist");
  assert((t.err_start_failed || "").trim().length > 0, "official err_start_failed allowlist");
  noEventSport("official err_start_failed", t.err_start_failed);
  // Shared admin points path: Official + Community player chromes keep same labels/fmt.
  assert((t.standings_points_label || "").trim().length > 0, "official standings_points_label");
  assert(
    (t.toast_points_awarded_fmt || "").includes("{points}"),
    "official toast_points_awarded_fmt {points}",
  );
  noEventSport("official standings_points_label", t.standings_points_label);

  const epc = await req("/public/events-player-chrome");
  assert(epc.status === 200, `events-player-chrome ${epc.status}`);
  const e = epc.body || {};
  assert(
    String(e.standings_points_label || "").trim() === String(t.standings_points_label || "").trim(),
    `Community standings_points_label shared with Official: ${e.standings_points_label}`,
  );
  assert(
    String(e.toast_points_awarded_fmt || "").trim() ===
      String(t.toast_points_awarded_fmt || "").trim(),
    `Community toast_points_awarded_fmt shared with Official: ${e.toast_points_awarded_fmt}`,
  );
  noEventSport("community standings_points_label", e.standings_points_label);
  assert((e.join_title || "").trim() === "Join with code", "join_title");
  assert(
    (e.page_title || "").trim() === "Community tournaments",
    `player page_title exact Community tournaments: ${e.page_title}`,
  );
  assert(
    (e.public_list_title || "").trim() === "Community tournaments",
    `public_list_title exact Community tournaments: ${e.public_list_title}`,
  );
  assert(
    (e.lobby_title || "").trim() === "Cup lobby",
    `lobby_title exact Cup lobby: ${e.lobby_title}`,
  );
  assert(
    !(e.lobby_unavailable || "").toLowerCase().includes("event"),
    "lobby_unavailable not Event",
  );
  noEventSport("player empty_web", e.empty_web);
  noEventSport("player lobby_title", e.lobby_title);
  noEventSport("player page_title", e.page_title);
  noEventSport("player public_list_title", e.public_list_title);
  noEventSport("player search_placeholder", e.search_placeholder);
  noEventSport("player report_action", e.report_action);
  noEventSport("player report_title", e.report_title);
  assert(
    (e.report_title || "").toLowerCase().includes("tournament"),
    `player report_title Tournament: ${e.report_title}`,
  );
  noEventSport("player feature_disabled", e.feature_disabled);
  noEventSport("player public_disabled", e.public_disabled);
  noEventSport("player public_list_empty", e.public_list_empty);
  assert(
    (e.public_list_empty || "").toLowerCase().includes("community") ||
      (e.public_list_empty || "").toLowerCase().includes("tournament"),
    `player public_list_empty Community/Tournament: ${e.public_list_empty}`,
  );
  assert(!(e.lobby_title || "").toLowerCase().includes("event"), "lobby_title not Event");
  assert(
    !(e.search_placeholder || "").toLowerCase().includes("event"),
    "search_placeholder not Event",
  );
  noEventSport("player detail_unavailable", e.detail_unavailable);
  noEventSport("player lobby_unavailable", e.lobby_unavailable);
  noEventSport("player chrome_unavailable", e.events_player_chrome_unavailable);
  // Mig 392: player report/match/QR paths read these from events_player_chrome only.
  assert(
    (e.err_catalog_unavailable || "").trim().length > 0 &&
      !/\bevents?\b/i.test(String(e.err_catalog_unavailable || "")),
    `player err_catalog_unavailable Tournament: ${e.err_catalog_unavailable}`,
  );
  noEventSport("player err_event_not_live", e.err_event_not_live);
  // Mig 410: writeEventsPlayerErr not-found/forbidden (201 seed hardened).
  noEventSport("player err_event_not_found", e.err_event_not_found);
  assert(
    (e.err_event_not_found || "").toLowerCase().includes("tournament"),
    `player err_event_not_found Tournament: ${e.err_event_not_found}`,
  );
  noEventSport("player err_forbidden", e.err_forbidden);
  assert(
    (e.err_forbidden || "").toLowerCase().includes("tournament"),
    `player err_forbidden Tournament: ${e.err_forbidden}`,
  );
  assert((e.err_match_not_found || "").trim().length > 0, "player err_match_not_found");
  assert((e.err_match_not_ready || "").trim().length > 0, "player err_match_not_ready");
  assert((e.err_players_missing || "").trim().length > 0, "player err_players_missing");
  assert((e.qr_unavailable || "").trim().length > 0, "player qr_unavailable");
  // Mig 393: check-in / start-game / cannot-join paths read these from player chrome only.
  noEventSport("player cannot_join_status", e.cannot_join_status);
  noEventSport("player err_start_failed", e.err_start_failed);
  assert((e.err_start_game_failed || "").trim().length > 0, "player err_start_game_failed");
  // Mig 395: hosted arena queue/leave writeEventsPlayerErr toast keys.
  assert((e.toast_arena_queue_failed || "").trim().length > 0, "player toast_arena_queue_failed");
  noEventSport("player toast_arena_queue_failed", e.toast_arena_queue_failed);
  assert((e.toast_arena_start_failed || "").trim().length > 0, "player toast_arena_start_failed");
  // Allowlist: Community Ready/Open Play / unauthorized keys on chrome GET.
  assert((e.err_match_not_ready || "").trim().length > 0, "player err_match_not_ready allowlist");
  assert(
    (e.err_start_game_failed || "").trim().length > 0,
    "player err_start_game_failed allowlist",
  );
  assert((e.err_unauthorized || "").trim().length > 0, "player err_unauthorized allowlist");
  noEventSport("player err_unauthorized", e.err_unauthorized);

  const spc = await req("/public/spectate-chrome");
  assert(spc.status === 200, `spectate-chrome ${spc.status}`);
  const s = spc.body || {};
  // Mig 394: activity panel must not say Event sport.
  noEventSport("spectate event_log_title", s.event_log_title);
  noEventSport("spectate no_events", s.no_events);
  assert(
    (s.event_log_title || "").toLowerCase().includes("match") ||
      (s.event_log_title || "").toLowerCase().includes("activity"),
    `spectate event_log_title Match/activity: ${s.event_log_title}`,
  );

  const eoc = await req("/public/events-organizer-chrome");
  assert(eoc.status === 200, `events-organizer-chrome ${eoc.status}`);
  const o = eoc.body || {};
  assert((o.create_action || "").trim() === "Host a tournament", "create_action Host");
  assert(
    (o.list_title || "").trim() === "My hosted tournaments",
    `list_title exact My hosted tournaments: ${o.list_title}`,
  );
  noEventSport("list_title", o.list_title);
  assert(
    (o.dashboard_title || "").trim() === "Hosting dashboard",
    `dashboard_title exact Hosting dashboard: ${o.dashboard_title}`,
  );
  noEventSport("dashboard_title", o.dashboard_title);
  assert(
    (o.create_title || "").trim() === "Host a community tournament",
    `create_title exact: ${o.create_title}`,
  );
  noEventSport("create_title", o.create_title);
  assert(
    (o.analytics_title || "").trim() === "Hosting analytics",
    `analytics_title exact Hosting analytics: ${o.analytics_title}`,
  );
  noEventSport("analytics_title", o.analytics_title);
  assert((o.start_action || "").trim() === "Start tournament", "start_action");
  assert((o.close_action || "").trim() === "Close tournament", "close_action");
  assert((o.reopen_action || "").trim() === "Reopen tournament", "reopen_action");
  assert((o.empty_list || "").trim() === "No hosted tournaments yet.", "empty_list");
  noEventSport("organizer empty_list", o.empty_list);
  noEventSport("organizer list_blurb", o.list_blurb);
  noEventSport("organizer dashboard_blurb", o.dashboard_blurb);
  assert((o.toast_created || "").trim() === "Tournament created", "toast_created");
  assert(
    (o.portal_public_list_label || "").trim() === "Community tournaments",
    "portal_public_list_label exact Community tournaments",
  );
  noEventSport("organizer analytics_blurb", o.analytics_blurb);
  noEventSport("organizer visibility_public_blurb", o.visibility_public_blurb);
  assert((o.search_label || "").trim() === "Search tournaments", "search_label");
  noEventSport("organizer create_blurb", o.create_blurb);
  assert((o.analytics_empty || "").trim() === "No hosted tournaments yet.", "analytics_empty");
  noEventSport("organizer feature_disabled", o.feature_disabled);
  noEventSport("organizer public_disabled", o.public_disabled);
  noEventSport("organizer public_list_empty", o.public_list_empty);
  noEventSport("organizer search_placeholder", o.search_placeholder);
  noEventSport("organizer report_title", o.report_title);
  assert(
    (o.portal_public_list_href || "").includes("source=community"),
    "portal public → Community",
  );
  assert(
    (o.portal_public_list_label || "").trim().length > 0,
    "portal_public_list_label for post-create",
  );
  assert(
    (o.portal_public_list_label || "").toLowerCase().includes("community"),
    `portal_public_list_label Community: ${o.portal_public_list_label}`,
  );
  noEventSport("portal_public_list_label", o.portal_public_list_label);
  noEventSport("portal_create_label", o.portal_create_label);
  assert(
    (o.visibility_public_blurb || "").toLowerCase().includes("community"),
    "visibility blurb Community",
  );
  noEventSport("host search_label", o.search_label);
  noEventSport("host toast_created", o.toast_created);
  noEventSport("host public_list_title", o.public_list_title);
  noEventSport("host err_event_not_found", o.err_event_not_found);
  noEventSport("host err_catalog_unavailable", o.err_catalog_unavailable);
  // Mig 411: writeEventsOrgErr create/list/start (201 organizer seed hardened).
  noEventSport("host err_create_failed", o.err_create_failed);
  noEventSport("host err_list_failed", o.err_list_failed);
  noEventSport("host err_start_failed", o.err_start_failed);
  noEventSport("host err_close_failed", o.err_close_failed);
  noEventSport("host err_update_failed", o.err_update_failed);
  // Mig 413: Hosting patch/logo/analytics (184 seed hardened).
  noEventSport("host patch_title_locked", o.patch_title_locked);
  noEventSport("host upload_logo_failed", o.upload_logo_failed);
  noEventSport("host analytics_title", o.analytics_title);
  noEventSport("host analytics_empty", o.analytics_empty);
  // Mig 414: Hosting sponsor upload fail (softHostingUploadSponsorFailed parity).
  noEventSport("host upload_sponsor_failed", o.upload_sponsor_failed);
  assert((o.upload_sponsor_failed || "").trim().length > 0, "host upload_sponsor_failed set");
  noEventSport("host chrome_unavailable", o.events_organizer_chrome_unavailable);

  const nav = await req("/platform/client-nav");
  assert(nav.status === 200, `client-nav ${nav.status}`);
  const brand = (nav.body?.events_brand_name || "").trim();
  assert(brand.length > 0 && !/\bevents?\b/i.test(brand), `events_brand_name Hosting: ${brand}`);
  assert(/^hosting$/i.test(brand), `events_brand_name exact Hosting: ${brand}`);
  const navUnavailable = (nav.body?.events_nav_unavailable || "").trim();
  if (navUnavailable) {
    assert(
      !/\bevents?\b/i.test(navUnavailable),
      `events_nav_unavailable Hosting: ${navUnavailable}`,
    );
  }
  const hostNav = Array.isArray(nav.body?.events) ? nav.body.events : [];
  const hostBottom = Array.isArray(nav.body?.bottom_nav?.events) ? nav.body.bottom_nav.events : [];
  for (const row of [...hostNav, ...hostBottom]) {
    const key = (row?.route_key || "").trim();
    const href = (row?.href || "").trim().split("?")[0];
    assert(key !== "events_public" && key !== "events", `Hosting nav no public browse key: ${key}`);
    assert(
      href !== "/events/public" && !href.startsWith("/events/public/"),
      `Hosting nav no /events/public: ${href}`,
    );
  }
  const dash = hostNav.find((x) => (x?.route_key || "") === "events_dashboard");
  if (dash) {
    assert(
      !/\bevents?\b/i.test(String(dash.title || "")),
      `host dashboard tab Hosting: ${dash.title}`,
    );
    assert(
      /^hosting$/i.test(String(dash.title || "").trim()),
      `host dashboard title exact Hosting: ${dash.title}`,
    );
  }
  const hostBottomDash = hostBottom.find((x) => (x?.route_key || "") === "events_dashboard");
  if (hostBottomDash) {
    assert(
      !/\bevents?\b/i.test(String(hostBottomDash.title || "")),
      `host bottom_nav dashboard Hosting: ${hostBottomDash.title}`,
    );
    assert(
      /^hosting$/i.test(String(hostBottomDash.title || "").trim()),
      `host bottom_nav title exact Hosting: ${hostBottomDash.title}`,
    );
  }
  const bottomPlayer = nav.body?.bottom_nav?.player || [];
  const playerArr = Array.isArray(bottomPlayer) ? bottomPlayer : [];
  assert(
    !playerArr.some((x) => (x?.route_key || "") === "events"),
    "player bottom_nav has no events browse tab",
  );
  const playerRail = Array.isArray(nav.body?.player) ? nav.body.player : [];
  assert(
    !playerRail.some((x) => (x?.route_key || "") === "events"),
    "player rail has no events browse tab",
  );
  // Marketing footer must not advertise a second Event browse sport.
  const marketing = Array.isArray(nav.body?.marketing) ? nav.body.marketing : [];
  for (const row of marketing) {
    const key = (row?.route_key || "").trim();
    const title = String(row?.title || "");
    const href = String(row?.href || "");
    assert(key !== "events" && key !== "events_public", `marketing no Event browse key: ${key}`);
    assert(!/\bevents?\b/i.test(title), `marketing title not Event-sport: ${title}`);
    assert(
      !href.includes("/events/public") && !href.includes("view=events"),
      `marketing href not Event browse: ${href}`,
    );
  }
  const marketingTournaments = marketing.find((x) => (x?.route_key || "") === "tournaments");
  assert(marketingTournaments, "marketing footer has Tournaments (mig 408)");
  assert(
    String(marketingTournaments.title || "").trim() === "Tournaments",
    `marketing Tournaments title: ${marketingTournaments.title}`,
  );
  assert(
    String(marketingTournaments.href || "").includes("view=tournaments"),
    `marketing Tournaments href guest hub: ${marketingTournaments.href}`,
  );
  assert(
    playerArr.some((x) => (x?.route_key || "") === "tournaments"),
    "player bottom_nav has Tournaments tab",
  );
  const dashCards = Array.isArray(nav.body?.dashboard) ? nav.body.dashboard : [];
  for (const card of dashCards) {
    const key = (card?.route_key || "").trim();
    const title = String(card?.title || "");
    const body = String(card?.body || "");
    const cta = String(card?.cta || "");
    // Mig 398: leftover Tournaments dashboard card must not say Event sport.
    if (key === "tournaments") {
      assert(!/\bevents?\b/i.test(body), `dashboard tournaments body not Event-sport: ${body}`);
      assert(!/\bevents?\b/i.test(cta), `dashboard tournaments cta not Event-sport: ${cta}`);
      assert(!/\bevents?\b/i.test(title), `dashboard tournaments title not Event-sport: ${title}`);
    }
  }
  const hostCard = dashCards.find((x) => {
    const key = (x?.route_key || "").trim();
    const href = (x?.href || "").trim();
    return (
      (key === "events_dashboard" || key === "events") &&
      (href === "/events" || href.startsWith("/events/"))
    );
  });
  if (hostCard) {
    assert(
      !/\bevents?\b/i.test(String(hostCard.title || "")),
      `portal Hosting card title: ${hostCard.title}`,
    );
    if ((hostCard.cta || "").trim()) {
      assert(
        !/\bevents?\b/i.test(String(hostCard.cta || "")),
        `portal Hosting card cta: ${hostCard.cta}`,
      );
    }
  }

  const wallet = await req("/public/wallet-chrome");
  assert(wallet.status === 200, `wallet-chrome ${wallet.status}`);
  const w = wallet.body || {};
  assert(
    !(w.list_kind_event_entry_paid || "").toLowerCase().startsWith("event "),
    "wallet entry fee Tournament wording",
  );
  assert(
    !(w.list_kind_event_host_fee || "").toLowerCase().startsWith("event "),
    "wallet host fee Tournament wording",
  );
  for (const [k, label] of [
    ["list_kind_event_entry_commission", "commission"],
    ["list_kind_event_entry_refund", "refund"],
    ["list_kind_event_entry_clawback", "clawback"],
  ]) {
    assert(
      !(w[k] || "").toLowerCase().startsWith("event "),
      `wallet entry ${label} Tournament wording`,
    );
  }

  const cat = await req("/events/catalog");
  assert(cat.status === 200, `events/catalog ${cat.status}`);
  const share = (cat.body?.share_path_template || "").trim();
  assert(
    share.includes("view=tournaments") && share.includes("source=community"),
    `share ${share}`,
  );
  const pubVis = (cat.body?.hosted_event_public_visibility || "").trim();
  assert(pubVis.length > 0, `public visibility code from live enums: ${pubVis}`);
  assert(!/\bevents?\b/i.test(pubVis), `public visibility code not Event-sport: ${pubVis}`);

  const list = await req("/tournaments?skip=0&limit=1");
  assert(list.status === 200, `tournaments list ${list.status}`);
  const row = (list.body?.tournaments || [])[0];
  if (row) {
    assert(
      typeof row.format_id === "string" || row.format_id == null,
      "format_id field present-or-null",
    );
    if (row.format_label)
      assert(String(row.format_label).trim().length > 0, "format_label non-empty when set");
  }

  const pub = await req("/events/public?skip=0&limit=1");
  assert(
    pub.status === 200 || pub.status === 403 || pub.status === 503,
    `events/public ${pub.status}`,
  );

  // Shared points path still admin-configured (formats unchanged by UX unify).
  const stamp = Date.now().toString(36);
  const sess = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `ux_${stamp}`,
      email: `ux_${stamp}@ex.com`,
      role: "admin",
    }),
  });
  if (sess.status === 404 || sess.status === 403) {
    console.log("SKIP points-toast admin probe (e2e auth off)");
  } else {
    assert(sess.status === 200 && sess.body?.access_token, "admin e2e session");
    const auth = { Authorization: `Bearer ${sess.body.access_token}` };
    const pts = await req("/console/competition/points-toast-settings", {
      headers: auth,
    });
    assert(pts.status === 200, `points-toast-settings ${pts.status}`);
    assert((pts.body?.standings_points_label || "").trim(), "standings_points_label");
    assert((pts.body?.toast_points_awarded_fmt || "").includes("{points}"), "toast fmt {points}");
    const evCat = await req("/console/events/catalog", { headers: auth });
    assert(evCat.status === 200, `console events catalog ${evCat.status}`);
    const qrPrefix = (evCat.body?.qr_filename_prefix || "").trim();
    assert(qrPrefix.length > 0, "qr_filename_prefix set");
    assert(
      !/\bevents?\b/i.test(qrPrefix),
      `host QR filename prefix Tournament wording: ${qrPrefix}`,
    );
  }

  const adminChrome = await req("/public/tournament-chrome");
  assert(adminChrome.status === 200, `tournament-chrome ${adminChrome.status}`);
  assert(
    !(adminChrome.body?.points_toast_settings_notif_body_blurb || "")
      .toLowerCase()
      .includes("event title"),
    "admin points blurb tournament title",
  );

  // Mig 379 + 390–391 + 397: player notif titles (Tournament) + deep-links (auto-try local postgres).
  // Force with DAMA_E2E_PG_CHECK=1; disable with DAMA_E2E_PG_CHECK=0.
  const pgOpt = (process.env.DAMA_E2E_PG_CHECK || "").trim();
  if (pgOpt !== "0") {
    try {
      const { execFileSync } = await import("node:child_process");
      const runPg = (sql) =>
        execFileSync(
          "docker",
          [
            "exec",
            "-i",
            "dama_postgres",
            "psql",
            "-U",
            "dama",
            "-d",
            "dama",
            "-t",
            "-A",
            "-F",
            "|",
            "-c",
            sql,
          ],
          { encoding: "utf8" },
        ).trim();
      const titleOut = runPg(
        "SELECT code, title_template FROM notification_kinds WHERE audience='player' AND code LIKE 'player.event_%' ORDER BY code;",
      );
      const titleRows = titleOut
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      assert(titleRows.length >= 8, `notif title rows: ${titleRows.length}`);
      for (const line of titleRows) {
        const [code, title] = line.split("|");
        assert(!!code && !!title, `notif title row: ${line}`);
        assert(!/\bevents?\b/i.test(title), `notif title not Event-sport: ${code}|${title}`);
      }
      const sql =
        "SELECT code, href_path, href_query_key FROM notification_kinds WHERE code IN (" +
        "'player.competition_points_awarded'," +
        "'player.event_cancelled','player.event_entry_kicked','player.event_reopened'," +
        "'player.event_auto_closed','player.event_finished'," +
        "'player.arena_started','player.arena_finished','player.arena_matched'" +
        ") ORDER BY code;";
      const out = runPg(sql);
      const rows = out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      assert(rows.length >= 9, `notif href rows: ${rows.length}`);
      for (const line of rows) {
        const [code, href, q] = line.split("|");
        if (
          code === "player.competition_points_awarded" ||
          code === "player.arena_started" ||
          code === "player.arena_finished" ||
          code === "player.arena_matched"
        ) {
          assert(
            (href || "").includes("view=tournaments") && (q || "").trim() === "id",
            `cup notif tournaments&id: ${line}`,
          );
        } else {
          // kick/cancel/reopen/auto_closed use code; finished may use id (cup deep-link).
          const qOk =
            code === "player.event_finished"
              ? (q || "").trim() === "id" || (q || "").trim() === "code"
              : (q || "").trim() === "code";
          assert(
            (href || "").includes("view=tournaments") &&
              (href || "").includes("source=community") &&
              qOk,
            `lifecycle notif Community: ${line}`,
          );
        }
      }
    } catch (err) {
      if (pgOpt === "1") throw err;
      console.log("SKIP: postgres notif href check (docker/psql unavailable)");
    }
  }

  // Host create Public → same Community feed (/events/public) used by Tournaments hub.
  // Needs e2e auth + wallet credit via postgres (same pattern as hosted arena e2e).
  if (pgOpt !== "0") {
    try {
      const { execFileSync } = await import("node:child_process");
      const stamp = Date.now().toString(36);
      const hostSess = await req("/auth/e2e/session", {
        method: "POST",
        body: JSON.stringify({
          username: `ux_host_${stamp}`,
          email: `ux_host_${stamp}@ex.com`,
        }),
      });
      if (hostSess.status === 404 || hostSess.status === 403) {
        console.log("SKIP: Host create→Community (e2e auth off)");
      } else {
        assert(hostSess.status === 200 && hostSess.body?.access_token, "host e2e session");
        const tok = hostSess.body.access_token;
        const uid = String(hostSess.body?.user?.id || "").trim();
        assert(uid, "host user id");
        const auth = { Authorization: `Bearer ${tok}` };
        await req("/me/age-gate", {
          method: "PUT",
          headers: auth,
          body: JSON.stringify({ date_of_birth: "1988-06-01" }),
        });
        await req("/me/phone-kyc", {
          method: "PUT",
          headers: auth,
          body: JSON.stringify({ phone: `+2519${stamp.slice(-8).padStart(8, "0")}` }),
        });
        await req("/geo/locate", { method: "POST", headers: auth, body: "{}" });
        execFileSync(
          "docker",
          [
            "exec",
            "-i",
            "dama_postgres",
            "psql",
            "-U",
            "dama",
            "-d",
            "dama",
            "-c",
            `INSERT INTO wallets (user_id, currency, balance, updated_at)
             VALUES ('${uid.replace(/'/g, "")}','ETB',500,NOW())
             ON CONFLICT (user_id, currency) DO UPDATE
             SET balance = wallets.balance + 500, updated_at = NOW();`,
          ],
          { encoding: "utf8" },
        );
        const cat = await req("/events/catalog", { headers: auth });
        assert(cat.status === 200, `events catalog ${cat.status}`);
        const formatId = String(cat.body?.formats?.[0]?.id || "").trim();
        const sizeId = String(cat.body?.sizes?.[0]?.id || "").trim();
        const vis = String(cat.body?.hosted_event_public_visibility || "public").trim();
        assert(formatId && sizeId && vis, "catalog format/size/public visibility");
        assert(
          cat.body?.hosted_events_enabled === true,
          "hosted_events_enabled for Host/Community",
        );
        assert(cat.body?.public_events_enabled === true, "public_events_enabled for Community");
        const created = await req("/events/", {
          method: "POST",
          headers: auth,
          body: JSON.stringify({
            title: `Community UX ${stamp}`,
            format_id: formatId,
            size_id: sizeId,
            visibility: vis,
          }),
        });
        assert(
          (created.status === 200 || created.status === 201) && created.body?.id,
          `Host create Public ${created.status} ${created.body?.error || created.body?.error_key || ""}`,
        );
        assert(
          String(created.body.visibility || "").trim() === vis,
          `created visibility public: ${created.body.visibility}`,
        );
        const joinCode = String(created.body.join_code || "")
          .trim()
          .toUpperCase();
        assert(joinCode.length >= 4, `created join_code: ${joinCode}`);
        const shareUrl = String(created.body.share_url || "").trim();
        assert(shareUrl.length > 0, "created share_url minted");
        assert(
          shareUrl.includes("view=tournaments") &&
            shareUrl.includes("source=community") &&
            shareUrl.toUpperCase().includes(joinCode),
          `created share_url Community+code: ${shareUrl}`,
        );
        assert(!/view=events/i.test(shareUrl), `share_url not legacy view=events: ${shareUrl}`);
        const pubList = await req("/events/public?skip=0&limit=100");
        assert(pubList.status === 200, `events/public after create ${pubList.status}`);
        const hit = (pubList.body?.events || []).find((e) => e?.id === created.body.id);
        assert(hit, "Host Public create appears in Community feed (/events/public)");
        const listShare = String(hit.share_url || "").trim();
        assert(
          listShare.includes("view=tournaments") &&
            listShare.includes("source=community") &&
            listShare.toUpperCase().includes(joinCode),
          `Community feed share_url Community+code: ${listShare}`,
        );
        assert(
          String(hit.format_label || "").trim().length > 0,
          `Community feed format_label for badge/format row: ${hit.format_label}`,
        );
      }
    } catch (err) {
      if (pgOpt === "1") throw err;
      console.log("SKIP: Host create→Community check (docker/auth unavailable)");
    }
  }

  console.log("PASS: tournament community UX chrome + share + points settings");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
