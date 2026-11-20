/**
 * E2E: Tournament discovery lifecycle UX (mig 441–443).
 * Status-honest chrome CTAs, Open·Live·Finished·My cups, My tournaments
 * (place/points/streak/prize), list lifecycle filters, started_at/finished_at,
 * settle chrome, dashboard My tournaments, finished never-enroll guards.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-tournament-discovery-lifecycle-check.mjs
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

function nonEmpty(v) {
  return String(v || "").trim().length > 0;
}

function assertSourceLocks() {
  const webCta = readFileSync(join(root, "apps/web/src/lib/cupLifecycle.ts"), "utf8");
  assert(/resolveCupCardCta/.test(webCta), "web cupLifecycle resolveCupCardCta");
  assert(/phase === \"finished\"/.test(webCta), "web finished → results kind");

  const hub = readFileSync(
    join(root, "apps/web/src/components/tournaments/CompetitionTournamentsHub.tsx"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(hub), "web Official hub uses resolveCupCardCta");
  assert(/lifecycleFilter/.test(hub), "web Official hub lifecycle filter");
  assert(/mineFilter/.test(hub), "web Official hub mine filter");

  const eventsHub = readFileSync(
    join(root, "apps/web/src/components/events/EventsPlayerHub.tsx"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(eventsHub), "web Community hub uses resolveCupCardCta");
  assert(/lifecycleFilter/.test(eventsHub), "web Community hub lifecycle filter");

  const detailModal = readFileSync(
    join(root, "apps/web/src/components/events/EventDetailModal.tsx"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(detailModal), "web EventDetailModal resolveCupCardCta");
  assert(
    /cardCta\.kind !== \"enroll\"/.test(detailModal),
    "web EventDetailModal finished never enroll",
  );

  const publicBrowse = readFileSync(
    join(root, "apps/web/src/components/events/PublicEventsBrowse.tsx"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(publicBrowse), "web PublicEventsBrowse resolveCupCardCta");

  const marketing = readFileSync(join(root, "apps/web/src/app/(marketing)/page.tsx"), "utf8");
  assert(/cupLifecyclePhase/.test(marketing), "web marketing enroll gated by lifecycle phase");

  const profile = readFileSync(
    join(root, "apps/web/src/components/profile/ProfileMyTournaments.tsx"),
    "utf8",
  );
  assert(
    /lifecycle.*all/.test(profile) || /"all"/.test(profile),
    "web profile My tournaments lifecycle=all",
  );
  assert(/mine:\s*true|mineFilter|mine = true|true,\s*\n\s*\)/.test(profile), "web profile mine");
  assert(/viewer_prize_amount/.test(profile), "web My tournaments shows viewer_prize_amount");
  assert(/my_tournaments_prize_label/.test(profile), "web My tournaments prize chrome label");

  const dash = readFileSync(join(root, "apps/web/src/app/(player)/dashboard/page.tsx"), "utf8");
  assert(/ProfileMyTournaments/.test(dash), "web dashboard embeds ProfileMyTournaments");

  const flutterLife = readFileSync(join(root, "apps/mobile/lib/core/cup_lifecycle.dart"), "utf8");
  assert(/resolveCupCardCta/.test(flutterLife), "Flutter cup_lifecycle resolveCupCardCta");

  const flutterTour = readFileSync(
    join(root, "apps/mobile/lib/features/tournaments/tournaments_page.dart"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(flutterTour), "Flutter Official cards resolveCupCardCta");
  assert(
    /CupLifecyclePhase\.open/.test(flutterTour) || /lifecycle/.test(flutterTour),
    "Flutter lifecycle chips",
  );

  const flutterEvents = readFileSync(
    join(root, "apps/mobile/lib/features/events/player_events_hub.dart"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(flutterEvents), "Flutter Community cards resolveCupCardCta");
  assert(/params\['mine'\]/.test(flutterEvents), "Flutter Community mine=1");

  const flutterHome = readFileSync(
    join(root, "apps/mobile/lib/features/home/home_page.dart"),
    "utf8",
  );
  assert(/resolveCupCardCta/.test(flutterHome), "Flutter home teaser resolveCupCardCta");
  assert(/lifecycle=open/.test(flutterHome), "Flutter home teaser lifecycle=open");

  const flutterPublicBrowse = readFileSync(
    join(root, "apps/mobile/lib/features/events/public_events_browse.dart"),
    "utf8",
  );
  assert(
    /resolveCupCardCta/.test(flutterPublicBrowse),
    "Flutter PublicEventsBrowse resolveCupCardCta",
  );

  const flutterPanel = readFileSync(
    join(root, "apps/mobile/lib/features/profile/my_tournaments_panel.dart"),
    "utf8",
  );
  assert(
    /lifecycle': 'all'/.test(flutterPanel) || /'lifecycle': 'all'/.test(flutterPanel),
    "Flutter My tournaments lifecycle=all",
  );
  assert(
    /mine': '1'/.test(flutterPanel) || /'mine': '1'/.test(flutterPanel),
    "Flutter My tournaments mine=1",
  );
  assert(/viewerPrizeAmount/.test(flutterPanel), "Flutter My tournaments prize amount");
  assert(/myTournamentsPrizeLabel/.test(flutterPanel), "Flutter My tournaments prize label");

  const flutterDash = readFileSync(
    join(root, "apps/mobile/lib/features/home/dashboard_page.dart"),
    "utf8",
  );
  assert(/MyTournamentsPanel/.test(flutterDash), "Flutter dashboard embeds MyTournamentsPanel");

  const flutterProfile = readFileSync(
    join(root, "apps/mobile/lib/features/profile/profile_page.dart"),
    "utf8",
  );
  assert(/MyTournamentsPanel/.test(flutterProfile), "Flutter profile embeds MyTournamentsPanel");

  const settleMut = readFileSync(
    join(root, "apps/admin/src/hooks/mutation/useSettleCompetitionPrizesMutation.ts"),
    "utf8",
  );
  assert(
    !/No prizes are due yet\./.test(settleMut),
    "admin settle mutation no invent English none-due",
  );
  assert(
    !/Unable to settle prizes\./.test(settleMut),
    "admin settle mutation no invent English failed",
  );

  const adminPage = readFileSync(
    join(root, "apps/admin/src/app/(console)/tournaments/page.tsx"),
    "utf8",
  );
  assert(
    !/Finish the tournament before settling prizes\."/.test(adminPage),
    "admin settle UI no invent English requires_finished",
  );

  const apiList = readFileSync(join(root, "apps/api/internal/rest/tournament_handlers.go"), "utf8");
  assert(/ViewerPrizesAmong/.test(apiList), "API list attaches ViewerPrizesAmong");
  assert(/viewer_prize_amount/.test(apiList), "API list exposes viewer_prize_amount");
  assert(/FinishedAt != nil/.test(apiList), "API enroll rejects finished cups");

  assert(
    existsSync(join(root, "apps/api/migrations/441_tournament_discovery_lifecycle_cta_chrome.sql")),
    "mig 441 present",
  );
  assert(
    existsSync(join(root, "apps/api/migrations/442_my_tournaments_place_points_chrome.sql")),
    "mig 442 present",
  );
  assert(
    existsSync(join(root, "apps/api/migrations/443_my_tournaments_prize_label_chrome.sql")),
    "mig 443 present",
  );
}

async function main() {
  assertSourceLocks();

  const tChrome = await req("/public/tournaments-player-chrome");
  assert(tChrome.status === 200, "tournaments-player-chrome 200");
  const t = tChrome.body || {};
  for (const k of [
    "watch_action",
    "results_action",
    "lobby_action",
    "filter_lifecycle_label",
    "filter_lifecycle_open_label",
    "filter_lifecycle_live_label",
    "filter_lifecycle_finished_label",
    "filter_mine_label",
    "empty_lifecycle_open",
    "empty_lifecycle_live",
    "empty_lifecycle_finished",
    "empty_mine",
    "my_tournaments_title",
    "my_tournaments_empty",
    "my_tournaments_open_action",
    "my_tournaments_place_label",
    "my_tournaments_points_label",
    "my_tournaments_streak_label",
    "my_tournaments_prize_label",
  ]) {
    assert(nonEmpty(t[k]), `tournaments_player_chrome.${k}`);
  }

  const eChrome = await req("/public/events-player-chrome");
  assert(eChrome.status === 200, "events-player-chrome 200");
  const e = eChrome.body || {};
  for (const k of [
    "watch_action",
    "results_action",
    "lobby_action",
    "filter_lifecycle_label",
    "filter_lifecycle_open_label",
    "filter_lifecycle_live_label",
    "filter_lifecycle_finished_label",
    "filter_mine_label",
    "empty_lifecycle_open",
    "empty_lifecycle_live",
    "empty_lifecycle_finished",
    "empty_mine",
  ]) {
    assert(nonEmpty(e[k]), `events_player_chrome.${k}`);
  }

  const adminChrome = await req("/public/tournament-chrome");
  assert(adminChrome.status === 200, "tournament-chrome 200");
  const a = adminChrome.body || {};
  for (const k of [
    "settle_prizes_action",
    "settle_prizes_pending",
    "settle_prizes_success_fmt",
    "settle_prizes_none_due",
    "settle_prizes_failed",
    "settle_prizes_requires_finished",
    "settle_prizes_already_settled",
    "prize_settle_settings_title",
    "prize_settle_settings_blurb",
    "prize_settle_settings_save_action",
    "prize_settle_label_auto_settle",
    "prize_settle_label_dispute_hours",
    "prize_settle_label_interval_minutes",
    "dispute_window_ends_at_label",
    "prize_settled_at_label",
    "status_after_start_blurb",
    "err_cup_already_started",
  ]) {
    assert(nonEmpty(a[k]), `tournament_chrome.${k}`);
  }

  for (const life of ["open", "live", "finished"]) {
    const list = await req(`/tournaments/?skip=0&limit=5&lifecycle=${life}`);
    assert(list.status === 200, `GET /tournaments lifecycle=${life} 200`);
    assert(Array.isArray(list.body?.tournaments), `tournaments array lifecycle=${life}`);
    for (const row of list.body.tournaments || []) {
      if (life === "finished") {
        assert(nonEmpty(row.finished_at), `finished row has finished_at (${row.id})`);
      }
      if (life === "live") {
        assert(nonEmpty(row.started_at), `live row has started_at (${row.id})`);
        assert(!nonEmpty(row.finished_at), `live row no finished_at (${row.id})`);
      }
      if (life === "open") {
        assert(!nonEmpty(row.started_at), `open row no started_at (${row.id})`);
        assert(!nonEmpty(row.finished_at), `open row no finished_at (${row.id})`);
      }
    }
  }

  const badLife = await req("/tournaments/?skip=0&limit=1&lifecycle=nope");
  assert(badLife.status === 400, "invalid tournament lifecycle → 400");

  const mineAnon = await req("/tournaments/?skip=0&limit=1&lifecycle=all&mine=1");
  assert(mineAnon.status === 401, "mine without auth → 401");

  for (const life of ["open", "live", "finished"]) {
    const list = await req(`/events/public?skip=0&limit=5&lifecycle=${life}`);
    assert(
      list.status === 200 || list.status === 403,
      `GET /events/public lifecycle=${life} ${list.status}`,
    );
    if (list.status === 200) {
      assert(Array.isArray(list.body?.events), `events array lifecycle=${life}`);
      for (const row of list.body.events || []) {
        if (life === "finished") {
          assert(nonEmpty(row.finished_at), `finished event has finished_at (${row.id})`);
        }
        if (life === "live") {
          assert(nonEmpty(row.started_at), `live event has started_at (${row.id})`);
          assert(!nonEmpty(row.finished_at), `live event no finished_at (${row.id})`);
        }
        if (life === "open") {
          assert(!nonEmpty(row.started_at), `open event no started_at (${row.id})`);
          assert(!nonEmpty(row.finished_at), `open event no finished_at (${row.id})`);
        }
      }
    }
  }

  const eventsMineAnon = await req("/events/public?skip=0&limit=1&lifecycle=all&mine=1");
  assert(eventsMineAnon.status === 401, "events mine without auth → 401");

  console.log("E2E_PASS: tournament discovery lifecycle (mig 441–443)");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
