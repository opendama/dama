/**
 * E2E: KO + RR + Swiss + Groups (group phase) forfeit → player.competition_points_awarded notif (toast source).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-points-toast-check.mjs
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
  const r = await req("/auth/e2e/session", { method: "POST", body: JSON.stringify(body) });
  if (r.status === 404 || r.status === 403) {
    console.error("SKIP: e2e auth off", r.status);
    process.exit(2);
  }
  assert(
    r.status === 200 && r.body?.access_token && r.body?.user?.id,
    `session ${username} status=${r.status}`,
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

async function runFormatToast(
  atok,
  stamp,
  formatId,
  formatLabel,
  enrollable,
  readyStatus,
  minPlayers,
  phaseFilter = "",
) {
  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    players.push(
      await e2eSession(
        `cpt_${formatLabel}_p${i}_${stamp}`,
        `cpt_${formatLabel}_p${i}_${stamp}@ex.com`,
      ),
    );
  }

  const create = await gql(atok, CREATE, {
    title: `E2E PointsToast ${formatLabel} ${stamp}`,
    formatId,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `${formatLabel} create ${JSON.stringify(create.body).slice(0, 160)}`,
  );
  const tid = create.body.data.createTournament.id;

  assert(
    (
      await req(`/console/tournaments/${tid}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({ status: enrollable }),
      })
    ).status === 200,
    `${formatLabel} open`,
  );

  for (const p of players) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `${formatLabel} enroll ${en.status}`);
    const ci = await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(
      ci.status === 200 || ci.status === 201 || ci.status === 409,
      `${formatLabel} check-in ${ci.status}`,
    );
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(
    start.status === 200,
    `${formatLabel} start ${start.status} ${JSON.stringify(start.body).slice(0, 220)}`,
  );

  let bracket = start.body?.bracket || [];
  if (!bracket.length) {
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${atok}` },
    });
    bracket = br.body?.bracket || [];
  }
  const phaseWant = String(phaseFilter || "").trim();
  const match = bracket.find(
    (m) =>
      !m.is_bye &&
      m.player_a_id &&
      m.player_b_id &&
      String(m.status || "").trim() === readyStatus &&
      (!phaseWant || String(m.phase || "").trim() === phaseWant),
  );
  assert(match?.id, `${formatLabel} ready match${phaseWant ? ` phase=${phaseWant}` : ""}`);

  const winnerId = match.player_a_id;
  const loserId = match.player_b_id;
  const winner = players.find((p) => p.uid === winnerId);
  assert(winner, `${formatLabel} winner session`);

  const beforeIds = new Set(
    sql(`
      SELECT COALESCE(string_agg(n.id::text, ','), '')
      FROM app_notifications n
      WHERE n.recipient_id = '${winnerId}'
        AND n.kind_code = 'player.competition_points_awarded'
    `)
      .split(",")
      .filter(Boolean),
  );

  const ff = await req(`/console/tournaments/${tid}/bracket/${match.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ user_id: loserId }),
  });
  assert(ff.status === 200, `${formatLabel} forfeit ${ff.status}`);

  let found = "";
  for (let i = 0; i < 20; i++) {
    found = sql(`
      SELECT n.id::text
      FROM app_notifications n
      WHERE n.recipient_id = '${winnerId}'
        AND n.kind_code = 'player.competition_points_awarded'
      ORDER BY n.created_at DESC
      LIMIT 1
    `);
    if (found && !beforeIds.has(found)) break;
    found = "";
    await sleep(250);
  }
  assert(found, `${formatLabel} winner has player.competition_points_awarded notification`);

  const list = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${winner.tok}` },
  });
  assert(list.status === 200, `${formatLabel} winner notifications ${list.status}`);
  const items = list.body?.notifications || list.body?.items || [];
  const row = items.find(
    (n) =>
      String(n.kind_code || n.kind || "").trim() === "player.competition_points_awarded" ||
      String(n.id || "").trim() === found,
  );
  assert(row, `${formatLabel} winner API list includes points-awarded notif`);
  const body = String(row.body || "").trim();
  assert(body.length > 0, `${formatLabel} points-awarded body non-empty (toast text)`);

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
}

async function main() {
  const stamp = Date.now();
  const admin = await e2eSession(`cpt_adm_${stamp}`, `cpt_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  // Fail-closed: chrome label required for emit.
  const label = sql(`
    SELECT COALESCE(value->>'standings_points_label','') FROM platform_settings WHERE key='tournaments_player_chrome'
  `).trim();
  assert(label.length > 0, "standings_points_label from DB");

  const winPts = sql(`
    SELECT COALESCE(value->>'competition_standings_points_win','') FROM platform_settings WHERE key='client_enums'
  `).trim();
  assert(Number(winPts) > 0, `competition_standings_points_win > 0 got=${winPts}`);

  const enumsRes = await req("/platform/enums", { headers: { Authorization: `Bearer ${atok}` } });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body;
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const ko = (enums.hosted_event_knockout_format || "").trim();
  const rr = (enums.hosted_event_round_robin_format || "").trim();
  const swiss = (enums.hosted_event_swiss_format || "").trim();
  const groups = (enums.hosted_event_groups_knockout_format || "").trim();
  const groupPhase = (enums.hosted_event_phase_group || "").trim();
  const readyStatus = (enums.tournament_bracket_ready || "").trim();
  assert(
    ko && rr && swiss && groups && groupPhase && readyStatus,
    "ko+rr+swiss+groups+phase from DB",
  );
  assert((enums.tournament_formats || []).includes(ko), `tournament_formats includes ${ko}`);
  assert((enums.tournament_formats || []).includes(rr), `tournament_formats includes ${rr}`);
  assert((enums.tournament_formats || []).includes(swiss), `tournament_formats includes ${swiss}`);
  assert(
    (enums.tournament_formats || []).includes(groups),
    `tournament_formats includes ${groups}`,
  );

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
  if (!cat.swiss_rounds_by_max_players || !Object.keys(cat.swiss_rounds_by_max_players).length) {
    cat.swiss_rounds_by_max_players = { 8: 2, 16: 3, 32: 4, 64: 5 };
  }
  if (!(cat.groups_knockout_target_group_size > 0)) cat.groups_knockout_target_group_size = 4;
  if (!(cat.groups_knockout_advance_per_group > 0)) cat.groups_knockout_advance_per_group = 2;
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify(cat),
  });

  const pub = await req("/events/catalog", { headers: { Authorization: `Bearer ${atok}` } });
  const minFor = (fid, floor = 4) => {
    let minPlayers = floor;
    if (pub.status === 200) {
      const n = Number(pub.body?.min_players_to_start?.[fid]);
      if (Number.isFinite(n) && n >= 2) minPlayers = Math.max(n, floor);
    }
    return minPlayers;
  };

  await runFormatToast(atok, stamp, ko, "ko", enrollable, readyStatus, minFor(ko));
  await runFormatToast(atok, stamp, rr, "rr", enrollable, readyStatus, minFor(rr));
  await runFormatToast(atok, stamp, swiss, "swiss", enrollable, readyStatus, minFor(swiss));
  await runFormatToast(
    atok,
    stamp,
    groups,
    "groups",
    enrollable,
    readyStatus,
    minFor(groups, 8),
    groupPhase,
  );

  console.log("E2E_PASS: competition points awarded notification (KO + RR + Swiss + Groups)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
