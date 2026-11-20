/**
 * E2E: Arena lifecycle notifications - started / matched / finished.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-arena-notifications-check.mjs
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
    if (![429, 502, 503].includes(r.status) || attempt === 8) return { status: r.status, body };
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
  assert(r.status === 200 && r.body?.access_token, `session ${username}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

function hasKind(userId, kind) {
  const uid = String(userId).replace(/'/g, "");
  const k = String(kind).replace(/'/g, "");
  return (
    sql(
      `SELECT COUNT(*)::text FROM app_notifications WHERE recipient_id='${uid}' AND kind_code='${k}'`,
    ) !== "0"
  );
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
    ) { id formatId }
  }
`;

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`an_adm_${stamp}`, `an_adm_${stamp}@ex.com`, "admin");
  const p1 = await e2eSession(`an_p1_${stamp}`, `an_p1_${stamp}@ex.com`);
  const p2 = await e2eSession(`an_p2_${stamp}`, `an_p2_${stamp}@ex.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  const enrollable = String(enums.enrollable_tournament_status || "").trim();
  assert(arenaId && enrollable, "arena + enrollable from DB");
  assert(
    (enums.tournament_formats || []).includes(arenaId),
    `tournament_formats includes ${arenaId}`,
  );

  for (const code of ["player.arena_started", "player.arena_matched", "player.arena_finished"]) {
    assert(
      sql(`SELECT COUNT(*)::text FROM notification_kinds WHERE code='${code}'`) === "1",
      `kind ${code} in DB`,
    );
  }

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
    title: `Arena Notif ${stamp}`,
    formatId: arenaId,
    maxPlayers: 8,
    arenaDurationMinutes: dur,
  });
  const tid = created.body?.data?.createTournament?.id;
  assert(tid, `create ${JSON.stringify(created.body).slice(0, 280)}`);

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

  assert(hasKind(p1.uid, "player.arena_started"), "p1 arena_started");
  assert(hasKind(p2.uid, "player.arena_started"), "p2 arena_started");

  for (const p of [p1, p2]) {
    const q = await req(`/tournaments/${tid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(q.status < 300, `queue ${q.status}`);
  }

  let paired = false;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    if (hasKind(p1.uid, "player.arena_matched") && hasKind(p2.uid, "player.arena_matched")) {
      paired = true;
      break;
    }
  }
  assert(paired, "arena_matched for both players");

  const fin = await req(`/console/tournaments/${tid}/arena/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({}),
  });
  assert(fin.status < 300, `finish ${fin.status}`);
  assert(hasKind(p1.uid, "player.arena_finished"), "p1 arena_finished");
  assert(hasKind(p2.uid, "player.arena_finished"), "p2 arena_finished");

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });

  console.log("E2E_PASS: competition arena lifecycle notifications");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
