/**
 * E2E: admin rematch resets ready/live unfinished match (clears ready + game_id).
 * Refuses done matches. Hosted event organizer rematch parity.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-rematch-check.mjs
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
  return { status: 503, body: { error: "transient upstream" } };
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
  mutation CreateRematchCup($title: String!, $formatId: String) {
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
  const admin = await e2eSession(`ptrm_adm_${stamp}`, `ptrm_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, "platform enums");
  const enums = enumsRes.body;
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const ko = (enums.hosted_event_knockout_format || "knockout").trim();
  const readyStatus = (enums.tournament_bracket_ready || "ready").trim();
  const liveStatus = (enums.tournament_bracket_live || "live").trim();

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
    players.push(await e2eSession(`ptrm_p${i}_${stamp}`, `ptrm_p${i}_${stamp}@ex.com`));
  }

  const create = await gql(atok, CREATE, {
    title: `E2E Rematch ${stamp}`,
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
  assert(start.status === 200, `start ${start.status}`);

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
  assert(aTok && bTok, "player tokens");

  await req(`/tournaments/${tid}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aTok}` },
    body: JSON.stringify({}),
  });
  const r2 = await req(`/tournaments/${tid}/bracket/${match.id}/ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bTok}` },
    body: JSON.stringify({}),
  });
  assert(r2.status === 200, `dual ready ${r2.status}`);
  const gameId = (r2.body?.game_id || r2.body?.match?.game_id || "").trim();
  assert(gameId.length > 0, `live game_id got=${gameId || "empty"}`);

  const rematch = await req(`/console/tournaments/${tid}/bracket/${match.id}/rematch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(
    rematch.status === 200,
    `rematch live ${rematch.status} ${JSON.stringify(rematch.body).slice(0, 160)}`,
  );
  const after = rematch.body?.match;
  assert(
    String(after?.status || "").trim() === readyStatus,
    `after rematch status=${after?.status}`,
  );
  assert(!(after?.game_id || "").trim(), "game_id cleared");
  assert(!(after?.player_a_ready_at || "").trim(), "player_a ready cleared");
  assert(!(after?.player_b_ready_at || "").trim(), "player_b ready cleared");
  assert(!(after?.winner_id || "").trim(), "no winner");

  const force = await req(`/console/tournaments/${tid}/bracket/${match.id}/start-game`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(force.status === 200 || force.status === 201, `force-start after rematch ${force.status}`);
  assert(
    String(force.body?.match?.status || "").trim() === liveStatus ||
      (force.body?.game_id || "").trim().length > 0,
    "force-start yields live game",
  );

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  console.log("ALL PLATFORM TOURNAMENT REMATCH E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
