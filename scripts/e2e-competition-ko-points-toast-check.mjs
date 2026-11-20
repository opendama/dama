/**
 * E2E: KO forfeit awards admin standings win points → player.competition_points_awarded
 * (engagement toast). Bracket advance + places% payout unchanged.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-ko-points-toast-check.mjs
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

const CREATE = `
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
  const admin = await e2eSession(`kopt_adm_${stamp}`, `kopt_adm_${stamp}@ex.com`, "admin");
  // Catalog min_players_to_start.knockout is 8 - match dual-purse KO e2e seat count.
  const players = [];
  for (let i = 0; i < 8; i++) {
    players.push(await e2eSession(`kopt_p${i}_${stamp}`, `kopt_p${i}_${stamp}@ex.com`));
  }

  const label = sql(`
    SELECT COALESCE(value->>'standings_points_label','') FROM platform_settings WHERE key='tournaments_player_chrome'
  `).trim();
  assert(label.length > 0, "standings_points_label from DB");

  const standGet = await req("/console/competition/standings-settings", {
    headers: { Authorization: `Bearer ${admin.tok}` },
  });
  assert(standGet.status === 200, `standings-settings get ${standGet.status}`);
  const origWin = String(standGet.body?.competition_standings_points_win || "").trim();
  const origDraw = String(standGet.body?.competition_standings_points_draw || "").trim();
  assert(Number(origWin) > 0, `admin standings win > 0 got=${origWin}`);
  // Prove admin CRUD drives toast N (not hardcoded 1).
  const probeWin = "7";
  const putStand = await req("/console/competition/standings-settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${admin.tok}` },
    body: JSON.stringify({
      competition_standings_points_win: probeWin,
      competition_standings_points_draw: origDraw || "0",
    }),
  });
  assert(putStand.status === 200, `standings-settings put probe ${putStand.status}`);

  let tid = "";
  try {
    const enumsRes = await req("/platform/enums", {
      headers: { Authorization: `Bearer ${admin.tok}` },
    });
    assert(enumsRes.status === 200, "enums");
    const enums = enumsRes.body || {};
    const koId = String(enums.hosted_event_knockout_format || "").trim();
    const enrollable = String(enums.enrollable_tournament_status || "").trim();
    const ready = String(enums.tournament_bracket_ready || "").trim();
    assert(koId && enrollable && ready, "ko + enrollable + ready from DB");
    assert(
      String(enums.competition_standings_points_win || "").trim() === probeWin,
      `enums reflect admin probe win got=${enums.competition_standings_points_win}`,
    );

    const created = await gql(admin.tok, CREATE, {
      title: `KO Points Toast ${stamp}`,
      formatId: koId,
      maxPlayers: 8,
    });
    tid = created.body?.data?.createTournament?.id;
    assert(tid, `create ${JSON.stringify(created.body).slice(0, 200)}`);

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

    for (const p of players) {
      const en = await req(`/tournaments/${tid}/enroll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.tok}` },
        body: JSON.stringify({}),
      });
      assert(en.status < 300 || en.status === 409, `enroll ${en.status}`);
      await req(`/tournaments/${tid}/check-in`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.tok}` },
        body: JSON.stringify({}),
      });
    }

    const start = await req(`/console/tournaments/${tid}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({}),
    });
    assert(start.status < 300, `start ${start.status}`);
    const bracket = start.body?.bracket || [];
    const match = bracket.find((m) => m.status === ready && m.player_a_id && m.player_b_id);
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

    const forfeit = await req(`/console/tournaments/${tid}/bracket/${match.id}/forfeit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admin.tok}` },
      body: JSON.stringify({ user_id: match.player_b_id }),
    });
    assert(forfeit.status === 200, `forfeit ${forfeit.status}`);

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
    assert(found, "KO winner has player.competition_points_awarded notification");

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

    // Exact inputs CompetitionPointsToast / Flutter bell need to show "+N label".
    const unread = await req("/me/notifications/unread-count", {
      headers: { Authorization: `Bearer ${winner.tok}` },
    });
    assert(unread.status === 200, `unread-count ${unread.status}`);
    assert(Number(unread.body?.count || 0) > 0, "unread count > 0 after KO points award");
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

    // List chrome (Flutter path) must also expose fmt.
    const listFmt = String(list.body?.chrome?.toast_points_awarded_fmt || "").trim();
    assert(
      listFmt.includes("{points}") && listFmt.includes("{label}"),
      "list chrome toast_points_awarded_fmt (Flutter bell)",
    );

    await req(`/console/tournaments/${tid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${admin.tok}` },
    });
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

  console.log(
    "E2E_PASS: KO forfeit emits competition points toast notif (admin N + client chrome path)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
