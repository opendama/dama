/**
 * E2E: paid hosted event KO finish → prize escrow → settle (console + optional auto worker).
 *
 * Env:
 *   DAMA_API_BASE              - default http://127.0.0.1:18080/api/v1
 *   DAMA_E2E_WAIT_AUTO_SETTLE  - if "1", poll after backdating dispute window (no console settle)
 *
 *   node scripts/e2e-hosted-event-play-settle-check.mjs
 */
import { execFileSync } from "node:child_process";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";
const waitAuto = process.env.DAMA_E2E_WAIT_AUTO_SETTLE === "1";

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
  const stamp = Date.now();
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const org = await e2eSession(`heps_org_${stamp}`, `heps_org_${stamp}@ex.com`);
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
  const minPlayers = Math.max(4, Number(cat.body?.min_players_to_start?.[format.id]) || 4);
  const readyStatus = (cat.body?.hosted_event_bracket_ready || "ready").trim();
  const hostFee = Number(size.host_fee_amount) || 0;
  const hostCur = String(size.host_fee_currency || "USD").trim() || "USD";
  const entryFee = 40;
  const currency = hostCur;
  if (hostFee > 0) creditWallet(org.uid, hostCur, Math.max(hostFee * 4, 400));

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Event Settle ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      prize_pool_display_enabled: true,
      country_code: "ET",
    }),
  });
  assert(
    create.status === 201 || create.status === 200,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, "event id + join_code");
  assert(ev.prize_pool_display_enabled === true, "prize pool display on");

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    const p = await e2eSession(`heps_p${i}_${stamp}`, `heps_p${i}_${stamp}@ex.com`);
    await passCashGate(p.tok, `${String(stamp).slice(-6)}${i}${i}`);
    creditWallet(p.uid, currency, entryFee * 4);
    players.push(p);
  }

  for (const p of players) {
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(
      join.status === 200 || join.status === 201,
      `join ${join.status} ${JSON.stringify(join.body).slice(0, 160)}`,
    );
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

  async function loadBracket() {
    const br = await req(`/events/${ev.id}/bracket`, {
      headers: { Authorization: `Bearer ${otok}` },
    });
    return br.body?.bracket || [];
  }

  let bracket = start.body?.bracket || [];
  if (!bracket.length) bracket = await loadBracket();
  assert(bracket.length > 0, "bracket nonempty");

  for (let round = 0; round < 16; round++) {
    const finishedAtLoop = sql(
      `SELECT COALESCE(finished_at::text,'') FROM hosted_events WHERE id='${ev.id.replace(/'/g, "")}'`,
    );
    if (finishedAtLoop.length > 0) break;
    bracket = await loadBracket();
    const playable = bracket.find(
      (m) =>
        !m.is_bye &&
        m.player_a_id &&
        m.player_b_id &&
        String(m.status || "").trim() === readyStatus,
    );
    if (!playable) {
      assert(false, `no ready match to forfeit at pass ${round}`);
    }
    const loser = playable.player_b_id;
    const forfeit = await req(`/events/${ev.id}/bracket/${playable.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${otok}` },
      body: JSON.stringify({ user_id: loser }),
    });
    assert(
      forfeit.status === 200,
      `forfeit pass ${round} ${forfeit.status} ${JSON.stringify(forfeit.body).slice(0, 160)}`,
    );
  }

  const eid = ev.id.replace(/'/g, "");
  const finishedAt = sql(
    `SELECT COALESCE(finished_at::text,'') FROM hosted_events WHERE id='${eid}'`,
  );
  assert(finishedAt.length > 0, "event finished_at set");

  const pendingCount = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='pending'`,
    ) || 0,
  );
  assert(pendingCount > 0, `pending event prize payouts n=${pendingCount}`);

  sql(`
    UPDATE hosted_events
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${eid}';
  `);

  const winnerId = sql(
    `SELECT user_id::text FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND placement=1 LIMIT 1`,
  );
  assert(winnerId.length > 0, "placement-1 payout user");
  const balWinnerBefore = walletBal(winnerId, currency);

  if (waitAuto) {
    sql(`
      UPDATE platform_settings
      SET value = value || '{"competition_prize_settle_interval_minutes":"1","competition_prize_auto_settle":"true"}'::jsonb,
          updated_at = NOW()
      WHERE key = 'client_enums';
    `);
    const deadline = Date.now() + 130_000;
    let settled = false;
    while (Date.now() < deadline) {
      await sleep(5000);
      const n = Number(
        sql(
          `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='settled'`,
        ) || 0,
      );
      if (n > 0) {
        settled = true;
        break;
      }
    }
    assert(settled, "auto worker settled at least one hosted payout within ~2m");
  } else {
    const settle = await req("/console/competitions/settle-prizes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(await e2eSession(`heps_adm_${stamp}`, `heps_adm_${stamp}@ex.com`, "admin")).tok}`,
      },
      body: JSON.stringify({}),
    });
    assert(settle.status === 200, `console settle ${settle.status}`);
    // Auto-settle worker may race the console click; accept either path.
    const settledFromBody = Number(settle.body?.settled) || 0;
    const settledFromDb = Number(
      sql(
        `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='settled'`,
      ) || 0,
    );
    assert(
      settledFromBody > 0 || settledFromDb > 0,
      `settled count body=${settledFromBody} db=${settledFromDb}`,
    );
  }

  const balWinnerAfter = walletBal(winnerId, currency);
  assert(
    balWinnerAfter > balWinnerBefore,
    `winner ${winnerId.slice(0, 8)} wallet grew ${balWinnerBefore} -> ${balWinnerAfter}`,
  );

  console.log("ALL HOSTED EVENT PLAY SETTLE E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
