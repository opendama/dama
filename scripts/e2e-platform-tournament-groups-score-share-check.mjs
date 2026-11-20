/**
 * E2E: paid Groups (groups_knockout) score_share → play through → escrow by standings points → settle → wallet.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-groups-score-share-check.mjs
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
  const amt = Number(amount);
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${amt},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${amt}, updated_at = NOW();
  `);
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
    const retryable = r.status === 429 || r.status === 502 || r.status === 503;
    if (!retryable || attempt === 8) return { status: r.status, body };
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
  mutation($title: String!, $fee: Float!, $cur: String!, $formatId: String, $maxPlayers: Int) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: $cur
      prizePoolDisplayEnabled: true
      prizePoolAmount: 10
      prizePoolCurrency: $cur
      formatId: $formatId
      maxPlayers: $maxPlayers
    ) { id formatId }
  }
`;

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`gkss_adm_${stamp}`, `gkss_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const enumsRes = await req("/platform/enums", { headers: { Authorization: `Bearer ${atok}` } });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body;
  const groups = (enums.hosted_event_groups_knockout_format || "").trim();
  const scoreMode = (enums.competition_payout_mode_score_share || "").trim();
  const readyStatus = (enums.tournament_bracket_ready || "").trim();
  const doneStatus = (enums.tournament_bracket_done || "").trim();
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  assert(groups && scoreMode && readyStatus, "groups + score_share + ready from DB");

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, "catalog");
  const cat = { ...catGet.body };
  cat.source = undefined;
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    for (const f of cat.formats || []) ids.add(f.id);
    s.allowed_format_ids = [...ids];
  }
  if (!(cat.groups_knockout_target_group_size > 0)) cat.groups_knockout_target_group_size = 4;
  if (!(cat.groups_knockout_advance_per_group > 0)) cat.groups_knockout_advance_per_group = 2;
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify(cat),
  });

  let minPlayers = 8;
  const pub = await req("/events/catalog", { headers: { Authorization: `Bearer ${atok}` } });
  if (pub.status === 200) {
    const n = Number(pub.body?.min_players_to_start?.[groups]);
    if (Number.isFinite(n) && n >= 2) minPlayers = Math.max(n, 8);
  }

  const entryFee = 40;
  const currency = "USD";
  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    const p = await e2eSession(`gkss_p${i}_${stamp}`, `gkss_p${i}_${stamp}@ex.com`);
    creditWallet(p.uid, currency, entryFee * 5);
    players.push(p);
  }

  const create = await gql(atok, CREATE, {
    title: `E2E Groups ScoreShare ${stamp}`,
    fee: entryFee,
    cur: currency,
    formatId: groups,
    maxPlayers: Math.max(minPlayers, 8),
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${JSON.stringify(create.body).slice(0, 180)}`,
  );
  const tid = create.body.data.createTournament.id;

  const upd = await req(`/console/tournaments/${tid}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      title: `E2E Groups ScoreShare ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      prize_pool_amount: 10,
      prize_pool_currency: currency,
      prize_pool_display_enabled: true,
      max_players: Math.max(minPlayers, 8),
      format_id: groups,
      prize_payout_mode: scoreMode,
      prize_place_percents: {},
    }),
  });
  assert(upd.status === 200, `update ${upd.status}`);
  assert(
    (upd.body?.prize_payout_mode || "") === scoreMode,
    `mode persisted ${upd.body?.prize_payout_mode}`,
  );

  assert(
    (
      await req(`/console/tournaments/${tid}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({ status: enrollable }),
      })
    ).status === 200,
    "open",
  );

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    await ensureCashReady(p.tok, `${String(stamp).slice(-6)}${i}${i}`);
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ country_code: "ET" }),
    });
    assert(
      en.status === 200 || en.status === 201,
      `enroll ${en.status} ${JSON.stringify(en.body).slice(0, 200)}`,
    );
    await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  const frozenAtStart = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM tournaments WHERE id='${tid}'`),
  );
  assert(frozenAtStart > 0, `classic freeze at start (${frozenAtStart})`);

  for (let round = 0; round < 80; round++) {
    const finished = sql(
      `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid}'`,
    );
    if (finished) break;
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${atok}` },
    });
    const bracket = br.body?.bracket || [];
    const match = bracket.find(
      (m) =>
        !m.is_bye &&
        m.player_a_id &&
        m.player_b_id &&
        String(m.status || "").trim() === readyStatus &&
        (!doneStatus || String(m.status || "").trim() !== doneStatus),
    );
    if (!match?.id) {
      await sleep(300);
      continue;
    }
    const ff = await req(`/console/tournaments/${tid}/bracket/${match.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${atok}` },
      body: JSON.stringify({ user_id: match.player_b_id }),
    });
    assert(ff.status === 200, `forfeit ${match.id} ${ff.status}`);
  }
  const finishedAt = sql(
    `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid}'`,
  );
  assert(finishedAt, "Groups finished_at set after playthrough");

  // Score-share uses the same phase filter as GET standings (group stage only for groups_knockout).
  const stand = await req(`/tournaments/${tid}/standings`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(stand.status === 200, `standings for score_share ${stand.status}`);
  const ptsByUser = {};
  let totalPts = 0;
  for (const r of stand.body?.standings || []) {
    const uid = String(r.user_id || "").trim();
    const pts = Number(r.points || 0);
    if (!uid || !(pts > 0)) continue;
    ptsByUser[uid] = pts;
    totalPts += pts;
  }
  assert(totalPts > 0, `score_share points total > 0 ${JSON.stringify(ptsByUser)}`);

  let rows = "";
  for (let i = 0; i < 20; i++) {
    rows = sql(
      `SELECT user_id::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' ORDER BY placement`,
    );
    if (rows) break;
    await sleep(500);
  }
  assert(rows, "escrow payout rows");
  const byUser = {};
  for (const line of rows.split("\n").filter(Boolean)) {
    const [uid, amt] = line.split(":");
    byUser[uid] = Number(amt);
  }
  const frozen = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM tournaments WHERE id='${tid}'`),
  );
  let paidSum = 0;
  const ranked = Object.entries(ptsByUser).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  for (let i = 0; i < ranked.length; i++) {
    const [uid, pts] = ranked[i];
    assert(byUser[uid] != null, `payout for ${uid}`);
    const expect = Math.round(((frozen * pts) / totalPts) * 100) / 100;
    const tol = i === 0 ? 0.1 : 0.06;
    assert(
      Math.abs(byUser[uid] - expect) < tol,
      `share ${uid} got ${byUser[uid]} expect~${expect} (${pts}/${totalPts})`,
    );
    paidSum += byUser[uid];
  }
  assert(
    Math.abs(Math.round(paidSum * 100) / 100 - frozen) < 0.02,
    `sum ${paidSum} == frozen ${frozen}`,
  );

  sql(`
    UPDATE tournaments
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${tid}';
  `);
  const topUid = Object.entries(ptsByUser).sort((a, b) => b[1] - a[1])[0][0];
  const balBefore = Number(
    sql(
      `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${topUid}' AND currency='${currency}'`,
    ) || 0,
  );
  assert(
    (
      await req("/console/competitions/settle-prizes", {
        method: "POST",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({}),
      })
    ).status === 200,
    "settle",
  );
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
  assert(settledN > 0, `settled ${settledN}`);
  const balAfter = Number(
    sql(
      `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${topUid}' AND currency='${currency}'`,
    ) || 0,
  );
  assert(balAfter > balBefore, `top scorer wallet ${balBefore} -> ${balAfter}`);

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  console.log("E2E_PASS: platform Groups score_share settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
