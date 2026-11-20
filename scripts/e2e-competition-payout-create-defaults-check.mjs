/**
 * E2E: paid create without prizePayoutMode → DB format default applied (Arena=score_share, KO=places_percent).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-payout-create-defaults-check.mjs
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

function creditWallet(userId, currency, amount) {
  const id = String(userId).replace(/'/g, "");
  const cur = String(currency).replace(/'/g, "");
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${Number(amount)},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${Number(amount)}, updated_at = NOW();
  `);
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
  assert(r.status === 200 && r.body?.access_token && r.body?.user?.id, `session ${username}`);
  return { tok: r.body.access_token, uid: r.body.user.id };
}

async function passCashGate(tok, phoneSuffix) {
  const h = { Authorization: `Bearer ${tok}` };
  await req("/me/age-gate", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ date_of_birth: "1988-06-01" }),
  });
  await req("/me/phone-kyc", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ phone: `+2519${phoneSuffix}` }),
  });
  const otp = await req("/me/phone-kyc/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (otp.status < 300 && otp.body?.debug_code) {
    await req("/me/phone-kyc/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: otp.body.challenge_id,
        code: otp.body.debug_code,
      }),
    });
  }
  await req("/geo/locate", { method: "POST", headers: h, body: JSON.stringify({}) });
  const start = await req("/auth/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (start.status < 300 && start.body?.debug_code) {
    await req("/auth/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: start.body.challenge_id,
        code: start.body.debug_code,
      }),
    });
  }
}

const CREATE_NO_MODE = `
  mutation($title: String!, $fee: Float!, $cur: String!, $formatId: String, $maxPlayers: Int, $mins: Int) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: $cur
      prizePoolDisplayEnabled: true
      prizePoolAmount: 10
      prizePoolCurrency: $cur
      formatId: $formatId
      maxPlayers: $maxPlayers
      arenaDurationMinutes: $mins
    ) { id formatId prizePayoutMode }
  }
`;

async function main() {
  const stamp = Date.now().toString(36);
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const admin = await e2eSession(`pcd_adm_${stamp}`, `pcd_adm_${stamp}@ex.com`, "admin");
  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(enumsRes.status === 200, "enums");
  const enums = enumsRes.body || {};
  const arena = String(enums.hosted_event_arena_format || "").trim();
  const ko = String(enums.hosted_event_knockout_format || "").trim();
  const rr = String(enums.hosted_event_round_robin_format || "").trim();
  const swiss = String(enums.hosted_event_swiss_format || "").trim();
  const groups = String(enums.hosted_event_groups_knockout_format || "").trim();
  const score = String(enums.competition_payout_mode_score_share || "").trim();
  const places = String(enums.competition_payout_mode_places_percent || "").trim();
  const dual = String(enums.competition_payout_mode_dual_purse || "").trim();
  const dualPlacePct = String(enums.competition_dual_purse_place_percent || "").trim();
  const defArena = String(enums.competition_default_payout_mode_arena || "").trim();
  const defKo = String(enums.competition_default_payout_mode_knockout || "").trim();
  const defRr = String(enums.competition_default_payout_mode_round_robin || "").trim();
  const defSwiss = String(enums.competition_default_payout_mode_swiss || "").trim();
  const defGroups = String(enums.competition_default_payout_mode_groups_knockout || "").trim();
  assert(
    arena &&
      ko &&
      rr &&
      swiss &&
      groups &&
      score &&
      places &&
      dual &&
      dualPlacePct &&
      defArena &&
      defKo &&
      defRr &&
      defSwiss &&
      defGroups,
    "formats + defaults from DB",
  );
  assert(defArena === score, `arena default is score_share got ${defArena}`);
  assert(defKo === places, `ko default is places_percent got ${defKo}`);
  assert(defRr === places, `rr default is places_percent got ${defRr}`);
  assert(defSwiss === places, `swiss default is places_percent got ${defSwiss}`);
  assert(defGroups === places, `groups default is places_percent got ${defGroups}`);

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(catGet.status === 200, "catalog");
  const cat = { ...catGet.body };
  cat.source = undefined;
  cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
  for (const s of cat.sizes || []) {
    const ids = new Set(s.allowed_format_ids || []);
    ids.add(arena);
    ids.add(ko);
    ids.add(rr);
    ids.add(swiss);
    ids.add(groups);
    s.allowed_format_ids = [...ids];
  }
  await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify(cat),
  });

  // ---- Platform GraphQL: Arena omit mode → score_share ----
  const arenaCreate = await gql(admin.tok, CREATE_NO_MODE, {
    title: `Default Arena ${stamp}`,
    fee: 20,
    cur: "USD",
    formatId: arena,
    maxPlayers: 8,
    mins: 5,
  });
  assert(
    arenaCreate.status === 200 && !arenaCreate.body?.errors,
    `arena create ${JSON.stringify(arenaCreate.body).slice(0, 200)}`,
  );
  const arenaId = arenaCreate.body.data.createTournament.id;
  const arenaModeGql = String(arenaCreate.body.data.createTournament.prizePayoutMode || "").trim();
  const arenaModeDb = sql(
    `SELECT COALESCE(prize_payout_mode,'') FROM tournaments WHERE id='${arenaId}'`,
  );
  assert(
    arenaModeGql === defArena || arenaModeDb === defArena,
    `arena mode gql=${arenaModeGql} db=${arenaModeDb}`,
  );
  assert(arenaModeDb === defArena, `arena DB default ${arenaModeDb}`);

  // ---- Platform GraphQL: KO omit mode → places_percent + default percents ----
  const koCreate = await gql(admin.tok, CREATE_NO_MODE, {
    title: `Default KO ${stamp}`,
    fee: 20,
    cur: "USD",
    formatId: ko,
    maxPlayers: 4,
    mins: 5,
  });
  assert(
    koCreate.status === 200 && !koCreate.body?.errors,
    `ko create ${JSON.stringify(koCreate.body).slice(0, 200)}`,
  );
  const koId = koCreate.body.data.createTournament.id;
  const koModeDb = sql(`SELECT COALESCE(prize_payout_mode,'') FROM tournaments WHERE id='${koId}'`);
  assert(koModeDb === defKo, `ko DB default ${koModeDb}`);
  const pctSum = Number(
    sql(`
      SELECT COALESCE((prize_place_percents->>'1')::numeric,0)
           + COALESCE((prize_place_percents->>'2')::numeric,0)
           + COALESCE((prize_place_percents->>'3')::numeric,0)
      FROM tournaments WHERE id='${koId}'
    `) || 0,
  );
  assert(Math.abs(pctSum - 100) < 0.01, `ko default percents sum 100 got ${pctSum}`);

  // ---- Platform GraphQL: KO default temporarily dual_purse → omit mode → dual_purse ----
  const payoutDefaultsBefore = await req("/console/competition/payout-defaults-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(payoutDefaultsBefore.status === 200, "payout-defaults get before dual omit");
  const pd = payoutDefaultsBefore.body || {};
  const putKoDualDefault = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: dual,
      competition_default_payout_mode_round_robin: pd.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: pd.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        pd.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: pd.competition_default_payout_mode_arena,
      competition_default_place_percent_1: pd.competition_default_place_percent_1,
      competition_default_place_percent_2: pd.competition_default_place_percent_2,
      competition_default_place_percent_3: pd.competition_default_place_percent_3,
      competition_dual_purse_place_percent: pd.competition_dual_purse_place_percent || dualPlacePct,
    }),
  });
  assert(
    putKoDualDefault.status === 200,
    `KO default→dual PUT ${putKoDualDefault.status} ${JSON.stringify(putKoDualDefault.body).slice(0, 160)}`,
  );
  const koDualOmitCreate = await gql(admin.tok, CREATE_NO_MODE, {
    title: `Default KO DualOmit ${stamp}`,
    fee: 20,
    cur: "USD",
    formatId: ko,
    maxPlayers: 4,
    mins: 5,
  });
  assert(
    koDualOmitCreate.status === 200 && !koDualOmitCreate.body?.errors,
    `ko dual-omit create ${JSON.stringify(koDualOmitCreate.body).slice(0, 200)}`,
  );
  const koDualOmitId = koDualOmitCreate.body.data.createTournament.id;
  const koDualOmitModeDb = sql(
    `SELECT COALESCE(prize_payout_mode,'') FROM tournaments WHERE id='${koDualOmitId}'`,
  );
  assert(koDualOmitModeDb === dual, `ko dual-omit DB mode ${koDualOmitModeDb} want ${dual}`);
  const koDualOmitPctSum = Number(
    sql(`
      SELECT COALESCE((prize_place_percents->>'1')::numeric,0)
           + COALESCE((prize_place_percents->>'2')::numeric,0)
           + COALESCE((prize_place_percents->>'3')::numeric,0)
      FROM tournaments WHERE id='${koDualOmitId}'
    `) || 0,
  );
  assert(
    Math.abs(koDualOmitPctSum - 100) < 0.01,
    `ko dual-omit place percents sum 100 got ${koDualOmitPctSum}`,
  );
  const restoreKoDefault = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: defKo,
      competition_default_payout_mode_round_robin: pd.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: pd.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        pd.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: pd.competition_default_payout_mode_arena,
      competition_default_place_percent_1: pd.competition_default_place_percent_1,
      competition_default_place_percent_2: pd.competition_default_place_percent_2,
      competition_default_place_percent_3: pd.competition_default_place_percent_3,
      competition_dual_purse_place_percent: pd.competition_dual_purse_place_percent || dualPlacePct,
    }),
  });
  assert(
    restoreKoDefault.status === 200 &&
      String(restoreKoDefault.body?.competition_default_payout_mode_knockout || "").trim() ===
        defKo,
    "KO default restored after dual omit",
  );

  // ---- Platform GraphQL: RR omit mode → places_percent ----
  const rrCreate = await gql(admin.tok, CREATE_NO_MODE, {
    title: `Default RR ${stamp}`,
    fee: 20,
    cur: "USD",
    formatId: rr,
    maxPlayers: 8,
    mins: 5,
  });
  assert(
    rrCreate.status === 200 && !rrCreate.body?.errors,
    `rr create ${JSON.stringify(rrCreate.body).slice(0, 200)}`,
  );
  const rrId = rrCreate.body.data.createTournament.id;
  const rrModeDb = sql(`SELECT COALESCE(prize_payout_mode,'') FROM tournaments WHERE id='${rrId}'`);
  assert(rrModeDb === defRr, `rr DB default ${rrModeDb}`);

  // ---- Platform GraphQL: Swiss omit mode → places_percent ----
  const swissCreate = await gql(admin.tok, CREATE_NO_MODE, {
    title: `Default Swiss ${stamp}`,
    fee: 20,
    cur: "USD",
    formatId: swiss,
    maxPlayers: 8,
    mins: 5,
  });
  assert(
    swissCreate.status === 200 && !swissCreate.body?.errors,
    `swiss create ${JSON.stringify(swissCreate.body).slice(0, 200)}`,
  );
  const swissId = swissCreate.body.data.createTournament.id;
  const swissModeDb = sql(
    `SELECT COALESCE(prize_payout_mode,'') FROM tournaments WHERE id='${swissId}'`,
  );
  assert(swissModeDb === defSwiss, `swiss DB default ${swissModeDb}`);

  // ---- Platform GraphQL: Groups omit mode → places_percent ----
  const groupsCreate = await gql(admin.tok, CREATE_NO_MODE, {
    title: `Default Groups ${stamp}`,
    fee: 20,
    cur: "USD",
    formatId: groups,
    maxPlayers: 8,
    mins: 5,
  });
  assert(
    groupsCreate.status === 200 && !groupsCreate.body?.errors,
    `groups create ${JSON.stringify(groupsCreate.body).slice(0, 200)}`,
  );
  const groupsId = groupsCreate.body.data.createTournament.id;
  const groupsModeDb = sql(
    `SELECT COALESCE(prize_payout_mode,'') FROM tournaments WHERE id='${groupsId}'`,
  );
  assert(groupsModeDb === defGroups, `groups DB default ${groupsModeDb}`);

  // ---- Hosted Arena create omit mode → score_share ----
  const org = await e2eSession(`pcd_org_${stamp}`, `pcd_org_${stamp}@ex.com`);
  const size =
    (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(arena)) ||
    (cat.sizes || [])[0];
  assert(size?.id, "size");
  const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
  const hostFee = Number(size.host_fee_amount || 0);
  creditWallet(org.uid, hostCur, Math.max(hostFee * 4 + 200, 500));
  await passCashGate(org.tok, String(5930000).slice(-8));

  const hosted = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted Default Arena ${stamp}`,
      format_id: arena,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: 40,
      entry_fee_currency: hostCur,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: false,
      arena_duration_minutes: 5,
      country_code: "ET",
      auto_approve: true,
      // intentionally omit prize_payout_mode
    }),
  });
  assert(
    hosted.status === 200 || hosted.status === 201,
    `hosted create ${hosted.status} ${JSON.stringify(hosted.body).slice(0, 200)}`,
  );
  const eid = (hosted.body?.event || hosted.body)?.id;
  assert(eid, "hosted event id");
  const hostedMode = sql(
    `SELECT COALESCE(prize_payout_mode,'') FROM hosted_events WHERE id='${eid}'`,
  );
  assert(hostedMode === defArena, `hosted arena default ${hostedMode}`);

  // ---- Hosted KO create omit mode with temp dual_purse format default ----
  const koSize = (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(ko)) || size;
  assert(koSize?.id, "ko size");
  const pdHosted =
    (
      await req("/console/competition/payout-defaults-settings", {
        headers: { Authorization: `Bearer ${admin.tok}` },
      })
    ).body || {};
  const putHostedKoDual = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: dual,
      competition_default_payout_mode_round_robin:
        pdHosted.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: pdHosted.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        pdHosted.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: pdHosted.competition_default_payout_mode_arena,
      competition_default_place_percent_1: pdHosted.competition_default_place_percent_1,
      competition_default_place_percent_2: pdHosted.competition_default_place_percent_2,
      competition_default_place_percent_3: pdHosted.competition_default_place_percent_3,
      competition_dual_purse_place_percent:
        pdHosted.competition_dual_purse_place_percent || dualPlacePct,
    }),
  });
  assert(putHostedKoDual.status === 200, `hosted KO default→dual PUT ${putHostedKoDual.status}`);
  const hostedKoDual = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted KO DualOmit ${stamp}`,
      format_id: ko,
      size_id: koSize.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: 40,
      entry_fee_currency: hostCur,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: false,
      country_code: "ET",
      auto_approve: true,
      // intentionally omit prize_payout_mode → dual format default
    }),
  });
  assert(
    hostedKoDual.status === 200 || hostedKoDual.status === 201,
    `hosted KO dual-omit create ${hostedKoDual.status} ${JSON.stringify(hostedKoDual.body).slice(0, 200)}`,
  );
  const hostedKoEid = (hostedKoDual.body?.event || hostedKoDual.body)?.id;
  assert(hostedKoEid, "hosted KO dual-omit event id");
  const hostedKoMode = sql(
    `SELECT COALESCE(prize_payout_mode,'') FROM hosted_events WHERE id='${hostedKoEid}'`,
  );
  assert(hostedKoMode === dual, `hosted KO dual-omit mode ${hostedKoMode} want ${dual}`);
  const hostedKoPctSum = Number(
    sql(`
      SELECT COALESCE((prize_place_percents->>'1')::numeric,0)
           + COALESCE((prize_place_percents->>'2')::numeric,0)
           + COALESCE((prize_place_percents->>'3')::numeric,0)
      FROM hosted_events WHERE id='${hostedKoEid}'
    `) || 0,
  );
  assert(
    Math.abs(hostedKoPctSum - 100) < 0.01,
    `hosted KO dual-omit place percents sum 100 got ${hostedKoPctSum}`,
  );
  const restoreHostedKoDefault = await req("/console/competition/payout-defaults-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_default_payout_mode_knockout: defKo,
      competition_default_payout_mode_round_robin:
        pdHosted.competition_default_payout_mode_round_robin,
      competition_default_payout_mode_swiss: pdHosted.competition_default_payout_mode_swiss,
      competition_default_payout_mode_groups_knockout:
        pdHosted.competition_default_payout_mode_groups_knockout,
      competition_default_payout_mode_arena: pdHosted.competition_default_payout_mode_arena,
      competition_default_place_percent_1: pdHosted.competition_default_place_percent_1,
      competition_default_place_percent_2: pdHosted.competition_default_place_percent_2,
      competition_default_place_percent_3: pdHosted.competition_default_place_percent_3,
      competition_dual_purse_place_percent:
        pdHosted.competition_dual_purse_place_percent || dualPlacePct,
    }),
  });
  assert(
    restoreHostedKoDefault.status === 200 &&
      String(restoreHostedKoDefault.body?.competition_default_payout_mode_knockout || "").trim() ===
        defKo,
    "hosted KO default restored after dual omit",
  );

  // ---- Hosted REST dual_purse + place percents that do not sum to 100 → reject ----
  const hostedKoDualBadPct = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted KO DualBadPct ${stamp}`,
      format_id: ko,
      size_id: koSize.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: 40,
      entry_fee_currency: hostCur,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: false,
      country_code: "ET",
      auto_approve: true,
      prize_payout_mode: dual,
      prize_place_percents: { 1: 50, 2: 30, 3: 10 },
    }),
  });
  assert(
    hostedKoDualBadPct.status === 400,
    `hosted KO dual bad place% status ${hostedKoDualBadPct.status} ${JSON.stringify(hostedKoDualBadPct.body).slice(0, 200)}`,
  );
  assert(
    !(hostedKoDualBadPct.body?.event || hostedKoDualBadPct.body)?.id,
    "hosted KO dual bad place% must not create event",
  );

  // ---- Hosted manage PATCH dual + bad place% sum → reject (create path covered above) ----
  const hostedKoDualOk = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `Hosted KO DualPatch ${stamp}`,
      format_id: ko,
      size_id: koSize.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: 40,
      entry_fee_currency: hostCur,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: false,
      country_code: "ET",
      auto_approve: true,
      prize_payout_mode: dual,
      prize_place_percents: { 1: 50, 2: 30, 3: 20 },
    }),
  });
  assert(
    hostedKoDualOk.status === 200 || hostedKoDualOk.status === 201,
    `hosted KO dual ok create ${hostedKoDualOk.status} ${JSON.stringify(hostedKoDualOk.body).slice(0, 200)}`,
  );
  const hostedPatchEid = (hostedKoDualOk.body?.event || hostedKoDualOk.body)?.id;
  assert(hostedPatchEid, "hosted KO dual patch event id");
  const hostedKoDualBadPatch = await req(`/events/${hostedPatchEid}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      prize_payout_mode: dual,
      prize_place_percents: { 1: 50, 2: 30, 3: 10 },
    }),
  });
  assert(
    hostedKoDualBadPatch.status === 400,
    `hosted KO dual PATCH bad place% status ${hostedKoDualBadPatch.status} ${JSON.stringify(hostedKoDualBadPatch.body).slice(0, 200)}`,
  );
  {
    const raw = sql(
      `SELECT COALESCE(prize_place_percents::text,'') FROM hosted_events WHERE id='${hostedPatchEid}'`,
    );
    assert(
      raw.includes('"1": 50') || raw.includes('"1":50'),
      `hosted dual place% unchanged after bad PATCH got ${raw}`,
    );
    assert(
      raw.includes('"3": 20') || raw.includes('"3":20'),
      `hosted dual place% 3 unchanged after bad PATCH got ${raw}`,
    );
  }

  await req(`/console/tournaments/${arenaId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  await req(`/console/tournaments/${koId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  await req(`/console/tournaments/${koDualOmitId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  await req(`/console/tournaments/${rrId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  await req(`/console/tournaments/${swissId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  await req(`/console/tournaments/${groupsId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${admin.tok}` },
  });

  console.log(
    "E2E_PASS: competition payout create defaults (platform Arena/KO/RR/Swiss/Groups + KO dual-omit + hosted Arena + hosted KO dual-omit + hosted dual bad place% create+PATCH)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
