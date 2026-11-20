/**
 * E2E: paid hosted Groups (groups_knockout) dual_purse → playthrough → place+perf escrow → settle → wallet.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-groups-dual-purse-check.mjs
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
    const ver = await req("/me/phone-kyc/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: otp.body.challenge_id,
        code: otp.body.debug_code,
      }),
    });
    assert(ver.status < 300, `session otp verify ${ver.status}`);
  }
  await req("/geo/locate", { method: "POST", headers: h, body: JSON.stringify({}) });
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

  const admin = await e2eSession(`hegkdp_adm_${stamp}`, `hegkdp_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`hegkdp_org_${stamp}`, `hegkdp_org_${stamp}@ex.com`);
  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const groups = String(enums.hosted_event_groups_knockout_format || "").trim();
  const dualMode = String(enums.competition_payout_mode_dual_purse || "").trim();
  const dualPlacePct = Number(String(enums.competition_dual_purse_place_percent || "").trim());
  const readyStatus = String(enums.hosted_event_bracket_ready || "").trim();
  assert(groups && dualMode && readyStatus, "groups + dual_purse + ready from DB");
  assert(
    Number.isFinite(dualPlacePct) && dualPlacePct > 0 && dualPlacePct < 100,
    `dual place purse % ${dualPlacePct}`,
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
    ids.add(groups);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.min_players_to_start) cat.min_players_to_start = {};
  cat.min_players_to_start[groups] = Math.max(8, Number(cat.min_players_to_start[groups]) || 8);
  if (!(cat.groups_knockout_target_group_size > 0)) cat.groups_knockout_target_group_size = 4;
  if (!(cat.groups_knockout_advance_per_group > 0)) cat.groups_knockout_advance_per_group = 2;
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  const size =
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(groups)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  const hostFee = Number(size.host_fee_amount || 0);
  const entryFee = 40;
  const minPlayers = Math.max(8, Number(cat.min_players_to_start[groups]) || 8);
  creditWallet(org.uid, hostCur, Math.max(hostFee * 4 + entryFee * minPlayers * 2, 1200));

  let phone = 5870000;
  phone += 1;
  await passCashGate(org.tok, String(phone).slice(-8));

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    const p = await e2eSession(`hegkdp_p${i}_${stamp}`, `hegkdp_p${i}_${stamp}@ex.com`);
    creditWallet(p.uid, hostCur, entryFee * 4);
    phone += 1;
    await passCashGate(p.tok, String(phone).slice(-8));
    players.push(p);
  }

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Groups DualPurse ${stamp}`,
      format_id: groups,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: hostCur,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: false,
      prize_payout_mode: dualMode,
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
  if (mode !== dualMode) {
    const patch = await req(`/events/${eid}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({
        prize_payout_mode: dualMode,
        prize_place_percents: { 1: 50, 2: 30, 3: 20 },
      }),
    });
    assert(patch.status === 200, `patch ${patch.status}`);
    mode = String((patch.body?.event || patch.body)?.prize_payout_mode || "").trim();
  }
  assert(mode === dualMode, `mode ${mode}`);

  for (const p of players) {
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(
      join.status === 200 || join.status === 201,
      `join ${join.status} ${JSON.stringify(join.body).slice(0, 200)}`,
    );
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

  for (let round = 0; round < 120; round++) {
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

  const stand = await req(`/events/${eid}/standings`, {
    headers: { Authorization: `Bearer ${org.tok}` },
  });
  assert(stand.status === 200, `standings ${stand.status}`);
  const rowsStand = stand.body?.standings || [];
  if (!(placesMap[1] && placesMap[2] && placesMap[3])) {
    for (const r of rowsStand) {
      const pl = Number(r.placement);
      const uid = String(r.user_id || "").trim();
      if (pl >= 1 && pl <= 3 && uid) placesMap[pl] = uid;
    }
  }
  assert(placesMap[1] && placesMap[2] && placesMap[3], `places 1/2/3 ${placeRows}`);

  const ptsByUser = {};
  let totalPts = 0;
  for (const r of rowsStand) {
    const uid = String(r.user_id || "").trim();
    const pts = Number(r.points || 0);
    if (!uid || !(pts > 0)) continue;
    ptsByUser[uid] = pts;
    totalPts += pts;
  }
  assert(totalPts > 0, `standings points total > 0 ${JSON.stringify(ptsByUser)}`);

  let payoutRows = "";
  for (let i = 0; i < 20; i++) {
    payoutRows = sql(
      `SELECT user_id::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' ORDER BY placement`,
    );
    if (payoutRows) break;
    await sleep(500);
  }
  assert(payoutRows, "escrow payout rows");
  const byUser = {};
  for (const line of payoutRows.split("\n").filter(Boolean)) {
    const [uid, amt] = line.split(":");
    byUser[uid] = Number(amt);
  }
  const frozen = Number(
    sql(
      `SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM hosted_events WHERE id='${eid}'`,
    ) || 0,
  );

  const placePurse = roundMoney2((frozen * dualPlacePct) / 100);
  const perfPurse = roundMoney2(frozen - placePurse);
  const placePctByPlace = { 1: 50, 2: 30, 3: 20 };
  const expectByUser = {};
  for (const [pl, uid] of Object.entries(placesMap)) {
    const pct = placePctByPlace[Number(pl)];
    if (!pct || !uid) continue;
    expectByUser[uid] = roundMoney2((expectByUser[uid] || 0) + (placePurse * pct) / 100);
  }
  for (const [uid, pts] of Object.entries(ptsByUser)) {
    expectByUser[uid] = roundMoney2((expectByUser[uid] || 0) + (perfPurse * pts) / totalPts);
  }
  // PKO claim: performance purse can pay someone outside finish places 1/2/3.
  {
    const itm = new Set([placesMap[1], placesMap[2], placesMap[3]].filter(Boolean));
    const nonItm = Object.keys(expectByUser).filter((uid) => !itm.has(uid));
    assert(
      nonItm.length >= 1,
      `dual performance non-ITM payee required ${JSON.stringify({ nonItm, expectByUser, placesMap })}`,
    );
  }

  let paidSum = 0;
  const rankedExpect = Object.entries(expectByUser).sort((a, b) => {
    const placeA = Number(Object.entries(placesMap).find(([, u]) => u === a[0])?.[0] || 99);
    const placeB = Number(Object.entries(placesMap).find(([, u]) => u === b[0])?.[0] || 99);
    if (placeA !== placeB) return placeA - placeB;
    return b[1] - a[1];
  });
  for (let i = 0; i < rankedExpect.length; i++) {
    const [uid, expect] = rankedExpect[i];
    assert(byUser[uid] != null, `payout for ${uid}`);
    const tol = i === 0 ? 0.12 : 0.06;
    assert(Math.abs(byUser[uid] - expect) < tol, `dual ${uid} got ${byUser[uid]} expect~${expect}`);
    paidSum += byUser[uid];
  }
  assert(Math.abs(roundMoney2(paidSum) - frozen) < 0.02, `sum ${paidSum} == frozen ${frozen}`);

  sql(`
    UPDATE hosted_events
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${eid}'
  `);
  const topUid = placesMap[1];
  const balBefore = walletBal(topUid, hostCur);
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
  const balAfter = walletBal(topUid, hostCur);
  assert(balAfter > balBefore, `1st wallet ${balBefore} -> ${balAfter}`);

  console.log("E2E_PASS: hosted Groups dual_purse settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
