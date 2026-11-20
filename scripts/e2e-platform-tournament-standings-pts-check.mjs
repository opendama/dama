/**
 * E2E: platform tournament Round Robin forfeit → standings Pts (+1 for winner).
 * Proves the paste claim "Tournaments: no cup Pts" is false.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-standings-pts-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;

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
  assert(
    r.status === 200 && r.body?.access_token && r.body?.user?.id,
    `session ${username} status=${r.status} body=${JSON.stringify(r.body).slice(0, 220)}`,
  );
  return { tok: r.body.access_token, uid: r.body.user.id };
}

const CREATE = `
  mutation($title: String!, $formatId: String) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: 8
    ) { id formatId }
  }
`;

async function main() {
  const stamp = Date.now();
  const admin = await e2eSession(`ptsp_adm_${stamp}`, `ptsp_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  const enumsRes = await req("/platform/enums", { headers: { Authorization: `Bearer ${atok}` } });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body;
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const rr = (enums.hosted_event_round_robin_format || "round_robin").trim();
  const readyStatus = (enums.tournament_bracket_ready || "ready").trim();
  assert((enums.tournament_formats || []).includes(rr), `tournament_formats includes ${rr}`);

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, "catalog get");
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
    const n = Number(pub.body?.min_players_to_start?.[rr]);
    if (Number.isFinite(n) && n >= 2) minPlayers = Math.max(n, 4);
  }

  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    players.push(await e2eSession(`ptsp_p${i}_${stamp}`, `ptsp_p${i}_${stamp}@ex.com`));
  }

  const create = await gql(atok, CREATE, { title: `E2E StandingsPts ${stamp}`, formatId: rr });
  assert(
    create.status === 200 && !create.body?.errors,
    `create ${JSON.stringify(create.body).slice(0, 180)}`,
  );
  const tid = create.body.data.createTournament.id;
  assert(create.body.data.createTournament.formatId === rr, `formatId ${rr}`);

  assert(
    (
      await req(`/console/tournaments/${tid}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({ status: enrollable }),
      })
    ).status === 200,
    "open",
  );

  for (const p of players) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `enroll ${en.status}`);
    await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
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
  const match = bracket.find(
    (m) =>
      !m.is_bye && m.player_a_id && m.player_b_id && String(m.status || "").trim() === readyStatus,
  );
  assert(match?.id, "ready RR match");

  const winnerId = match.player_a_id;
  const loserId = match.player_b_id;
  const ff = await req(`/console/tournaments/${tid}/bracket/${match.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ user_id: loserId }),
  });
  assert(ff.status === 200, `forfeit ${ff.status} ${JSON.stringify(ff.body).slice(0, 160)}`);

  const st = await req(`/tournaments/${tid}/standings`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(st.status === 200, `standings ${st.status}`);
  assert((st.body.format_id || "").trim() === rr, `standings format_id ${st.body.format_id}`);
  const rows = st.body.standings || [];
  assert(rows.length > 0, `standings rows n=${rows.length}`);

  const winnerRow = rows.find((r) => (r.user_id || "").trim() === winnerId);
  assert(winnerRow, `winner in standings ${JSON.stringify(rows).slice(0, 240)}`);
  const pts = Number(winnerRow.points);
  const wins = Number(winnerRow.wins);
  assert(
    Number.isFinite(pts) && pts >= 1,
    `winner Pts >= 1 got=${pts} row=${JSON.stringify(winnerRow)}`,
  );
  assert(Number.isFinite(wins) && wins >= 1, `winner Wins >= 1 got=${wins}`);

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  console.log("ALL PLATFORM TOURNAMENT STANDINGS PTS E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
