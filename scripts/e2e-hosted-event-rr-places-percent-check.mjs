/**
 * E2E: paid hosted RR places_percent 50/30/20 → playthrough → placements → escrow → settle → wallet.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-rr-places-percent-check.mjs
 */
import { execFileSync } from "node:child_process";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

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
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${Number(amount)},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${Number(amount)}, updated_at = NOW();
  `);
}

function walletBal(userId, currency) {
  const id = String(userId).replace(/'/g, "");
  const cur = String(currency).replace(/'/g, "");
  return Number(
    sql(
      `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${id}' AND currency='${cur}'`,
    ) || 0,
  );
}

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

async function e2eSession(username, email, role) {
  const body = { username, email };
  if (role) body.role = role;
  const r = await req("/auth/e2e/session", { method: "POST", body: JSON.stringify(body) });
  if (r.status === 404 || r.status === 403) {
    console.error("SKIP: e2e auth off", r.status);
    process.exit(2);
  }
  assert(r.status === 200 && r.body?.access_token && r.body?.user?.id, `session ${username}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

async function passCashGate(tok, phoneSuffix) {
  const h = { Authorization: `Bearer ${tok}` };
  await req("/me/age-gate", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ date_of_birth: "1988-06-01" }),
  });
  await req("/me/phone-kyc", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ phone: `+2519${phoneSuffix}` }),
  });
  const otp = await req("/me/phone-kyc/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (otp.status < 300 && otp.body?.debug_code) {
    await req("/me/phone-kyc/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: otp.body.challenge_id,
        code: otp.body.debug_code,
      }),
    });
  }
  await req("/geo/locate", { method: "POST", headers: h, body: JSON.stringify({}) });
  const start = await req("/auth/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (start.status < 300 && start.body?.debug_code) {
    await req("/auth/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: start.body.challenge_id,
        code: start.body.debug_code,
      }),
    });
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const admin = await e2eSession(`herrpp_adm_${stamp}`, `herrpp_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`herrpp_org_${stamp}`, `herrpp_org_${stamp}@ex.com`);
  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const rr = String(enums.hosted_event_round_robin_format || "").trim();
  const places = String(enums.competition_payout_mode_places_percent || "").trim();
  const readyStatus = String(enums.hosted_event_bracket_ready || "").trim();
  assert(rr && places && readyStatus, "rr + places% + ready from DB");

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, "catalog");
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    ids.add(rr);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.min_players_to_start) cat.min_players_to_start = {};
  cat.min_players_to_start[rr] = Math.max(4, Number(cat.min_players_to_start[rr]) || 4);
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  const size =
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(rr)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  const hostFee = Number(size.host_fee_amount || 0);
  const entryFee = 40;
  const minPlayers = Math.max(4, Number(cat.min_players_to_start[rr]) || 4);
  creditWallet(org.uid, hostCur, Math.max(hostFee * 4 + entryFee * minPlayers * 2, 800));

  let phone = 5740000;
  phone += 1;
  await passCashGate(org.tok, String(phone).slice(-8));

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    const p = await e2eSession(`herrpp_p${i}_${stamp}`, `herrpp_p${i}_${stamp}@ex.com`);
    creditWallet(p.uid, hostCur, entryFee * 4);
    phone += 1;
    await passCashGate(p.tok, String(phone).slice(-8));
    players.push(p);
  }

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted RR Places% ${stamp}`,
      format_id: rr,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: hostCur,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: false,
      prize_payout_mode: places,
      prize_place_percents: { 1: 50, 2: 30, 3: 20 },
      country_code: "ET",
      auto_approve: true,
    }),
  });
  assert(
    create.status === 200 || create.status === 201,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, "event id+code");
  const eid = ev.id;

  let mode = String(ev.prize_payout_mode || "").trim();
  if (mode !== places) {
    const patch = await req(`/events/${eid}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({
        prize_payout_mode: places,
        prize_place_percents: { 1: 50, 2: 30, 3: 20 },
      }),
    });
    assert(patch.status === 200, `patch ${patch.status}`);
    mode = String((patch.body?.event || patch.body)?.prize_payout_mode || "").trim();
  }
  assert(mode === places, `mode ${mode}`);

  for (const p of players) {
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(join.status === 200 || join.status === 201, `join ${join.status}`);
    await req(`/events/${eid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }

  const start = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  const frozenAtStart = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM hosted_events WHERE id='${eid}'`),
  );
  assert(frozenAtStart > 0, `classic freeze at start (${frozenAtStart})`);

  for (let round = 0; round < 80; round++) {
    const finished = sql(
      `SELECT COALESCE(finished_at::text,'') FROM hosted_events WHERE id='${eid}'`,
    );
    if (finished) break;
    const br = await req(`/events/${eid}/bracket`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    const bracket = br.body?.bracket || [];
    const match = bracket.find(
      (m) =>
        !m.is_bye &&
        m.player_a_id &&
        m.player_b_id &&
        String(m.status || "").trim() === readyStatus,
    );
    if (!match?.id) {
      await sleep(300);
      continue;
    }
    const ff = await req(`/events/${eid}/bracket/${match.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({ user_id: match.player_b_id }),
    });
    assert(ff.status === 200, `forfeit ${match.id.slice(0, 8)} ${ff.status}`);
  }
  assert(
    sql(`SELECT COALESCE(finished_at::text,'') FROM hosted_events WHERE id='${eid}'`).length > 0,
    "finished_at",
  );

  const placeRows = sql(`
    SELECT placement::text || ':' || user_id::text
    FROM hosted_event_entries
    WHERE event_id='${eid}' AND placement IS NOT NULL
    ORDER BY placement ASC
  `);
  const placesMap = {};
  for (const line of placeRows.split("\n").filter(Boolean)) {
    const [pl, uid] = line.split(":");
    placesMap[Number(pl)] = uid;
  }
  assert(placesMap[1] && placesMap[2] && placesMap[3], `placements 1/2/3 got ${placeRows}`);

  const frozen = Number(
    sql(
      `SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM hosted_events WHERE id='${eid}'`,
    ) || 0,
  );
  const payoutRows = sql(`
    SELECT placement::text || ':' || amount::text || ':' || user_id::text
    FROM competition_prize_payouts
    WHERE entity_kind='event' AND entity_id='${eid}'
    ORDER BY placement ASC
  `);
  assert(payoutRows.length > 0, "escrow rows");
  const byPlace = {};
  for (const line of payoutRows.split("\n").filter(Boolean)) {
    const [pl, amt, uid] = line.split(":");
    byPlace[Number(pl)] = { amount: Number(amt), userId: uid };
  }
  assert(byPlace[1] && byPlace[2] && byPlace[3], `payouts 1/2/3 ${payoutRows}`);
  const expect = (pct) => Math.round(frozen * pct * 100) / 100;
  assert(Math.abs(byPlace[1].amount - expect(0.5)) < 0.02, `1st 50% got ${byPlace[1].amount}`);
  assert(Math.abs(byPlace[2].amount - expect(0.3)) < 0.02, `2nd 30% got ${byPlace[2].amount}`);
  assert(Math.abs(byPlace[3].amount - expect(0.2)) < 0.02, `3rd 20% got ${byPlace[3].amount}`);

  sql(`
    UPDATE hosted_events
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${eid}'
  `);
  const balBefore = walletBal(byPlace[1].userId, hostCur);
  const settle = await req("/console/competitions/settle-prizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(settle.status === 200, "settle");
  const settled = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='settled'`,
    ) || 0,
  );
  assert(settled >= 3, `settled n=${settled}`);
  const balAfter = walletBal(byPlace[1].userId, hostCur);
  assert(balAfter > balBefore, `1st wallet ${balBefore} -> ${balAfter}`);

  console.log("E2E_PASS: hosted RR places_percent settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
