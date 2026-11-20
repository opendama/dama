/**
 * E2E: hosted event report → open report blocks prize settle → dismiss → settle ok.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-report-check.mjs
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
  await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
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
  const stamp = Date.now();
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const adm = await e2eSession(`herp_adm_${stamp}`, `herp_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`herp_org_${stamp}`, `herp_org_${stamp}@ex.com`);
  await passCashGate(org.tok, String(stamp).slice(-8));

  const enums = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${adm.tok}` },
  });
  assert(enums.status === 200, "platform enums");
  const pendingPrize = enums.body.competition_prize_payout_pending || "pending";
  const readyStatus = (
    enums.body.hosted_event_bracket_ready ||
    enums.body.tournament_bracket_ready ||
    "ready"
  ).trim();

  const cat = await req("/events/catalog", { headers: { Authorization: `Bearer ${org.tok}` } });
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
  const reason = (cat.body?.report_reason_codes || [])[0];
  assert(!!reason, "catalog report reason");
  const hostFee = Number(size.host_fee_amount) || 0;
  const hostCur = String(size.host_fee_currency || "USD").trim() || "USD";
  const entryFee = 35;
  const currency = hostCur;
  if (hostFee > 0) creditWallet(org.uid, hostCur, Math.max(hostFee * 4, 400));

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `E2E Event Report ${stamp}`,
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
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 160)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, "event id + join_code");
  const eid = String(ev.id).replace(/'/g, "");

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    const p = await e2eSession(`herp_p${i}_${stamp}`, `herp_p${i}_${stamp}@ex.com`);
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
    assert(join.status === 200 || join.status === 201, `join ${join.status}`);
    const ci = await req(`/events/${ev.id}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(ci.status === 200 || ci.status === 201 || ci.status === 409, `check-in ${ci.status}`);
  }

  const report = await req(`/events/${ev.id}/report`, {
    method: "POST",
    headers: { Authorization: `Bearer ${players[0].tok}` },
    body: JSON.stringify({ reason_code: reason, note: "smoke" }),
  });
  assert(
    report.status === 201,
    `report ${report.status} ${JSON.stringify(report.body).slice(0, 200)}`,
  );
  const reportId = report.body?.id || report.body?.report?.id;
  assert(!!reportId, "report id");

  // Cup lobby deep link must use event UUID (not join code) for player.event_report_received.
  const reportHrefEntity = sql(`
    SELECT COALESCE(href_entity_id,'') FROM app_notifications
    WHERE kind_code='player.event_report_received'
      AND recipient_id='${String(players[0].uid).replace(/'/g, "")}'
    ORDER BY created_at DESC LIMIT 1
  `);
  assert(
    reportHrefEntity === eid,
    `event_report_received href_entity_id=${reportHrefEntity} want event uuid ${eid}`,
  );

  const joinedHrefEntity = sql(`
    SELECT COALESCE(href_entity_id,'') FROM app_notifications
    WHERE kind_code='player.event_joined'
      AND recipient_id='${String(players[0].uid).replace(/'/g, "")}'
    ORDER BY created_at DESC LIMIT 1
  `);
  assert(
    joinedHrefEntity === eid,
    `event_joined href_entity_id=${joinedHrefEntity} want event uuid ${eid}`,
  );

  const list = await req("/console/events/reports?status=open&skip=0&limit=20", {
    headers: { Authorization: `Bearer ${adm.tok}` },
  });
  assert(list.status === 200, `list reports ${list.status}`);
  assert(
    (list.body.reports || list.body.items || []).some((x) => x.id === reportId),
    "admin sees open event report",
  );

  const start = await req(`/events/${ev.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  async function loadBracket() {
    const br = await req(`/events/${ev.id}/bracket`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    return br.body?.bracket || [];
  }

  for (let pass = 0; pass < 16; pass++) {
    const finishedAtLoop = sql(
      `SELECT COALESCE(finished_at::text,'') FROM hosted_events WHERE id='${eid}'`,
    );
    if (finishedAtLoop.length > 0) break;
    const bracket = await loadBracket();
    const playable = bracket.find(
      (m) =>
        String(m.status || "").trim() === readyStatus &&
        m.player_a_id &&
        m.player_b_id &&
        !m.is_bye,
    );
    assert(!!playable, `ready match for forfeit pass ${pass}`);
    const forfeit = await req(`/events/${ev.id}/bracket/${playable.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({ user_id: playable.player_b_id }),
    });
    assert(forfeit.status === 200, `forfeit pass ${pass} ${forfeit.status}`);
  }

  const finishedAt = sql(
    `SELECT COALESCE(finished_at::text,'') FROM hosted_events WHERE id='${eid}'`,
  );
  assert(finishedAt.length > 0, "event finished_at set");

  let pendingBefore = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='${String(pendingPrize).replace(/'/g, "")}'`,
    ) || 0,
  );
  if (pendingBefore < 1) {
    const winnerUid = String(players[0].uid).replace(/'/g, "");
    sql(`
      INSERT INTO competition_prize_payouts (
        entity_kind, entity_id, user_id, placement, amount, currency, status, created_at, updated_at
      ) VALUES (
        'event', '${eid}', '${winnerUid}', 1, 25, '${currency.replace(/'/g, "")}', '${String(pendingPrize).replace(/'/g, "")}', NOW(), NOW()
      )
      ON CONFLICT (entity_kind, entity_id, user_id, placement) DO UPDATE
      SET amount = EXCLUDED.amount, status = EXCLUDED.status, updated_at = NOW();
    `);
    pendingBefore = Number(
      sql(
        `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='${String(pendingPrize).replace(/'/g, "")}'`,
      ) || 0,
    );
  }
  assert(pendingBefore > 0, `pending event payout n=${pendingBefore}`);

  sql(`
    UPDATE hosted_events
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${eid}';
  `);

  const blocked = await req("/console/competitions/settle-prizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${adm.tok}` },
    body: JSON.stringify({}),
  });
  assert(blocked.status === 200, `settle while open report ${blocked.status}`);
  const stillPending = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='${String(pendingPrize).replace(/'/g, "")}'`,
    ) || 0,
  );
  assert(stillPending > 0, "open event report keeps payout pending");

  const d = await req(`/console/events/reports/${reportId}/dismiss`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adm.tok}` },
    body: JSON.stringify({}),
  });
  assert(d.status === 200, `dismiss ${d.status} ${JSON.stringify(d.body).slice(0, 120)}`);

  const settled = await req("/console/competitions/settle-prizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${adm.tok}` },
    body: JSON.stringify({}),
  });
  assert(settled.status === 200, `settle after dismiss ${settled.status}`);
  const settledCount = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='event' AND entity_id='${eid}' AND status='settled'`,
    ) || 0,
  );
  assert(settledCount > 0, `event payout settled after dismiss n=${settledCount}`);

  console.log("ALL HOSTED EVENT REPORT SMOKE PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
