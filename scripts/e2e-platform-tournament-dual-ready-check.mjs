/**
 * E2E: platform tournament dual-ready → auto StartGame → game_id.
 *
 * Requires DAMA_ALLOW_E2E_AUTH=1.
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-dual-ready-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;

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
  mutation CreateDualReadyCup($title: String!, $formatId: String) {
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
  const admin = await e2eSession(`ptdr_adm_${stamp}`, `ptdr_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, "platform enums");
  const enums = enumsRes.body;
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const ko = (enums.hosted_event_knockout_format || "knockout").trim();
  const readyStatus = (enums.tournament_bracket_ready || "ready").trim();

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
    players.push(await e2eSession(`ptdr_p${i}_${stamp}`, `ptdr_p${i}_${stamp}@ex.com`));
  }

  const create = await gql(atok, CREATE, {
    title: `E2E DualReady ${stamp}`,
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
  const bTok = players.find((p) => p.uid === match.player_b_id)?.tok;
  assert(aTok && bTok, "player tokens for match seats");

  const r1 = await req(`/tournaments/${tid}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aTok}` },
    body: JSON.stringify({}),
  });
  assert(r1.status === 200, `player A ready ${r1.status} ${JSON.stringify(r1.body).slice(0, 160)}`);
  assert(!(r1.body?.game_id || "").trim(), "first ready alone should not start game yet");

  const r2 = await req(`/tournaments/${tid}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bTok}` },
    body: JSON.stringify({}),
  });
  assert(r2.status === 200, `player B ready ${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
  const gameId = (r2.body?.game_id || r2.body?.match?.game_id || "").trim();
  assert(gameId.length > 0, `dual-ready auto game_id got=${gameId || "empty"}`);

  const br2 = await req(`/tournaments/${tid}/bracket`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  const updated = (br2.body?.bracket || []).find((m) => m.id === match.id);
  assert((updated?.game_id || "").trim() === gameId, "bracket stores game_id after dual ready");

  const flags = await req("/feature-flags");
  const ratedOn = flags.body?.public_event_matches_rated === true;
  const game = await req(`/games/${gameId}/state`, {
    headers: { Authorization: `Bearer ${aTok}` },
  });
  assert(game.status === 200, `game state ${game.status}`);
  if (ratedOn) {
    assert(
      game.body?.rated === true || game.body?.game?.rated === true,
      "tournament board rated when flag on",
    );
  }

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  console.log("ALL PLATFORM TOURNAMENT DUAL-READY E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
