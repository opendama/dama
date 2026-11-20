/**
 * E2E: paid hosted Arena dual_purse → seed arena Pts → finish freeze → place+perf merge → settle → wallet.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-arena-dual-purse-check.mjs
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

function roundMoney2(v) {
  return Math.round(v * 100) / 100;
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

  const admin = await e2eSession(`heardp_adm_${stamp}`, `heardp_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`heardp_org_${stamp}`, `heardp_org_${stamp}@ex.com`);
  // 4 players + place% 70/30 → places 3/4 can earn performance purse only (PKO non-ITM claim).
  const players = [];
  for (let i = 0; i < 4; i++) {
    players.push(await e2eSession(`heardp_p${i}_${stamp}`, `heardp_p${i}_${stamp}@ex.com`));
  }
  const [p1, p2, p3, p4] = players;

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  const dualMode = String(enums.competition_payout_mode_dual_purse || "").trim();
  const dualPlacePct = Number(String(enums.competition_dual_purse_place_percent || "").trim());
  assert(arenaId && dualMode, "arena + dual_purse");
  assert(
    Number.isFinite(dualPlacePct) && dualPlacePct > 0 && dualPlacePct < 100,
    `dual place % ${dualPlacePct}`,
  );

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, "catalog");
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    ids.add(arenaId);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.min_players_to_start) cat.min_players_to_start = {};
  cat.min_players_to_start[arenaId] = Math.max(2, Number(cat.min_players_to_start[arenaId]) || 2);
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  const size =
    (cat.sizes || []).find(
      (s) => (s.allowed_format_ids || []).includes(arenaId) && Number(s.max_players || 0) >= 4,
    ) ||
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(arenaId)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  assert(Number(size.max_players || 0) >= 4, `size max_players>=4 got ${size.max_players}`);
  const hostFee = Number(size.host_fee_amount || 0);
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  const entryFee = 40;
  const currency = hostCur;
  const guarantee = 20;
  creditWallet(org.uid, hostCur, Math.max(hostFee * 4 + guarantee * 4 + entryFee * 8, 1200));

  let phone = 5940000;
  phone += 1;
  await passCashGate(org.tok, String(phone).slice(-8));

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Arena DualPurse ${stamp}`,
      format_id: arenaId,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: true,
      prize_pool_guarantee_amount: guarantee,
      arena_duration_minutes: 5,
      prize_payout_mode: dualMode,
      prize_place_percents: { 1: 70, 2: 30 },
      country_code: "ET",
      auto_approve: true,
    }),
  });
  assert(
    create.status === 200 || create.status === 201,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id, "event id");
  const eid = ev.id;

  let mode = String(ev.prize_payout_mode || "").trim();
  if (mode !== dualMode) {
    const patch = await req(`/events/${eid}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({
        prize_payout_mode: dualMode,
        prize_place_percents: { 1: 70, 2: 30 },
      }),
    });
    assert(patch.status === 200, `patch ${patch.status}`);
    mode = String((patch.body?.event || patch.body)?.prize_payout_mode || "").trim();
  }
  assert(mode === dualMode, `mode ${mode}`);

  for (const p of players) {
    phone += 1;
    await passCashGate(p.tok, String(phone).slice(-8));
    creditWallet(p.uid, currency, entryFee * 5);
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(join.status === 200 || join.status === 201, `join ${join.status}`);
  }

  const start = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  const ptsByUid = {
    [p1.uid]: 40,
    [p2.uid]: 25,
    [p3.uid]: 15,
    [p4.uid]: 10,
  };
  for (const [uid, pts] of Object.entries(ptsByUid)) {
    sql(
      `UPDATE hosted_event_entries SET arena_points = ${pts} WHERE event_id = '${eid}' AND user_id = '${uid}'`,
    );
  }

  const finish = await req(`/events/${eid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(finish.status === 200, `finish ${finish.status}`);

  const frozen = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM hosted_events WHERE id='${eid}'`),
  );
  assert(frozen > 0, `frozen ${frozen}`);

  let rows = "";
  for (let i = 0; i < 20; i++) {
    rows = sql(
      `SELECT user_id::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' ORDER BY placement`,
    );
    if (rows) break;
    await sleep(500);
  }
  assert(rows, "escrow rows");
  const byUser = {};
  for (const line of rows.split("\n").filter(Boolean)) {
    const [uid, amt] = line.split(":");
    byUser[uid] = Number(amt);
  }

  const placePurse = roundMoney2((frozen * dualPlacePct) / 100);
  const perfPurse = roundMoney2(frozen - placePurse);
  const totalPts = Object.values(ptsByUid).reduce((a, b) => a + b, 0);
  const placePctByUid = { [p1.uid]: 70, [p2.uid]: 30 };
  const expectByUser = {};
  for (const [uid, pct] of Object.entries(placePctByUid)) {
    expectByUser[uid] = roundMoney2((expectByUser[uid] || 0) + (placePurse * pct) / 100);
  }
  for (const [uid, pts] of Object.entries(ptsByUid)) {
    expectByUser[uid] = roundMoney2((expectByUser[uid] || 0) + (perfPurse * pts) / totalPts);
  }
  {
    const itm = new Set([p1.uid, p2.uid]);
    const nonItm = Object.keys(expectByUser).filter((uid) => !itm.has(uid));
    assert(
      nonItm.length >= 1,
      `dual performance non-ITM payee required ${JSON.stringify({ nonItm, expectByUser })}`,
    );
  }
  let paidSum = 0;
  const ranked = Object.entries(expectByUser).sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < ranked.length; i++) {
    const [uid, expect] = ranked[i];
    assert(byUser[uid] != null, `payout for ${uid}`);
    const tol = i === 0 ? 0.12 : 0.06;
    assert(Math.abs(byUser[uid] - expect) < tol, `dual ${uid} got ${byUser[uid]} expect~${expect}`);
    paidSum += byUser[uid];
  }
  assert(Math.abs(roundMoney2(paidSum) - frozen) < 0.02, "sum == frozen");
  for (const p of players) {
    if (!expectByUser[p.uid]) {
      assert(byUser[p.uid] == null, `zero-expect ${p.uid}`);
    }
  }

  sql(`
    UPDATE hosted_events
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${eid}'
  `);
  const balBefore = walletBal(p1.uid, currency);
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
  assert(settled >= Object.keys(expectByUser).length, `settled n=${settled}`);
  const balAfter = walletBal(p1.uid, currency);
  assert(balAfter > balBefore, `p1 wallet ${balBefore} -> ${balAfter}`);

  console.log("E2E_PASS: hosted Arena dual_purse settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
