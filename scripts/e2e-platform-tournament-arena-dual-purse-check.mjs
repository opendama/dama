/**
 * E2E: paid Arena dual_purse → seed arena Pts → force finish → place+perf merge escrow → settle → wallet.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-arena-dual-purse-check.mjs
 */
import { execFileSync } from "node:child_process";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;
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

async function gql(token, query, variables) {
  const res = await fetch(gqlBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
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

async function ensureCashReady(tok, phoneSuffix) {
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

const CREATE = `
  mutation($title: String!, $fee: Float!, $cur: String!, $formatId: String, $maxPlayers: Int, $mins: Int) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: $cur
      prizePoolDisplayEnabled: true
      formatId: $formatId
      maxPlayers: $maxPlayers
      arenaDurationMinutes: $mins
    ) { id title formatId }
  }
`;

async function main() {
  const stamp = Date.now().toString(36);
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const admin = await e2eSession(`ardp_adm_${stamp}`, `ardp_adm_${stamp}@ex.com`, "admin");
  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const arenaFormat = String(enums.hosted_event_arena_format || "").trim();
  const dualMode = String(enums.competition_payout_mode_dual_purse || "").trim();
  const dualPlacePct = Number(String(enums.competition_dual_purse_place_percent || "").trim());
  const enrollable = String(enums.enrollable_tournament_status || "open").trim();
  assert(arenaFormat && dualMode, "arena + dual_purse from DB");
  assert(
    Number.isFinite(dualPlacePct) && dualPlacePct > 0 && dualPlacePct < 100,
    `dual place % ${dualPlacePct}`,
  );

  const fee = 40;
  const cur = "USD";
  // 4 players + place% 70/30 → places 3/4 can earn performance purse only (PKO non-ITM claim).
  const players = [];
  for (let i = 0; i < 4; i++) {
    const p = await e2eSession(`ardp_p${i}_${stamp}`, `ardp_p${i}_${stamp}@ex.com`);
    creditWallet(p.uid, cur, fee * 5);
    await ensureCashReady(p.tok, String(5640001 + i).slice(-8));
    players.push(p);
  }
  const [p1, p2, p3, p4] = players;

  const create = await gql(admin.tok, CREATE, {
    title: `Arena DualPurse ${stamp}`,
    fee,
    cur,
    formatId: arenaFormat,
    maxPlayers: 8,
    mins: 5,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const tid = create.body.data.createTournament.id;
  assert(tid, "tournament id");

  const upd = await req(`/console/tournaments/${tid}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Arena DualPurse ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: fee,
      entry_fee_currency: cur,
      prize_pool_amount: 10,
      prize_pool_currency: cur,
      prize_pool_display_enabled: true,
      max_players: 8,
      format_id: arenaFormat,
      arena_duration_minutes: 5,
      prize_payout_mode: dualMode,
      prize_place_percents: { 1: 70, 2: 30 },
    }),
  });
  assert(upd.status === 200, `update ${upd.status}`);
  assert(String(upd.body?.prize_payout_mode || "").trim() === dualMode, "mode dual_purse");

  const open = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(open.status === 200, "open");

  for (const p of players) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ country_code: "ET" }),
    });
    assert(en.status === 200 || en.status === 201, `enroll ${en.status}`);
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  // Unequal arena points → places 1..4; place% 70/30 so p3/p4 are performance-only (non-ITM).
  const ptsByUid = {
    [p1.uid]: 40,
    [p2.uid]: 25,
    [p3.uid]: 15,
    [p4.uid]: 10,
  };
  for (const [uid, pts] of Object.entries(ptsByUid)) {
    sql(
      `UPDATE tournament_entries SET arena_points = ${pts} WHERE tournament_id = '${tid}' AND user_id = '${uid}'`,
    );
  }

  const finish = await req(`/console/tournaments/${tid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(finish.status === 200, `finish ${finish.status}`);

  const frozen = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM tournaments WHERE id='${tid}'`),
  );
  assert(frozen > 0, `frozen ${frozen}`);

  let rows = "";
  for (let i = 0; i < 20; i++) {
    rows = sql(
      `SELECT user_id::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' ORDER BY placement`,
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
    UPDATE tournaments
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${tid}'
  `);
  const balBefore = walletBal(p1.uid, cur);
  const settle = await req("/console/competitions/settle-prizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(settle.status === 200, "settle");
  const settled = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' AND status='settled'`,
    ) || 0,
  );
  assert(settled >= Object.keys(expectByUser).length, `settled n=${settled}`);
  const balAfter = walletBal(p1.uid, cur);
  assert(balAfter > balBefore, `p1 wallet ${balBefore} -> ${balAfter}`);

  console.log("E2E_PASS: platform Arena dual_purse settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
