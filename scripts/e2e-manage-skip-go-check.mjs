/**
 * Manage Players/Payments/Live boards skip-go E2E (real backend meta + fee totals).
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 and local Docker Postgres.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-manage-skip-go-check.mjs
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1";
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

import { execFileSync } from "node:child_process";

async function sleepMs(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function req(path, opts = {}) {
  let last = { status: 0, body: null };
  for (let attempt = 0; attempt < 8; attempt++) {
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
    last = { status: r.status, body };
    if (r.status !== 429 && r.status !== 503) return last;
    await sleepMs(400 * (attempt + 1));
  }
  return last;
}

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

function creditWallet(userId, currency, amount) {
  const id = String(userId).replace(/'/g, "");
  const cur = String(currency).replace(/'/g, "");
  const amt = Number(amount);
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${amt},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${amt}, updated_at = NOW();
  `);
}

function assertMeta(meta, label) {
  assert(meta && typeof meta === "object", `${label} meta object`);
  assert(typeof meta.skip === "number", `${label} meta.skip`);
  assert(typeof meta.limit === "number" && meta.limit > 0, `${label} meta.limit`);
  assert(typeof meta.total === "number", `${label} meta.total`);
  assert(typeof meta.page === "number", `${label} meta.page`);
  assert(typeof meta.total_pages === "number", `${label} meta.total_pages`);
  assert(typeof meta.has_more === "boolean", `${label} meta.has_more`);
  assert(
    typeof meta.page_summary === "string" && meta.page_summary.trim().length > 0,
    `${label} meta.page_summary`,
  );
  assert(
    typeof meta.next_action_label === "string" && meta.next_action_label.trim().length > 0,
    `${label} meta.next_action_label`,
  );
}

async function main() {
  const chrome = await req("/public/events-organizer-chrome");
  assert(chrome.status < 300, `organizer chrome ${chrome.status}`);
  const pageSize = Number(String(chrome.body?.list_page_size || "").trim());
  assert(Number.isFinite(pageSize) && pageSize > 0, `list_page_size ${pageSize}`);

  const org = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      email: `manage-skip-org-${Date.now()}@example.com`,
      username: `mskorg${String(Date.now()).slice(-6)}`,
    }),
  });
  assert(org.status < 300 && org.body?.access_token, `org session ${org.status}`);
  const orgTok = org.body.access_token;
  const orgH = { Authorization: `Bearer ${orgTok}` };

  const player = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      email: `manage-skip-pl-${Date.now()}@example.com`,
      username: `mskpl${String(Date.now()).slice(-6)}`,
    }),
  });
  assert(player.status < 300 && player.body?.access_token, `player session ${player.status}`);
  const playerTok = player.body.access_token;
  const playerId = player.body.user?.id || player.body.user_id || player.body.id;
  assert(playerId, "player id");

  const catalog = await req("/events/catalog");
  assert(catalog.status < 300, `catalog ${catalog.status}`);
  const formats = catalog.body?.formats || [];
  const sizes = catalog.body?.sizes || [];
  const format = formats.find((f) => f.enabled !== false) || formats[0];
  const size = sizes.find((s) => s.enabled !== false) || sizes[0];
  assert(format?.id && size?.id, "catalog format/size");

  const feeCur = String(size.host_fee_currency || catalog.body?.payment_currency || "ETB").trim();
  const hostFee = Number(size.host_fee_amount || 0);
  if (hostFee > 0)
    creditWallet(org.body.user?.id || org.body.user_id || org.body.id, feeCur, hostFee + 50);

  const create = await req("/events/", {
    method: "POST",
    headers: orgH,
    body: JSON.stringify({
      title: `Manage skip-go ${Date.now()}`,
      format_id: format.id,
      size_id: size.id,
      is_free_entry: true,
    }),
  });
  assert(create.status < 300 && create.body?.id, `create event ${create.status}`);
  const eventId = create.body.id;
  const joinCode = create.body.join_code || create.body?.event?.join_code;
  assert(joinCode, "create join_code");

  // Seat a real player so Players/Payments share a non-empty roster page.
  const join = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${playerTok}` },
    body: JSON.stringify({ code: joinCode, country_code: "ET" }),
  });
  assert(join.status < 300, `join free cup ${join.status}`);

  // Unpaged entries still works (Results/lobby path).
  const full = await req(`/events/${eventId}/entries`, { headers: orgH });
  assert(full.status < 300 && Array.isArray(full.body?.entries), `unpaged entries ${full.status}`);
  assert(full.body.meta == null, "unpaged entries has no meta");
  assert(full.body.entries.length >= 1, "unpaged entries includes joined seat");

  // Paged roster + fee totals (Players/Payments shared page).
  const page1 = await req(`/events/${eventId}/entries?skip=0&limit=${pageSize}`, {
    headers: orgH,
  });
  assert(page1.status < 300, `paged entries ${page1.status}`);
  assert(Array.isArray(page1.body?.entries), "paged entries array");
  assert(page1.body.entries.length >= 1, "paged entries non-empty after join");
  assert(page1.body.meta.total >= 1, "paged meta.total after join");
  assertMeta(page1.body.meta, "entries");
  assert(typeof page1.body.entry_fees_gross === "number", "entry_fees_gross");
  assert(typeof page1.body.entry_fees_commission === "number", "entry_fees_commission");
  assert(typeof page1.body.entry_fees_organizer_net === "number", "entry_fees_organizer_net");
  assert(typeof page1.body.entry_fees_paid_count === "number", "entry_fees_paid_count");
  assert(typeof page1.body.entry_fees_currency === "string", "entry_fees_currency");
  assert(page1.body.meta.limit === pageSize, `entries meta.limit matches chrome ${pageSize}`);

  // Players and Payments share the exact same skip/limit page (same entries + meta).
  const page1b = await req(`/events/${eventId}/entries?skip=0&limit=${pageSize}`, {
    headers: orgH,
  });
  assert(page1b.status < 300, `paged entries repeat ${page1b.status}`);
  assert(
    JSON.stringify((page1.body.entries || []).map((e) => e.id)) ===
      JSON.stringify((page1b.body.entries || []).map((e) => e.id)),
    "Players/Payments same roster page entry ids",
  );
  assert(
    page1.body.meta.skip === page1b.body.meta.skip &&
      page1.body.meta.limit === page1b.body.meta.limit &&
      page1.body.meta.total === page1b.body.meta.total,
    "Players/Payments same roster meta skip/limit/total",
  );
  assert(
    page1.body.entry_fees_gross === page1b.body.entry_fees_gross &&
      page1.body.entry_fees_paid_count === page1b.body.entry_fees_paid_count,
    "Players/Payments same full-roster fee totals",
  );
  assert(
    (page1.body.entries || []).some((e) => e.user_id === playerId),
    "paged roster includes joined player",
  );

  // Multi-page: second seat + limit=1 proves skip/go advances and fee totals stay full-roster.
  const player2 = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      email: `manage-skip-pl2-${Date.now()}@example.com`,
      username: `mskpl2${String(Date.now()).slice(-6)}`,
    }),
  });
  assert(player2.status < 300 && player2.body?.access_token, `player2 session ${player2.status}`);
  const player2Tok = player2.body.access_token;
  const player2Id = player2.body.user?.id || player2.body.user_id || player2.body.id;
  assert(player2Id, "player2 id");
  const join2 = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${player2Tok}` },
    body: JSON.stringify({ code: joinCode, country_code: "ET" }),
  });
  assert(join2.status < 300, `join2 free cup ${join2.status}`);

  const slice0 = await req(`/events/${eventId}/entries?skip=0&limit=1`, { headers: orgH });
  assert(slice0.status < 300, `entries slice0 ${slice0.status}`);
  assertMeta(slice0.body.meta, "entries slice0");
  assert(slice0.body.meta.limit === 1, "slice0 meta.limit 1");
  assert(slice0.body.meta.total >= 2, `slice0 meta.total ${slice0.body.meta.total}`);
  assert(slice0.body.entries.length === 1, "slice0 one row");
  assert(slice0.body.meta.has_more === true, "slice0 has_more");
  assert(typeof slice0.body.meta.next_skip === "number", "slice0 next_skip");

  const slice1 = await req(
    `/events/${eventId}/entries?skip=${slice0.body.meta.next_skip}&limit=1`,
    { headers: orgH },
  );
  assert(slice1.status < 300, `entries slice1 ${slice1.status}`);
  assertMeta(slice1.body.meta, "entries slice1");
  assert(slice1.body.entries.length === 1, "slice1 one row");
  assert(
    slice0.body.entries[0].id !== slice1.body.entries[0].id,
    "slice0/slice1 different seat ids",
  );
  assert(
    slice0.body.entry_fees_gross === slice1.body.entry_fees_gross &&
      slice0.body.entry_fees_paid_count === slice1.body.entry_fees_paid_count,
    "fee totals identical across roster pages",
  );
  const sliceIds = [slice0.body.entries[0].user_id, slice1.body.entries[0].user_id].sort();
  const joinedIds = [playerId, player2Id].sort();
  assert(
    JSON.stringify(sliceIds) === JSON.stringify(joinedIds),
    "limit=1 pages cover both joined seats",
  );

  // Dual-mode: any skip or limit triggers parseListPagination; both required or 400.
  const skipOnly = await req(`/events/${eventId}/entries?skip=0`, { headers: orgH });
  assert(skipOnly.status === 400, `entries skip-only fails closed ${skipOnly.status}`);
  const limitOnly = await req(`/events/${eventId}/entries?limit=${pageSize}`, { headers: orgH });
  assert(limitOnly.status === 400, `entries limit-only fails closed ${limitOnly.status}`);
  const liveBad = await req(`/events/${eventId}/live-boards?skip=0`, { headers: orgH });
  assert(liveBad.status === 400, `live-boards skip-only fails closed ${liveBad.status}`);

  // Live boards paged empty cup.
  const live = await req(`/events/${eventId}/live-boards?skip=0&limit=${pageSize}`, {
    headers: orgH,
  });
  assert(live.status < 300, `live-boards ${live.status}`);
  assert(Array.isArray(live.body?.matches), "live-boards matches");
  assertMeta(live.body.meta, "live-boards");
  assert(typeof live.body.officially_paused_count === "number", "officially_paused_count");
  assert(live.body.meta.total === 0, "live-boards empty total");
  assert(live.body.officially_paused_count === 0, "officially_paused_count zero");

  const liveOfficial = await req(
    `/events/${eventId}/live-boards?skip=0&limit=${pageSize}&official_only=1`,
    { headers: orgH },
  );
  assert(liveOfficial.status < 300, `live-boards official_only ${liveOfficial.status}`);
  assertMeta(liveOfficial.body.meta, "live-boards official");
  assert(liveOfficial.body.meta.total === 0, "official filter empty total");

  // Guest/player cannot hit live-boards (organizer-only).
  const strangerLive = await req(`/events/${eventId}/live-boards?skip=0&limit=${pageSize}`, {
    headers: { Authorization: `Bearer ${playerTok}` },
  });
  assert(
    strangerLive.status === 403 || strangerLive.status === 401 || strangerLive.status === 404,
    `non-org live-boards ${strangerLive.status}`,
  );

  // Admin console event entries require console role; mint admin and page.
  const admin = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      email: `manage-skip-adm-${Date.now()}@example.com`,
      username: `mskadm${String(Date.now()).slice(-6)}`,
      role: "admin",
    }),
  });
  assert(admin.status < 300 && admin.body?.access_token, `admin session ${admin.status}`);
  const admH = { Authorization: `Bearer ${admin.body.access_token}` };
  const consoleEntries = await req(`/console/events/${eventId}/entries?skip=0&limit=${pageSize}`, {
    headers: admH,
  });
  assert(consoleEntries.status < 300, `console entries ${consoleEntries.status}`);
  assert(Array.isArray(consoleEntries.body?.entries), "console entries array");
  assertMeta(consoleEntries.body.meta, "console entries");

  const consoleLive = await req(`/console/official-pause/live?skip=0&limit=${pageSize}`, {
    headers: admH,
  });
  assert(consoleLive.status < 300, `console official-pause live ${consoleLive.status}`);
  assert(Array.isArray(consoleLive.body?.games), "console live games array");
  assertMeta(consoleLive.body.meta, "console live");
  assert(
    typeof consoleLive.body.officially_paused_count === "number",
    "console officially_paused_count",
  );

  console.log("E2E_PASS manage-skip-go");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
