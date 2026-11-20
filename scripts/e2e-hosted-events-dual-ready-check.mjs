/**
 * E2E: hosted event dual-ready → auto StartGame → game_id (player path, not organizer force).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-events-dual-ready-check.mjs
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
  return { status: 429, body: { error: "rate limit exceeded" } };
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

async function passCashGate(tok, phoneSuffix = "55667788") {
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
}

async function main() {
  const stamp = Date.now();
  const org = await e2eSession(`hedr_org_${stamp}`, `hedr_org_${stamp}@ex.com`);
  const otok = org.tok;
  await passCashGate(otok, String(stamp).slice(-8));

  const cat = await req("/events/catalog", { headers: { Authorization: `Bearer ${otok}` } });
  assert(cat.status === 200, `catalog ${cat.status}`);
  const formats = cat.body?.formats || [];
  const sizes = cat.body?.sizes || [];
  const ko = (cat.body?.hosted_event_knockout_format || "knockout").trim();
  const format =
    formats.find((f) => f.id === ko && f.enabled !== false) ||
    formats.find((f) => f.enabled !== false);
  assert(format?.id, "enabled format");
  const size =
    sizes.find(
      (s) => (s.allowed_format_ids || []).includes(format.id) && Number(s.max_players) >= 4,
    ) ||
    sizes.find((s) => Number(s.max_players) >= 4) ||
    sizes[0];
  assert(size?.id, "size");
  const minPlayers = Math.max(2, Number(cat.body?.min_players_to_start?.[format.id]) || 4);
  const readyStatus = (cat.body?.hosted_event_bracket_ready || "ready").trim();
  const hostFee = Number(size.host_fee_amount) || 0;
  const hostCur = String(size.host_fee_currency || "USD").trim() || "USD";
  if (hostFee > 0) {
    creditWallet(org.uid, hostCur, Math.max(hostFee * 4, 200));
  }

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Event DualReady ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: true,
      entry_fee_amount: 0,
      entry_fee_currency: hostCur,
      country_code: "ET",
    }),
  });
  assert(
    create.status === 201 || create.status === 200,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, "event id + join_code");

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    const p = await e2eSession(`hedr_p${i}_${stamp}`, `hedr_p${i}_${stamp}@ex.com`);
    await passCashGate(p.tok, `${String(stamp).slice(-6)}${i}${i}`);
    players.push(p);
  }

  for (const p of players) {
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code }),
    });
    assert(join.status === 200 || join.status === 201, `join ${join.status}`);
    const ci = await req(`/events/${ev.id}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(ci.status === 200 || ci.status === 201 || ci.status === 409, `check-in ${ci.status}`);
  }

  const start = await req(`/events/${ev.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status} ${JSON.stringify(start.body).slice(0, 200)}`);

  let bracket = start.body?.bracket || [];
  if (!bracket.length) {
    const br = await req(`/events/${ev.id}/bracket`, {
      headers: { Authorization: `Bearer ${otok}` },
    });
    bracket = br.body?.bracket || [];
  }
  assert(bracket.length > 0, "bracket nonempty");

  const match = bracket.find(
    (m) =>
      !m.is_bye && m.player_a_id && m.player_b_id && String(m.status || "").trim() === readyStatus,
  );
  assert(match?.id, `ready match status=${readyStatus}`);

  const aTok = players.find((p) => p.uid === match.player_a_id)?.tok;
  const bTok = players.find((p) => p.uid === match.player_b_id)?.tok;
  assert(aTok && bTok, "player tokens for match seats");

  const r1 = await req(`/events/${ev.id}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aTok}` },
    body: JSON.stringify({}),
  });
  assert(r1.status === 200, `player A ready ${r1.status}`);
  assert(!(r1.body?.game_id || "").trim(), "first ready alone should not start game yet");

  const r2 = await req(`/events/${ev.id}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bTok}` },
    body: JSON.stringify({}),
  });
  assert(r2.status === 200, `player B ready ${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
  const gameId = (r2.body?.game_id || r2.body?.match?.game_id || "").trim();
  assert(gameId.length > 0, `dual-ready auto game_id got=${gameId || "empty"}`);

  const br2 = await req(`/events/${ev.id}/bracket`, {
    headers: { Authorization: `Bearer ${otok}` },
  });
  const updated = (br2.body?.bracket || []).find((m) => m.id === match.id);
  assert((updated?.game_id || "").trim() === gameId, "bracket stores game_id after dual ready");

  console.log("ALL HOSTED EVENT DUAL-READY E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
