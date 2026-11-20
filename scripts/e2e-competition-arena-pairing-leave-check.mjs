/**
 * E2E: Arena pairing-by-score pairs closest high scores; leave-queue keeps points; re-queue works.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-arena-pairing-leave-check.mjs
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

const CREATE = `
  mutation($title: String!, $formatId: String, $maxPlayers: Int, $mins: Int) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: $maxPlayers
      arenaDurationMinutes: $mins
    ) { id formatId }
  }
`;

async function waitPair(tid, tok, preferUids) {
  for (let i = 0; i < 40; i++) {
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const bracket = br.body?.bracket || [];
    const open = bracket.filter(
      (m) =>
        !m.is_bye &&
        m.player_a_id &&
        m.player_b_id &&
        !m.finished_at &&
        String(m.phase || "").includes("arena"),
    );
    if (preferUids?.length) {
      const hit = open.find(
        (m) => preferUids.includes(m.player_a_id) && preferUids.includes(m.player_b_id),
      );
      if (hit) return hit;
    } else if (open.length) {
      return open[open.length - 1];
    }
    await sleep(500);
  }
  return null;
}

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`apl_adm_${stamp}`, `apl_adm_${stamp}@ex.com`, "admin");
  const pHi = await e2eSession(`apl_hi_${stamp}`, `apl_hi_${stamp}@ex.com`);
  const pMid = await e2eSession(`apl_mid_${stamp}`, `apl_mid_${stamp}@ex.com`);
  const pLo = await e2eSession(`apl_lo_${stamp}`, `apl_lo_${stamp}@ex.com`);

  const getArena = await req("/console/competition/arena-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(getArena.status === 200, `arena-settings ${getArena.status}`);
  const before = getArena.body || {};
  const modes = before.competition_arena_pairing_modes || [];
  const scoreMode = modes.map((m) => String(m).trim()).find((m) => m === "score") || "score";
  assert(
    (modes || []).map((m) => String(m).trim()).includes(scoreMode),
    `score mode in DB modes=${JSON.stringify(modes)}`,
  );

  const putScore = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_arena_points_win: before.competition_arena_points_win,
      competition_arena_points_draw: before.competition_arena_points_draw,
      competition_arena_points_loss: before.competition_arena_points_loss,
      competition_arena_streak_second_win: before.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: before.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes: before.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: scoreMode,
      competition_arena_auto_start: before.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: before.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: before.competition_arena_allow_join_while_live,
    }),
  });
  assert(putScore.status === 200, `set pairing score ${putScore.status}`);
  assert(
    String(putScore.body?.competition_arena_default_pairing_mode || "") === scoreMode,
    "pairing mode is score",
  );

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  const enrollable = String(enums.enrollable_tournament_status || "open").trim();
  assert(arenaId, "arena format");

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, "catalog");
  const cat = { ...catGet.body };
  cat.source = undefined;
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    ids.add(arenaId);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.min_players_to_start) cat.min_players_to_start = {};
  cat.min_players_to_start[arenaId] = 2;
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  const created = await gql(admin.tok, CREATE, {
    title: `Arena PairLeave ${stamp}`,
    formatId: arenaId,
    maxPlayers: 8,
    mins: 15,
  });
  assert(
    created.status === 200 && !created.body?.errors,
    `create ${JSON.stringify(created.body).slice(0, 160)}`,
  );
  const tid = created.body.data.createTournament.id;

  assert(
    (
      await req(`/console/tournaments/${tid}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${admin.tok}` },
        body: JSON.stringify({ status: enrollable }),
      })
    ).status === 200,
    "open",
  );

  for (const p of [pHi, pMid, pLo]) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `enroll ${en.status}`);
  }

  assert(
    (
      await req(`/console/tournaments/${tid}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.tok}` },
        body: JSON.stringify({}),
      })
    ).status === 200,
    "start",
  );

  // Seed scores: hi=100, mid=90, lo=10 → score pairing should match hi+mid first.
  sql(
    `UPDATE tournament_entries SET arena_points = 100 WHERE tournament_id='${tid}' AND user_id='${pHi.uid}'`,
  );
  sql(
    `UPDATE tournament_entries SET arena_points = 90 WHERE tournament_id='${tid}' AND user_id='${pMid.uid}'`,
  );
  sql(
    `UPDATE tournament_entries SET arena_points = 10 WHERE tournament_id='${tid}' AND user_id='${pLo.uid}'`,
  );

  for (const p of [pHi, pMid, pLo]) {
    const q = await req(`/tournaments/${tid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(q.status === 200 || q.status === 201, `queue ${q.status}`);
  }

  const pair = await waitPair(tid, admin.tok, [pHi.uid, pMid.uid]);
  assert(pair?.id, "score-mode pair hi+mid");
  const seats = [pair.player_a_id, pair.player_b_id].sort();
  const expect = [pHi.uid, pMid.uid].sort();
  assert(
    seats[0] === expect[0] && seats[1] === expect[1],
    `paired hi+mid got ${seats.join(",")} expect ${expect.join(",")}`,
  );

  // Leave queue for lo (still queued alone) - keep points; hi/mid leave after match? leave lo.
  const leave = await req(`/tournaments/${tid}/arena/queue/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pLo.tok}` },
    body: JSON.stringify({}),
  });
  assert(leave.status === 200, `leave queue ${leave.status}`);
  const ptsLo = Number(
    sql(
      `SELECT COALESCE(arena_points::text,'0') FROM tournament_entries WHERE tournament_id='${tid}' AND user_id='${pLo.uid}'`,
    ) || 0,
  );
  assert(ptsLo === 10, `leave-early keeps points got ${ptsLo}`);

  const reQ = await req(`/tournaments/${tid}/arena/queue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pLo.tok}` },
    body: JSON.stringify({}),
  });
  assert(reQ.status === 200 || reQ.status === 201, `re-queue after leave ${reQ.status}`);
  const stillPts = Number(
    sql(
      `SELECT COALESCE(arena_points::text,'0') FROM tournament_entries WHERE tournament_id='${tid}' AND user_id='${pLo.uid}'`,
    ) || 0,
  );
  assert(stillPts === 10, "points unchanged after re-queue");

  await req(`/console/tournaments/${tid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });

  const restore = await req("/console/competition/arena-settings", {
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
  assert(restore.status === 200, `restore arena-settings ${restore.status}`);

  console.log("E2E_PASS: arena score pairing + leave-early keeps points");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
