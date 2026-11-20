/**
 * E2E: platform Arena cup - create → enroll → start → queue → pair → score path smoke.
 *
 * Requires API with DAMA_ALLOW_E2E_AUTH=1.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-arena-check.mjs
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

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`arena_adm_${stamp}`, `arena_adm_${stamp}@example.com`, "admin");
  const p1 = await e2eSession(`arena_p1_${stamp}`, `arena_p1_${stamp}@example.com`);
  const p2 = await e2eSession(`arena_p2_${stamp}`, `arena_p2_${stamp}@example.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `platform/enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  assert(arenaId.length > 0, "hosted_event_arena_format from DB");
  const formats = enums.tournament_formats || [];
  assert(formats.includes(arenaId), `tournament_formats includes ${arenaId}`);

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

  const duration = Number.parseInt(
    String(enums.competition_arena_default_duration_minutes || "5"),
    10,
  );
  const dur = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 5) : 5;

  const created = await gql(admin.tok, CREATE, {
    title: `Arena E2E ${stamp}`,
    formatId: arenaId,
    maxPlayers: 8,
    arenaDurationMinutes: dur,
  });
  const cup = created.body?.data?.createTournament;
  assert(
    cup?.id && cup.formatId === arenaId,
    `create arena cup ${JSON.stringify(created.body).slice(0, 200)}`,
  );
  const tid = cup.id;

  const enrollable = String(enums.enrollable_tournament_status || "").trim();
  if (enrollable) {
    const st = await req(`/console/tournaments/${tid}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({ status: enrollable }),
    });
    assert(st.status === 200, `set enrollable ${st.status}`);
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
  assert(
    start.status < 300,
    `start arena ${start.status} ${JSON.stringify(start.body).slice(0, 200)}`,
  );
  const startedTour = start.body?.tournament || start.body;
  assert(startedTour?.arena_ends_at, "arena_ends_at set on start");

  for (const p of [p1, p2]) {
    const q = await req(`/tournaments/${tid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(q.status < 300, `queue ${q.status} ${JSON.stringify(q.body).slice(0, 160)}`);
  }

  let paired = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${p1.tok}` },
    });
    const matches = br.body?.bracket || br.body?.matches || [];
    if (Array.isArray(matches) && matches.length > 0) {
      paired = true;
      break;
    }
  }
  assert(paired, "arena worker paired a match");

  const standings = await req(`/tournaments/${tid}/arena/standings`, {
    headers: { Authorization: `Bearer ${p1.tok}` },
  });
  assert(standings.status === 200, `arena standings ${standings.status}`);
  const rows = standings.body?.standings || standings.body?.rows || standings.body;
  assert(Array.isArray(rows) && rows.length >= 2, "arena standings rows");

  const leave = await req(`/tournaments/${tid}/arena/queue/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p2.tok}` },
    body: JSON.stringify({}),
  });
  assert(leave.status < 300, `leave queue ${leave.status}`);

  // While a ready/live arena match is open, re-queue must stay conflict (in-match).
  const requeueBusy = await req(`/tournaments/${tid}/arena/queue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p1.tok}` },
    body: JSON.stringify({}),
  });
  assert(requeueBusy.status === 409, `re-queue while in match blocked ${requeueBusy.status}`);

  const forceFinish = await req(`/console/tournaments/${tid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    forceFinish.status < 300,
    `force finish arena ${forceFinish.status} ${JSON.stringify(forceFinish.body).slice(0, 200)}`,
  );
  const finishedTour = forceFinish.body?.tournament || forceFinish.body;
  assert((finishedTour?.finished_at || "").trim().length > 0, "finished_at after force finish");
  assert((finishedTour?.winner_id || "").trim().length > 0, "winner_id after force finish");

  const leaveAfterFinish = await req(`/tournaments/${tid}/arena/queue/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p1.tok}` },
    body: JSON.stringify({}),
  });
  assert(leaveAfterFinish.status < 300, `leave queue after finish ${leaveAfterFinish.status}`);

  const archived = String(
    enums.archived_tournament_status || enums.default_tournament_status || "",
  ).trim();
  if (archived) {
    await req(`/console/tournaments/${tid}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({ status: archived }),
    });
  }
  const del = await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(del.status === 200, `cleanup delete ${del.status}`);

  console.log("E2E_PASS: platform tournament arena");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
