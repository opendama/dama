/**
 * E2E: paid KO score_share → playthrough (wins → standings Pts) → pot×points/total
 * escrow (eliminated winners still share) → settle → wallet. places% remains alternate.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-ko-score-share-check.mjs
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

const CREATE = `
  mutation($title: String!, $fee: Float!, $cur: String!, $formatId: String!) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: $cur
      prizePoolDisplayEnabled: true
      prizePoolAmount: 20
      prizePoolCurrency: $cur
      formatId: $formatId
      maxPlayers: 4
    ) { id formatId prizePayoutMode }
  }
`;

async function main() {
  const stamp = Date.now().toString(36);
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const admin = await e2eSession(`koss_adm_${stamp}`, `koss_adm_${stamp}@ex.com`, "admin");
  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const ko = String(enums.hosted_event_knockout_format || "").trim();
  const scoreMode = String(enums.competition_payout_mode_score_share || "").trim();
  const enrollable = String(enums.enrollable_tournament_status || "open").trim();
  assert(ko && scoreMode, "ko + score_share from DB");

  const fee = 40;
  const cur = "USD";
  const players = [];
  for (let i = 0; i < 4; i++) {
    const p = await e2eSession(`koss_p${i}_${stamp}`, `koss_p${i}_${stamp}@ex.com`);
    creditWallet(p.uid, cur, fee * 4);
    await passCashGate(p.tok, String(5620000 + i).slice(-8));
    players.push(p);
  }

  const create = await gql(admin.tok, CREATE, {
    title: `KO ScoreShare ${stamp}`,
    fee,
    cur,
    formatId: ko,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const tid = create.body.data.createTournament.id;
  assert(tid, "tournament id");

  const title = `KO ScoreShare ${stamp}`;
  const upd = await req(`/console/tournaments/${tid}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title,
      description: "",
      is_free: false,
      entry_fee_amount: fee,
      entry_fee_currency: cur,
      prize_pool_amount: 20,
      prize_pool_currency: cur,
      prize_pool_display_enabled: true,
      format_id: ko,
      max_players: 4,
      prize_payout_mode: scoreMode,
      prize_place_percents: {},
    }),
  });
  assert(
    upd.status === 200,
    `update payout ${upd.status} ${JSON.stringify(upd.body).slice(0, 160)}`,
  );
  assert(
    String(upd.body?.prize_payout_mode || "").trim() === scoreMode,
    "prize_payout_mode score_share",
  );

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
  for (const p of players) {
    await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  const frozenAtStart = Number(
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM tournaments WHERE id='${tid}'`),
  );
  assert(frozenAtStart > 0, `classic freeze at start (${frozenAtStart})`);

  const readyStatuses = new Set(
    [enums.tournament_bracket_ready, enums.hosted_event_bracket_ready, "ready"]
      .map((s) => String(s || "").trim())
      .filter(Boolean),
  );
  async function loadBracket() {
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${admin.tok}` },
    });
    return br.body?.bracket || br.body?.matches || [];
  }
  for (let round = 0; round < 16; round++) {
    const finished = sql(
      `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid}'`,
    );
    if (finished.length > 0) break;
    const bracket = await loadBracket();
    const playable = bracket.find(
      (m) =>
        readyStatuses.has(String(m.status || "").trim()) &&
        m.player_a_id &&
        m.player_b_id &&
        !m.is_bye,
    );
    assert(playable, `ready match pass ${round}`);
    const ff = await req(`/console/tournaments/${tid}/bracket/${playable.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({ user_id: playable.player_b_id }),
    });
    assert(ff.status === 200, `forfeit ${round} ${ff.status}`);
  }

  assert(
    sql(`SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid}'`).length > 0,
    "finished_at",
  );

  const stand = await req(`/tournaments/${tid}/standings`, {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(stand.status === 200, `standings ${stand.status}`);
  const rowsStand = stand.body?.standings || [];
  const ptsByUser = {};
  let totalPts = 0;
  for (const r of rowsStand) {
    const uid = String(r.user_id || "").trim();
    const pts = Number(r.points || 0);
    if (!uid || !(pts > 0)) continue;
    ptsByUser[uid] = pts;
    totalPts += pts;
  }
  assert(totalPts > 0, `KO standings points > 0 ${JSON.stringify(ptsByUser)}`);
  // 4-player KO: champion 2 wins + runner-up 1 win (first-round losers have 0 → no share).
  assert(Object.keys(ptsByUser).length >= 2, `at least 2 scorers got ${JSON.stringify(ptsByUser)}`);

  let payoutRows = "";
  for (let i = 0; i < 20; i++) {
    payoutRows = sql(
      `SELECT user_id::text || ':' || amount::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid}' ORDER BY placement`,
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
    sql(`SELECT COALESCE(prize_pool_frozen_amount::text,'0') FROM tournaments WHERE id='${tid}'`) ||
      0,
  );
  assert(frozen > 0, `frozen pot ${frozen}`);

  let paidSum = 0;
  const ranked = Object.entries(ptsByUser).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  for (let i = 0; i < ranked.length; i++) {
    const [uid, pts] = ranked[i];
    assert(byUser[uid] != null, `payout for scorer ${uid}`);
    const expect = Math.round(((frozen * pts) / totalPts) * 100) / 100;
    const tol = i === 0 ? 0.1 : 0.06;
    assert(
      Math.abs(byUser[uid] - expect) < tol,
      `share ${uid} got ${byUser[uid]} expect~${expect} (${pts}/${totalPts})`,
    );
    paidSum += byUser[uid];
  }
  // Zero-point players must not receive score-share escrow.
  for (const p of players) {
    if (!ptsByUser[p.uid]) {
      assert(byUser[p.uid] == null, `zero-pts ${p.uid} must not get score-share`);
    }
  }
  assert(
    Math.abs(Math.round(paidSum * 100) / 100 - frozen) < 0.02,
    `sum ${paidSum} == frozen ${frozen}`,
  );

  sql(`
    UPDATE tournaments
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${tid}'
  `);
  const topUid = ranked[0][0];
  const balBefore = walletBal(topUid, cur);
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
  assert(settled >= Object.keys(ptsByUser).length, `settled n=${settled}`);
  const balAfter = walletBal(topUid, cur);
  assert(balAfter > balBefore, `top scorer wallet ${balBefore} -> ${balAfter}`);

  console.log("E2E_PASS: platform KO score_share settle");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
