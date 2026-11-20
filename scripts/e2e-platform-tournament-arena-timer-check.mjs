/**
 * E2E: platform Arena natural expiry - start → backdate arena_ends_at → worker finish.
 *
 * Requires DAMA_ALLOW_E2E_AUTH=1.
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournament-arena-timer-check.mjs
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
  const admin = await e2eSession(
    `arena_tmr_adm_${stamp}`,
    `arena_tmr_adm_${stamp}@example.com`,
    "admin",
  );
  const p1 = await e2eSession(`arena_tmr_p1_${stamp}`, `arena_tmr_p1_${stamp}@example.com`);
  const p2 = await e2eSession(`arena_tmr_p2_${stamp}`, `arena_tmr_p2_${stamp}@example.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `platform/enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  assert(arenaId.length > 0, "hosted_event_arena_format from DB");

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

  const created = await gql(admin.tok, CREATE, {
    title: `Arena Timer E2E ${stamp}`,
    formatId: arenaId,
    maxPlayers: 8,
    arenaDurationMinutes: 5,
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
  assert(
    sql(`SELECT COALESCE(arena_ends_at::text,'') FROM tournaments WHERE id='${tid}'`).length > 0,
    "arena_ends_at set",
  );

  // Natural expiry path: backdate clock so ListExpiredArenas picks it up.
  sql(
    `UPDATE tournaments SET arena_ends_at = NOW() - INTERVAL '30 seconds', updated_at = NOW() WHERE id='${tid}'`,
  );

  let finished = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const finishedAt = sql(
      `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid}'`,
    );
    if (finishedAt.length > 0) {
      finished = true;
      break;
    }
    await sleep(2000);
  }
  assert(finished, "arena finish worker set finished_at after arena_ends_at expiry");

  const del = await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(del.status === 200, `cleanup delete ${del.status}`);

  console.log("E2E_PASS: platform tournament arena natural timer");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
