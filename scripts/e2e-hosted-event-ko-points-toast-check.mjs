/**
 * E2E: hosted KO forfeit awards admin standings win points → player.competition_points_awarded.
 * Bracket advance + places% payout unchanged.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-ko-points-toast-check.mjs
 */
import { execFileSync } from "node:child_process";

const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
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

function creditWallet(uid, cur, amount) {
  sql(`
    INSERT INTO wallets (user_id, currency, balance, updated_at)
    VALUES ('${uid}','${cur}',${amount},NOW())
    ON CONFLICT (user_id, currency) DO UPDATE
    SET balance = wallets.balance + ${amount}, updated_at = NOW();
  `);
}

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`hekopt_adm_${stamp}`, `hekopt_adm_${stamp}@ex.com`, "admin");
  const org = await e2eSession(`hekopt_org_${stamp}`, `hekopt_org_${stamp}@ex.com`);

  const label = sql(`
    SELECT COALESCE(
      (SELECT value->>'standings_points_label' FROM platform_settings WHERE key='events_player_chrome'),
      (SELECT value->>'standings_points_label' FROM platform_settings WHERE key='tournaments_player_chrome'),
      ''
    )
  `).trim();
  assert(label.length > 0, "standings_points_label from DB");

  const standGet = await req("/console/competition/standings-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(standGet.status === 200, `standings-settings get ${standGet.status}`);
  const origWin = String(standGet.body?.competition_standings_points_win || "").trim();
  const origDraw = String(standGet.body?.competition_standings_points_draw || "").trim();
  assert(Number(origWin) > 0, `admin standings win > 0 got=${origWin}`);
  const probeWin = "5";
  assert(
    (
      await req("/console/competition/standings-settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${admin.tok}` },
        body: JSON.stringify({
          competition_standings_points_win: probeWin,
          competition_standings_points_draw: origDraw || "0",
        }),
      })
    ).status === 200,
    "standings-settings put probe",
  );

  let enums;
  let koId;
  let ready;
  try {
    const enumsRes = await req("/platform/enums", {
      headers: { Authorization: `Bearer ${admin.tok}` },
    });
    assert(enumsRes.status === 200, "enums");
    enums = enumsRes.body || {};
    koId = String(enums.hosted_event_knockout_format || "").trim();
    ready = String(enums.hosted_event_bracket_ready || "").trim();
    assert(koId && ready, "ko + ready from DB");
    assert(
      String(enums.competition_standings_points_win || "").trim() === probeWin,
      `enums reflect admin probe win got=${enums.competition_standings_points_win}`,
    );

    const catGet = await req("/console/events/catalog", {
      headers: { Authorization: `Bearer ${admin.tok}` },
    });
    assert(catGet.status === 200, "catalog");
    const cat = { ...catGet.body };
    cat.source = undefined;
    cat.formats = (cat.formats || []).map((f) => ({ ...f, enabled: true }));
    for (const s of cat.sizes || []) {
      const ids = new Set(s.allowed_format_ids || []);
      ids.add(koId);
      s.allowed_format_ids = [...ids];
    }
    if (!cat.min_players_to_start) cat.min_players_to_start = {};
    cat.min_players_to_start[koId] = 4;
    const put = await req("/console/events/catalog", {
      method: "PUT",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify(cat),
    });
    assert(put.status === 200, `catalog put ${put.status}`);

    const size =
      (cat.sizes || []).find(
        (s) => (s.allowed_format_ids || []).includes(koId) && Number(s.max_players) >= 4,
      ) ||
      (cat.sizes || []).find((s) => (s.allowed_format_ids || []).includes(koId)) ||
      (cat.sizes || [])[0];
    assert(size?.id, "size");
    const hostCur = String(size.host_fee_currency || "ETB").trim() || "ETB";
    const hostFee = Number(size.host_fee_amount || 0);
    creditWallet(org.uid, hostCur, Math.max(hostFee * 4, 400));

    let phone = 5950000;
    phone += 1;
    await passCashGate(org.tok, String(phone).slice(-8));

    const players = [];
    for (let i = 0; i < 4; i++) {
      players.push(await e2eSession(`hekopt_p${i}_${stamp}`, `hekopt_p${i}_${stamp}@ex.com`));
    }

    const create = await req("/events/", {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({
        title: `Hosted KO Points Toast ${stamp}`,
        format_id: koId,
        size_id: size.id,
        visibility: "private",
        is_free_entry: true,
        entry_fee_amount: 0,
        entry_fee_currency: hostCur,
        country_code: "ET",
        auto_approve: true,
      }),
    });
    assert(
      create.status === 200 || create.status === 201,
      `create ${create.status} ${JSON.stringify(create.body).slice(0, 220)}`,
    );
    const ev = create.body?.event || create.body;
    assert(ev?.id && ev?.join_code, "event id+code");
    const eid = ev.id;

    for (const p of players) {
      phone += 1;
      await passCashGate(p.tok, String(phone).slice(-8));
      const join = await req("/events/join", {
        method: "POST",
        headers: { Authorization: `Bearer ${p.tok}` },
        body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
      });
      assert(join.status === 200 || join.status === 201, `join ${join.status}`);
      await req(`/events/${eid}/check-in`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.tok}` },
        body: JSON.stringify({}),
      });
    }

    const start = await req(`/events/${eid}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({}),
    });
    assert(start.status === 200, `start ${start.status}`);
    let bracket = start.body?.bracket || [];
    if (!bracket.length) {
      const br = await req(`/events/${eid}/bracket`, {
        headers: { Authorization: `Bearer ${org.tok}` },
      });
      bracket = br.body?.bracket || [];
    }
    const match = bracket.find(
      (m) => !m.is_bye && m.player_a_id && m.player_b_id && String(m.status || "").trim() === ready,
    );
    assert(match?.id, "ready match");

    const winnerID = String(match.player_a_id).replace(/'/g, "");
    const winner = players.find((p) => p.uid === match.player_a_id);
    assert(winner, "winner session");

    const beforeIds = new Set(
      sql(`
      SELECT COALESCE(string_agg(n.id::text, ','), '')
      FROM app_notifications n
      WHERE n.recipient_id = '${winnerID}'
        AND n.kind_code = 'player.competition_points_awarded'
    `)
        .split(",")
        .filter(Boolean),
    );

    const ff = await req(`/events/${eid}/bracket/${match.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({ user_id: match.player_b_id }),
    });
    assert(ff.status === 200, `forfeit ${ff.status}`);

    let found = "";
    for (let i = 0; i < 20; i++) {
      found = sql(`
      SELECT n.id::text
      FROM app_notifications n
      WHERE n.recipient_id = '${winnerID}'
        AND n.kind_code = 'player.competition_points_awarded'
      ORDER BY n.created_at DESC
      LIMIT 1
    `);
      if (found && !beforeIds.has(found)) break;
      found = "";
      await sleep(250);
    }
    assert(found, "hosted KO winner has competition_points_awarded notif");

    const list = await req("/me/notifications?skip=0&limit=20", {
      headers: { Authorization: `Bearer ${winner.tok}` },
    });
    assert(list.status === 200, `winner notifications ${list.status}`);
    const items = list.body?.notifications || list.body?.items || [];
    const row = items.find(
      (n) =>
        String(n.kind_code || n.kind || "").trim() === "player.competition_points_awarded" ||
        String(n.id || "").trim() === found,
    );
    assert(row, "winner API list includes points-awarded notif");
    assert(String(row.body || "").trim().length > 0, "points-awarded body non-empty (toast text)");
    assert(!row.read, "points-awarded notif unread (web/Flutter toast gate)");
    const args = row.body_args || row.bodyArgs || [];
    assert(Array.isArray(args) && args.length >= 2, "body_args has points+label");
    assert(
      String(args[0]) === probeWin,
      `body_args points=${args[0]} expect admin probe ${probeWin}`,
    );
    assert(String(args[1] || "").trim().length > 0, "body_args label non-empty (toast {label})");

    const unread = await req("/me/notifications/unread-count", {
      headers: { Authorization: `Bearer ${winner.tok}` },
    });
    assert(unread.status === 200, `unread-count ${unread.status}`);
    assert(Number(unread.body?.count || 0) > 0, "unread count > 0 after hosted KO points award");
    const toastFmt = String(unread.body?.chrome?.toast_points_awarded_fmt || "").trim();
    assert(
      toastFmt.includes("{points}") && toastFmt.includes("{label}"),
      "unread chrome toast_points_awarded_fmt",
    );
    const rendered = toastFmt
      .replaceAll("{points}", String(args[0]).trim())
      .replaceAll("{label}", String(args[1]).trim())
      .trim();
    assert(
      rendered.length > 0 && rendered.includes(probeWin),
      `client toast text renderable got=${rendered}`,
    );
    const listFmt = String(list.body?.chrome?.toast_points_awarded_fmt || "").trim();
    assert(
      listFmt.includes("{points}") && listFmt.includes("{label}"),
      "list chrome toast_points_awarded_fmt (Flutter bell)",
    );

    console.log(
      "E2E_PASS: hosted KO forfeit emits competition points toast notif (admin N + client chrome path)",
    );
  } finally {
    const restore = await req("/console/competition/standings-settings", {
      method: "PUT",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({
        competition_standings_points_win: origWin,
        competition_standings_points_draw: origDraw || "0",
      }),
    });
    assert(restore.status === 200, `standings-settings restore ${restore.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
