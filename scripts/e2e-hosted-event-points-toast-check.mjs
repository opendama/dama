/**
 * E2E: hosted KO + RR + Swiss + Groups (group phase) forfeit → winner gets
 * player.competition_points_awarded (toast source for web Sonner / Flutter SnackBar).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-points-toast-check.mjs
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
  return { status: 429, body: {} };
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

let phoneSeq = 5920000;

async function runHostedFormatToast({
  label,
  formatId,
  stamp,
  orgTok,
  orgUid,
  size,
  hostCur,
  hostFee,
  readyStatus,
  minPlayers,
  phaseFilter,
}) {
  phoneSeq += 1;
  await passCashGate(orgTok, String(phoneSeq).slice(-8));
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${orgUid}','${hostCur}',${Math.max(hostFee * 4, 400)},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${Math.max(hostFee * 4, 400)}, updated_at = NOW();
  `);

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    players.push(
      await e2eSession(`hept_${label}_p${i}_${stamp}`, `hept_${label}_p${i}_${stamp}@ex.com`),
    );
  }

  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${orgTok}` },
    body: JSON.stringify({
      title: `Hosted ${label} PtsToast ${stamp}`,
      format_id: formatId,
      size_id: size.id,
      visibility: "private",
      is_free_entry: true,
      entry_fee_amount: 0,
      entry_fee_currency: hostCur,
      country_code: "ET",
      auto_approve: true,
    }),
  });
  assert(
    create.status === 200 || create.status === 201,
    `${label} create ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, `${label} event id+code`);
  const eid = ev.id;

  for (const p of players) {
    phoneSeq += 1;
    await passCashGate(p.tok, String(phoneSeq).slice(-8));
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(join.status === 200 || join.status === 201, `${label} join ${join.status}`);
    await req(`/events/${eid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }

  const start = await req(`/events/${eid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${orgTok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `${label} start ${start.status}`);
  let bracket = start.body?.bracket || [];
  if (!bracket.length) {
    const br = await req(`/events/${eid}/bracket`, {
      headers: { Authorization: `Bearer ${orgTok}` },
    });
    bracket = br.body?.bracket || [];
  }
  const match = bracket.find((m) => {
    if (m.is_bye || !m.player_a_id || !m.player_b_id) return false;
    if (String(m.status || "").trim() !== readyStatus) return false;
    if (phaseFilter && String(m.phase || "").trim() !== phaseFilter) return false;
    return true;
  });
  assert(match?.id, `${label} ready match${phaseFilter ? ` phase=${phaseFilter}` : ""}`);

  const winnerId = match.player_a_id;
  const loserId = match.player_b_id;
  const winner = players.find((p) => p.uid === winnerId);
  assert(winner, `${label} winner session`);

  const beforeIds = new Set(
    sql(`
      SELECT COALESCE(string_agg(n.id::text, ','), '')
      FROM app_notifications n
      WHERE n.recipient_id = '${winnerId}'
        AND n.kind_code = 'player.competition_points_awarded'
    `)
      .split(",")
      .filter(Boolean),
  );

  const ff = await req(`/events/${eid}/bracket/${match.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${orgTok}` },
    body: JSON.stringify({ user_id: loserId }),
  });
  assert(ff.status === 200, `${label} forfeit ${ff.status}`);

  let found = "";
  for (let i = 0; i < 20; i++) {
    found = sql(`
      SELECT n.id::text
      FROM app_notifications n
      WHERE n.recipient_id = '${winnerId}'
        AND n.kind_code = 'player.competition_points_awarded'
      ORDER BY n.created_at DESC
      LIMIT 1
    `);
    if (found && !beforeIds.has(found)) break;
    found = "";
    await sleep(250);
  }
  assert(found, `${label} winner has competition_points_awarded notif`);

  const list = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${winner.tok}` },
  });
  assert(list.status === 200, `${label} notifications ${list.status}`);
  const items = list.body?.notifications || list.body?.items || [];
  const row = items.find(
    (n) =>
      String(n.kind_code || "").trim() === "player.competition_points_awarded" ||
      String(n.id || "").trim() === found,
  );
  assert(row && String(row.body || "").trim(), `${label} toast body non-empty`);
}

async function main() {
  const stamp = Date.now().toString(36);
  const label = sql(`
    SELECT COALESCE(value->>'standings_points_label','') FROM platform_settings WHERE key='tournaments_player_chrome'
  `).trim();
  assert(label.length > 0, "standings_points_label from DB (emit fail-closed)");

  const admin = await e2eSession(`hept_adm_${stamp}`, `hept_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`hept_org_${stamp}`, `hept_org_${stamp}@ex.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const ko = String(enums.hosted_event_knockout_format || "").trim();
  const rr = String(enums.hosted_event_round_robin_format || "").trim();
  const swiss = String(enums.hosted_event_swiss_format || "").trim();
  const groups = String(enums.hosted_event_groups_knockout_format || "").trim();
  const groupPhase = String(enums.hosted_event_phase_group || "").trim();
  const readyStatus = String(enums.hosted_event_bracket_ready || "").trim();
  assert(
    ko && rr && swiss && groups && groupPhase && readyStatus,
    "ko+rr+swiss+groups+phase+ready from DB",
  );

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, "catalog get");
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    ids.add(ko);
    ids.add(rr);
    ids.add(swiss);
    ids.add(groups);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.min_players_to_start) cat.min_players_to_start = {};
  cat.min_players_to_start[ko] = Math.max(4, Number(cat.min_players_to_start[ko]) || 4);
  cat.min_players_to_start[rr] = Math.max(4, Number(cat.min_players_to_start[rr]) || 4);
  cat.min_players_to_start[swiss] = Math.max(6, Number(cat.min_players_to_start[swiss]) || 6);
  cat.min_players_to_start[groups] = Math.max(8, Number(cat.min_players_to_start[groups]) || 8);
  if (!cat.swiss_rounds_by_max_players || !Object.keys(cat.swiss_rounds_by_max_players).length) {
    cat.swiss_rounds_by_max_players = { 8: 2, 16: 3, 32: 4, 64: 5 };
  }
  if (!(cat.groups_knockout_target_group_size > 0)) cat.groups_knockout_target_group_size = 4;
  if (!(cat.groups_knockout_advance_per_group > 0)) cat.groups_knockout_advance_per_group = 2;
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  const sizeFor = (fid) =>
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(fid)) ||
    (cat.sizes || [])[0];
  const sizeRR = sizeFor(rr);
  assert(sizeRR?.id, "size");
  const hostFee = Number(sizeRR.host_fee_amount || 0);
  const hostCur = String(sizeRR.host_fee_currency || "ETB").trim() || "ETB";

  await runHostedFormatToast({
    label: "ko",
    formatId: ko,
    stamp,
    orgTok: org.tok,
    orgUid: org.uid,
    size: sizeFor(ko) || sizeRR,
    hostCur,
    hostFee,
    readyStatus,
    minPlayers: Math.max(4, Number(cat.min_players_to_start[ko]) || 4),
  });

  await runHostedFormatToast({
    label: "rr",
    formatId: rr,
    stamp,
    orgTok: org.tok,
    orgUid: org.uid,
    size: sizeRR,
    hostCur,
    hostFee,
    readyStatus,
    minPlayers: Math.max(4, Number(cat.min_players_to_start[rr]) || 4),
  });

  await runHostedFormatToast({
    label: "swiss",
    formatId: swiss,
    stamp,
    orgTok: org.tok,
    orgUid: org.uid,
    size: sizeFor(swiss) || sizeRR,
    hostCur,
    hostFee,
    readyStatus,
    minPlayers: Math.max(6, Number(cat.min_players_to_start[swiss]) || 6),
  });

  await runHostedFormatToast({
    label: "groups",
    formatId: groups,
    stamp,
    orgTok: org.tok,
    orgUid: org.uid,
    size: sizeFor(groups) || sizeRR,
    hostCur,
    hostFee,
    readyStatus,
    minPlayers: Math.max(8, Number(cat.min_players_to_start[groups]) || 8),
    phaseFilter: groupPhase,
  });

  console.log(
    "E2E_PASS: hosted event competition points awarded notification (KO + RR + Swiss + Groups)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
