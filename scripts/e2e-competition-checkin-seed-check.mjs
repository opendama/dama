/**
 * E2E: unchecked-in entrants are excluded from bracket seed (tournament + hosted event).
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-checkin-seed-check.mjs
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
  const amt = Number(amount);
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${id}','${cur}',${amt},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${amt}, updated_at = NOW();
  `);
}

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

function seatIds(bracket) {
  const ids = new Set();
  for (const m of bracket || []) {
    const a = (m.player_a_id || "").trim();
    const b = (m.player_b_id || "").trim();
    if (a) ids.add(a);
    if (b) ids.add(b);
  }
  return ids;
}

async function e2eSession(username, email, role) {
  const body = { username, email };
  if (role) body.role = role;
  const r = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (r.status === 404 || r.status === 403) {
    console.error("SKIP: /auth/e2e/session unavailable (set DAMA_ALLOW_E2E_AUTH=1).", r.status);
    process.exit(2);
  }
  assert(r.status === 200 && r.body?.access_token && r.body?.user?.id, `e2e session ${username}`);
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
  await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
}

const CREATE = `
  mutation CreateCheckinSeedCup($title: String!, $formatId: String) {
    createTournament(
      title: $title
      isFree: true
      entryFeeAmount: 0
      entryFeeCurrency: "USD"
      formatId: $formatId
      maxPlayers: 8
    ) { id formatId status }
  }
`;

async function main() {
  const stamp = Date.now();
  const admin = await e2eSession(`ckin_adm_${stamp}`, `ckin_adm_${stamp}@ex.com`, "admin");
  const atok = admin.tok;

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, "platform enums");
  const enums = enumsRes.body;
  const enrollable = (enums.enrollable_tournament_status || "open").trim();
  const ko = (enums.hosted_event_knockout_format || "knockout").trim();

  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, `catalog get ${catGet.status}`);
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
    const n = Number(pub.body?.min_players_to_start?.[ko]);
    if (Number.isFinite(n) && n >= 2) minPlayers = n;
  }
  // Enroll one extra who will NOT check in (must be excluded from seed).
  const totalEnroll = minPlayers + 1;

  // ---- Tournament ----
  const tPlayers = [];
  for (let i = 0; i < totalEnroll; i++) {
    tPlayers.push(await e2eSession(`ckin_tp${i}_${stamp}`, `ckin_tp${i}_${stamp}@ex.com`));
  }
  const create = await gql(atok, CREATE, {
    title: `E2E CheckinSeed Tour ${stamp}`,
    formatId: ko,
  });
  assert(
    create.status === 200 && !create.body?.errors,
    `create tour ${JSON.stringify(create.body).slice(0, 160)}`,
  );
  const tid = create.body.data.createTournament.id;
  assert(tid, "tournament id");

  const open = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(open.status === 200, `open ${open.status}`);

  for (const p of tPlayers) {
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(en.status === 200 || en.status === 201, `tour enroll ${en.status}`);
  }

  const uncheckedTour = tPlayers[tPlayers.length - 1];
  for (let i = 0; i < minPlayers; i++) {
    const ci = await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tPlayers[i].tok}` },
      body: JSON.stringify({}),
    });
    assert(
      ci.status === 200 || ci.status === 201 || ci.status === 409,
      `tour check-in ${ci.status}`,
    );
  }

  const tStart = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(
    tStart.status === 200,
    `tour start ${tStart.status} ${JSON.stringify(tStart.body).slice(0, 160)}`,
  );
  let tBracket = tStart.body?.bracket || [];
  if (!tBracket.length) {
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${atok}` },
    });
    tBracket = br.body?.bracket || [];
  }
  assert(tBracket.length > 0, "tournament bracket nonempty");
  const tSeats = seatIds(tBracket);
  assert(
    !tSeats.has(uncheckedTour.uid),
    `tournament unchecked ${uncheckedTour.uid.slice(0, 8)} not in bracket`,
  );
  for (let i = 0; i < minPlayers; i++) {
    assert(
      tSeats.has(tPlayers[i].uid),
      `tournament checked-in ${tPlayers[i].uid.slice(0, 8)} in bracket`,
    );
  }

  await req(`/console/tournaments/${tid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${atok}` },
  });

  // ---- Hosted event ----
  const org = await e2eSession(`ckin_org_${stamp}`, `ckin_org_${stamp}@ex.com`);
  await passCashGate(org.tok, String(stamp).slice(-8));
  const formats = pub.body?.formats || [];
  const sizes = pub.body?.sizes || [];
  const format =
    formats.find((f) => f.id === ko && f.enabled !== false) ||
    formats.find((f) => f.enabled !== false);
  assert(format?.id, "event format");
  const size =
    sizes.find(
      (s) =>
        (s.allowed_format_ids || []).includes(format.id) && Number(s.max_players) >= totalEnroll,
    ) ||
    sizes.find((s) => Number(s.max_players) >= totalEnroll) ||
    sizes[0];
  assert(size?.id, "event size");
  const hostFee = Number(size.host_fee_amount) || 0;
  const hostCur = String(size.host_fee_currency || "USD").trim() || "USD";
  if (hostFee > 0) creditWallet(org.uid, hostCur, Math.max(hostFee * 4, 200));

  const createEv = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({
      title: `E2E CheckinSeed Event ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: true,
      entry_fee_amount: 0,
      entry_fee_currency: hostCur,
      country_code: "ET",
    }),
  });
  assert(
    createEv.status === 201 || createEv.status === 200,
    `create event ${createEv.status} ${JSON.stringify(createEv.body).slice(0, 160)}`,
  );
  const ev = createEv.body?.event || createEv.body;
  assert(ev?.id && ev?.join_code, "event id + join_code");

  const ePlayers = [];
  for (let i = 0; i < totalEnroll; i++) {
    const p = await e2eSession(`ckin_ep${i}_${stamp}`, `ckin_ep${i}_${stamp}@ex.com`);
    await passCashGate(p.tok, `${String(stamp).slice(-6)}${i}${i}`);
    ePlayers.push(p);
  }

  for (const p of ePlayers) {
    const join = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ code: ev.join_code }),
    });
    assert(join.status === 200 || join.status === 201, `event join ${join.status}`);
  }

  const uncheckedEv = ePlayers[ePlayers.length - 1];
  for (let i = 0; i < minPlayers; i++) {
    const ci = await req(`/events/${ev.id}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ePlayers[i].tok}` },
      body: JSON.stringify({}),
    });
    assert(
      ci.status === 200 || ci.status === 201 || ci.status === 409,
      `event check-in ${ci.status}`,
    );
  }

  const eStart = await req(`/events/${ev.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${org.tok}` },
    body: JSON.stringify({}),
  });
  assert(
    eStart.status === 200,
    `event start ${eStart.status} ${JSON.stringify(eStart.body).slice(0, 160)}`,
  );
  let eBracket = eStart.body?.bracket || [];
  if (!eBracket.length) {
    const br = await req(`/events/${ev.id}/bracket`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    eBracket = br.body?.bracket || [];
  }
  assert(eBracket.length > 0, "event bracket nonempty");
  const eSeats = seatIds(eBracket);
  assert(
    !eSeats.has(uncheckedEv.uid),
    `event unchecked ${uncheckedEv.uid.slice(0, 8)} not in bracket`,
  );
  for (let i = 0; i < minPlayers; i++) {
    assert(
      eSeats.has(ePlayers[i].uid),
      `event checked-in ${ePlayers[i].uid.slice(0, 8)} in bracket`,
    );
  }

  console.log("ALL COMPETITION CHECK-IN SEED E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
