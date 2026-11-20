/**
 * E2E guards: admin payout-defaults CRUD, KO dual_purse + score_share allowed (+ places% still ok),
 * GraphQL create KO dual_purse/score_share, classic post-start enroll block, arena pairing round-trip.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-payout-guards-check.mjs
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
  assert(r.status === 200 && r.body?.access_token && r.body?.user?.id, `session ${username}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

const CREATE_PAID = `
  mutation($title: String!, $formatId: String, $maxPlayers: Int, $fee: Float) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: $maxPlayers
      prizePoolDisplayEnabled: true
      prizePoolAmount: 10
      prizePoolCurrency: "USD"
    ) { id formatId }
  }
`;

const CREATE_PAID_MODE = `
  mutation(
    $title: String!
    $formatId: String
    $maxPlayers: Int
    $fee: Float
    $mode: String!
    $percents: String
  ) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: $maxPlayers
      prizePoolDisplayEnabled: true
      prizePoolAmount: 10
      prizePoolCurrency: "USD"
      prizePayoutMode: $mode
      prizePlacePercents: $percents
    ) { id formatId prizePayoutMode prizePlacePercents }
  }
`;

const CREATE_FREE = `
  mutation($title: String!, $formatId: String, $maxPlayers: Int) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: $maxPlayers
    ) { id formatId }
  }
`;

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`pdg_adm_${stamp}`, `pdg_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  // ---- Admin payout-defaults CRUD round-trip ----
  const getDef = await req("/console/competition/payout-defaults-settings", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(getDef.status === 200, `get payout-defaults ${getDef.status}`);
  const before = getDef.body || {};
  assert(
    String(before.competition_default_payout_mode_arena || "").trim(),
    "default arena payout mode from DB",
  );
  assert(
    String(before.competition_default_payout_mode_knockout || "").trim(),
    "default KO payout mode from DB",
  );
  const putSame = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: before.competition_default_payout_mode_knockout,
      competition_default_payout_mode_round_robin:
        before.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        before.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
      competition_default_place_percent_1: before.competition_default_place_percent_1,
      competition_default_place_percent_2: before.competition_default_place_percent_2,
      competition_default_place_percent_3: before.competition_default_place_percent_3,
      competition_dual_purse_place_percent: before.competition_dual_purse_place_percent,
    }),
  });
  assert(
    putSame.status === 200,
    `put payout-defaults ${putSame.status} ${JSON.stringify(putSame.body).slice(0, 180)}`,
  );
  assert(
    String(putSame.body?.competition_default_payout_mode_arena || "") ===
      String(before.competition_default_payout_mode_arena || ""),
    "payout-defaults arena mode round-trip",
  );

  // Dual purse (mig 374) must be selectable as a format default without changing other defaults.
  const dualMode = String(before.competition_payout_mode_dual_purse || "").trim();
  const dualPlacePct = String(before.competition_dual_purse_place_percent || "").trim();
  assert(dualMode, "dual_purse enum from payout-defaults payload");
  assert(dualPlacePct, "dual_purse place percent from payout-defaults payload");

  // Place-purse % of pot must round-trip (admin PKO split setting).
  const flippedDualPlacePct = dualPlacePct === "60" ? "55" : "60";
  const putDualPlace = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: before.competition_default_payout_mode_knockout,
      competition_default_payout_mode_round_robin:
        before.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        before.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
      competition_default_place_percent_1: before.competition_default_place_percent_1,
      competition_default_place_percent_2: before.competition_default_place_percent_2,
      competition_default_place_percent_3: before.competition_default_place_percent_3,
      competition_dual_purse_place_percent: flippedDualPlacePct,
    }),
  });
  assert(
    putDualPlace.status === 200,
    `dual place % PUT ${putDualPlace.status} ${JSON.stringify(putDualPlace.body).slice(0, 160)}`,
  );
  assert(
    String(putDualPlace.body?.competition_dual_purse_place_percent || "").trim() ===
      flippedDualPlacePct,
    `dual place % PUT body got ${putDualPlace.body?.competition_dual_purse_place_percent}`,
  );
  const getDualPlace = await req("/console/competition/payout-defaults-settings", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(getDualPlace.status === 200, `dual place % GET ${getDualPlace.status}`);
  assert(
    String(getDualPlace.body?.competition_dual_purse_place_percent || "").trim() ===
      flippedDualPlacePct,
    `dual place % GET got ${getDualPlace.body?.competition_dual_purse_place_percent}`,
  );
  const restoreDualPlace = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: before.competition_default_payout_mode_knockout,
      competition_default_payout_mode_round_robin:
        before.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        before.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
      competition_default_place_percent_1: before.competition_default_place_percent_1,
      competition_default_place_percent_2: before.competition_default_place_percent_2,
      competition_default_place_percent_3: before.competition_default_place_percent_3,
      competition_dual_purse_place_percent: dualPlacePct,
    }),
  });
  assert(restoreDualPlace.status === 200, `dual place % restore ${restoreDualPlace.status}`);
  assert(
    String(restoreDualPlace.body?.competition_dual_purse_place_percent || "").trim() ===
      dualPlacePct,
    "dual place % restored",
  );

  // Invalid place-purse % of pot must be rejected (1–99 only); value unchanged.
  const dualPlaceBase = {
    competition_default_payout_mode_knockout: before.competition_default_payout_mode_knockout,
    competition_default_payout_mode_round_robin: before.competition_default_payout_mode_round_robin,
    competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
    competition_default_payout_mode_groups_knockout:
      before.competition_default_payout_mode_groups_knockout,
    competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
    competition_default_place_percent_1: before.competition_default_place_percent_1,
    competition_default_place_percent_2: before.competition_default_place_percent_2,
    competition_default_place_percent_3: before.competition_default_place_percent_3,
  };
  // Empty omit falls back to current (PATCH semantics); only out-of-bounds / non-numeric reject.
  for (const bad of ["0", "100", "abc"]) {
    const putBad = await req("/console/competition/payout-defaults-settings", {
      method: "PUT",
      headers: { Authorization: `Bearer ${atok}` },
      body: JSON.stringify({
        ...dualPlaceBase,
        competition_dual_purse_place_percent: bad,
      }),
    });
    assert(
      putBad.status === 400,
      `dual place % reject ${JSON.stringify(bad)} status ${putBad.status} ${JSON.stringify(putBad.body).slice(0, 120)}`,
    );
  }
  const getAfterBad = await req("/console/competition/payout-defaults-settings", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(getAfterBad.status === 200, `dual place % GET after rejects ${getAfterBad.status}`);
  assert(
    String(getAfterBad.body?.competition_dual_purse_place_percent || "").trim() === dualPlacePct,
    `dual place % unchanged after rejects got ${getAfterBad.body?.competition_dual_purse_place_percent}`,
  );

  const putKoDual = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: dualMode,
      competition_default_payout_mode_round_robin:
        before.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        before.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
      competition_default_place_percent_1: before.competition_default_place_percent_1,
      competition_default_place_percent_2: before.competition_default_place_percent_2,
      competition_default_place_percent_3: before.competition_default_place_percent_3,
      competition_dual_purse_place_percent: dualPlacePct,
    }),
  });
  assert(
    putKoDual.status === 200,
    `KO default dual_purse allowed ${putKoDual.status} ${JSON.stringify(putKoDual.body).slice(0, 160)}`,
  );
  assert(
    String(putKoDual.body?.competition_default_payout_mode_knockout || "").trim() === dualMode,
    "KO default dual_purse persisted",
  );

  // KO may be defaulted to score_share (places% remains alternate); restore original after.
  const scoreMode = String(before.competition_payout_mode_score_share || "").trim();
  assert(scoreMode, "score_share enum from payout-defaults payload");
  const putKoScore = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: scoreMode,
      competition_default_payout_mode_round_robin:
        before.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        before.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
      competition_default_place_percent_1: before.competition_default_place_percent_1,
      competition_default_place_percent_2: before.competition_default_place_percent_2,
      competition_default_place_percent_3: before.competition_default_place_percent_3,
      competition_dual_purse_place_percent: dualPlacePct,
    }),
  });
  assert(
    putKoScore.status === 200,
    `KO default score_share allowed ${putKoScore.status} ${JSON.stringify(putKoScore.body).slice(0, 160)}`,
  );
  assert(
    String(putKoScore.body?.competition_default_payout_mode_knockout || "").trim() === scoreMode,
    "KO default score_share persisted",
  );
  const restoreKo = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: before.competition_default_payout_mode_knockout,
      competition_default_payout_mode_round_robin:
        before.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: before.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        before.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: before.competition_default_payout_mode_arena,
      competition_default_place_percent_1: before.competition_default_place_percent_1,
      competition_default_place_percent_2: before.competition_default_place_percent_2,
      competition_default_place_percent_3: before.competition_default_place_percent_3,
      competition_dual_purse_place_percent: dualPlacePct,
    }),
  });
  assert(restoreKo.status === 200, `restore KO default ${restoreKo.status}`);

  const enumsRes = await req("/platform/enums", { headers: { Authorization: `Bearer ${atok}` } });
  assert(enumsRes.status === 200, `enums ${enumsRes.status}`);
  const enums = enumsRes.body || {};
  const ko = String(enums.hosted_event_knockout_format || "").trim();
  const rr = String(enums.hosted_event_round_robin_format || "").trim();
  const placesMode = String(enums.competition_payout_mode_places_percent || "").trim();
  const enrollable = String(enums.enrollable_tournament_status || "open").trim();
  assert(ko && rr && placesMode && scoreMode && dualMode, "format + payout modes from DB");

  // Ensure catalog allows formats
  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, "catalog get");
  const cat = { ...catGet.body };
  cat.source = undefined;
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

  // ---- GraphQL create KO with explicit dual_purse (+ place percents) ----
  const koGqlDual = await gql(atok, CREATE_PAID_MODE, {
    title: `KO GQL DualPurse ${stamp}`,
    formatId: ko,
    maxPlayers: 4,
    fee: 10,
    mode: dualMode,
    percents: JSON.stringify({ 1: 50, 2: 30, 3: 20 }),
  });
  assert(
    koGqlDual.status === 200 && !koGqlDual.body?.errors,
    `ko gql dual_purse create ${JSON.stringify(koGqlDual.body).slice(0, 220)}`,
  );
  assert(
    String(koGqlDual.body?.data?.createTournament?.prizePayoutMode || "").trim() === dualMode,
    "ko gql create prizePayoutMode dual_purse",
  );
  {
    const raw = String(koGqlDual.body?.data?.createTournament?.prizePlacePercents || "").trim();
    assert(raw, "ko gql dual_purse prizePlacePercents persisted");
    const pct = JSON.parse(raw);
    assert(
      Number(pct["1"]) === 50 && Number(pct["2"]) === 30 && Number(pct["3"]) === 20,
      `ko gql dual percents ${raw}`,
    );
  }
  await req(`/console/tournaments/${koGqlDual.body.data.createTournament.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- GraphQL dual_purse + place percents that do not sum to 100 → reject ----
  const koGqlDualBadPct = await gql(atok, CREATE_PAID_MODE, {
    title: `KO GQL DualPurse BadPct ${stamp}`,
    formatId: ko,
    maxPlayers: 4,
    fee: 10,
    mode: dualMode,
    percents: JSON.stringify({ 1: 50, 2: 30, 3: 10 }),
  });
  assert(
    Array.isArray(koGqlDualBadPct.body?.errors) && koGqlDualBadPct.body.errors.length > 0,
    `ko gql dual bad place% sum must error got ${JSON.stringify(koGqlDualBadPct.body).slice(0, 220)}`,
  );
  assert(
    !koGqlDualBadPct.body?.data?.createTournament?.id,
    "ko gql dual bad place% must not create tournament",
  );

  // ---- GraphQL dual_purse omit percents → DB default place percents ----
  const koGqlDualDefault = await gql(atok, CREATE_PAID_MODE, {
    title: `KO GQL DualPurse Defaults ${stamp}`,
    formatId: ko,
    maxPlayers: 4,
    fee: 10,
    mode: dualMode,
    percents: null,
  });
  assert(
    koGqlDualDefault.status === 200 && !koGqlDualDefault.body?.errors,
    `ko gql dual_purse default percents create ${JSON.stringify(koGqlDualDefault.body).slice(0, 220)}`,
  );
  assert(
    String(koGqlDualDefault.body?.data?.createTournament?.prizePayoutMode || "").trim() ===
      dualMode,
    "ko gql dual omit-percents mode",
  );
  {
    const raw = String(
      koGqlDualDefault.body?.data?.createTournament?.prizePlacePercents || "",
    ).trim();
    assert(raw, "ko gql dual omit-percents → enum defaults persisted");
    const pct = JSON.parse(raw);
    const d1 = Number(String(before.competition_default_place_percent_1 || "").trim());
    const d2 = Number(String(before.competition_default_place_percent_2 || "").trim());
    const d3 = Number(String(before.competition_default_place_percent_3 || "").trim());
    assert(
      Number(pct["1"]) === d1 && Number(pct["2"]) === d2 && Number(pct["3"]) === d3,
      `ko gql dual default percents ${raw} vs enums ${d1}/${d2}/${d3}`,
    );
  }
  await req(`/console/tournaments/${koGqlDualDefault.body.data.createTournament.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- GraphQL create KO with explicit score_share (create-time, not only PUT) ----
  const koGqlScore = await gql(atok, CREATE_PAID_MODE, {
    title: `KO GQL ScoreShare ${stamp}`,
    formatId: ko,
    maxPlayers: 4,
    fee: 10,
    mode: scoreMode,
    percents: null,
  });
  assert(
    koGqlScore.status === 200 && !koGqlScore.body?.errors,
    `ko gql score_share create ${JSON.stringify(koGqlScore.body).slice(0, 220)}`,
  );
  assert(
    String(koGqlScore.body?.data?.createTournament?.prizePayoutMode || "").trim() === scoreMode,
    "ko gql create prizePayoutMode score_share",
  );
  await req(`/console/tournaments/${koGqlScore.body.data.createTournament.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- KO tournament may set dual_purse via console PUT ----
  const koDualCreate = await gql(atok, CREATE_PAID, {
    title: `KO Dual Guard ${stamp}`,
    formatId: ko,
    maxPlayers: 4,
    fee: 10,
  });
  assert(
    koDualCreate.status === 200 && !koDualCreate.body?.errors,
    `ko dual create ${JSON.stringify(koDualCreate.body).slice(0, 200)}`,
  );
  const koDualId = koDualCreate.body.data.createTournament.id;
  const koDualPut = await req(`/console/tournaments/${koDualId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      title: `KO Dual Guard ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: 10,
      entry_fee_currency: "USD",
      prize_pool_amount: 10,
      prize_pool_currency: "USD",
      prize_pool_display_enabled: true,
      max_players: 4,
      format_id: ko,
      prize_payout_mode: dualMode,
      prize_place_percents: { 1: 50, 2: 30, 3: 20 },
    }),
  });
  assert(
    koDualPut.status === 200,
    `KO dual_purse allowed ${koDualPut.status} ${JSON.stringify(koDualPut.body).slice(0, 180)}`,
  );
  assert(
    String(koDualPut.body?.prize_payout_mode || "").trim() === dualMode,
    "KO dual_purse persisted",
  );
  // Console PUT dual + place percents that do not sum to 100 → reject (create path already covered).
  const koDualBadPctPut = await req(`/console/tournaments/${koDualId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      title: `KO Dual Guard ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: 10,
      entry_fee_currency: "USD",
      prize_pool_amount: 10,
      prize_pool_currency: "USD",
      prize_pool_display_enabled: true,
      max_players: 4,
      format_id: ko,
      prize_payout_mode: dualMode,
      prize_place_percents: { 1: 50, 2: 30, 3: 10 },
    }),
  });
  assert(
    koDualBadPctPut.status === 400,
    `KO dual PUT bad place% status ${koDualBadPctPut.status} ${JSON.stringify(koDualBadPctPut.body).slice(0, 160)}`,
  );
  {
    const raw = sql(
      `SELECT COALESCE(prize_place_percents::text,'') FROM tournaments WHERE id='${koDualId}'`,
    );
    assert(
      raw.includes('"1": 50') || raw.includes('"1":50'),
      `KO dual place% unchanged after bad PUT got ${raw}`,
    );
    assert(
      raw.includes('"2": 30') || raw.includes('"2":30'),
      `KO dual place% 2 unchanged got ${raw}`,
    );
    assert(
      raw.includes('"3": 20') || raw.includes('"3":20'),
      `KO dual place% 3 unchanged got ${raw}`,
    );
  }
  await req(`/console/tournaments/${koDualId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- KO tournament may set score_share; places_percent still allowed ----
  const koCreate = await gql(atok, CREATE_PAID, {
    title: `KO Guard ${stamp}`,
    formatId: ko,
    maxPlayers: 4,
    fee: 10,
  });
  assert(
    koCreate.status === 200 && !koCreate.body?.errors,
    `ko create ${JSON.stringify(koCreate.body).slice(0, 200)}`,
  );
  const koId = koCreate.body.data.createTournament.id;
  const koScore = await req(`/console/tournaments/${koId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      title: `KO Guard ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: 10,
      entry_fee_currency: "USD",
      prize_pool_amount: 10,
      prize_pool_currency: "USD",
      prize_pool_display_enabled: true,
      max_players: 4,
      format_id: ko,
      prize_payout_mode: scoreMode,
      prize_place_percents: {},
    }),
  });
  assert(
    koScore.status === 200,
    `KO score_share allowed ${koScore.status} ${JSON.stringify(koScore.body).slice(0, 180)}`,
  );
  assert(
    String(koScore.body?.prize_payout_mode || "").trim() === scoreMode,
    "KO score_share persisted",
  );
  const koOk = await req(`/console/tournaments/${koId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      title: `KO Guard ${stamp}`,
      description: "",
      is_free: false,
      entry_fee_amount: 10,
      entry_fee_currency: "USD",
      prize_pool_amount: 10,
      prize_pool_currency: "USD",
      prize_pool_display_enabled: true,
      max_players: 4,
      format_id: ko,
      prize_payout_mode: placesMode,
      prize_place_percents: { 1: 70, 2: 30 },
    }),
  });
  assert(koOk.status === 200, `KO places_percent allowed ${koOk.status}`);
  await req(`/console/tournaments/${koId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- Classic RR: enroll after start blocked ----
  let minPlayers = 4;
  const pub = await req("/events/catalog", { headers: { Authorization: `Bearer ${atok}` } });
  if (pub.status === 200) {
    const n = Number(pub.body?.min_players_to_start?.[rr]);
    if (Number.isFinite(n) && n >= 2) minPlayers = Math.max(n, 4);
  }
  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    players.push(await e2eSession(`pdg_p${i}_${stamp}`, `pdg_p${i}_${stamp}@ex.com`));
  }
  const late = await e2eSession(`pdg_late_${stamp}`, `pdg_late_${stamp}@ex.com`);

  const rrCreate = await gql(atok, CREATE_FREE, {
    title: `RR EnrollGuard ${stamp}`,
    formatId: rr,
    maxPlayers: Math.max(minPlayers + 2, 8),
  });
  assert(
    rrCreate.status === 200 && !rrCreate.body?.errors,
    `rr create ${JSON.stringify(rrCreate.body).slice(0, 160)}`,
  );
  const rrId = rrCreate.body.data.createTournament.id;
  assert(
    (
      await req(`/console/tournaments/${rrId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${atok}` },
        body: JSON.stringify({ status: enrollable }),
      })
    ).status === 200,
    "rr open",
  );
  for (const p of players) {
    const en = await req(`/tournaments/${rrId}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `rr enroll ${en.status}`);
    await req(`/tournaments/${rrId}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
  }
  const start = await req(`/console/tournaments/${rrId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `rr start ${start.status}`);
  const lateEn = await req(`/tournaments/${rrId}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${late.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    lateEn.status === 409,
    `classic post-start enroll blocked ${lateEn.status} ${JSON.stringify(lateEn.body).slice(0, 160)}`,
  );
  await req(`/console/tournaments/${rrId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- Arena pairing mode round-trip (rating ↔ score) ----
  const getArena = await req("/console/competition/arena-settings", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(getArena.status === 200, `get arena-settings ${getArena.status}`);
  const arenaBefore = getArena.body || {};
  const modes = arenaBefore.competition_arena_pairing_modes || [];
  const curMode = String(arenaBefore.competition_arena_default_pairing_mode || "").trim();
  assert(curMode && Array.isArray(modes) && modes.length >= 2, "pairing modes from DB");
  const alt = modes.map((m) => String(m).trim()).find((m) => m && m !== curMode);
  assert(alt, `alternate pairing mode (have=${modes.join(",")})`);
  const flip = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_arena_points_win: arenaBefore.competition_arena_points_win,
      competition_arena_points_draw: arenaBefore.competition_arena_points_draw,
      competition_arena_points_loss: arenaBefore.competition_arena_points_loss,
      competition_arena_streak_second_win: arenaBefore.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: arenaBefore.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes:
        arenaBefore.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: alt,
      competition_arena_auto_start: arenaBefore.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: arenaBefore.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: arenaBefore.competition_arena_allow_join_while_live,
    }),
  });
  assert(flip.status === 200, `flip pairing ${flip.status}`);
  assert(
    String(flip.body?.competition_arena_default_pairing_mode || "") === alt,
    `pairing flipped to ${alt}`,
  );
  const restore = await req("/console/competition/arena-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      competition_arena_points_win: arenaBefore.competition_arena_points_win,
      competition_arena_points_draw: arenaBefore.competition_arena_points_draw,
      competition_arena_points_loss: arenaBefore.competition_arena_points_loss,
      competition_arena_streak_second_win: arenaBefore.competition_arena_streak_second_win,
      competition_arena_streak_third_plus_win: arenaBefore.competition_arena_streak_third_plus_win,
      competition_arena_default_duration_minutes:
        arenaBefore.competition_arena_default_duration_minutes,
      competition_arena_default_pairing_mode: curMode,
      competition_arena_auto_start: arenaBefore.competition_arena_auto_start,
      competition_arena_pair_interval_seconds: arenaBefore.competition_arena_pair_interval_seconds,
      competition_arena_allow_join_while_live: arenaBefore.competition_arena_allow_join_while_live,
    }),
  });
  assert(restore.status === 200, `restore pairing ${restore.status}`);
  assert(
    String(restore.body?.competition_arena_default_pairing_mode || "") === curMode,
    "pairing mode restored",
  );

  console.log(
    "E2E_PASS: competition payout guards (defaults + KO score_share + classic enroll + pairing)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
