/**
 * E2E: paid hosted Arena score_share → organizer PATCH payout → finish → escrow → settle → wallet.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-arena-payout-score-share-check.mjs
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
  const amt = Number(amount);
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${amt},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${amt}, updated_at = NOW();
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
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
    const retryable = r.status === 429 || r.status === 502 || r.status === 503;
    if (!retryable || attempt === maxAttempts) {
      return { status: r.status, body };
    }
    await sleep(1000 * attempt);
  }
  return { status: 503, body: { error: "transient" } };
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
  const r = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (r.status === 404 || r.status === 403) {
    console.error("SKIP: /auth/e2e/session unavailable (set DAMA_ALLOW_E2E_AUTH=1).", r.status);
    process.exit(2);
  }
  assert(r.status === 200 && r.body?.access_token && r.body?.user?.id, `e2e session ${username}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

async function passCashGate(tok, phoneSuffix) {
  const h = { Authorization: `Bearer ${tok}` };
  let r = await req("/me/age-gate", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ date_of_birth: "1988-06-01" }),
  });
  assert(r.status < 300 || r.body?.ok === true || r.status === 200, `age-gate ${r.status}`);
  r = await req("/me/phone-kyc", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ phone: `+2519${phoneSuffix}` }),
  });
  assert(r.status < 300, `phone-kyc ${r.status}`);
  const otp = await req("/me/phone-kyc/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (otp.status < 300 && otp.body?.debug_code) {
    r = await req("/me/phone-kyc/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: otp.body.challenge_id,
        code: otp.body.debug_code,
      }),
    });
    assert(r.status < 300, `otp verify ${r.status}`);
  }
  r = await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  assert(r.status < 300, `locate ${r.status}`);
  const start = await req("/auth/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (start.status < 300 && start.body?.debug_code) {
    const ver = await req("/auth/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: start.body.challenge_id,
        code: start.body.debug_code,
      }),
    });
    assert(ver.status < 300, `session otp verify ${ver.status}`);
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const admin = await e2eSession(`heass_adm_${stamp}`, `heass_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`heass_org_${stamp}`, `heass_org_${stamp}@ex.com`);
  const p1 = await e2eSession(`heass_p1_${stamp}`, `heass_p1_${stamp}@ex.com`);
  const p2 = await e2eSession(`heass_p2_${stamp}`, `heass_p2_${stamp}@ex.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  const scoreMode = String(enums.competition_payout_mode_score_share || "").trim();
  assert(arenaId, "arena format");
  assert(scoreMode, "score_share mode");

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, `catalog get ${catGet.status}`);
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
  const put = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });
  assert(put.status === 200, `catalog put ${put.status}`);

  const size =
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(arenaId)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  const hostFee = Number(size.host_fee_amount || 0);
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  const entryFee = 40;
  const currency = hostCur;
  const guarantee = 20;
  creditWallet(org.uid, hostCur, Math.max(hostFee * 4 + guarantee * 4, 800));

  let phone = 5900000;
  phone += 1;
  await passCashGate(org.tok, String(phone).slice(-8));

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Arena ScoreShare ${stamp}`,
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
      country_code: "ET",
      auto_approve: true,
    }),
  });
  assert(
    create.status === 200 || create.status === 201,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 240)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id, "event id");
  const eid = ev.id;

  // Organizer PATCH payout mode before start (parity with admin).
  const patch = await req(`/events/${eid}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      prize_payout_mode: scoreMode,
      prize_place_percents: {},
    }),
  });
  assert(
    patch.status === 200,
    `patch payout ${patch.status} ${JSON.stringify(patch.body).slice(0, 200)}`,
  );
  const modeOut = patch.body?.prize_payout_mode || patch.body?.event?.prize_payout_mode;
  assert(modeOut === scoreMode, `prize_payout_mode persisted ${modeOut}`);

  for (const [p, suf] of [
    [p1, "11"],
    [p2, "22"],
  ]) {
    phone += 1;
    await passCashGate(p.tok, `${String(phone).slice(-6)}${suf}`);
    creditWallet(p.uid, currency, entryFee * 5);
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(
      join.status === 200 || join.status === 201,
      `join ${join.status} ${JSON.stringify(join.body).slice(0, 160)}`,
    );
  }

  const start = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status} ${JSON.stringify(start.body).slice(0, 200)}`);

  const p1Pts = 20;
  const p2Pts = 5;
  const totalPts = p1Pts + p2Pts;
  sql(
    `UPDATE hosted_event_entries SET arena_points = ${p1Pts} WHERE event_id = '${eid}' AND user_id = '${p1.uid}'`,
  );
  sql(
    `UPDATE hosted_event_entries SET arena_points = ${p2Pts} WHERE event_id = '${eid}' AND user_id = '${p2.uid}'`,
  );

  const finish = await req(`/events/${eid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    finish.status === 200,
    `finish ${finish.status} ${JSON.stringify(finish.body).slice(0, 200)}`,
  );

  const frozen = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM hosted_events WHERE id='${eid}'`),
  );
  assert(frozen > 0, `frozen pot > 0 (${frozen})`);

  let rows = "";
  for (let i = 0; i < 20; i++) {
    rows = sql(
      `SELECT user_id::text || ':' || placement::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' ORDER BY placement`,
    );
    if (rows) break;
    await sleep(500);
  }
  assert(rows, "escrow payout rows exist");
  const byUser = {};
  for (const line of rows.split("\n").filter(Boolean)) {
    const [uid, place, amt] = line.split(":");
    byUser[uid] = { place: Number(place), amount: Number(amt) };
  }
  assert(byUser[p1.uid] && byUser[p2.uid], `both users paid ${JSON.stringify(byUser)}`);
  const sum = Math.round((byUser[p1.uid].amount + byUser[p2.uid].amount) * 100) / 100;
  assert(Math.abs(sum - frozen) < 0.011, `payout sum ${sum} == frozen ${frozen}`);
  const expect1 = Math.round(((frozen * p1Pts) / totalPts) * 100) / 100;
  assert(
    Math.abs(byUser[p1.uid].amount - expect1) < 0.05,
    `p1 share got ${byUser[p1.uid].amount} expect~${expect1}`,
  );

  sql(`
    UPDATE hosted_events
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${eid}';
  `);
  const balBefore = walletBal(p1.uid, currency);
  const settle = await req("/console/competitions/settle-prizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(settle.status === 200, `settle ${settle.status}`);
  let settledN = 0;
  for (let i = 0; i < 20; i++) {
    settledN = Number(
      sql(
        `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='settled'`,
      ) || 0,
    );
    if (settledN > 0) break;
    await sleep(500);
  }
  assert(settledN > 0, `settled n=${settledN}`);
  const balAfter = walletBal(p1.uid, currency);
  assert(balAfter > balBefore, `p1 wallet grew ${balBefore} -> ${balAfter}`);

  console.log("E2E_PASS: hosted event arena score_share settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
