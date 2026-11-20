/**
 * Live E2E: Hall of Fame periods, match votes, live games + QR.
 * Requires API up + DAMA_ALLOW_E2E_AUTH=1.
 * Usage: node scripts/e2e-hof-votes-qr-check.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const p of [resolve(root, ".env"), resolve(root, "apps/api/.env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      const v = t
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const API = (
  process.env.DAMA_E2E_API ||
  process.env.NEXT_PUBLIC_REST_URL ||
  "http://127.0.0.1:8080/api/v1"
).replace(/\/$/, "");

async function req(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, headers: res.headers, buf: text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function mint(username) {
  const { ok, status, json } = await req("/auth/e2e/session", {
    method: "POST",
    body: { username, email: `${username}@e2e.test` },
  });
  assert(ok, `e2e session failed ${status}: ${JSON.stringify(json)}`);
  assert(json?.access_token, "missing access_token");
  return { token: json.access_token, user: json.user };
}

async function main() {
  console.log("API", API);

  // Chrome fail-closed surfaces
  for (const [path, keys] of [
    [
      "/public/leaderboard-chrome",
      [
        "hall_of_fame_title",
        "period_week",
        "unranked_label",
        "podium_first_crown",
        "default_period",
        "list_page_size",
      ],
    ],
    [
      "/public/play-rail-chrome",
      [
        "label_players",
        "join_game_action",
        "id_truncate_chars",
        "viewers_empty_count",
        "qr_unavailable",
        "qr_download_filename_prefix",
        "view_profile_action",
        "friend_requests_count_aria",
      ],
    ],
    [
      "/public/spectate-chrome",
      [
        "vote_section_title",
        "vote_meta_separator",
        "viewers_overflow_prefix",
        "vote_unavailable",
        "vote_players_cannot",
      ],
    ],
    [
      "/public/profile-inspect-chrome",
      [
        "friends_count_label",
        "online_now_label",
        "offline_now_label",
        "playing_now_label",
        "overview_tab",
        "games_tab",
      ],
    ],
  ]) {
    const { ok, json } = await req(path);
    assert(ok, `${path} failed`);
    for (const k of keys) {
      assert(typeof json?.[k] === "string" && json[k].trim(), `${path} missing ${k}`);
    }
    console.log("OK chrome", path);
  }
  {
    const { ok, json } = await req("/public/leaderboard-chrome");
    assert(ok, "leaderboard-chrome recheck failed");
    const dp = String(json.default_period || "")
      .trim()
      .toLowerCase();
    assert(["week", "month", "year", "all"].includes(dp), `invalid default_period ${dp}`);
    const n = Number.parseInt(String(json.list_page_size || "").trim(), 10);
    assert(Number.isFinite(n) && n > 0, `invalid list_page_size ${json.list_page_size}`);
    console.log("OK hof chrome default_period", dp, "list_page_size", n);
  }

  // Hall of Fame periods
  for (const period of ["week", "month", "year", "all"]) {
    const { ok, json } = await req(`/leaderboard?skip=0&limit=10&period=${period}`);
    assert(ok, `leaderboard period=${period} failed`);
    assert(Array.isArray(json?.leaderboard), `leaderboard array missing for ${period}`);
    assert(json?.period === period, `period echo mismatch ${json?.period}`);
    console.log("OK hof", period, "rows", json.leaderboard.length, "total", json?.meta?.total);
  }

  const a = await mint(`hof_a_${Date.now()}`);
  const b = await mint(`hof_b_${Date.now()}`);
  const voter = await mint(`hof_v_${Date.now()}`);

  // Unknown UUID must not invent QR / join-url
  const fakeId = "11111111-2222-4333-8444-555555555555";
  const qrUnknown = await fetch(`${API}/games/${fakeId}/qr.png`);
  assert(qrUnknown.status === 404, `unknown game qr expected 404 got ${qrUnknown.status}`);
  const joinUnknown = await req(`/games/${fakeId}/join-url`);
  assert(
    joinUnknown.status === 404,
    `unknown game join-url expected 404 got ${joinUnknown.status}`,
  );
  console.log("OK qr/join-url reject unknown uuid");

  let live = await req("/games/live");
  assert(live.ok, "games/live failed");
  let games = live.json?.games ?? [];
  console.log("live games", games.length);

  // Start AI game ? warm QR for a known game
  const start = await req("/games/start", {
    method: "POST",
    token: a.token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(start.ok, `start ai failed ${start.status} ${JSON.stringify(start.json)}`);
  const gameId = start.json?.id || start.json?.game?.id;
  assert(gameId, "no game id from start");
  console.log("OK started game", gameId);

  await new Promise((r) => setTimeout(r, 350));
  // Browser fetch always sends Origin; CORS only exposes Content-Disposition then.
  const warmQr = await fetch(`${API}/games/${encodeURIComponent(gameId)}/qr.png`, {
    headers: { Origin: process.env.DAMA_E2E_ORIGIN || "http://localhost:3000" },
  });
  assert(warmQr.status === 200, `warm qr after create ${warmQr.status}`);
  assert((warmQr.headers.get("content-type") || "").includes("png"), "warm qr not png");
  const warmBuf = Buffer.from(await warmQr.arrayBuffer());
  assert(
    warmBuf[0] === 0x89 && warmBuf[1] === 0x50 && warmBuf.length > 800,
    `warm qr bad png (${warmBuf.length})`,
  );
  const cd = warmQr.headers.get("content-disposition") || "";
  assert(
    cd.toLowerCase().includes("filename="),
    `warm qr missing Content-Disposition filename (${cd})`,
  );
  assert(
    /filename="?dama-game-/i.test(cd),
    `QR filename must use DB qr_download_filename_prefix (got ${cd})`,
  );
  const expose = (warmQr.headers.get("access-control-expose-headers") || "").toLowerCase();
  assert(
    expose.includes("content-disposition"),
    `CORS must expose Content-Disposition for browser QR download (got ${expose || "none"})`,
  );
  console.log("OK warm qr.png after create", warmBuf.length, "bytes + CORS expose");

  const join = await req(`/games/${encodeURIComponent(gameId)}/join-url`);
  assert(join.ok, `join-url failed ${join.status}`);
  assert(
    typeof join.json?.join_url === "string" && join.json.join_url.includes("gameId="),
    "join_url bad",
  );
  console.log("OK join-url");

  const votesGet = await req(`/games/${encodeURIComponent(gameId)}/votes`, { token: voter.token });
  assert(votesGet.ok, `get votes failed ${votesGet.status}`);
  assert(typeof votesGet.json?.total === "number", "votes total missing");
  assert(Array.isArray(votesGet.json?.players), "votes players tallies missing");
  console.log("OK votes get", votesGet.json.total, "tallies", votesGet.json.players.length);

  // Invite PvP: cast ? finish ? correct voters non-empty
  const inv = await req("/invites/", {
    method: "POST",
    token: a.token,
    body: {
      to_user: b.user.username,
      rated: false,
      preferred_color: "white",
      time_control_seconds: 180,
    },
  });
  assert(inv.status === 201, `invite create ${inv.status} ${JSON.stringify(inv.json)}`);
  const inviteId = inv.json?.id || inv.json?.invite?.id;
  assert(inviteId, "invite id missing");
  const accept = await req(`/invites/${encodeURIComponent(inviteId)}/accept`, {
    method: "POST",
    token: b.token,
    body: {},
  });
  assert(accept.ok, `invite accept ${accept.status} ${JSON.stringify(accept.json)}`);
  const pvpId =
    accept.json?.match?.game_id ||
    accept.json?.invite?.game_id ||
    accept.json?.game_id ||
    accept.json?.game?.id;
  assert(pvpId, `pvp game id missing ${JSON.stringify(accept.json)}`);
  console.log("OK pvp game", pvpId);

  const p1 = accept.json?.match?.player1_id;
  const p2 = accept.json?.match?.player2_id;
  assert(p1 && p2, `pvp seats missing ${JSON.stringify(accept.json)}`);

  const cast = await req(`/games/${encodeURIComponent(pvpId)}/votes`, {
    method: "POST",
    token: voter.token,
    body: { voted_player_id: p1 },
  });
  assert(cast.ok, `cast vote failed ${cast.status} ${JSON.stringify(cast.json)}`);
  assert(typeof cast.json?.total === "number" && cast.json.total >= 1, "cast total not bumped");
  const pct = (cast.json.players || []).find((p) => p.player_id === p1)?.percent;
  assert(typeof pct === "number", "cast percent missing");
  assert(cast.json?.my_vote === p1, `caster my_vote expected ${p1}`);
  console.log("OK cast vote on pvp", pvpId, "pct", pct);

  // Seated players cannot cast (API reject).
  const seatCast = await req(`/games/${encodeURIComponent(pvpId)}/votes`, {
    method: "POST",
    token: a.token,
    body: { voted_player_id: p2 },
  });
  assert(seatCast.status === 400, `seated cast expected 400 got ${seatCast.status}`);
  assert(
    String(seatCast.json?.error || "")
      .toLowerCase()
      .includes("cannot vote"),
    `seated cast error expected players cannot vote got ${JSON.stringify(seatCast.json)}`,
  );
  console.log("OK seated player cannot cast");

  // Public tallies visible without auth; other viewers must not inherit caster my_vote.
  const anonVotes = await req(`/games/${encodeURIComponent(pvpId)}/votes`);
  assert(anonVotes.ok, `anon votes get ${anonVotes.status}`);
  assert(
    typeof anonVotes.json?.total === "number" && anonVotes.json.total >= 1,
    "anon tallies missing",
  );
  assert(anonVotes.json?.my_vote == null, "anon must not have my_vote");
  const other = await req(`/games/${encodeURIComponent(pvpId)}/votes`, { token: a.token });
  assert(other.ok, `other viewer votes ${other.status}`);
  assert(
    other.json?.my_vote == null,
    `other viewer my_vote leaked: ${JSON.stringify(other.json?.my_vote)}`,
  );
  console.log("OK vote my_vote isolation + anon public tallies");

  // b resigns ? p1 (a) wins ? voter is correct
  const abandon = await req(`/games/${encodeURIComponent(pvpId)}/abandon`, {
    method: "POST",
    token: b.token,
    body: {},
  });
  assert(abandon.ok, `abandon failed ${abandon.status} ${JSON.stringify(abandon.json)}`);

  const correct = await req(`/games/${encodeURIComponent(pvpId)}/votes/correct`);
  assert(correct.ok, `correct voters failed ${correct.status}`);
  assert(Array.isArray(correct.json?.voters), "voters array missing");
  assert(correct.json?.winner_id === p1, `winner_id expected ${p1} got ${correct.json?.winner_id}`);
  assert(
    correct.json.voters.some((v) => v.id === voter.user?.id),
    `voter ${voter.user?.id} missing from correct list ${JSON.stringify(correct.json.voters)}`,
  );
  assert(correct.json.voters.length <= 10, "correct voters > 10");
  console.log("OK correct voters after finish", correct.json.voters.length);

  // Live list shape when games exist
  live = await req("/games/live");
  games = live.json?.games ?? [];
  if (games.length) {
    const g = games[0];
    assert(typeof g.id === "string", "live game id");
    assert("spectator_count" in g, "spectator_count missing");
    assert(Array.isArray(g.viewers), "viewers missing");
    console.log("OK live row shape", g.id, "spectators", g.spectator_count);
  }

  // Authenticated me always present when Bearer; anon omits me
  const lbAnon = await req("/leaderboard?skip=0&limit=5&period=all");
  assert(lbAnon.ok, "leaderboard anon failed");
  assert(lbAnon.json?.me == null, "anon leaderboard must not include me");
  for (const period of ["week", "month", "year", "all"]) {
    const lbMe = await req(`/leaderboard?skip=0&limit=5&period=${period}`, { token: a.token });
    assert(lbMe.ok, `leaderboard me period=${period} failed`);
    assert(
      lbMe.json?.me != null && typeof lbMe.json.me.rank === "number",
      `expected me for ${period}`,
    );
    console.log("OK me payload", period, lbMe.json?.me ?? null);
  }

  console.log("E2E_HOF_VOTES_QR_COMPLETE");
  process.exit(0);
}

main().catch((e) => {
  console.error("E2E_FAIL", e.message || e);
  process.exit(1);
});
