/**
 * E2E: Arena Unlimited open enroll
 *   Community: null Unlimited + high ceiling (join, start, late join); classic reject; cap-3 full-stop
 *   Official: null + high (create, enroll, start, late enroll); classic reject; GraphQL seatCapUnlimited
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-arena-unlimited-enroll-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

import { execFileSync } from "node:child_process";

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
  return { status: 503, body: { error: "transient" } };
}

/** GraphQL with same 429/502/503 retry as REST req (raw fetch was flaking under rate limit). */
async function gqlReq(opts = {}) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(gqlBase, {
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
    assert(r.status < 300, `phone otp verify ${r.status}`);
  }
  r = await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  assert(r.status < 300, `locate ${r.status}`);
}

async function ensureOtp(tok) {
  const start = await req("/auth/otp/start", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}` },
    body: JSON.stringify({}),
  });
  if (start.status < 300 && start.body?.debug_code) {
    await req("/auth/otp/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        challenge_id: start.body.challenge_id,
        code: start.body.debug_code,
      }),
    });
  }
}

async function main() {
  const stamp = Date.now().toString(36);

  const nullable = sql(`
    SELECT CASE WHEN a.attnotnull THEN 'notnull' ELSE 'nullable' END
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'hosted_events' AND a.attname = 'max_players' AND NOT a.attisdropped
  `);
  assert(nullable === "nullable", `hosted_events.max_players ${nullable}`);

  const seed = sql(`
    SELECT COALESCE(s->>'max_players','NULL')
      || '|'
      || COALESCE((s->'allowed_format_ids')::text, '[]')
    FROM platform_settings, jsonb_array_elements(value->'sizes') s
    WHERE key = 'events_catalog' AND s->>'id' = 'size_unlimited'
  `);
  assert(seed.startsWith("NULL|"), `seed size_unlimited ${seed}`);

  for (const key of [
    "events_admin_chrome",
    "events_organizer_chrome",
    "events_player_chrome",
    "tournament_chrome",
    "tournaments_player_chrome",
  ]) {
    const label = sql(
      `SELECT value->>'unlimited_players_label' FROM platform_settings WHERE key='${key}'`,
    );
    assert(String(label || "").trim().length > 0, `chrome ${key}.unlimited_players_label`);
  }

  const org = await e2eSession(`unlim_org_${stamp}`, `unlim_org_${stamp}@example.com`);
  const admin = await e2eSession(
    `unlim_adm_${stamp}`,
    `unlim_adm_${stamp}@example.com`,
    "superadmin",
  );

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `platform enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  assert(arenaId, "hosted_event_arena_format from DB");
  assert(
    seed.includes(`"${arenaId}"`),
    `seed size_unlimited allows DB arena format ${arenaId} got ${seed}`,
  );

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, `catalog get ${catGet.status}`);
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) =>
    f.id === arenaId ? { ...f, enabled: true } : { ...f, enabled: true },
  );
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
    (cat.sizes || []).find((s) => s.id === "size_unlimited") ||
    (cat.sizes || []).find(
      (s) =>
        (s.max_players == null || s.max_players === undefined) &&
        (s.allowed_format_ids || []).includes(arenaId),
    );
  assert(size?.id, "catalog Unlimited Arena size");
  assert(
    size.max_players == null || size.max_players === undefined,
    `size uncapped got ${size.max_players}`,
  );

  const hostFee = Number(size.host_fee_amount || size.hostFeeAmount || 0);
  const hostCur = String(size.host_fee_currency || size.hostFeeCurrency || "ETB").trim() || "ETB";
  if (hostFee > 0) {
    creditWallet(org.uid, hostCur, Math.max(hostFee * 3, 500));
  }

  const duration = Number.parseInt(
    String(enums.competition_arena_default_duration_minutes || ""),
    10,
  );
  assert(
    Number.isFinite(duration) && duration > 0,
    "competition_arena_default_duration_minutes from DB",
  );
  const dur = Math.min(duration, 5);

  let phoneSeq = 5900000;
  phoneSeq += 1;
  await passCashGate(org.tok, String(phoneSeq).slice(-8));
  await ensureOtp(org.tok);

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Unlimited Arena ${stamp}`,
      format_id: arenaId,
      size_id: size.id,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    create.status === 200 || create.status === 201,
    `hosted create ${create.status} ${JSON.stringify(create.body).slice(0, 220)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id, "event id");
  assert(String(ev.format_id || "").trim() === arenaId, `format arena got ${ev.format_id}`);
  assert(
    !Object.prototype.hasOwnProperty.call(ev, "max_players") || ev.max_players == null,
    "hosted response omits/null max_players",
  );
  assert(ev.seat_cap_unlimited === true, "hosted null seat_cap_unlimited");

  // Community: classic format + Unlimited catalog size must reject (catalog + create defense).
  const classicHostFmt = String(
    (enums.tournament_formats || []).find(
      (f) => String(f).trim() && String(f).trim() !== arenaId,
    ) || "",
  ).trim();
  assert(classicHostFmt.length > 0, "classic host format id from DB (no invent)");
  const badHostedClassic = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Classic on Unlimited ${stamp}`,
      format_id: classicHostFmt,
      size_id: size.id,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    badHostedClassic.status === 400 &&
      String(badHostedClassic.body?.error_key || "").trim() === "format_unavailable",
    `classic+Unlimited size rejected ${badHostedClassic.status} ${JSON.stringify(badHostedClassic.body).slice(0, 200)}`,
  );

  const eid = ev.id;
  const code = String(ev.join_code || "").trim();
  assert(code, "join_code");

  const dbMax = sql(
    `SELECT COALESCE(max_players::text,'NULL') FROM hosted_events WHERE id='${eid}'`,
  );
  assert(dbMax === "NULL", `hosted row max_players ${dbMax}`);

  for (let i = 1; i <= 3; i++) {
    const p = await e2eSession(`unlim_p${i}_${stamp}`, `unlim_p${i}_${stamp}@example.com`);
    phoneSeq += 1;
    await passCashGate(p.tok, String(phoneSeq).slice(-8));
    await ensureOtp(p.tok);
    const j = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code, country_code: "ET" }),
    });
    assert(
      j.status === 200 || j.status === 201,
      `join ${i} ${j.status} ${JSON.stringify(j.body).slice(0, 160)}`,
    );
  }

  const after = await req(`/events/${eid}`, {
    headers: { Authorization: `Bearer ${org.tok}` },
  });
  assert(after.status === 200, `get event ${after.status}`);
  const got = after.body?.event || after.body;
  assert(
    !Object.prototype.hasOwnProperty.call(got, "max_players") || got.max_players == null,
    "get omits/null max_players",
  );
  assert(got.seat_cap_unlimited === true, "get seat_cap_unlimited");
  assert(Number(got.approved_count) >= 3, `approved_count ${got.approved_count}`);
  assert(String(got.status || "") !== "full", `status not full got ${got.status}`);
  assert(
    !Object.prototype.hasOwnProperty.call(got, "prize_pool_if_full"),
    "no prize_pool_if_full when uncapped",
  );

  // Null Unlimited: start (min_players only) + late join while live.
  const getArena = await req("/console/competition/arena-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(getArena.status === 200, `get arena-settings ${getArena.status}`);
  const arenaBefore = { ...getArena.body };
  const putArenaLive = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_arena_points_win: arenaBefore.competition_arena_points_win,
      competition_arena_points_draw: arenaBefore.competition_arena_points_draw,
      competition_arena_points_loss: arenaBefore.competition_arena_points_loss,
      competition_arena_streak_second_win: arenaBefore.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: arenaBefore.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes:
        arenaBefore.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: arenaBefore.competition_arena_default_pairing_mode,
      competition_arena_auto_start: arenaBefore.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: arenaBefore.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: "true",
    }),
  });
  assert(putArenaLive.status === 200, `enable join-while-live ${putArenaLive.status}`);
  const startUnlim = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    startUnlim.status === 200,
    `null Unlimited start ${startUnlim.status} ${JSON.stringify(startUnlim.body).slice(0, 200)}`,
  );
  const lateP = await e2eSession(`unlim_late_${stamp}`, `unlim_late_${stamp}@example.com`);
  phoneSeq += 1;
  await passCashGate(lateP.tok, String(phoneSeq).slice(-8));
  await ensureOtp(lateP.tok);
  const lateJoin = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${lateP.tok}` },
    body: JSON.stringify({ code, country_code: "ET" }),
  });
  assert(
    lateJoin.status === 200 || lateJoin.status === 201,
    `null Unlimited late join ${lateJoin.status} ${JSON.stringify(lateJoin.body).slice(0, 180)}`,
  );
  await req(`/events/${eid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });

  // Community high safety ceiling (Arena): create size + host + join
  const highSizeId = `e2e_unlim_high_${stamp}`;
  const highSize = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      id: highSizeId,
      label: "E2E High Ceiling Arena",
      enabled: true,
      max_players: 10000,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1003,
    }),
  });
  assert(
    highSize.status < 300 && highSize.body?.max_players === 10000,
    `high size create ${highSize.status}`,
  );
  const badHighClassic = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Classic on High ${stamp}`,
      format_id: classicHostFmt,
      size_id: highSizeId,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    badHighClassic.status === 400 &&
      String(badHighClassic.body?.error_key || "").trim() === "format_unavailable",
    `classic+high Unlimited size rejected ${badHighClassic.status} ${JSON.stringify(badHighClassic.body).slice(0, 200)}`,
  );
  creditWallet(org.uid, hostCur, Math.max(hostFee * 3, 500));
  phoneSeq += 1;
  await passCashGate(org.tok, String(phoneSeq).slice(-8));
  await ensureOtp(org.tok);
  const highCreate = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `High Ceiling Arena ${stamp}`,
      format_id: arenaId,
      size_id: highSizeId,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    highCreate.status === 200 || highCreate.status === 201,
    `high hosted create ${highCreate.status} ${JSON.stringify(highCreate.body).slice(0, 200)}`,
  );
  const highEv = highCreate.body?.event || highCreate.body;
  assert(highEv?.id, "high event id");
  assert(highEv.max_players === 10000, `high event max ${highEv.max_players}`);
  assert(highEv.seat_cap_unlimited === true, "high event seat_cap_unlimited");
  const highDb = sql(
    `SELECT COALESCE(max_players::text,'NULL') FROM hosted_events WHERE id='${highEv.id}'`,
  );
  assert(highDb === "10000", `high hosted row ${highDb}`);
  const highCode = String(highEv.join_code || "").trim();
  assert(highCode, "high join_code");
  for (let i = 1; i <= 3; i++) {
    const highP = await e2eSession(
      `unlim_hi_p${i}_${stamp}`,
      `unlim_hi_p${i}_${stamp}@example.com`,
    );
    phoneSeq += 1;
    await passCashGate(highP.tok, String(phoneSeq).slice(-8));
    await ensureOtp(highP.tok);
    const highJoin = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${highP.tok}` },
      body: JSON.stringify({ code: highCode, country_code: "ET" }),
    });
    assert(highJoin.status === 200 || highJoin.status === 201, `high join ${i} ${highJoin.status}`);
  }
  // High ceiling: start + late join while live (same open-enroll path as null Unlimited).
  const startHigh = await req(`/events/${highEv.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    startHigh.status === 200,
    `high Unlimited start ${startHigh.status} ${JSON.stringify(startHigh.body).slice(0, 200)}`,
  );
  const highLate = await e2eSession(`unlim_hi_late_${stamp}`, `unlim_hi_late_${stamp}@example.com`);
  phoneSeq += 1;
  await passCashGate(highLate.tok, String(phoneSeq).slice(-8));
  await ensureOtp(highLate.tok);
  const highLateJoin = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${highLate.tok}` },
    body: JSON.stringify({ code: highCode, country_code: "ET" }),
  });
  assert(
    highLateJoin.status === 200 || highLateJoin.status === 201,
    `high Unlimited late join ${highLateJoin.status} ${JSON.stringify(highLateJoin.body).slice(0, 180)}`,
  );
  await req(`/events/${highEv.id}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  const delHighSize = await req(`/console/events/catalog/sizes/${encodeURIComponent(highSizeId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(delHighSize.status < 300, `delete high size ${delHighSize.status}`);

  // Arena capped full-stop (same HasPlayerCap path as high safety ceilings): fill to 3, status full, reject 4th.
  const ceilSizeId = `e2e_ceil3_${stamp}`;
  const ceilSize = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      id: ceilSizeId,
      label: "E2E Cap 3 Arena",
      enabled: true,
      max_players: 3,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1004,
    }),
  });
  assert(
    ceilSize.status < 300 && ceilSize.body?.max_players === 3,
    `cap-3 size create ${ceilSize.status}`,
  );
  creditWallet(org.uid, hostCur, Math.max(hostFee * 3, 500));
  phoneSeq += 1;
  await passCashGate(org.tok, String(phoneSeq).slice(-8));
  await ensureOtp(org.tok);
  const ceilCreate = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Cap 3 Arena ${stamp}`,
      format_id: arenaId,
      size_id: ceilSizeId,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    ceilCreate.status === 200 || ceilCreate.status === 201,
    `cap-3 hosted create ${ceilCreate.status}`,
  );
  const ceilEv = ceilCreate.body?.event || ceilCreate.body;
  assert(ceilEv?.id && ceilEv.max_players === 3, `cap-3 event max ${ceilEv?.max_players}`);
  const ceilCode = String(ceilEv.join_code || "").trim();
  assert(ceilCode, "cap-3 join_code");
  for (let i = 1; i <= 3; i++) {
    const p = await e2eSession(`unlim_c3_p${i}_${stamp}`, `unlim_c3_p${i}_${stamp}@example.com`);
    phoneSeq += 1;
    await passCashGate(p.tok, String(phoneSeq).slice(-8));
    await ensureOtp(p.tok);
    const j = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ceilCode, country_code: "ET" }),
    });
    assert(j.status === 200 || j.status === 201, `cap-3 join ${i} ${j.status}`);
  }
  const ceilGot = await req(`/events/${ceilEv.id}`, {
    headers: { Authorization: `Bearer ${org.tok}` },
  });
  const ceilRow = ceilGot.body?.event || ceilGot.body;
  assert(String(ceilRow.status || "") === "full", `cap-3 status full got ${ceilRow.status}`);
  assert(Number(ceilRow.approved_count) === 3, `cap-3 approved ${ceilRow.approved_count}`);
  const ceilExtra = await e2eSession(`unlim_c3_x_${stamp}`, `unlim_c3_x_${stamp}@example.com`);
  phoneSeq += 1;
  await passCashGate(ceilExtra.tok, String(phoneSeq).slice(-8));
  await ensureOtp(ceilExtra.tok);
  const ceilReject = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${ceilExtra.tok}` },
    body: JSON.stringify({ code: ceilCode, country_code: "ET" }),
  });
  const ceilRejectKey = String(ceilReject.body?.error_key || "").trim();
  assert(
    ceilReject.status === 409 &&
      (ceilRejectKey === "event_full" || ceilRejectKey === "event_not_joinable"),
    `cap-3 4th join rejected ${ceilReject.status} ${JSON.stringify(ceilReject.body).slice(0, 160)}`,
  );
  const delCeilSize = await req(`/console/events/catalog/sizes/${encodeURIComponent(ceilSizeId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(delCeilSize.status < 300, `delete cap-3 size ${delCeilSize.status}`);

  // Official Arena capped: enroll to max then reject (tournaments have no full status).
  const offCeilGql = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateCap3($title: String!, $formatId: String, $maxPlayers: Int, $arenaDurationMinutes: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id formatId maxPlayers }
        }
      `,
      variables: {
        title: `Official Cap 3 ${stamp}`,
        formatId: arenaId,
        maxPlayers: 3,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const offCeilBody = offCeilGql.body;
  assert(
    offCeilGql.status === 200 && !offCeilBody?.errors,
    `official cap-3 gql ${JSON.stringify(offCeilBody?.errors || offCeilBody).slice(0, 200)}`,
  );
  const offCeil = offCeilBody?.data?.createTournament;
  assert(offCeil?.id && offCeil.maxPlayers === 3, `official cap-3 ${JSON.stringify(offCeil)}`);
  const enrollableCeil = String(enums.enrollable_tournament_status || "open").trim() || "open";
  const setCeilOpen = await req(`/console/tournaments/${offCeil.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ status: enrollableCeil }),
  });
  assert(setCeilOpen.status === 200, `official cap-3 set enrollable ${setCeilOpen.status}`);
  for (let i = 1; i <= 3; i++) {
    const p = await e2eSession(`unlim_oc3_p${i}_${stamp}`, `unlim_oc3_p${i}_${stamp}@example.com`);
    phoneSeq += 1;
    await passCashGate(p.tok, String(phoneSeq).slice(-8));
    await ensureOtp(p.tok);
    const en = await req(`/tournaments/${offCeil.id}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `official cap-3 enroll ${i} ${en.status}`);
  }
  const offExtra = await e2eSession(`unlim_oc3_x_${stamp}`, `unlim_oc3_x_${stamp}@example.com`);
  phoneSeq += 1;
  await passCashGate(offExtra.tok, String(phoneSeq).slice(-8));
  await ensureOtp(offExtra.tok);
  const offReject = await req(`/tournaments/${offCeil.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${offExtra.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    offReject.status >= 400,
    `official cap-3 4th enroll rejected ${offReject.status} ${JSON.stringify(offReject.body).slice(0, 160)}`,
  );

  // Official Arena: omit maxPlayers => null seat cap
  const gqlRes = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateUnlimitedArena($title: String!, $formatId: String, $arenaDurationMinutes: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id formatId maxPlayers seatCapUnlimited status }
        }
      `,
      variables: {
        title: `Official Unlimited Arena ${stamp}`,
        formatId: arenaId,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const gqlBody = gqlRes.body;
  assert(
    gqlRes.status === 200 && !gqlBody?.errors,
    `graphql ${JSON.stringify(gqlBody?.errors || gqlBody).slice(0, 240)}`,
  );
  const cup = gqlBody?.data?.createTournament;
  assert(cup?.id, "official cup id");
  assert(cup.formatId === arenaId, `official format ${cup.formatId}`);
  assert(cup.maxPlayers == null, `official maxPlayers null got ${cup.maxPlayers}`);

  const offMax = sql(
    `SELECT COALESCE(max_players::text,'NULL') FROM tournaments WHERE id='${cup.id}'`,
  );
  assert(offMax === "NULL", `official row max_players ${offMax}`);

  // Official Unlimited: multi-enroll must not hit a seat full-stop
  const enrollable = String(enums.enrollable_tournament_status || "").trim();
  assert(enrollable.length > 0, "enrollable_tournament_status from DB");
  const setEnroll = await req(`/console/tournaments/${cup.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(setEnroll.status === 200, `set enrollable ${setEnroll.status}`);
  for (let i = 1; i <= 3; i++) {
    const p = await e2eSession(`unlim_off_p${i}_${stamp}`, `unlim_off_p${i}_${stamp}@example.com`);
    phoneSeq += 1;
    await passCashGate(p.tok, String(phoneSeq).slice(-8));
    await ensureOtp(p.tok);
    const en = await req(`/tournaments/${cup.id}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(
      en.status === 200 || en.status === 201,
      `official enroll ${i} ${en.status} ${JSON.stringify(en.body).slice(0, 160)}`,
    );
  }
  const offGet = await req(`/tournaments/${cup.id}`, {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(offGet.status === 200, `official get ${offGet.status}`);
  const offRow = offGet.body?.tournament || offGet.body;
  assert(
    !Object.prototype.hasOwnProperty.call(offRow, "max_players") || offRow.max_players == null,
    "official get omits/null max_players",
  );
  assert(offRow.seat_cap_unlimited === true, "official seat_cap_unlimited");
  assert(
    !Object.prototype.hasOwnProperty.call(offRow, "prize_pool_if_full"),
    "official no prize_pool_if_full when uncapped",
  );

  // Classic formats must not accept Unlimited (null max)
  const classicId = String(
    (enums.tournament_formats || []).find(
      (f) => String(f).trim() && String(f).trim() !== arenaId,
    ) || "",
  ).trim();
  assert(classicId.length > 0, "classic format id from DB (no invent)");
  const badClassic = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateClassicNoMax($title: String!, $formatId: String) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
          ) { id maxPlayers }
        }
      `,
      variables: {
        title: `Classic No Max ${stamp}`,
        formatId: classicId,
      },
    }),
  });
  const badBody = badClassic.body;
  assert(
    badClassic.status === 200 &&
      Array.isArray(badBody?.errors) &&
      badBody.errors.length > 0 &&
      !badBody?.data?.createTournament?.id,
    `classic null max rejected ${JSON.stringify(badBody).slice(0, 240)}`,
  );

  // Arena: present maxPlayers < 2 must reject (never coerce to Unlimited).
  const badArenaLt2 = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateArenaLt2(
          $title: String!
          $formatId: String
          $maxPlayers: Int
          $arenaDurationMinutes: Int
        ) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id maxPlayers }
        }
      `,
      variables: {
        title: `Arena Lt2 ${stamp}`,
        formatId: arenaId,
        maxPlayers: 1,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const badArenaLt2Body = badArenaLt2.body;
  assert(
    badArenaLt2.status === 200 &&
      Array.isArray(badArenaLt2Body?.errors) &&
      badArenaLt2Body.errors.length > 0 &&
      !badArenaLt2Body?.data?.createTournament?.id,
    `arena maxPlayers 1 rejected ${JSON.stringify(badArenaLt2Body).slice(0, 240)}`,
  );

  const badArenaLt0 = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateArenaLt0(
          $title: String!
          $formatId: String
          $maxPlayers: Int
          $arenaDurationMinutes: Int
        ) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id maxPlayers }
        }
      `,
      variables: {
        title: `Arena Lt0 ${stamp}`,
        formatId: arenaId,
        maxPlayers: 0,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const badArenaLt0Body = badArenaLt0.body;
  assert(
    badArenaLt0.status === 200 &&
      Array.isArray(badArenaLt0Body?.errors) &&
      badArenaLt0Body.errors.length > 0 &&
      !badArenaLt0Body?.data?.createTournament?.id,
    `arena maxPlayers 0 rejected ${JSON.stringify(badArenaLt0Body).slice(0, 240)}`,
  );

  // Classic formats must not accept huge safety ceilings
  const badClassicHigh = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateClassicHigh($title: String!, $formatId: String, $maxPlayers: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
          ) { id maxPlayers }
        }
      `,
      variables: {
        title: `Classic High ${stamp}`,
        formatId: classicId,
        maxPlayers: 10000,
      },
    }),
  });
  const badHighBody = badClassicHigh.body;
  assert(
    badClassicHigh.status === 200 &&
      Array.isArray(badHighBody?.errors) &&
      badHighBody.errors.length > 0 &&
      !badHighBody?.data?.createTournament?.id,
    `classic high max rejected ${JSON.stringify(badHighBody).slice(0, 240)}`,
  );

  // DB classic seat ceiling + 1 is the smallest high Unlimited (not hardcoded 10000).
  let classicCeiling = 0;
  for (const k of Object.keys(catGet.body?.swiss_rounds_by_max_players || {})) {
    const n = Number.parseInt(String(k).trim(), 10);
    if (Number.isFinite(n) && n >= 2 && n > classicCeiling) classicCeiling = n;
  }
  assert(classicCeiling >= 2, `classic seat ceiling from DB swiss map ${classicCeiling}`);
  const justAbove = classicCeiling + 1;
  const boundaryArena = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateBoundaryArena($title: String!, $formatId: String, $maxPlayers: Int, $arenaDurationMinutes: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id maxPlayers seatCapUnlimited }
        }
      `,
      variables: {
        title: `Official Boundary Arena ${stamp}`,
        formatId: arenaId,
        maxPlayers: justAbove,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const boundaryArenaBody = boundaryArena.body;
  assert(
    boundaryArena.status === 200 && !boundaryArenaBody?.errors,
    `official ceiling+1 Arena ${JSON.stringify(boundaryArenaBody?.errors || boundaryArenaBody).slice(0, 200)}`,
  );
  const boundaryCup = boundaryArenaBody?.data?.createTournament;
  assert(
    boundaryCup?.id &&
      boundaryCup.maxPlayers === justAbove &&
      boundaryCup.seatCapUnlimited === true,
    `official ceiling+1 seatCapUnlimited max=${boundaryCup?.maxPlayers}`,
  );
  const boundaryClassic = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateBoundaryClassic($title: String!, $formatId: String, $maxPlayers: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
          ) { id maxPlayers }
        }
      `,
      variables: {
        title: `Classic Boundary ${stamp}`,
        formatId: classicId,
        maxPlayers: justAbove,
      },
    }),
  });
  const boundaryClassicBody = boundaryClassic.body;
  assert(
    boundaryClassic.status === 200 &&
      Array.isArray(boundaryClassicBody?.errors) &&
      boundaryClassicBody.errors.length > 0 &&
      !boundaryClassicBody?.data?.createTournament?.id,
    `classic ceiling+1 rejected ${JSON.stringify(boundaryClassicBody).slice(0, 240)}`,
  );
  const boundaryAtCeil = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateAtCeilingArena($title: String!, $formatId: String, $maxPlayers: Int, $arenaDurationMinutes: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id maxPlayers seatCapUnlimited }
        }
      `,
      variables: {
        title: `Official At Ceiling Arena ${stamp}`,
        formatId: arenaId,
        maxPlayers: classicCeiling,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const atCeilBody = boundaryAtCeil.body;
  assert(
    boundaryAtCeil.status === 200 && !atCeilBody?.errors,
    `official at-ceiling Arena ${JSON.stringify(atCeilBody?.errors || atCeilBody).slice(0, 200)}`,
  );
  const atCeilCup = atCeilBody?.data?.createTournament;
  assert(
    atCeilCup?.id && atCeilCup.maxPlayers === classicCeiling && atCeilCup.seatCapUnlimited !== true,
    `official at-ceiling is classic fixed not Unlimited (max=${atCeilCup?.maxPlayers} unlim=${atCeilCup?.seatCapUnlimited})`,
  );

  // Official REST Update: classic cannot clear max to Unlimited
  const classicOk = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateClassicCapped($title: String!, $formatId: String, $maxPlayers: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
          ) { id formatId maxPlayers }
        }
      `,
      variables: {
        title: `Classic Capped ${stamp}`,
        formatId: classicId,
        maxPlayers: 8,
      },
    }),
  });
  const classicOkBody = classicOk.body;
  const classicCup = classicOkBody?.data?.createTournament;
  assert(classicCup?.id && classicCup.maxPlayers === 8, "classic capped create");

  const badPut = await req(`/console/tournaments/${classicCup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Classic Capped ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: classicId,
      max_players: null,
    }),
  });
  assert(
    badPut.status === 400 &&
      String(badPut.body?.error_key || "").trim() === "err_unlimited_arena_only",
    `REST classic null max rejected ${badPut.status} ${JSON.stringify(badPut.body).slice(0, 200)}`,
  );

  const badPutHigh = await req(`/console/tournaments/${classicCup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Classic Capped ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: classicId,
      max_players: 10000,
    }),
  });
  assert(
    badPutHigh.status === 400 &&
      String(badPutHigh.body?.error_key || "").trim() === "err_unlimited_arena_only",
    `REST classic high max rejected ${badPutHigh.status} ${JSON.stringify(badPutHigh.body).slice(0, 200)}`,
  );

  // REST Arena PUT: present max_players under 2 must reject (never coerce to Unlimited).
  const badArenaPutLt2 = await req(`/console/tournaments/${cup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Official Unlimited ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: arenaId,
      max_players: 1,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    badArenaPutLt2.status === 400 &&
      String(badArenaPutLt2.body?.error_key || "").trim() === "err_max_players_required",
    `REST Arena max_players 1 rejected ${badArenaPutLt2.status} ${JSON.stringify(badArenaPutLt2.body).slice(0, 200)}`,
  );

  const badArenaPutLt0 = await req(`/console/tournaments/${cup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Official Unlimited ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: arenaId,
      max_players: 0,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    badArenaPutLt0.status === 400 &&
      String(badArenaPutLt0.body?.error_key || "").trim() === "err_max_players_required",
    `REST Arena max_players 0 rejected ${badArenaPutLt0.status} ${JSON.stringify(badArenaPutLt0.body).slice(0, 200)}`,
  );

  const badArenaPutNeg = await req(`/console/tournaments/${cup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Official Unlimited ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: arenaId,
      max_players: -1,
      arena_duration_minutes: dur,
    }),
  });
  assert(
    badArenaPutNeg.status === 400 &&
      String(badArenaPutNeg.body?.error_key || "").trim() === "err_max_players_required",
    `REST Arena max_players -1 rejected ${badArenaPutNeg.status} ${JSON.stringify(badArenaPutNeg.body).slice(0, 200)}`,
  );

  // Official Arena high safety ceiling via GraphQL create
  const highGql = await gqlReq({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${admin.tok}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateHighArena($title: String!, $formatId: String, $maxPlayers: Int, $arenaDurationMinutes: Int) {
          createTournament(
            title: $title
            isFree: true
            entryFeeAmount: 0
            entryFeeCurrency: "USD"
            formatId: $formatId
            maxPlayers: $maxPlayers
            arenaDurationMinutes: $arenaDurationMinutes
          ) { id formatId maxPlayers seatCapUnlimited }
        }
      `,
      variables: {
        title: `Official High Arena ${stamp}`,
        formatId: arenaId,
        maxPlayers: 10000,
        arenaDurationMinutes: dur,
      },
    }),
  });
  const highGqlBody = highGql.body;
  assert(
    highGql.status === 200 && !highGqlBody?.errors,
    `official high gql ${JSON.stringify(highGqlBody?.errors || highGqlBody).slice(0, 200)}`,
  );
  const highCup = highGqlBody?.data?.createTournament;
  assert(highCup?.id && highCup.maxPlayers === 10000, `official high max ${highCup?.maxPlayers}`);
  assert(highCup.seatCapUnlimited === true, "official high gql seatCapUnlimited");
  const highOffDb = sql(
    `SELECT COALESCE(max_players::text,'NULL') FROM tournaments WHERE id='${highCup.id}'`,
  );
  assert(highOffDb === "10000", `official high row ${highOffDb}`);

  // Official high ceiling: enroll + start + late enroll while live
  const setHighEnroll = await req(`/console/tournaments/${highCup.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(setHighEnroll.status === 200, `official high set enrollable ${setHighEnroll.status}`);
  for (let i = 1; i <= 3; i++) {
    const p = await e2eSession(`unlim_ohi_p${i}_${stamp}`, `unlim_ohi_p${i}_${stamp}@example.com`);
    phoneSeq += 1;
    await passCashGate(p.tok, String(phoneSeq).slice(-8));
    await ensureOtp(p.tok);
    const en = await req(`/tournaments/${highCup.id}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `official high enroll ${i} ${en.status}`);
  }
  const startHighOff = await req(`/console/tournaments/${highCup.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    startHighOff.status < 300,
    `official high Unlimited start ${startHighOff.status} ${JSON.stringify(startHighOff.body).slice(0, 200)}`,
  );
  const highOffLate = await e2eSession(
    `unlim_ohi_late_${stamp}`,
    `unlim_ohi_late_${stamp}@example.com`,
  );
  phoneSeq += 1;
  await passCashGate(highOffLate.tok, String(phoneSeq).slice(-8));
  await ensureOtp(highOffLate.tok);
  const highOffLateEn = await req(`/tournaments/${highCup.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${highOffLate.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    highOffLateEn.status === 200 || highOffLateEn.status === 201,
    `official high Unlimited late enroll ${highOffLateEn.status} ${JSON.stringify(highOffLateEn.body).slice(0, 180)}`,
  );
  await req(`/console/tournaments/${highCup.id}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });

  // Official Arena high safety ceiling via REST update (null -> ceiling)
  const highPut = await req(`/console/tournaments/${cup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Official Unlimited Arena ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: arenaId,
      max_players: 10000,
      arena_duration_minutes: dur,
    }),
  });
  assert(highPut.status === 200, `Arena high max update ${highPut.status}`);
  assert(highPut.body?.max_players === 10000, `Arena high max got ${highPut.body?.max_players}`);
  assert(highPut.body?.seat_cap_unlimited === true, "Arena high max seat_cap_unlimited");

  // Official Arena: restore true Unlimited (null) after high ceiling
  const restoreNull = await req(`/console/tournaments/${cup.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      title: `Official Unlimited Arena ${stamp}`,
      description: "",
      is_free: true,
      entry_fee_amount: 0,
      entry_fee_currency: "USD",
      format_id: arenaId,
      max_players: null,
      arena_duration_minutes: dur,
    }),
  });
  assert(restoreNull.status === 200, `Arena restore null ${restoreNull.status}`);
  assert(
    !Object.prototype.hasOwnProperty.call(restoreNull.body, "max_players") ||
      restoreNull.body.max_players == null,
    `Arena restore null max got ${restoreNull.body?.max_players}`,
  );
  assert(restoreNull.body?.seat_cap_unlimited === true, "Arena restore null seat_cap_unlimited");
  const restoredDb = sql(
    `SELECT COALESCE(max_players::text,'NULL') FROM tournaments WHERE id='${cup.id}'`,
  );
  assert(restoredDb === "NULL", `Arena restored row ${restoredDb}`);

  // Official null Unlimited: start + late enroll while live (cup already has 3 seats).
  const startOff = await req(`/console/tournaments/${cup.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    startOff.status < 300,
    `official null Unlimited start ${startOff.status} ${JSON.stringify(startOff.body).slice(0, 200)}`,
  );
  const lateOff = await e2eSession(
    `unlim_off_late_${stamp}`,
    `unlim_off_late_${stamp}@example.com`,
  );
  phoneSeq += 1;
  await passCashGate(lateOff.tok, String(phoneSeq).slice(-8));
  await ensureOtp(lateOff.tok);
  const lateOffEn = await req(`/tournaments/${cup.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lateOff.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    lateOffEn.status === 200 || lateOffEn.status === 201,
    `official null Unlimited late enroll ${lateOffEn.status} ${JSON.stringify(lateOffEn.body).slice(0, 180)}`,
  );
  await req(`/console/tournaments/${cup.id}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });

  // Restore arena join-while-live flag (do not leave local DB dirty).
  const restoreArena = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_arena_points_win: arenaBefore.competition_arena_points_win,
      competition_arena_points_draw: arenaBefore.competition_arena_points_draw,
      competition_arena_points_loss: arenaBefore.competition_arena_points_loss,
      competition_arena_streak_second_win: arenaBefore.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: arenaBefore.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes:
        arenaBefore.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: arenaBefore.competition_arena_default_pairing_mode,
      competition_arena_auto_start: arenaBefore.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: arenaBefore.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: arenaBefore.competition_arena_allow_join_while_live,
    }),
  });
  assert(restoreArena.status === 200, `restore arena-settings ${restoreArena.status}`);

  console.log("E2E_PASS arena-unlimited-enroll");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
