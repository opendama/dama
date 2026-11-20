/**
 * Live E2E: activity analytics (admin + public platform stats).
 * Requires API with mig 171-179; console check needs DAMA_ALLOW_E2E_AUTH=1.
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:8080/api/v1";

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(base + path, { ...opts, headers });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function assertNum(obj, key) {
  assert(typeof obj[key] === "number" && Number.isFinite(obj[key]), `number ${key}`);
}

function assertPeriodOptions(body, where) {
  assert(
    Array.isArray(body.period_options) && body.period_options.length > 0,
    `${where} period_options`,
  );
  for (const o of body.period_options) {
    assert(typeof o.id === "string" && o.id.trim(), `${where} period_options.id`);
    assert(typeof o.label === "string" && o.label.trim(), `${where} period_options.label`);
  }
  assert(
    body.period_options.every((o) => body.periods.includes(o.id)),
    `${where} period_options ? periods`,
  );
}

function assertKpiSections(body, where, { minSections, minItems }) {
  assert(
    Array.isArray(body.kpi_sections) && body.kpi_sections.length >= minSections,
    `${where} kpi_sections`,
  );
  let items = 0;
  for (const sec of body.kpi_sections) {
    assert(typeof sec.id === "string" && sec.id.trim(), `${where} section.id`);
    assert(typeof sec.title === "string" && sec.title.trim(), `${where} section.title`);
    assert(Array.isArray(sec.items) && sec.items.length > 0, `${where} section.items`);
    for (const it of sec.items) {
      assert(typeof it.id === "string" && it.id.trim(), `${where} kpi.id`);
      assert(typeof it.label === "string" && it.label.trim(), `${where} kpi.label`);
      assert(typeof it.value === "number" && Number.isFinite(it.value), `${where} kpi.value`);
      items += 1;
    }
  }
  assert(items >= minItems, `${where} kpi item count >= ${minItems}`);
}

(async () => {
  const chrome = await req("/public/platform-stats-chrome");
  assert(chrome.status === 200, "platform-stats-chrome status");
  for (const k of [
    "source",
    "platform_stats_unavailable",
    "section_title",
    "section_blurb",
    "period_label",
    "period_day_label",
    "period_week_label",
    "period_month_label",
    "period_year_label",
    "kpi_online_now",
    "kpi_playing_now",
    "kpi_users_total",
    "kpi_visited",
    "kpi_played",
    "kpi_games_finished",
    "kpi_dau",
    "kpi_wau",
    "kpi_mau",
    "series_title",
    "series_subtitle",
    "series_y_axis",
    "series_empty",
    "series_legend_aria",
    "series_today_label",
    "series_visited_label",
    "series_played_label",
    "series_games_label",
    "series_visited_color",
    "series_played_color",
    "series_games_color",
    "heatmap_title",
    "heatmap_empty",
    "cumulative_title",
    "breakdown_modes_title",
    "breakdown_outcomes_title",
    "breakdown_entry_title",
  ]) {
    assert(typeof chrome.body[k] === "string" && chrome.body[k].trim().length > 0, `chrome.${k}`);
  }

  const before = await req("/public/platform-stats");
  assert(before.status === 200, "platform-stats before visit");
  const visitedBefore = before.body.visited;

  const visitorKey = `e2e-visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const visit = await req("/public/platform-stats/visit", {
    method: "POST",
    body: JSON.stringify({ visitor_key: visitorKey }),
  });
  assert(visit.status === 200 && visit.body?.ok === true, "platform-stats visit");

  const badVisit = await req("/public/platform-stats/visit", {
    method: "POST",
    body: JSON.stringify({ visitor_key: "short" }),
  });
  assert(badVisit.status === 400, "platform-stats visit rejects short key");

  const stats = await req("/public/platform-stats");
  assert(stats.status === 200, "platform-stats status");
  assert(
    typeof stats.body.default_period === "string" && stats.body.default_period.trim(),
    "default_period",
  );
  assert(Array.isArray(stats.body.periods) && stats.body.periods.length > 0, "periods");
  assert(stats.body.periods.includes(stats.body.default_period), "default_period in periods");
  assert(stats.body.period === stats.body.default_period, "empty query uses default_period");
  assertPeriodOptions(stats.body, "public");
  assertKpiSections(stats.body, "public", { minSections: 1, minItems: 9 });
  assert(stats.body.visited >= visitedBefore + 1, "visit increments visited");
  for (const k of [
    "online_now",
    "playing_now",
    "users_total",
    "visited",
    "played",
    "games_finished",
    "dau",
    "wau",
    "mau",
  ]) {
    assertNum(stats.body, k);
  }
  assert(Array.isArray(stats.body.series) && stats.body.series.length > 0, "public series");
  assert(
    Array.isArray(stats.body.series_meta) && stats.body.series_meta.length === 3,
    "public series_meta (visited/played/games)",
  );
  for (const k of [
    "series_title",
    "series_subtitle",
    "series_y_axis",
    "series_empty",
    "series_legend_aria",
    "series_today_label",
    "today_day",
  ]) {
    assert(typeof stats.body[k] === "string" && stats.body[k].trim(), `public ${k}`);
  }
  for (const m of stats.body.series_meta) {
    assert(m.key && m.label && m.color_class, "public series_meta fields");
    assert(!["new_users"].includes(m.key), "public series excludes new_users");
  }
  const pubLast = stats.body.series[stats.body.series.length - 1]?.bucket;
  const todayUtcPub = new Date().toISOString().slice(0, 10);
  assert(pubLast === todayUtcPub, `public series ends today UTC (got ${pubLast})`);
  for (const k of [
    "heatmap_title",
    "heatmap_empty",
    "cumulative_title",
    "cumulative_empty",
    "breakdown_modes_title",
    "breakdown_outcomes_title",
    "breakdown_entry_title",
  ]) {
    assert(typeof stats.body[k] === "string" && stats.body[k].trim(), `public ${k}`);
  }
  assert(
    Array.isArray(stats.body.heatmap_stats) && stats.body.heatmap_stats.length === 4,
    "public heatmap_stats",
  );
  assert(Array.isArray(stats.body.breakdown_modes), "public breakdown_modes");
  assert(
    Array.isArray(stats.body.breakdown_outcomes) && stats.body.breakdown_outcomes.length === 2,
    "public breakdown_outcomes",
  );
  assert(
    Array.isArray(stats.body.breakdown_entry) && stats.body.breakdown_entry.length === 2,
    "public breakdown_entry",
  );

  for (const period of stats.body.periods) {
    const row = await req(`/public/platform-stats?period=${encodeURIComponent(period)}`);
    assert(row.status === 200, `platform-stats period=${period}`);
    assert(row.body.period === period, `period echo ${period}`);
    assertPeriodOptions(row.body, `public ${period}`);
    assertKpiSections(row.body, `public ${period}`, { minSections: 1, minItems: 9 });
    assert(Array.isArray(row.body.series) && row.body.series.length > 0, `public series ${period}`);
  }

  const badPeriod = await req("/public/platform-stats?period=not-a-period");
  assert(badPeriod.status === 400, "invalid period rejected");

  const stamp = Date.now();
  const session = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      email: `activity-e2e-${stamp}@example.com`,
      username: `activity_e2e_${stamp}`,
      role: "admin",
    }),
  });
  assert(
    session.status === 200 && typeof session.body?.access_token === "string",
    "e2e admin session",
  );
  const token = session.body.access_token;

  const hbBefore = await req("/console/activity", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(hbBefore.status === 200, "console activity before heartbeat");
  const dauBefore = hbBefore.body.dau;

  const hb = await req("/presence/heartbeat", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: "{}",
  });
  assert(hb.status === 200, "presence heartbeat records auth visit");

  const adminChrome = await req("/public/admin-console-chrome");
  assert(adminChrome.status === 200, "admin-console-chrome status");
  assert(
    adminChrome.body?.activity && typeof adminChrome.body.activity === "object",
    "activity chrome section",
  );
  for (const k of [
    "page_title",
    "kpi_online_now",
    "kpi_dau",
    "series_title",
    "series_subtitle",
    "series_y_axis",
    "series_today_label",
    "period_label",
    "live_section_title",
    "engagement_section_title",
    "series_visited_color",
    "series_played_color",
    "series_games_color",
    "series_new_users_color",
    "series_legend_aria",
    "heatmap_title",
    "cumulative_title",
    "breakdown_modes_title",
    "breakdown_outcomes_title",
    "breakdown_entry_title",
  ]) {
    assert(
      typeof adminChrome.body.activity[k] === "string" && adminChrome.body.activity[k].trim(),
      `admin chrome activity.${k}`,
    );
  }

  const activity = await req("/console/activity", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(activity.status === 200, "console activity status");
  assert(activity.body.period === activity.body.default_period, "console default period");
  assertPeriodOptions(activity.body, "console");
  assertKpiSections(activity.body, "console", { minSections: 3, minItems: 10 });
  assert(
    Array.isArray(activity.body.series_meta) && activity.body.series_meta.length === 4,
    "series_meta",
  );
  const metaKeys = new Set();
  for (const m of activity.body.series_meta) {
    assert(m.key && m.label && m.color_class, "series_meta fields");
    assert(
      /var\(--dama-[a-z0-9-]+\)/.test(String(m.color_class)) ||
        /bg-\[var\(--dama-[a-z0-9-]+\)\]/.test(String(m.color_class)),
      "series color uses design token",
    );
    metaKeys.add(m.key);
  }
  assert(
    typeof activity.body.series_title === "string" && activity.body.series_title.trim(),
    "series_title",
  );
  assert(
    typeof activity.body.series_subtitle === "string" && activity.body.series_subtitle.trim(),
    "series_subtitle",
  );
  assert(
    typeof activity.body.series_y_axis === "string" && activity.body.series_y_axis.trim(),
    "series_y_axis",
  );
  assert(
    typeof activity.body.series_today_label === "string" && activity.body.series_today_label.trim(),
    "series_today_label",
  );
  assert(
    typeof activity.body.today_day === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(activity.body.today_day),
    "today_day",
  );
  assert(
    typeof activity.body.series_empty === "string" && activity.body.series_empty.trim(),
    "series_empty",
  );
  assert(
    typeof activity.body.series_legend_aria === "string" && activity.body.series_legend_aria.trim(),
    "series_legend_aria",
  );
  assert(
    Array.isArray(activity.body.heatmap_stats) && activity.body.heatmap_stats.length === 4,
    "console heatmap_stats",
  );
  assert(Array.isArray(activity.body.breakdown_modes), "console breakdown_modes");
  assert(
    Array.isArray(activity.body.breakdown_outcomes) &&
      activity.body.breakdown_outcomes.length === 2,
    "console breakdown_outcomes",
  );
  assert(
    Array.isArray(activity.body.breakdown_entry) && activity.body.breakdown_entry.length === 2,
    "console breakdown_entry",
  );
  assert(activity.body.dau >= dauBefore, "heartbeat does not decrease DAU");
  for (const k of [
    "online_now",
    "playing_now",
    "users_total",
    "new_users",
    "visited",
    "played",
    "games_finished",
    "dau",
    "wau",
    "mau",
  ]) {
    assertNum(activity.body, k);
  }
  assert(Array.isArray(activity.body.series), "console series");
  assert(activity.body.series.length > 0, "console series non-empty");
  const sectionIds = (activity.body.kpi_sections || []).map((s) => s.id);
  assert(
    sectionIds.includes("live") &&
      sectionIds.includes("period") &&
      sectionIds.includes("engagement"),
    "kpi section ids",
  );
  for (const pt of activity.body.series) {
    assert(typeof pt.bucket === "string" && pt.bucket.trim(), "series.bucket");
    assert(
      pt.values && typeof pt.values === "object" && !Array.isArray(pt.values),
      "series.values map",
    );
    for (const key of metaKeys) {
      assert(
        typeof pt.values[key] === "number" && Number.isFinite(pt.values[key]),
        `series.values.${key}`,
      );
    }
    assert(
      pt.visited === undefined &&
        pt.played === undefined &&
        pt.games === undefined &&
        pt.new_users === undefined,
      "series has no flat invent fields",
    );
  }
  const lastBucket = activity.body.series[activity.body.series.length - 1]?.bucket;
  const todayUtc = new Date().toISOString().slice(0, 10);
  assert(lastBucket === todayUtc, `series ends at today UTC (got ${lastBucket})`);

  for (const period of activity.body.periods) {
    const row = await req(`/console/activity?period=${encodeURIComponent(period)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(row.status === 200, `console activity period=${period}`);
    assert(row.body.period === period, `console period echo ${period}`);
    assertPeriodOptions(row.body, `console ${period}`);
    assertKpiSections(row.body, `console ${period}`, { minSections: 3, minItems: 10 });
    assert(
      Array.isArray(row.body.series) && row.body.series.length > 0,
      `console series ${period}`,
    );
    const end = row.body.series[row.body.series.length - 1]?.bucket;
    assert(end === todayUtc, `console series ${period} ends today`);
    if (period === "year") {
      assert(
        row.body.series.length >= 365 && row.body.series.length <= 366,
        `year series covers full window (got ${row.body.series.length})`,
      );
    }
  }

  const badConsolePeriod = await req("/console/activity?period=not-a-period", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(badConsolePeriod.status === 400, "console invalid period rejected");

  const noAuth = await req("/console/activity");
  assert(noAuth.status === 401 || noAuth.status === 403, "console activity requires auth");

  const playerStamp = Date.now();
  const playerSession = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      email: `activity-player-${playerStamp}@example.com`,
      username: `activity_player_${playerStamp}`,
      role: "player",
    }),
  });
  assert(
    playerSession.status === 200 && typeof playerSession.body?.access_token === "string",
    "e2e player session",
  );
  const playerDenied = await req("/console/activity", {
    headers: { Authorization: `Bearer ${playerSession.body.access_token}` },
  });
  assert(playerDenied.status === 401 || playerDenied.status === 403, "player lacks activity.read");

  console.log("E2E activity analytics OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
