/**
 * E2E: one seat Ready, opponent silent past DB timeout → worker auto-forfeit.
 *
 * Temporarily sets competition_match_ready_timeout_seconds=5 via local Postgres,
 * then restores 300. Requires Docker postgres container dama_postgres.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-ready-timeout-check.mjs
 */
import { spawnSync } from "node:child_process";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;
const pgContainer = process.env.DAMA_E2E_PG_CONTAINER || "dama_postgres";
const pgUser = process.env.DAMA_E2E_PG_USER || "dama";
const pgDb = process.env.DAMA_E2E_PG_DB || "dama";

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function psql(sql) {
  const r = spawnSync(
    "docker",
    ["exec", pgContainer, "psql", "-U", pgUser, "-d", pgDb, "-t", "-A", "-c", sql],
    { encoding: "utf8", shell: false },
  );
  if (r.status !== 0) {
    throw new Error(`psql failed: ${(r.stderr || r.stdout || "").trim()}`);
  }
  return (r.stdout || "").trim();
}

function setReadyTimeoutSeconds(n) {
  psql(
    `UPDATE platform_settings SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('competition_match_ready_timeout_seconds', '${n}', 'competition_match_ready_auto_forfeit', 'true'), updated_at = NOW() WHERE key = 'client_enums';`,
  );
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

const CREATE = `
  mutation CreateReadyTimeoutCup($title: String!, $formatId: String) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: 8
    ) { id formatId status }
  }
`;

async function main() {
  const stamp = Date.now();
  let restored = false;
  const restore = () => {
    if (restored) return;
    try {
      setReadyTimeoutSeconds(300);
      restored = true;
      console.log("OK: restored ready timeout to 300");
    } catch (e) {
      console.error("WARN: restore timeout failed", e);
    }
  };
  process.on("exit", restore);
  process.on("SIGINT", () => {
    restore();
    process.exit(130);
  });

  try {
    setReadyTimeoutSeconds(5);
    assert(true, "set ready timeout seconds=5 auto_forfeit=true");
  } catch (e) {
    console.error("SKIP: cannot reach postgres for timeout override.", e.message || e);
    process.exit(2);
  }

  const admin = await e2eSession(`ptrt_adm_${stamp}`, `ptrt_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, "platform enums");
  const enums = enumsRes.body;
  assert(
    String(enums.competition_match_ready_timeout_seconds || "").trim().length > 0,
    "enums expose competition_match_ready_timeout_seconds",
  );
  assert(
    String(enums.competition_match_ready_auto_forfeit || "").trim().length > 0,
    "enums expose competition_match_ready_auto_forfeit",
  );
  assert(
    String(enums.competition_check_in_window_hours || "").trim().length > 0,
    "enums expose competition_check_in_window_hours",
  );
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const ko = (enums.hosted_event_knockout_format || "knockout").trim();
  const readyStatus = (enums.tournament_bracket_ready || "ready").trim();
  const doneStatus = (
    enums.tournament_bracket_done ||
    enums.hosted_event_bracket_done ||
    "done"
  ).trim();

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, `catalog get ${catGet.status}`);
  const cat = catGet.body;
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    for (const f of cat.formats || []) ids.add(f.id);
    s.allowed_format_ids = [...ids];
  }
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify(cat),
  });

  let minPlayers = 4;
  const pub = await req("/events/catalog", { headers: { Authorization: `Bearer ${atok}` } });
  if (pub.status === 200) {
    const n = Number(pub.body?.min_players_to_start?.[ko]);
    if (Number.isFinite(n) && n >= 2) minPlayers = n;
  }

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    players.push(await e2eSession(`ptrt_p${i}_${stamp}`, `ptrt_p${i}_${stamp}@ex.com`));
  }

  const create = await gql(atok, CREATE, {
    title: `E2E ReadyTimeout ${stamp}`,
    formatId: ko,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const tid = create.body.data.createTournament.id;
  assert(tid, "tournament id");

  const open = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(open.status === 200, `open ${open.status}`);

  for (const p of players) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `enroll ${en.status}`);
    const ci = await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(ci.status === 200 || ci.status === 201 || ci.status === 409, `check-in ${ci.status}`);
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status} ${JSON.stringify(start.body).slice(0, 160)}`);

  let bracket = start.body?.bracket || [];
  if (!bracket.length) {
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${atok}` },
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
  assert(aTok, "player A token");

  const r1 = await req(`/tournaments/${tid}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aTok}` },
    body: JSON.stringify({}),
  });
  assert(r1.status === 200, `player A ready ${r1.status}`);
  assert(!(r1.body?.game_id || "").trim(), "first ready alone should not start game");

  // Worker ticks every 20s and reloads enums; timeout is 5s after ready_at.
  let forfeited = null;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${atok}` },
    });
    const updated = (br.body?.bracket || []).find((m) => m.id === match.id);
    if (!updated) continue;
    const st = String(updated.status || "").trim();
    const winner = (updated.winner_id || "").trim();
    if (st === doneStatus || (winner && winner === match.player_a_id)) {
      forfeited = updated;
      break;
    }
  }
  assert(forfeited, "ready-timeout worker forfeited no-show opponent");
  assert(
    (forfeited.winner_id || "").trim() === match.player_a_id,
    `winner is ready seat got=${forfeited.winner_id}`,
  );
  assert(!(forfeited.game_id || "").trim(), "forfeit path has no board game_id");

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  restore();
  console.log("ALL PLATFORM TOURNAMENT READY-TIMEOUT E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  try {
    setReadyTimeoutSeconds(300);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
