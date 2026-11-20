/**
 * E2E: hosted Arena forfeit awards arena points → winner gets player.competition_points_awarded.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-arena-points-toast-check.mjs
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
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${Number(amount)},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${Number(amount)}, updated_at = NOW();
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
    if (![429, 502, 503].includes(r.status) || attempt === 8) return { status: r.status, body };
    await sleep(1000 * attempt);
  }
  return { status: 503, body: {} };
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

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`heapt_adm_${stamp}`, `heapt_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`heapt_org_${stamp}`, `heapt_org_${stamp}@ex.com`);
  const p1 = await e2eSession(`heapt_p1_${stamp}`, `heapt_p1_${stamp}@ex.com`);
  const p2 = await e2eSession(`heapt_p2_${stamp}`, `heapt_p2_${stamp}@ex.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  const winPts = Number(enums.competition_arena_points_win || 0);
  assert(arenaId && winPts > 0, `arena + win pts from DB got=${winPts}`);

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, "catalog");
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    ids.add(arenaId);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.min_players_to_start) cat.min_players_to_start = {};
  cat.min_players_to_start[arenaId] = Math.max(2, Number(cat.min_players_to_start[arenaId]) || 2);
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  const size =
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(arenaId)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  const hostFee = Number(size.host_fee_amount || 0);
  creditWallet(org.uid, hostCur, Math.max(hostFee * 4, 400));

  let phone = 5720000;
  phone += 1;
  await passCashGate(org.tok, String(phone).slice(-8));

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Arena PtsToast ${stamp}`,
      format_id: arenaId,
      size_id: size.id,
      visibility: "private",
      is_free_entry: true,
      entry_fee_amount: 0,
      entry_fee_currency: hostCur,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: 5,
    }),
  });
  assert(
    create.status === 200 || create.status === 201,
    `create ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, "event id+code");
  const eid = ev.id;

  for (const p of [p1, p2]) {
    phone += 1;
    await passCashGate(p.tok, String(phone).slice(-8));
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(join.status === 200 || join.status === 201, `join ${join.status}`);
  }

  const start = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status}`);

  for (const p of [p1, p2]) {
    const q = await req(`/events/${eid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(q.status < 300, `queue ${q.status}`);
  }

  let match = null;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const br = await req(`/events/${eid}/bracket`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    const matches = br.body?.bracket || br.body?.matches || [];
    if (Array.isArray(matches) && matches.length > 0) {
      match = matches.find((m) => m.player_a_id && m.player_b_id) || matches[0];
      if (match) break;
    }
  }
  assert(match?.id, "arena pair match");

  const loser = match.player_b_id || p2.uid;
  const winner = match.player_a_id === loser ? match.player_b_id : match.player_a_id;
  assert(winner && loser, "winner/loser seats");

  const forfeit = await req(`/events/${eid}/bracket/${match.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({ user_id: loser }),
  });
  assert(forfeit.status === 200, `forfeit ${forfeit.status}`);

  const arenaPts = Number(
    sql(
      `SELECT COALESCE(arena_points::text,'0') FROM hosted_event_entries WHERE event_id='${eid}' AND user_id='${winner}'`,
    ) || 0,
  );
  assert(arenaPts >= winPts, `winner arena_points ${arenaPts} >= win pts ${winPts}`);

  let notifId = "";
  for (let i = 0; i < 20; i++) {
    notifId = sql(
      `SELECT id::text FROM app_notifications WHERE recipient_id='${winner}' AND kind_code='player.competition_points_awarded' ORDER BY created_at DESC LIMIT 1`,
    );
    if (notifId) break;
    await sleep(500);
  }
  assert(notifId, "winner has competition_points_awarded notif");

  const wTok = winner === p1.uid ? p1.tok : p2.tok;
  const listW = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${wTok}` },
  });
  assert(listW.status === 200, "notifications");
  const items = listW.body?.notifications || listW.body?.items || [];
  const hit = items.find((it) => it.kind_code === "player.competition_points_awarded");
  assert(hit && String(hit.body || "").trim(), "toast body non-empty");

  console.log("E2E_PASS: hosted arena points awarded notification");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
