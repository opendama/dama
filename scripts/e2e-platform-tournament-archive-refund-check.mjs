/**
 * E2E: admin GraphQL setTournamentStatus open → archived refunds paid seats
 * (parity with REST console SetStatus; admin UI uses GraphQL).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-archive-refund-check.mjs
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
  return { status: 503, body: { error: "transient upstream" } };
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

function walletBal(userId, currency) {
  const id = String(userId).replace(/'/g, "");
  const cur = String(currency).replace(/'/g, "");
  const row = sql(
    `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${id}' AND currency='${cur}'`,
  );
  return Number(row || 0);
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
  assert(r.status === 200 && r.body?.access_token && r.body?.user?.id, `e2e session ${username}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

const CREATE = `
  mutation CreatePaid($title: String!, $fee: Float!, $cur: String!, $formatId: String!) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: $cur
      prizePoolDisplayEnabled: true
      maxPlayers: 8
      formatId: $formatId
    ) { id status }
  }
`;

const SET_STATUS = `
  mutation SetStatus($id: ID!, $status: String!) {
    setTournamentStatus(id: $id, status: $status) { id status }
  }
`;

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
    body: JSON.stringify({ phone: `+2519${String(phoneSuffix).padStart(8, "0")}` }),
  });
  await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
}

async function main() {
  const stamp = Date.now();
  const admin = await e2eSession(`ptar_adm_${stamp}`, `ptar_adm_${stamp}@example.com`, "admin");
  const atok = admin.tok;

  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, "platform enums");
  const enums = enumsRes.body;
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const archived =
    (enums.tournament_statuses || []).find((s) => String(s).trim() === "archived") || "archived";
  const koFormat = (
    enums.tournament_default_format ||
    enums.hosted_event_knockout_format ||
    "knockout"
  ).trim();

  const entryFee = 40;
  const currency = "USD";
  const p0 = await e2eSession(`ptar_p0_${stamp}`, `ptar_p0_${stamp}@example.com`);
  const p1 = await e2eSession(`ptar_p1_${stamp}`, `ptar_p1_${stamp}@example.com`);
  creditWallet(p0.uid, currency, entryFee * 3);
  creditWallet(p1.uid, currency, entryFee * 3);
  await ensureCashReady(p0.tok, stamp % 100000000);
  await ensureCashReady(p1.tok, (stamp + 1) % 100000000);

  const create = await gql(atok, CREATE, {
    title: `E2E Archive Refund ${stamp}`,
    fee: entryFee,
    cur: currency,
    formatId: koFormat,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${JSON.stringify(create.body).slice(0, 180)}`,
  );
  const tid = create.body.data?.createTournament?.id;
  assert(tid, "tournament id");

  const open = await gql(atok, SET_STATUS, { id: tid, status: enrollable });
  assert(
    open.status === 200 &&
      !open.body?.errors &&
      open.body.data?.setTournamentStatus?.status === enrollable,
    `open via GraphQL ${JSON.stringify(open.body).slice(0, 180)}`,
  );

  for (const p of [p0, p1]) {
    const before = walletBal(p.uid, currency);
    const enroll = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(enroll.status === 201 || enroll.status === 200, `enroll ${enroll.status}`);
    const after = walletBal(p.uid, currency);
    assert(after <= before - entryFee + 0.001, `fee charged uid=${p.uid} ${before}->${after}`);
  }

  const bal0Before = walletBal(p0.uid, currency);
  const bal1Before = walletBal(p1.uid, currency);

  const arch = await gql(atok, SET_STATUS, { id: tid, status: archived });
  assert(
    arch.status === 200 &&
      !arch.body?.errors &&
      arch.body.data?.setTournamentStatus?.status === archived,
    `archive via GraphQL ${JSON.stringify(arch.body).slice(0, 220)}`,
  );

  const bal0After = walletBal(p0.uid, currency);
  const bal1After = walletBal(p1.uid, currency);
  assert(bal0After >= bal0Before + entryFee - 0.001, `p0 refunded ${bal0Before}->${bal0After}`);
  assert(bal1After >= bal1Before + entryFee - 0.001, `p1 refunded ${bal1Before}->${bal1After}`);

  const ledger = sql(`
    SELECT COUNT(*)::text FROM wallet_ledger
    WHERE kind = 'tournament_entry_refund'
      AND reference LIKE 'tournament_entry_refund:%'
      AND user_id IN ('${p0.uid.replace(/'/g, "")}','${p1.uid.replace(/'/g, "")}')
  `);
  assert(Number(ledger) >= 2, `ledger refund rows got=${ledger}`);

  console.log("ALL PLATFORM TOURNAMENT ARCHIVE REFUND E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
