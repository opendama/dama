/**
 * E2E: hosted-event Arena - create → join → start → queue → pair → standings → organizer finish.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-arena-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
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
  const org = await e2eSession(`hev_arena_org_${stamp}`, `hev_arena_org_${stamp}@example.com`);
  const p1 = await e2eSession(`hev_arena_p1_${stamp}`, `hev_arena_p1_${stamp}@example.com`);
  const p2 = await e2eSession(`hev_arena_p2_${stamp}`, `hev_arena_p2_${stamp}@example.com`);
  const admin = await e2eSession(
    `hev_arena_adm_${stamp}`,
    `hev_arena_adm_${stamp}@example.com`,
    "admin",
  );

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `platform enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  assert(arenaId, "hosted_event_arena_format from DB");

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
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(arenaId)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "catalog size for arena");
  const hostFee = Number(size.host_fee_amount || size.hostFeeAmount || 0);
  const hostCur = String(size.host_fee_currency || size.hostFeeCurrency || "ETB").trim() || "ETB";
  if (hostFee > 0) {
    creditWallet(org.uid, hostCur, Math.max(hostFee * 3, 200));
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

  let phoneSeq = 5800000;
  phoneSeq += 1;
  await passCashGate(org.tok, String(phoneSeq).slice(-8));
  await ensureOtp(org.tok);

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Arena E2E ${stamp}`,
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
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 220)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id, "event id");
  assert(String(ev.format_id || "").trim() === arenaId, `format arena got ${ev.format_id}`);
  const eid = ev.id;
  const code = String(ev.join_code || "").trim();
  assert(code, "join_code");

  for (const p of [p1, p2]) {
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
      `join ${j.status} ${JSON.stringify(j.body).slice(0, 160)}`,
    );
  }

  await ensureOtp(org.tok);
  const start = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status} ${JSON.stringify(start.body).slice(0, 220)}`);
  const started = start.body?.event || start.body;
  assert(started?.arena_ends_at, "arena_ends_at on start");

  for (const p of [p1, p2]) {
    const q = await req(`/events/${eid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(q.status === 200, `queue ${q.status}`);
  }

  let paired = false;
  for (let i = 0; i < 30; i++) {
    const br = await req(`/events/${eid}/bracket`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    const matches = br.body?.bracket || br.body?.matches || [];
    if (matches.some((m) => m.player_a_id && m.player_b_id && !m.is_bye)) {
      paired = true;
      break;
    }
    await sleep(500);
  }
  assert(paired, "arena worker paired a match");

  const st = await req(`/events/${eid}/arena/standings`, {
    headers: { Authorization: `Bearer ${p1.tok}` },
  });
  assert(st.status === 200, `standings ${st.status}`);
  assert(Array.isArray(st.body?.standings), "standings rows array");

  const leave = await req(`/events/${eid}/arena/queue/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p1.tok}` },
    body: JSON.stringify({}),
  });
  assert(leave.status === 200, `leave queue ${leave.status}`);

  await ensureOtp(org.tok);
  const finish = await req(`/events/${eid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    finish.status === 200,
    `organizer finish ${finish.status} ${JSON.stringify(finish.body).slice(0, 200)}`,
  );
  const finished = finish.body?.event || finish.body;
  assert(finished?.finished_at, "finished_at after organizer finish");

  console.log("E2E_PASS: hosted event arena");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
