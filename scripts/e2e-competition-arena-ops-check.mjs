/**
 * E2E: Arena ops gaps - admin settings CRUD, streak scoring, join-while-live (platform + hosted).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-arena-ops-check.mjs
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
  return { status: 503, body: { error: "transient" } };
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

const CREATE = `
  mutation CreateArenaCup($title: String!, $formatId: String, $maxPlayers: Int, $arenaDurationMinutes: Int) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: $maxPlayers
      arenaDurationMinutes: $arenaDurationMinutes
    ) { id title formatId }
  }
`;

async function waitPair(tid, tok) {
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const matches = br.body?.bracket || br.body?.matches || [];
    const m = Array.isArray(matches)
      ? matches.find((x) => x.player_a_id && x.player_b_id && !x.finished_at)
      : null;
    if (m) return m;
  }
  return null;
}

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`aops_adm_${stamp}`, `aops_adm_${stamp}@example.com`, "admin");

  // ---- Admin CRUD: arena + standings settings ----
  const getArena = await req("/console/competition/arena-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(getArena.status === 200, `get arena-settings ${getArena.status}`);
  const before = getArena.body || {};
  assert(String(before.competition_arena_points_win || "").trim(), "arena points_win from DB");
  assert(
    String(before.competition_arena_allow_join_while_live || "").trim(),
    "allow_join_while_live from DB",
  );

  const putArena = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_arena_points_win: before.competition_arena_points_win,
      competition_arena_points_draw: before.competition_arena_points_draw,
      competition_arena_points_loss: before.competition_arena_points_loss,
      competition_arena_streak_second_win: before.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: before.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes: before.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: before.competition_arena_default_pairing_mode,
      competition_arena_auto_start: before.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: before.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: "true",
    }),
  });
  assert(
    putArena.status === 200,
    `put arena-settings ${putArena.status} ${JSON.stringify(putArena.body).slice(0, 180)}`,
  );
  assert(
    String(putArena.body?.competition_arena_allow_join_while_live || "").toLowerCase() === "true",
    "allow_join_while_live persisted true",
  );

  const getStand = await req("/console/competition/standings-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(getStand.status === 200, `get standings-settings ${getStand.status}`);
  const sw = String(getStand.body?.competition_standings_points_win || "").trim();
  const sd = String(getStand.body?.competition_standings_points_draw || "").trim();
  assert(
    sw && sd !== undefined && sd !== null && String(sd).length > 0,
    "standings points from DB",
  );
  const putStand = await req("/console/competition/standings-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_standings_points_win: sw,
      competition_standings_points_draw: sd,
    }),
  });
  assert(putStand.status === 200, `put standings-settings ${putStand.status}`);
  assert(
    String(putStand.body?.competition_standings_points_win || "") === sw,
    "standings points_win round-trip",
  );

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  assert(arenaId, "arena format");
  const winPts = Number(enums.competition_arena_points_win || 0);
  const streak2 = Number(enums.competition_arena_streak_second_win || 0);
  assert(winPts > 0 && streak2 > 0, `win=${winPts} streak2=${streak2} from DB`);

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, `catalog get ${catGet.status}`);
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
  const putCat = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });
  assert(putCat.status === 200, `catalog put ${putCat.status}`);

  // ---- Platform: streak + late enroll while live ----
  const p1 = await e2eSession(`aops_p1_${stamp}`, `aops_p1_${stamp}@example.com`);
  const p2 = await e2eSession(`aops_p2_${stamp}`, `aops_p2_${stamp}@example.com`);
  const p3 = await e2eSession(`aops_p3_${stamp}`, `aops_p3_${stamp}@example.com`);

  const created = await gql(admin.tok, CREATE, {
    title: `Arena Ops ${stamp}`,
    formatId: arenaId,
    maxPlayers: 8,
    arenaDurationMinutes: 10,
  });
  const tid = created.body?.data?.createTournament?.id;
  assert(tid, `create ${JSON.stringify(created.body).slice(0, 200)}`);

  const enrollable = String(enums.enrollable_tournament_status || "").trim();
  if (enrollable) {
    const st = await req(`/console/tournaments/${tid}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({ status: enrollable }),
    });
    assert(st.status === 200, `open ${st.status}`);
  }

  for (const p of [p1, p2]) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status < 300 || en.status === 409, `enroll ${en.status}`);
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(start.status < 300, `start ${start.status}`);

  // Late join while live (p3).
  const late = await req(`/tournaments/${tid}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p3.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    late.status < 300 || late.status === 201,
    `platform late enroll while live ${late.status} ${JSON.stringify(late.body).slice(0, 180)}`,
  );

  // Streak: two consecutive forfeits in favor of p1.
  for (const p of [p1, p2]) {
    await req(`/tournaments/${tid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }
  const m1 = await waitPair(tid, p1.tok);
  assert(m1?.id, "first pair");
  const loser1 = m1.player_a_id === p1.uid ? m1.player_b_id : m1.player_a_id;
  const f1 = await req(`/console/tournaments/${tid}/bracket/${m1.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ user_id: loser1 }),
  });
  assert(f1.status === 200, `forfeit1 ${f1.status}`);
  const ptsAfter1 = Number(
    sql(
      `SELECT COALESCE(arena_points::text,'0') FROM tournament_entries WHERE tournament_id='${tid}' AND user_id='${p1.uid}'`,
    ) || 0,
  );
  assert(ptsAfter1 === winPts, `first win points ${ptsAfter1} == ${winPts}`);

  for (const p of [p1, p2]) {
    await req(`/tournaments/${tid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }
  const m2 = await waitPair(tid, p1.tok);
  assert(m2?.id, "second pair");
  const loser2 = m2.player_a_id === p1.uid ? m2.player_b_id : m2.player_a_id;
  const f2 = await req(`/console/tournaments/${tid}/bracket/${m2.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ user_id: loser2 }),
  });
  assert(f2.status === 200, `forfeit2 ${f2.status}`);
  const ptsAfter2 = Number(
    sql(
      `SELECT COALESCE(arena_points::text,'0') FROM tournament_entries WHERE tournament_id='${tid}' AND user_id='${p1.uid}'`,
    ) || 0,
  );
  const expectStreak = winPts + streak2;
  assert(ptsAfter2 === expectStreak, `streak-2 total ${ptsAfter2} == win+streak2 ${expectStreak}`);
  const streak = Number(
    sql(
      `SELECT COALESCE(arena_streak::text,'0') FROM tournament_entries WHERE tournament_id='${tid}' AND user_id='${p1.uid}'`,
    ) || 0,
  );
  assert(streak === 2, `arena_streak == 2 got ${streak}`);

  await req(`/console/tournaments/${tid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });

  // ---- Hosted: join while live ----
  const org = await e2eSession(`aops_org_${stamp}`, `aops_org_${stamp}@example.com`);
  const hp1 = await e2eSession(`aops_hp1_${stamp}`, `aops_hp1_${stamp}@example.com`);
  const hp2 = await e2eSession(`aops_hp2_${stamp}`, `aops_hp2_${stamp}@example.com`);
  const hp3 = await e2eSession(`aops_hp3_${stamp}`, `aops_hp3_${stamp}@example.com`);

  const size =
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(arenaId)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  const hostFee = Number(size.host_fee_amount || 0);
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  if (hostFee > 0) creditWallet(org.uid, hostCur, Math.max(hostFee * 3, 200));

  let phone = 6100000;
  phone += 1;
  await passCashGate(org.tok, String(phone).slice(-8));

  const createEv = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Arena LiveJoin ${stamp}`,
      format_id: arenaId,
      size_id: size.id,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
      auto_approve: true,
      arena_duration_minutes: 10,
    }),
  });
  assert(
    createEv.status === 200 || createEv.status === 201,
    `create event ${createEv.status} ${JSON.stringify(createEv.body).slice(0, 200)}`,
  );
  const ev = createEv.body?.event || createEv.body;
  assert(ev?.id && ev?.join_code, "event id+code");

  for (const p of [hp1, hp2]) {
    phone += 1;
    await passCashGate(p.tok, String(phone).slice(-8));
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
    });
    assert(join.status === 200 || join.status === 201, `join pre ${join.status}`);
  }

  const startEv = await req(`/events/${ev.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(startEv.status === 200, `start event ${startEv.status}`);

  phone += 1;
  await passCashGate(hp3.tok, String(phone).slice(-8));
  const lateEv = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${hp3.tok}` },
    body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
  });
  assert(
    lateEv.status === 200 || lateEv.status === 201,
    `hosted late join while live ${lateEv.status} ${JSON.stringify(lateEv.body).slice(0, 180)}`,
  );

  await req(`/events/${ev.id}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });

  // Restore arena settings mutated for join-while-live (do not leave local DB dirty).
  const restoreArena = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_arena_points_win: before.competition_arena_points_win,
      competition_arena_points_draw: before.competition_arena_points_draw,
      competition_arena_points_loss: before.competition_arena_points_loss,
      competition_arena_streak_second_win: before.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: before.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes: before.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: before.competition_arena_default_pairing_mode,
      competition_arena_auto_start: before.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: before.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: before.competition_arena_allow_join_while_live,
    }),
  });
  assert(
    restoreArena.status === 200,
    `restore arena-settings ${restoreArena.status} ${JSON.stringify(restoreArena.body).slice(0, 160)}`,
  );

  console.log("E2E_PASS: competition arena ops (settings + streak + live join)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
