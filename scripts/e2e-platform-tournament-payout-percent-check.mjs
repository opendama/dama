/**
 * E2E: paid Arena with places_percent payout → force finish → escrow rows match % of frozen pot.
 *
 * Requires DAMA_ALLOW_E2E_AUTH=1.
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-payout-percent-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

import { execFileSync } from "node:child_process";

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

async function e2eSession(username, email, role) {
  const body = { username, email };
  if (role) body.role = role;
  const r = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (r.status === 404 || r.status === 403) {
    console.error(
      "SKIP: /auth/e2e/session unavailable (set DAMA_ALLOW_E2E_AUTH=1 on API).",
      r.status,
    );
    process.exit(2);
  }
  assert(
    r.status === 200 && r.body?.access_token && r.body?.user?.id,
    `e2e session ${username} ${r.status}`,
  );
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
  mutation CreatePaidArena($title: String!, $fee: Float!, $cur: String!, $formatId: String, $maxPlayers: Int, $mins: Int) {
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
  const admin = await e2eSession(`ppct_adm_${stamp}`, `ppct_adm_${stamp}@example.com`, "admin");
  const atok = admin.tok;

  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, `platform enums ${enumsRes.status}`);
  const enums = enumsRes.body;
  const arenaFormat = (enums.hosted_event_arena_format || "").trim();
  assert(arenaFormat, "hosted_event_arena_format from DB");
  const placesMode = (enums.competition_payout_mode_places_percent || "").trim();
  assert(placesMode, "competition_payout_mode_places_percent from DB");
  const enrollable =
    (enums.enrollable_tournament_status || "").trim() ||
    (enums.tournament_statuses || []).find((s) => String(s).includes("open")) ||
    "open";

  const entryFee = 40;
  const currency = "USD";
  const p1 = await e2eSession(`ppct_p1_${stamp}`, `ppct_p1_${stamp}@example.com`);
  const p2 = await e2eSession(`ppct_p2_${stamp}`, `ppct_p2_${stamp}@example.com`);
  creditWallet(p1.uid, currency, entryFee * 5);
  creditWallet(p2.uid, currency, entryFee * 5);

  const create = await gql(atok, CREATE, {
    title: `E2E Places% Arena ${stamp}`,
    fee: entryFee,
    cur: currency,
    formatId: arenaFormat,
    maxPlayers: 8,
    mins: 5,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 240)}`,
  );
  const tid = create.body.data?.createTournament?.id;
  assert(tid, "tournament id");

  // Persist places_percent (70/30) via console PUT (no single-tournament GET).
  const upd = await req(`/console/tournaments/${tid}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      title: `E2E Places% Arena ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      prize_pool_amount: 10,
      prize_pool_currency: currency,
      prize_pool_display_enabled: true,
      max_players: 8,
      format_id: arenaFormat,
      arena_duration_minutes: 5,
      prize_payout_mode: placesMode,
      prize_place_percents: { 1: 70, 2: 30 },
    }),
  });
  assert(
    upd.status === 200,
    `update payout mode ${upd.status} ${JSON.stringify(upd.body).slice(0, 200)}`,
  );
  const modeOut = upd.body?.prize_payout_mode || upd.body?.tournament?.prize_payout_mode;
  assert(modeOut === placesMode, `prize_payout_mode persisted ${modeOut}`);

  const open = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(open.status === 200, `open ${open.status}`);

  let phoneSeq = 5600000;
  for (const p of [p1, p2]) {
    phoneSeq += 1;
    await ensureCashReady(p.tok, String(phoneSeq).slice(-8));
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ country_code: "ET" }),
    });
    assert(
      en.status === 200 || en.status === 201,
      `enroll ${en.status} ${JSON.stringify(en.body).slice(0, 180)}`,
    );
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status} ${JSON.stringify(start.body).slice(0, 200)}`);

  // Seed unequal arena points so placements are deterministic after finish.
  sql(
    `UPDATE tournament_entries SET arena_points = 20 WHERE tournament_id = '${tid}' AND user_id = '${p1.uid}'`,
  );
  sql(
    `UPDATE tournament_entries SET arena_points = 5 WHERE tournament_id = '${tid}' AND user_id = '${p2.uid}'`,
  );

  const finish = await req(`/console/tournaments/${tid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(finish.status === 200, `force finish ${finish.status}`);

  const frozen = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM tournaments WHERE id='${tid}'`),
  );
  assert(frozen > 0, `frozen pot > 0 (${frozen})`);

  // Escrow may run async with finish - poll payouts briefly.
  let rows = "";
  for (let i = 0; i < 15; i++) {
    rows = sql(
      `SELECT placement::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' ORDER BY placement`,
    );
    if (rows) break;
    await sleep(500);
  }
  assert(rows, "escrow payout rows exist");

  const map = {};
  for (const line of rows.split("\n").filter(Boolean)) {
    const [place, amt] = line.split(":");
    map[Number(place)] = Number(amt);
  }
  const expect1 = Math.round(frozen * 0.7 * 100) / 100;
  const expect2 = Math.round((frozen - expect1) * 100) / 100; // remainder to keep pot closed
  // Places percent builder may put remainder on 1st; allow either exact 70/30 or 70+remainder / 30.
  assert(map[1] > 0 && map[2] > 0, `both place payouts present ${JSON.stringify(map)}`);
  const sum = Math.round(((map[1] || 0) + (map[2] || 0)) * 100) / 100;
  assert(Math.abs(sum - frozen) < 0.011, `payout sum ${sum} == frozen ${frozen}`);
  assert(
    Math.abs((map[1] || 0) - expect1) < 0.02 ||
      Math.abs((map[1] || 0) - (expect1 + (frozen - expect1 - expect2))) < 0.05,
    `1st ~70% got ${map[1]} expect~${expect1}`,
  );

  // Close dispute window → console settle → wallet credit (full money path).
  sql(`
    UPDATE tournaments
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${tid}';
  `);
  const winnerId = sql(
    `SELECT user_id::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' AND placement=1 LIMIT 1`,
  );
  assert(winnerId, "placement-1 winner");
  const balBefore = Number(
    sql(
      `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${winnerId}' AND currency='${currency}'`,
    ) || 0,
  );
  const settle = await req("/console/competitions/settle-prizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(settle.status === 200, `console settle ${settle.status}`);
  let settledN = 0;
  for (let i = 0; i < 20; i++) {
    settledN = Number(
      sql(
        `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' AND status='settled'`,
      ) || 0,
    );
    if (settledN > 0) break;
    await sleep(500);
  }
  assert(settledN > 0, `settled payouts n=${settledN}`);
  const balAfter = Number(
    sql(
      `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${winnerId}' AND currency='${currency}'`,
    ) || 0,
  );
  assert(balAfter > balBefore, `winner wallet grew ${balBefore} -> ${balAfter}`);

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  console.log("E2E_PASS: platform tournament places_percent settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
