/**
 * E2E: tournament report create → admin list → open report blocks prize settle → dismiss → settle ok.
 * Usage: node scripts/e2e-platform-tournament-report-check.mjs
 */
import { execFileSync } from "node:child_process";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gql = `${base.replace(/\/api\/v1$/, "")}/graphql`;
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

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
    const t = await r.text();
    let body;
    try {
      body = JSON.parse(t);
    } catch {
      body = t;
    }
    const retryable = r.status === 429 || r.status === 502 || r.status === 503;
    if (!retryable || attempt === maxAttempts) {
      return { status: r.status, body };
    }
    await sleep(1000 * attempt);
  }
  return { status: 503, body: { error: "transient upstream" } };
}

async function session(username, email, role) {
  const body = { username, email };
  if (role) body.role = role;
  const r = await req("/auth/e2e/session", { method: "POST", body: JSON.stringify(body) });
  if (r.status !== 200) throw new Error(`session ${username} ${r.status}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

function sql(q) {
  return execFileSync(
    "docker",
    ["exec", pgContainer, "psql", "-U", pgUser, "-d", pgDb, "-t", "-A", "-c", q],
    { encoding: "utf8" },
  ).trim();
}

const adm = await session("smoke_rep5_adm", "smoke_rep5_adm@ex.com", "admin");
const players = [];
for (let i = 0; i < 4; i++) {
  players.push(await session(`smoke_rep5_p${i}`, `smoke_rep5_p${i}@ex.com`));
}

const chrome = await req("/public/tournaments-player-chrome");
assert(
  chrome.status === 200 && String(chrome.body.report_action || "").trim(),
  "player chrome report_action",
);

const g = await fetch(gql, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${adm.tok}` },
  body: JSON.stringify({
    query: `mutation CreateReportSmoke($title: String!, $formatId: String) {
      createTournament(
        title: $title
        isFree: true
        entryFeeAmount: 0
        entryFeeCurrency: "USD"
        formatId: $formatId
      ) { id formatId status }
    }`,
    variables: { title: "Report Smoke", formatId: "knockout" },
  }),
});
const gj = await g.json();
const tid = gj?.data?.createTournament?.id;
assert(!!tid, `create cup ${JSON.stringify(gj).slice(0, 200)}`);
const tidSql = String(tid).replace(/'/g, "");

const enums = await req("/platform/enums", { headers: { Authorization: `Bearer ${adm.tok}` } });
const openStatus = enums.body.enrollable_tournament_status || "open";
const pendingPrize = enums.body.competition_prize_payout_pending || "pending";
let r = await req(`/console/tournaments/${tid}/status`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${adm.tok}` },
  body: JSON.stringify({ status: openStatus }),
});
assert(r.status === 200, `open ${r.status}`);

for (const p of players) {
  r = await req(`/tournaments/${tid}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.tok}` },
  });
  assert(r.status === 201 || r.status === 200, `enroll ${r.status}`);
  r = await req(`/tournaments/${tid}/check-in`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.tok}` },
  });
  assert(r.status === 200, `check-in ${r.status}`);
}

r = await req(`/console/tournaments/${tid}/start`, {
  method: "POST",
  headers: { Authorization: `Bearer ${adm.tok}` },
});
assert(r.status === 200, `start ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);

const cat = await req("/events/catalog", {
  headers: { Authorization: `Bearer ${players[0].tok}` },
});
const reason = (cat.body.report_reason_codes || [])[0];
assert(!!reason, "catalog report reason");

r = await req(`/tournaments/${tid}/report`, {
  method: "POST",
  headers: { Authorization: `Bearer ${players[0].tok}` },
  body: JSON.stringify({ reason_code: reason, note: "smoke" }),
});
assert(r.status === 201, `report ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
const reportId = r.body.id;

const list = await req("/console/tournaments/reports?status=open&skip=0&limit=20", {
  headers: { Authorization: `Bearer ${adm.tok}` },
});
assert(
  list.status === 200,
  `list reports ${list.status} ${JSON.stringify(list.body).slice(0, 160)}`,
);
assert(
  (list.body.reports || []).some((x) => x.id === reportId),
  "admin sees open report",
);

const readyStatuses = new Set(
  [enums.body.tournament_bracket_ready, enums.body.hosted_event_bracket_ready, "ready"]
    .map((s) => String(s || "").trim())
    .filter(Boolean),
);

async function loadBracket() {
  const br = await req(`/tournaments/${tid}/bracket`, {
    headers: { Authorization: `Bearer ${adm.tok}` },
  });
  return br.body?.bracket || br.body?.matches || [];
}

for (let pass = 0; pass < 16; pass++) {
  const finishedAtLoop = sql(
    `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tidSql}'`,
  );
  if (finishedAtLoop.length > 0) break;
  const bracket = await loadBracket();
  const playable = bracket.find(
    (m) =>
      readyStatuses.has(String(m.status || "").trim()) &&
      m.player_a_id &&
      m.player_b_id &&
      !m.is_bye,
  );
  assert(!!playable, `ready match for forfeit pass ${pass}`);
  const forfeit = await req(`/console/tournaments/${tid}/bracket/${playable.id}/forfeit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adm.tok}` },
    body: JSON.stringify({ user_id: playable.player_b_id }),
  });
  assert(forfeit.status === 200, `forfeit pass ${pass} ${forfeit.status}`);
}

const finishedAt = sql(
  `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tidSql}'`,
);
assert(finishedAt.length > 0, "tournament finished_at set");

const winnerUid = String(players[0].uid).replace(/'/g, "");
sql(`
  INSERT INTO competition_prize_payouts (
    entity_kind, entity_id, user_id, placement, amount, currency, status, created_at, updated_at
  ) VALUES (
    'tournament', '${tidSql}', '${winnerUid}', 1, 25, 'USD', '${String(pendingPrize).replace(/'/g, "")}', NOW(), NOW()
  )
  ON CONFLICT (entity_kind, entity_id, user_id, placement) DO UPDATE
  SET amount = EXCLUDED.amount, status = EXCLUDED.status, updated_at = NOW();
`);
sql(`
  UPDATE tournaments
  SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
  WHERE id='${tidSql}';
`);

const pendingStatus = String(pendingPrize).replace(/'/g, "");
const pendingBefore = Number(
  sql(
    `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tidSql}' AND status='${pendingStatus}'`,
  ) || 0,
);
assert(pendingBefore > 0, `seeded pending payout n=${pendingBefore}`);

const blocked = await req("/console/competitions/settle-prizes", {
  method: "POST",
  headers: { Authorization: `Bearer ${adm.tok}` },
  body: JSON.stringify({}),
});
assert(blocked.status === 200, `settle while open report ${blocked.status}`);
const stillPending = Number(
  sql(
    `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tidSql}' AND status='${pendingStatus}'`,
  ) || 0,
);
assert(stillPending > 0, "open report keeps this cup payout pending");

const d = await req(`/console/tournaments/reports/${reportId}/dismiss`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${adm.tok}` },
});
assert(d.status === 200, `dismiss ${d.status}`);

const settled = await req("/console/competitions/settle-prizes", {
  method: "POST",
  headers: { Authorization: `Bearer ${adm.tok}` },
  body: JSON.stringify({}),
});
assert(settled.status === 200, `settle after dismiss ${settled.status}`);
const settledCount = Number(
  sql(
    `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tidSql}' AND status='settled'`,
  ) || 0,
);
assert(settledCount > 0, `this cup payout settled after dismiss n=${settledCount}`);

await req(`/console/tournaments/${tid}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${adm.tok}` },
});
console.log("ALL REPORT SMOKE PASSED");
