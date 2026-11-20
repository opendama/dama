/**
 * E2E: Arena forfeit awards arena points → winner gets player.competition_points_awarded
 * (toast source for web Sonner + Flutter SnackBar).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-arena-points-toast-check.mjs
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
  const admin = await e2eSession(`apt_adm_${stamp}`, `apt_adm_${stamp}@example.com`, "admin");
  const p1 = await e2eSession(`apt_p1_${stamp}`, `apt_p1_${stamp}@example.com`);
  const p2 = await e2eSession(`apt_p2_${stamp}`, `apt_p2_${stamp}@example.com`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, `platform/enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const arenaId = String(enums.hosted_event_arena_format || "").trim();
  assert(arenaId, "hosted_event_arena_format from DB");
  const winPts = Number(enums.competition_arena_points_win || 0);
  assert(winPts > 0, `competition_arena_points_win > 0 got=${winPts}`);

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
  const put = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });
  assert(put.status === 200, `catalog put ${put.status}`);

  const created = await gql(admin.tok, CREATE, {
    title: `Arena Pts Toast ${stamp}`,
    formatId: arenaId,
    maxPlayers: 8,
    arenaDurationMinutes: 5,
  });
  const cup = created.body?.data?.createTournament;
  assert(cup?.id, `create ${JSON.stringify(created.body).slice(0, 200)}`);
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
  assert(start.status < 300, `start ${start.status}`);

  for (const p of [p1, p2]) {
    const q = await req(`/tournaments/${tid}/arena/queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(q.status < 300, `queue ${q.status}`);
  }

  let match = null;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${p1.tok}` },
    });
    const matches = br.body?.bracket || br.body?.matches || [];
    if (Array.isArray(matches) && matches.length > 0) {
      match = matches.find((m) => m.player_a_id && m.player_b_id) || matches[0];
      if (match) break;
    }
  }
  assert(match?.id, "arena pair match");

  const loser = match.player_b_id || p2.uid;
  const winner = match.player_a_id === loser ? match.player_b_id : match.player_a_id;
  assert(winner && loser, "winner/loser seats");

  const forfeit = await req(`/console/tournaments/${tid}/bracket/${match.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({ user_id: loser }),
  });
  assert(
    forfeit.status === 200,
    `arena forfeit ${forfeit.status} ${JSON.stringify(forfeit.body).slice(0, 200)}`,
  );

  const arenaPts = Number(
    sql(
      `SELECT COALESCE(arena_points::text,'0') FROM tournament_entries WHERE tournament_id='${tid}' AND user_id='${winner}'`,
    ) || 0,
  );
  assert(arenaPts >= winPts, `winner arena_points ${arenaPts} >= win pts ${winPts}`);

  let notifId = "";
  for (let i = 0; i < 20; i++) {
    notifId = sql(
      `SELECT id::text FROM app_notifications WHERE recipient_id='${winner}' AND kind_code='player.competition_points_awarded' ORDER BY created_at DESC LIMIT 1`,
    );
    if (notifId) break;
    await sleep(500);
  }
  assert(notifId, "winner has player.competition_points_awarded notification");

  const wTok = winner === p1.uid ? p1.tok : p2.tok;
  const listW = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${wTok}` },
  });
  assert(listW.status === 200, `winner notifications ${listW.status}`);
  const items = listW.body?.items || [];
  const hit = items.find((it) => it.kind_code === "player.competition_points_awarded");
  assert(hit, "winner API list includes points-awarded notif");
  assert(String(hit.body || "").trim().length > 0, "points-awarded body non-empty");
  assert(Array.isArray(hit.body_args) && hit.body_args.length >= 2, "body_args [points,label,...]");
  assert(String(hit.body_args[0] || "").trim().length > 0, "body_args points");
  assert(String(hit.body_args[1] || "").trim().length > 0, "body_args label");
  const toastFmt = String(listW.body?.chrome?.toast_points_awarded_fmt || "").trim();
  assert(toastFmt.includes("{points}") && toastFmt.includes("{label}"), "notif chrome toast fmt");
  const toastText = toastFmt
    .replaceAll("{points}", String(hit.body_args[0]).trim())
    .replaceAll("{label}", String(hit.body_args[1]).trim())
    .trim();
  assert(toastText.length > 0, `client toast text from fmt got=${toastText}`);

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  console.log("E2E_PASS: competition arena points awarded notification");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
