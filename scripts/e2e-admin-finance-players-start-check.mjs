/**
 * Smoke: Financial overview + cup players entries + checked-in start chrome (mig 509/510).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-admin-finance-players-start-check.mjs
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1";
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

import { execFileSync } from "node:child_process";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function sql(q) {
  return execFileSync(
    "docker",
    ["exec", pgContainer, "psql", "-U", pgUser, "-d", pgDb, "-t", "-A", "-c", q],
    { encoding: "utf8" },
  ).trim();
}

async function req(path, opts = {}) {
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
  return { status: r.status, body };
}

async function e2eSession() {
  const stamp = Date.now().toString(36);
  return req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `fin_adm_${stamp}`,
      email: `fin_adm_${stamp}@example.com`,
      role: "admin",
    }),
  });
}

async function main() {
  const wantStart = "Not enough checked-in players to start. Approved players must check in first.";
  const orgCopy = sql(
    `SELECT value->>'not_enough_players' FROM platform_settings WHERE key='events_organizer_chrome'`,
  );
  assert(orgCopy === wantStart, "events_organizer_chrome not_enough_players checked-in copy");
  const tourCopy = sql(
    `SELECT value->>'not_enough_players' FROM platform_settings WHERE key='tournament_chrome'`,
  );
  assert(tourCopy === wantStart, "tournament_chrome not_enough_players checked-in copy");

  const liveTab = sql(
    `SELECT value->>'tab_live_boards_label' FROM platform_settings WHERE key='tournament_chrome'`,
  );
  assert(Boolean(liveTab.trim()), "tournament_chrome tab_live_boards_label");

  const playersTitle = sql(
    `SELECT value->>'detail_players_section_title' FROM platform_settings WHERE key='events_admin_chrome'`,
  );
  assert(Boolean(playersTitle.trim()), "events_admin_chrome detail_players_section_title");

  const checkedIn = sql(
    `SELECT value->>'players_checked_in_label' FROM platform_settings WHERE key='events_organizer_chrome'`,
  );
  assert(Boolean(checkedIn.trim()), "events_organizer_chrome players_checked_in_label");

  const overviewTitle = sql(
    `SELECT value->'payments'->>'overview_page_title' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(overviewTitle.trim()), "admin_console_chrome overview_page_title");
  const period7 = sql(
    `SELECT value->'payments'->>'overview_period_7d' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(period7.trim()), "admin_console_chrome overview_period_7d");
  const emptyVal = sql(
    `SELECT value->'payments'->>'overview_empty_value' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(emptyVal === "-", "overview_empty_value is ASCII hyphen (no em dash)");
  assert(!emptyVal.includes("\u2014"), "overview_empty_value has no em dash");

  const navHit = sql(`
    SELECT COUNT(*)::text FROM platform_settings ps,
      jsonb_array_elements(ps.value->'modules') m
    WHERE ps.key='console_nav' AND m->>'href'='/payments/overview'
  `);
  assert(navHit === "1", "console_nav modules include /payments/overview");

  const unauth = await req("/console/financial-overview");
  assert(unauth.status === 401 || unauth.status === 403, "financial-overview requires auth");

  const badDays = await req("/console/financial-overview?days=11");
  assert(
    badDays.status === 401 || badDays.status === 403 || badDays.status === 400,
    "financial-overview rejects or gates invalid days",
  );

  const admin = await e2eSession();
  assert(admin.status === 200 && admin.body?.access_token, "admin e2e session");
  const h = { Authorization: `Bearer ${admin.body.access_token}` };

  for (const days of [7, 30, 90]) {
    const ov = await req(`/console/financial-overview?days=${days}`, { headers: h });
    assert(ov.status === 200, `financial-overview days=${days} 200`);
    assert(ov.body?.period_days === days, `period_days=${days}`);
    assert(typeof ov.body?.pending_receipts === "number", `pending_receipts days=${days}`);
    assert(Array.isArray(ov.body?.platform_revenue), `platform_revenue days=${days}`);
    assert(Array.isArray(ov.body?.net_profit), `net_profit days=${days}`);
    assert(Array.isArray(ov.body?.net_cashflow), `net_cashflow days=${days}`);
    assert(Array.isArray(ov.body?.wallet_balances), `wallet_balances days=${days}`);
  }

  const badAuth = await req("/console/financial-overview?days=11", { headers: h });
  assert(badAuth.status === 400, "authed financial-overview rejects days=11");

  const chrome = await req("/public/admin-console-chrome");
  assert(chrome.status === 200, "admin-console-chrome 200");
  const pay = chrome.body?.payments || {};
  assert(Boolean((pay.overview_page_title || "").trim()), "chrome payments.overview_page_title");
  assert(Boolean((pay.overview_period_7d || "").trim()), "chrome payments.overview_period_7d");
  assert(
    Boolean((pay.overview_kpi_platform_revenue || "").trim()),
    "chrome payments.overview_kpi_platform_revenue",
  );
  assert(
    Boolean((pay.overview_kpi_net_profit || "").trim()),
    "chrome payments.overview_kpi_net_profit",
  );
  assert(
    Boolean((pay.overview_kpi_net_cashflow || "").trim()),
    "chrome payments.overview_kpi_net_cashflow",
  );
  assert(
    !/\(7d\)/i.test((pay.overview_kpi_topup_volume || "").trim()),
    "chrome topup volume period-neutral",
  );
  assert(
    !/\(7d\)/i.test((pay.overview_kpi_payout_volume || "").trim()),
    "chrome payout volume period-neutral",
  );

  const pauseChrome = await req("/public/official-pause-chrome");
  assert(pauseChrome.status === 200, "official-pause-chrome 200");
  assert(
    Boolean((pauseChrome.body?.actions_menu_label || "").trim()),
    "official-pause-chrome actions_menu_label (mig 518)",
  );
  assert(
    Boolean((pauseChrome.body?.select_all_label || "").trim()),
    "official-pause-chrome select_all_label (mig 518)",
  );
  assert(
    Boolean((pauseChrome.body?.bulk_selected_pause_action || "").trim()),
    "official-pause-chrome bulk_selected_pause_action (mig 518)",
  );
  assert(
    Boolean((pauseChrome.body?.bulk_selected_resume_action || "").trim()),
    "official-pause-chrome bulk_selected_resume_action (mig 518)",
  );
  assert(
    Boolean((pauseChrome.body?.live_boards_empty || "").trim()),
    "official-pause-chrome live_boards_empty (mig 521)",
  );
  assert(
    Array.isArray(pauseChrome.body?.reasons) && pauseChrome.body.reasons.length > 0,
    "official-pause-chrome reasons array (mig 520)",
  );
  const reasonsType = sql(
    `SELECT jsonb_typeof(value->'reasons') FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(
    reasonsType === "array",
    `DB official_pause_chrome.reasons is array (mig 520; got ${reasonsType})`,
  );

  const liveBoards = await req("/console/official-pause/live?skip=0&limit=20", { headers: h });
  assert(liveBoards.status === 200, `console official-pause/live 200 (got ${liveBoards.status})`);
  assert(Array.isArray(liveBoards.body?.games), "console official-pause/live games array");
  const fakeGid = "00000000-0000-0000-0000-000000000000";
  const bulkPause = await req("/games/official-pause/bulk", {
    headers: h,
    method: "POST",
    body: JSON.stringify({ game_ids: [fakeGid], reason_key: "tech_issue" }),
  });
  assert(
    bulkPause.status === 200,
    `authed official-pause/bulk game_ids 200 (got ${bulkPause.status})`,
  );
  assert(
    Number(bulkPause.body?.failed_count) >= 1 || Number(bulkPause.body?.ok) === 0,
    "authed official-pause/bulk unknown board fails closed",
  );
  const bulkResume = await req("/games/official-resume/bulk", {
    headers: h,
    method: "POST",
    body: JSON.stringify({ game_ids: [fakeGid] }),
  });
  assert(bulkResume.status === 200, `authed official-resume/bulk 200 (got ${bulkResume.status})`);
  assert(
    Number(bulkResume.body?.failed_count) >= 1 || Number(bulkResume.body?.ok) === 0,
    "authed official-resume/bulk unknown board fails closed",
  );

  const tourChrome = await req("/public/tournament-chrome");
  assert(tourChrome.status === 200, "tournament-chrome 200");
  assert(
    (tourChrome.body?.not_enough_players || "").trim() === wantStart,
    "public tournament-chrome not_enough_players",
  );
  assert(
    Boolean((tourChrome.body?.tab_live_boards_label || "").trim()),
    "public tournament-chrome tab_live_boards_label",
  );

  const orgChrome = await req("/public/events-organizer-chrome");
  assert(orgChrome.status === 200, "events-organizer-chrome 200");
  assert(
    (orgChrome.body?.not_enough_players || "").trim() === wantStart,
    "public events-organizer-chrome not_enough_players",
  );
  assert(
    Boolean((orgChrome.body?.players_open_player_label || "").trim()),
    "public events-organizer-chrome players_open_player_label",
  );

  // Entries routes exist (404 cup vs 401/403 without id path is fine; empty uuid → not found).
  const evEntries = await req("/console/events/00000000-0000-0000-0000-000000000000/entries", {
    headers: h,
  });
  assert(
    evEntries.status === 404 || evEntries.status === 200,
    `console event entries reachable (${evEntries.status})`,
  );
  const tEntries = await req("/console/tournaments/00000000-0000-0000-0000-000000000000/entries", {
    headers: h,
  });
  assert(
    tEntries.status === 404 || tEntries.status === 200,
    `console tournament entries reachable (${tEntries.status})`,
  );

  // Create empty free cup → start must return checked-in not_enough_players (error_key + chrome body).
  const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;
  const stamp = Date.now().toString(36);
  const createRes = await fetch(gqlBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.body.access_token}`,
    },
    body: JSON.stringify({
      query: `mutation($title: String!, $maxPlayers: Int) {
        createTournament(
          title: $title
          isFree: true
          entryFeeAmount: 0
          entryFeeCurrency: "USD"
          maxPlayers: $maxPlayers
        ) { id }
      }`,
      variables: { title: `fin_empty_start_${stamp}`, maxPlayers: 8 },
    }),
  });
  const createJson = await createRes.json();
  const tid = createJson?.data?.createTournament?.id;
  assert(
    Boolean(tid),
    `create empty cup for start gate (${JSON.stringify(createJson).slice(0, 180)})`,
  );
  const startEmpty = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  assert(startEmpty.status === 409, `empty cup start status 409 (got ${startEmpty.status})`);
  assert(
    (startEmpty.body?.error_key || "").trim() === "not_enough_players",
    "empty cup start error_key not_enough_players",
  );
  assert(
    (startEmpty.body?.error || "").trim() === wantStart,
    "empty cup start error body is checked-in chrome copy",
  );
  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: h,
  });

  console.log("E2E_PASS admin-finance-players-start");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
