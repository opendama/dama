/**
 * Smoke: Financial overview chrome + routes, players entries routes, start copy.
 * Requires local API + dama_postgres. Optional admin session via DAMA_ALLOW_E2E_AUTH.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-finance-players-start-chrome-check.mjs
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

async function main() {
  const health = await fetch(`${base.replace(/\/api\/v1\/?$/, "")}/healthz`);
  assert(health.ok, "API healthz");

  const startCopy = sql(
    `SELECT value->>'not_enough_players' FROM platform_settings WHERE key='tournament_chrome'`,
  );
  assert(
    startCopy.includes("checked-in") && startCopy.includes("check in"),
    `tournament not_enough_players checked-in copy (${startCopy})`,
  );
  const orgCopy = sql(
    `SELECT value->>'not_enough_players' FROM platform_settings WHERE key='events_organizer_chrome'`,
  );
  assert(
    orgCopy.includes("checked-in") && orgCopy.includes("check in"),
    "organizer not_enough_players checked-in copy",
  );

  const liveTab = sql(
    `SELECT value->>'tab_live_boards_label' FROM platform_settings WHERE key='tournament_chrome'`,
  );
  assert(Boolean(liveTab.trim()), "tab_live_boards_label");

  const overviewTitle = sql(
    `SELECT value->'payments'->>'overview_page_title' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(overviewTitle.trim()), "overview_page_title");
  const period7 = sql(
    `SELECT value->'payments'->>'overview_period_7d' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(period7.trim()), "overview_period_7d (mig 510)");
  const emptyVal = sql(
    `SELECT value->'payments'->>'overview_empty_value' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(emptyVal === "-" || emptyVal.length > 0, "overview_empty_value ascii");
  assert(!emptyVal.includes("\u2014"), "overview_empty_value no em dash");

  const navHit = sql(
    `SELECT COUNT(*)::text FROM platform_settings ps,
      jsonb_array_elements(ps.value->'modules') m
     WHERE ps.key='console_nav' AND m->>'href'='/payments/overview'`,
  );
  assert(navHit === "1" || Number(navHit) >= 1, "console_nav Financial overview module");

  const playersLabel = sql(
    `SELECT value->>'detail_players_section_title' FROM platform_settings WHERE key='events_admin_chrome'`,
  );
  assert(Boolean(playersLabel.trim()), "events admin detail_players_section_title");
  const openPlayer = sql(
    `SELECT value->>'players_open_player_label' FROM platform_settings WHERE key='events_organizer_chrome'`,
  );
  assert(Boolean(openPlayer.trim()), "organizer players_open_player_label (mig 511)");
  const netCash = sql(
    `SELECT value->'payments'->>'overview_kpi_net_cashflow' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(netCash.trim()), "overview_kpi_net_cashflow (mig 512)");
  const netProfit = sql(
    `SELECT value->'payments'->>'overview_kpi_net_profit' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(netProfit.trim()), "overview_kpi_net_profit (mig 513)");
  const topupVol = sql(
    `SELECT value->'payments'->>'overview_kpi_topup_volume' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(Boolean(topupVol.trim()), "overview_kpi_topup_volume present");
  assert(!/\(7d\)/i.test(topupVol), "overview_kpi_topup_volume period-neutral (mig 514)");
  const payoutVol = sql(
    `SELECT value->'payments'->>'overview_kpi_payout_volume' FROM platform_settings WHERE key='admin_console_chrome'`,
  );
  assert(!/\(7d\)/i.test(payoutVol), "overview_kpi_payout_volume period-neutral (mig 514)");
  const liveFilter = sql(
    `SELECT value->>'filter_official_paused' FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(
    liveFilter.trim() === "Officially",
    "live boards filter_official_paused Officially (mig 515)",
  );
  const kpiSep = sql(
    `SELECT value->>'kpi_count_separator' FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(Boolean(kpiSep.trim()), "kpi_count_separator (mig 515)");
  assert(
    !kpiSep.includes("\u2014") && !kpiSep.includes("\u00b7"),
    "kpi_count_separator no em dash / middle-dot",
  );
  const tourStatusCol = sql(
    `SELECT value->>'detail_players_col_status' FROM platform_settings WHERE key='tournament_chrome'`,
  );
  assert(Boolean(tourStatusCol.trim()), "tournament detail_players_col_status (mig 516)");
  // psql -tA trims text; assert length of spaced " - " (3) and no middle-dot.
  const kpiSepLen = sql(
    `SELECT length(value->>'kpi_count_separator')::text FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(kpiSepLen === "3", "kpi_count_separator length 3 spaced ASCII (mig 517)");
  const mig518Keys = [
    "actions_menu_label",
    "select_all_label",
    "select_row_label",
    "selected_count_fmt",
    "clear_selection_action",
    "bulk_selected_pause_action",
    "bulk_selected_pause_pending",
    "bulk_selected_confirm_title",
    "bulk_selected_confirm_description",
    "bulk_selected_confirm",
    "bulk_selected_resume_action",
    "bulk_selected_resume_pending",
    "bulk_selected_resume_confirm_title",
    "bulk_selected_resume_confirm_description",
    "bulk_selected_resume_confirm",
    "toast_bulk_resumed",
    "toast_bulk_resume_partial",
    "toast_bulk_resume_failed",
  ];
  for (const key of mig518Keys) {
    const v = sql(
      `SELECT value->>'${key}' FROM platform_settings WHERE key='official_pause_chrome'`,
    );
    assert(Boolean(String(v || "").trim()), `${key} (mig 518)`);
  }
  const pauseChromePublic = await req("/public/official-pause-chrome");
  assert(
    pauseChromePublic.status === 200,
    `official-pause-chrome 200 (got ${pauseChromePublic.status})`,
  );
  const pauseChromeBody =
    pauseChromePublic.body && typeof pauseChromePublic.body === "object"
      ? pauseChromePublic.body
      : {};
  for (const key of mig518Keys) {
    assert(
      Boolean(String(pauseChromeBody[key] || "").trim()),
      `public official-pause-chrome.${key} (mig 518)`,
    );
  }
  const pausePending = sql(
    `SELECT value->>'pause_pending' FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(Boolean(pausePending.trim()), "pause_pending present");
  assert(
    !pausePending.includes("\u2026") &&
      !pausePending.includes("\u2014") &&
      !pausePending.includes("\u00b7"),
    "pause_pending ASCII only (mig 519)",
  );
  const activityPauseFmt = sql(
    `SELECT value->>'activity_pause_fmt' FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(
    !activityPauseFmt.includes("\u2026") &&
      !activityPauseFmt.includes("\u2014") &&
      !activityPauseFmt.includes("\u00b7"),
    "activity_pause_fmt ASCII only (mig 519)",
  );
  const liveBoardsEmpty = sql(
    `SELECT value->>'live_boards_empty' FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(Boolean(liveBoardsEmpty.trim()), "live_boards_empty (mig 521)");
  assert(
    Boolean(String(pauseChromeBody.live_boards_empty || "").trim()),
    "public official-pause-chrome.live_boards_empty (mig 521)",
  );
  const reasonsType = sql(
    `SELECT jsonb_typeof(value->'reasons') FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(
    reasonsType === "array",
    `official_pause_chrome.reasons is array (mig 520; got ${reasonsType})`,
  );
  const reasonsLen = sql(
    `SELECT jsonb_array_length(value->'reasons')::text FROM platform_settings WHERE key='official_pause_chrome'`,
  );
  assert(
    Number(reasonsLen) > 0,
    `official_pause_chrome.reasons non-empty (mig 520; len=${reasonsLen})`,
  );
  assert(
    Array.isArray(pauseChromeBody.reasons) && pauseChromeBody.reasons.length > 0,
    "public official-pause-chrome.reasons array",
  );

  const fo = await req("/console/financial-overview");
  assert(fo.status === 401 || fo.status === 403, `financial-overview auth gate (${fo.status})`);
  const foBad = await req("/console/financial-overview?days=13");
  assert(
    foBad.status === 401 || foBad.status === 403 || foBad.status === 400,
    `financial-overview days validation reachable (${foBad.status})`,
  );

  const evEntries = await req("/console/events/00000000-0000-0000-0000-000000000001/entries");
  assert(
    evEntries.status === 401 || evEntries.status === 403 || evEntries.status === 404,
    `console event entries route (${evEntries.status})`,
  );
  const tEntries = await req("/console/tournaments/00000000-0000-0000-0000-000000000001/entries");
  assert(
    tEntries.status === 401 || tEntries.status === 403 || tEntries.status === 404,
    `console tournament entries route (${tEntries.status})`,
  );

  const bulkPause = await req("/games/official-pause/bulk", {
    method: "POST",
    body: JSON.stringify({ game_ids: ["x"], reason_key: "x" }),
  });
  assert(
    bulkPause.status === 401 || bulkPause.status === 403,
    `official-pause/bulk auth gate (${bulkPause.status})`,
  );
  const bulkResume = await req("/games/official-resume/bulk", {
    method: "POST",
    body: JSON.stringify({ game_ids: ["x"] }),
  });
  assert(
    bulkResume.status === 401 || bulkResume.status === 403,
    `official-resume/bulk auth gate (${bulkResume.status})`,
  );

  console.log("E2E_PASS finance-players-start-chrome");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
