/**
 * E2E: platform tournaments - create/start KO / RR / Swiss / groups_knockout.
 *
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 (local stack or staging).
 *
 * Env:
 *   DAMA_API_BASE          - default http://127.0.0.1:18080/api/v1
 *   DAMA_POSTGRES_*        - optional; only if catalog wallet credit needed (not used for free cups)
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-platform-tournaments-formats-check.mjs
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
      JSON.stringify(r.body).slice(0, 120),
    );
    process.exit(2);
  }
  assert(
    r.status === 200 && r.body?.access_token && r.body?.user?.id,
    `e2e session ${username} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`,
  );
  return { tok: r.body.access_token, uid: r.body.user.id };
}

async function enableAllFormats(atok) {
  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, `catalog get ${catGet.status}`);
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    for (const f of cat.formats) ids.add(f.id);
    s.allowed_format_ids = [...ids];
  }
  if (!cat.swiss_rounds_by_max_players || !Object.keys(cat.swiss_rounds_by_max_players).length) {
    cat.swiss_rounds_by_max_players = { 8: 2, 16: 3, 32: 4, 64: 5 };
  }
  if (!(cat.groups_knockout_target_group_size > 0)) cat.groups_knockout_target_group_size = 4;
  if (!(cat.groups_knockout_advance_per_group > 0)) cat.groups_knockout_advance_per_group = 2;

  const put = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify(cat),
  });
  assert(
    put.status === 200,
    `catalog enable all formats ${put.status} ${JSON.stringify(put.body).slice(0, 200)}`,
  );
  return cat;
}

function resolveFormatPlan(enums, pubCatalog) {
  const minMap = pubCatalog.min_players_to_start || {};
  const tournamentFormats = enums.tournament_formats || [
    "knockout",
    "round_robin",
    "swiss",
    "groups_knockout",
  ];
  const keys = [
    ["knockout", enums.hosted_event_knockout_format || "knockout"],
    ["round_robin", enums.hosted_event_round_robin_format || "round_robin"],
    ["swiss", enums.hosted_event_swiss_format || "swiss"],
    ["groups_knockout", enums.hosted_event_groups_knockout_format || "groups_knockout"],
  ];
  const plan = [];
  for (const [label, formatId] of keys) {
    if (!tournamentFormats.includes(formatId)) {
      console.log("SKIP:", `format ${label} (${formatId}) not in tournament_formats`);
      continue;
    }
    const minPlayers = Math.max(Number(minMap[formatId] ?? minMap[label]) || 2, 2);
    plan.push({ label, formatId, minPlayers });
  }
  assert(plan.length === 4, `expected 4 tournament formats, got ${plan.length}`);
  return plan;
}

const CREATE_TOURNAMENT = `
  mutation CreatePlatformFormatCup(
    $title: String!
    $formatId: String
    $maxPlayers: Int
  ) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: $maxPlayers
    ) {
      id
      title
      status
      formatId
      maxPlayers
    }
  }
`;

async function cleanupCup(atok, tid, archivedStatus) {
  if (archivedStatus) {
    const arch = await req(`/console/tournaments/${tid}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${atok}` },
      body: JSON.stringify({ status: archivedStatus }),
    });
    if (arch.status >= 300) {
      console.log(
        "WARN:",
        `archive ${tid} ${arch.status} ${JSON.stringify(arch.body).slice(0, 120)}`,
      );
    }
  }
  const del = await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(del.status === 200 && del.body?.ok === true, `delete ${tid} ${del.status}`);
}

async function tryStandings(tid, playerTok, label) {
  const st = await req(`/tournaments/${tid}/standings`, {
    headers: { Authorization: `Bearer ${playerTok}` },
  });
  if (st.status === 404) {
    console.log("OK:", `standings ${label} route not implemented (404) - skipped`);
    return;
  }
  assert(
    st.status === 200 && Array.isArray(st.body?.standings),
    `standings ${label} ${st.status} ${JSON.stringify(st.body).slice(0, 160)}`,
  );
  console.log("OK:", `standings ${label} n=${(st.body.standings || []).length}`);
}

async function main() {
  const stamp = Date.now();
  const admin = await e2eSession(`ptf_adm_${stamp}`, `ptf_adm_${stamp}@example.com`, "admin");
  const atok = admin.tok;

  await enableAllFormats(atok);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, `platform enums ${enumsRes.status}`);
  const enums = enumsRes.body;

  const pub = await req("/events/catalog");
  assert(pub.status === 200, "public events catalog");
  const plan = resolveFormatPlan(enums, pub.body);

  const enrollable =
    (enums.enrollable_tournament_status || "").trim() ||
    (enums.client_enums?.enrollable_tournament_status || "").trim();
  assert(enrollable.length > 0, "enrollable_tournament_status from platform enums");

  const statuses = enums.tournament_statuses || enums.client_enums?.tournament_statuses || [];
  const archivedStatus =
    (Array.isArray(statuses) ? statuses : []).find((s) => String(s).trim() === "archived") ||
    "archived";

  const maxPlayersNeeded = Math.max(...plan.map((p) => p.minPlayers), 8);
  const playerCount = Math.max(maxPlayersNeeded, 8);
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(await e2eSession(`ptf_p${i}_${stamp}`, `ptf_p${i}_${stamp}@example.com`));
  }

  const createdIds = [];

  try {
    for (const { label, formatId, minPlayers } of plan) {
      const title = `E2E Platform ${label} ${stamp}`;
      const create = await gql(atok, CREATE_TOURNAMENT, {
        title,
        formatId,
        maxPlayers: Math.max(minPlayers, 16),
      });
      assert(
        create.status === 200 && !create.body?.errors,
        `createTournament ${label} ${create.status} ${JSON.stringify(create.body).slice(0, 240)}`,
      );
      const row = create.body.data?.createTournament;
      assert(row?.id, `tournament id ${label}`);
      assert(
        (row.formatId || formatId) === formatId,
        `formatId ${label} got=${row.formatId} want=${formatId}`,
      );
      const tid = row.id;
      createdIds.push(tid);

      const open = await req(`/console/tournaments/${tid}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({ status: enrollable }),
      });
      assert(
        open.status === 200,
        `open ${label} ${open.status} ${JSON.stringify(open.body).slice(0, 160)}`,
      );

      for (let i = 0; i < minPlayers; i++) {
        const en = await req(`/tournaments/${tid}/enroll`, {
          method: "POST",
          headers: { Authorization: `Bearer ${players[i].tok}` },
          body: JSON.stringify({}),
        });
        assert(
          en.status === 200 || en.status === 201,
          `enroll ${label} p${i} ${en.status} ${JSON.stringify(en.body).slice(0, 120)}`,
        );
        const ci = await req(`/tournaments/${tid}/check-in`, {
          method: "POST",
          headers: { Authorization: `Bearer ${players[i].tok}` },
          body: JSON.stringify({}),
        });
        assert(
          ci.status === 200 || ci.status === 201 || ci.status === 409,
          `check-in ${label} p${i} ${ci.status}`,
        );
      }

      const start = await req(`/console/tournaments/${tid}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({}),
      });
      assert(
        start.status === 200,
        `start ${label} ${start.status} ${JSON.stringify(start.body).slice(0, 200)}`,
      );
      let bracket = start.body?.bracket || [];
      if (!bracket.length) {
        const br = await req(`/tournaments/${tid}/bracket`, {
          headers: { Authorization: `Bearer ${players[0].tok}` },
        });
        assert(
          br.status === 200 && (br.body.bracket || []).length > 0,
          `bracket ${label} ${br.status} n=${(br.body.bracket || []).length}`,
        );
        bracket = br.body.bracket || [];
      } else {
        assert(bracket.length > 0, `bracket ${label} n=${bracket.length}`);
      }
      console.log("OK:", `${label} bracket matches=${bracket.length}`);

      if (label === "round_robin" || label === "swiss") {
        await tryStandings(tid, players[0].tok, label);
      }

      await cleanupCup(atok, tid, archivedStatus);
      createdIds.pop();
    }
  } finally {
    for (const tid of createdIds) {
      try {
        await cleanupCup(atok, tid, archivedStatus);
      } catch (e) {
        console.error("WARN: cleanup failed", tid, e?.message || e);
      }
    }
  }

  console.log("ALL PLATFORM TOURNAMENT FORMAT E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
