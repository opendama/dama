/**
 * E2E: platform tournament KO finish → prize escrow → settle (console + optional auto worker).
 *
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 and Postgres via docker exec (same as hosted-events E2E).
 *
 * Env:
 *   DAMA_API_BASE              - default http://127.0.0.1:18080/api/v1
 *   DAMA_POSTGRES_*            - user/db/container (defaults dama/dama/dama_postgres)
 *   DAMA_E2E_WAIT_AUTO_SETTLE  - if "1", poll wallet after backdating dispute window (no console settle)
 *
 *   node scripts/e2e-platform-tournament-play-settle-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";
const waitAuto = process.env.DAMA_E2E_WAIT_AUTO_SETTLE === "1";

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
  return { status: 503, body: { error: "transient upstream" } };
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

function walletBal(userId, currency) {
  const id = String(userId).replace(/'/g, "");
  const cur = String(currency).replace(/'/g, "");
  const row = sql(
    `SELECT COALESCE(balance::text,'0') FROM wallets WHERE user_id='${id}' AND currency='${cur}'`,
  );
  return Number(row || 0);
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

const CREATE_CUP = `
  mutation CreatePaidKO($title: String!, $fee: Float!, $cur: String!) {
    createTournament(
      title: $title
      isFree: false
      entryFeeAmount: $fee
      entryFeeCurrency: $cur
      prizePoolDisplayEnabled: true
      maxPlayers: 8
      formatId: "knockout"
    ) {
      id
      title
      status
    }
  }
`;

async function main() {
  const stamp = Date.now();
  const admin = await e2eSession(`ptps_adm_${stamp}`, `ptps_adm_${stamp}@example.com`, "admin");
  const atok = admin.tok;

  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);

  const enumsRes = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enumsRes.status === 200, `platform enums ${enumsRes.status}`);
  const enums = enumsRes.body;
  const enrollable =
    (enums.enrollable_tournament_status || "").trim() ||
    (enums.tournament_statuses || []).find((s) => String(s).includes("open")) ||
    "open";
  const koFormat = enums.hosted_event_knockout_format || "knockout";

  const catRes = await req("/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  let minPlayers = 4;
  if (catRes.status === 200 && catRes.body?.min_players_to_start) {
    const n = Number(catRes.body.min_players_to_start[koFormat]);
    if (Number.isFinite(n) && n >= 2) minPlayers = n;
  }

  const entryFee = 50;
  const currency = "USD";
  const players = [];
  for (let i = 0; i < minPlayers; i++) {
    players.push(await e2eSession(`ptps_p${i}_${stamp}`, `ptps_p${i}_${stamp}@example.com`));
    creditWallet(players[i].uid, currency, entryFee * 3);
  }
  const p0 = players[0];
  const p1 = players[1];

  const title = `E2E Settle KO ${stamp}`;
  const create = await gql(
    atok,
    CREATE_CUP.replace('formatId: "knockout"', `formatId: "${koFormat}"`),
    {
      title,
      fee: entryFee,
      cur: currency,
    },
  );
  assert(
    create.status === 200 && !create.body?.errors,
    `create cup ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const tid = create.body.data?.createTournament?.id;
  assert(tid, "tournament id");

  const open = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(open.status === 200, `open cup ${open.status}`);

  async function ensureCashReady(tok, phoneSuffix) {
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
      const ver = await req("/me/phone-kyc/otp/verify", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          challenge_id: otp.body.challenge_id,
          code: otp.body.debug_code,
        }),
      });
      assert(ver.status < 300, `phone kyc verify ${ver.status}`);
    }
    await req("/geo/locate", {
      method: "POST",
      headers: h,
      body: JSON.stringify({}),
    });
    const start = await req("/auth/otp/start", {
      method: "POST",
      headers: h,
      body: JSON.stringify({}),
    });
    if (start.status < 300 && start.body?.debug_code) {
      const ver = await req("/auth/otp/verify", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          challenge_id: start.body.challenge_id,
          code: start.body.debug_code,
        }),
      });
      assert(ver.status < 300, `session otp verify ${ver.status}`);
    }
  }

  let phoneSeq = 5500000;
  for (const p of players) {
    phoneSeq += 1;
    await ensureCashReady(p.tok, String(phoneSeq).slice(-8));
    const en = await req(`/tournaments/${tid}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({ country_code: "ET" }),
    });
    assert(
      en.status === 200 || en.status === 201,
      `enroll ${p.uid.slice(0, 8)} ${en.status} ${JSON.stringify(en.body).slice(0, 200)}`,
    );
  }

  for (const p of players) {
    const ci = await req(`/tournaments/${tid}/check-in`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.tok}` },
      body: JSON.stringify({}),
    });
    assert(
      ci.status === 200 || ci.status === 201 || ci.status === 409,
      `check-in ${p.uid.slice(0, 8)} ${ci.status}`,
    );
  }

  const start = await req(`/console/tournaments/${tid}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start ${start.status} ${JSON.stringify(start.body).slice(0, 160)}`);

  async function loadBracket() {
    const br = await req(`/tournaments/${tid}/bracket`, {
      headers: { Authorization: `Bearer ${atok}` },
    });
    return br.body?.bracket || br.body?.matches || [];
  }

  let bracket = start.body?.bracket || [];
  if (!bracket.length) bracket = await loadBracket();
  assert(bracket.length > 0, "bracket has matches");

  // Knockout with N players needs multiple match results to crown a winner.
  const readyStatuses = new Set(
    [enums.tournament_bracket_ready, enums.hosted_event_bracket_ready, "ready"]
      .map((s) => String(s || "").trim())
      .filter(Boolean),
  );
  for (let round = 0; round < 16; round++) {
    const finishedAtLoop = sql(
      `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid.replace(/'/g, "")}'`,
    );
    if (finishedAtLoop.length > 0) break;
    bracket = await loadBracket();
    const playable = bracket.find((m) => {
      const st = String(m.status || "").trim();
      return readyStatuses.has(st) && m.player_a_id && m.player_b_id && !m.is_bye;
    });
    if (!playable) {
      assert(false, `no ready match to forfeit at pass ${round}`);
    }
    const loser = playable.player_b_id;
    const forfeit = await req(`/console/tournaments/${tid}/bracket/${playable.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${atok}` },
      body: JSON.stringify({ user_id: loser }),
    });
    assert(
      forfeit.status === 200,
      `forfeit pass ${round} ${forfeit.status} ${JSON.stringify(forfeit.body).slice(0, 160)}`,
    );
  }

  const finishedAt = sql(
    `SELECT COALESCE(finished_at::text,'') FROM tournaments WHERE id='${tid.replace(/'/g, "")}'`,
  );
  assert(finishedAt.length > 0, "tournament finished_at set");

  const pendingCount = Number(
    sql(
      `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid.replace(/'/g, "")}' AND status='pending'`,
    ) || 0,
  );
  assert(pendingCount > 0, `pending prize payouts n=${pendingCount}`);

  sql(`
    UPDATE tournaments
    SET dispute_window_ends_at = NOW() - INTERVAL '1 minute', updated_at = NOW()
    WHERE id='${tid.replace(/'/g, "")}';
  `);

  const winnerId = sql(
    `SELECT user_id::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid.replace(/'/g, "")}' AND placement=1 LIMIT 1`,
  );
  assert(winnerId.length > 0, "placement-1 payout user");
  const balWinnerBefore = walletBal(winnerId, currency);

  if (waitAuto) {
    sql(`
      UPDATE platform_settings
      SET value = value || '{"competition_prize_settle_interval_minutes":"1","competition_prize_auto_settle":"true"}'::jsonb,
          updated_at = NOW()
      WHERE key = 'client_enums';
    `);
    const deadline = Date.now() + 130_000;
    let settled = false;
    while (Date.now() < deadline) {
      await sleep(5000);
      const n = Number(
        sql(
          `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid.replace(/'/g, "")}' AND status='settled'`,
        ) || 0,
      );
      if (n > 0) {
        settled = true;
        break;
      }
    }
    assert(settled, "auto worker settled at least one payout within ~2m");
  } else {
    const settle = await req("/console/competitions/settle-prizes", {
      method: "POST",
      headers: { Authorization: `Bearer ${atok}` },
      body: JSON.stringify({}),
    });
    assert(settle.status === 200, `console settle ${settle.status}`);
    // Auto-settle worker may race the console click; accept either path.
    const settledFromBody = Number(settle.body?.settled) || 0;
    const settledFromDb = Number(
      sql(
        `SELECT COUNT(*) FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid.replace(/'/g, "")}' AND status='settled'`,
      ) || 0,
    );
    assert(
      settledFromBody > 0 || settledFromDb > 0,
      `settled count body=${settledFromBody} db=${settledFromDb}`,
    );
  }

  const balWinnerAfter = walletBal(winnerId, currency);
  assert(
    balWinnerAfter > balWinnerBefore,
    `winner ${winnerId.slice(0, 8)} wallet grew ${balWinnerBefore} -> ${balWinnerAfter}`,
  );

  // Prize paid notif deep-link: /transactions?id=<ledger> (mig 458; not bare /wallet).
  const kindHref = sql(
    `SELECT href_path || '|' || COALESCE(href_query_key,'') FROM notification_kinds WHERE code='player.competition_prize_settled'`,
  );
  assert(kindHref === "/transactions|id", `prize settled kind href ${kindHref}`);
  const ledgerId = sql(
    `SELECT ledger_tx_id::text FROM competition_prize_payouts WHERE entity_kind='tournament' AND entity_id='${tid.replace(/'/g, "")}' AND user_id='${winnerId.replace(/'/g, "")}' AND placement=1 LIMIT 1`,
  );
  assert(ledgerId.length > 0, "winner ledger_tx_id");
  const winnerTok = players.find((p) => p.uid === winnerId)?.tok;
  assert(Boolean(winnerTok), "winner session token");
  const notifs = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${winnerTok}` },
  });
  assert(notifs.status === 200, `winner notifications ${notifs.status}`);
  const prizePaid = (notifs.body?.items || []).find(
    (n) => n.kind_code === "player.competition_prize_settled",
  );
  assert(Boolean(prizePaid), "prize paid notification present");
  assert(
    String(prizePaid.href || "") === `/transactions?id=${ledgerId}`,
    `prize paid href ${prizePaid.href} want /transactions?id=${ledgerId}`,
  );

  // Soft-archive after start/finish (mig 459): Archive ok; Draft/Open blocked.
  const archive = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: "archived" }),
  });
  assert(archive.status === 200, `soft-archive after settle ${archive.status}`);
  assert(String(archive.body?.status || "") === "archived", "status archived");
  const draftBlocked = await req(`/console/tournaments/${tid}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: "draft" }),
  });
  assert(draftBlocked.status === 409, `draft after start blocked ${draftBlocked.status}`);
  assert(
    String(draftBlocked.body?.error_key || "") === "err_cup_already_started",
    `draft error_key ${draftBlocked.body?.error_key}`,
  );

  console.log("ALL PLATFORM TOURNAMENT PLAY SETTLE E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
