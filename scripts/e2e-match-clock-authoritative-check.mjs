#!/usr/bin/env node
/**
 * Authoritative match clock E2E (DB + API + flag claim).
 * Requires local API (default http://127.0.0.1:18080) and a player JWT
 * (DAMA_E2E_TOKEN or .tmp-admin-auth.json access_token / token).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
// Accept origin or .../api/v1 (env often includes the REST prefix).
const base = (process.env.DAMA_API_BASE_URL || "http://127.0.0.1:18080")
  .replace(/\/$/, "")
  .replace(/\/api\/v1$/i, "");

function loadToken() {
  const env = (process.env.DAMA_E2E_TOKEN || "").trim();
  if (env) return env;
  const p = resolve(root, ".tmp-admin-auth.json");
  if (!existsSync(p)) return "";
  const raw = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  const j = JSON.parse(raw);
  return String(
    j.access_token || j.token || j.accessToken || j.state?.token || j.state?.access_token || "",
  ).trim();
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

/** Public chrome can briefly 503 during API recycle - retry GET readiness probes. */
async function apiReady(path, { attempts = 12, delayMs = 500 } = {}) {
  let last = { status: 0, json: null };
  for (let i = 0; i < attempts; i++) {
    last = await api(path);
    if (last.status === 200) return last;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function mintToken() {
  const existing = loadToken();
  const stamp = Date.now();
  const sess = await api("/api/v1/auth/e2e/session", {
    method: "POST",
    body: {
      username: `clk_e2e_${stamp}`,
      email: `clk_e2e_${stamp}@e2e.test`,
    },
  });
  if (sess.status === 200 && sess.json?.access_token) {
    return String(sess.json.access_token).trim();
  }
  // Fall back to saved JWT when e2e mint is disabled on this API.
  assert(
    existing,
    `e2e session ${sess.status}: ${JSON.stringify(sess.json)}; missing DAMA_E2E_TOKEN / .tmp-admin-auth.json`,
  );
  return existing;
}

async function main() {
  const token = await mintToken();

  const prog = await api("/api/v1/progression");
  assert(prog.status === 200, `progression ${prog.status}`);
  const clock = prog.json?.match_clock;
  assert(clock?.enabled === true, "match_clock.enabled must be true");
  assert(clock.initial_seconds > 0, "match_clock.initial_seconds required");
  assert(Array.isArray(clock.presets) && clock.presets.length > 0, "match_clock.presets required");
  const presetOk = clock.presets.some((p) => p.seconds === clock.initial_seconds);
  assert(presetOk, "initial_seconds must appear in presets");

  const chrome = await apiReady("/api/v1/public/play-chrome");
  assert(chrome.status === 200, `play-chrome ${chrome.status}`);
  assert(
    String(chrome.json?.toast_clock_flag || "").trim(),
    "play_chrome.toast_clock_flag missing (mig 427)",
  );
  assert(
    String(chrome.json?.toast_clock_flag_failed || "").trim(),
    "play_chrome.toast_clock_flag_failed missing (mig 427)",
  );
  const wonOnTime = String(chrome.json?.you_won_on_time_message || "").trim();
  const lostOnTime = String(chrome.json?.you_lost_on_time_message || "").trim();
  const drewOnTime = String(chrome.json?.you_drew_on_time_message || "").trim();
  const youWonGeneric = String(chrome.json?.you_won_message || "").trim();
  const youLostGeneric = String(chrome.json?.you_lost_message || "").trim();
  assert(wonOnTime, "play_chrome.you_won_on_time_message missing (mig 438)");
  assert(lostOnTime, "play_chrome.you_lost_on_time_message missing (mig 438)");
  assert(drewOnTime, "play_chrome.you_drew_on_time_message missing (mig 438)");
  assert(/on\s*time/i.test(wonOnTime), `you_won_on_time_message must say on time: ${wonOnTime}`);
  assert(/on\s*time/i.test(lostOnTime), `you_lost_on_time_message must say on time: ${lostOnTime}`);
  assert(/on\s*time/i.test(drewOnTime), `you_drew_on_time_message must say on time: ${drewOnTime}`);
  assert(
    wonOnTime.toLowerCase() !== youWonGeneric.toLowerCase(),
    `on-time win copy must differ from generic you_won_message (${youWonGeneric})`,
  );
  assert(
    lostOnTime.toLowerCase() !== youLostGeneric.toLowerCase(),
    `on-time loss copy must differ from generic you_lost_message (${youLostGeneric})`,
  );
  assert(
    String(chrome.json?.match_result_win_on_time_aria || "").trim(),
    "play_chrome.match_result_win_on_time_aria missing (mig 438)",
  );
  assert(
    String(chrome.json?.match_result_loss_on_time_aria || "").trim(),
    "play_chrome.match_result_loss_on_time_aria missing (mig 438)",
  );
  assert(
    String(chrome.json?.match_result_draw_on_time_aria || "").trim(),
    "play_chrome.match_result_draw_on_time_aria missing (mig 438)",
  );
  assert(
    String(chrome.json?.notif_result_win_on_time || "").trim(),
    "play_chrome.notif_result_win_on_time missing (mig 440)",
  );
  assert(
    String(chrome.json?.notif_result_loss_on_time || "").trim(),
    "play_chrome.notif_result_loss_on_time missing (mig 440)",
  );
  assert(
    String(chrome.json?.notif_result_draw_on_time || "").trim(),
    "play_chrome.notif_result_draw_on_time missing (mig 440)",
  );

  const spectateChrome = await apiReady("/api/v1/public/spectate-chrome");
  assert(spectateChrome.status === 200, `spectate-chrome ${spectateChrome.status}`);
  const spectateP1OnTime = String(spectateChrome.json?.status_p1_wins_on_time || "").trim();
  const spectateP2OnTime = String(spectateChrome.json?.status_p2_wins_on_time || "").trim();
  const spectateDrawOnTime = String(spectateChrome.json?.status_draw_on_time || "").trim();
  const spectateP1Wins = String(spectateChrome.json?.status_p1_wins || "").trim();
  const spectateP2Wins = String(spectateChrome.json?.status_p2_wins || "").trim();
  assert(spectateP1OnTime, "spectate_chrome.status_p1_wins_on_time missing (mig 439)");
  assert(spectateP2OnTime, "spectate_chrome.status_p2_wins_on_time missing (mig 439)");
  assert(spectateDrawOnTime, "spectate_chrome.status_draw_on_time missing (mig 439)");
  assert(
    /on\s*time/i.test(spectateP1OnTime),
    `status_p1_wins_on_time must say on time: ${spectateP1OnTime}`,
  );
  assert(
    /on\s*time/i.test(spectateP2OnTime),
    `status_p2_wins_on_time must say on time: ${spectateP2OnTime}`,
  );
  assert(
    /on\s*time/i.test(spectateDrawOnTime),
    `status_draw_on_time must say on time: ${spectateDrawOnTime}`,
  );
  assert(
    spectateP1OnTime.toLowerCase() !== spectateP1Wins.toLowerCase(),
    `on-time P1 copy must differ from generic status_p1_wins (${spectateP1Wins})`,
  );
  assert(
    spectateP2OnTime.toLowerCase() !== spectateP2Wins.toLowerCase(),
    `on-time P2 copy must differ from generic status_p2_wins (${spectateP2Wins})`,
  );

  const railChrome = await apiReady("/api/v1/public/play-rail-chrome");
  assert(railChrome.status === 200, `play-rail-chrome ${railChrome.status}`);
  const railWinOnTime = String(railChrome.json?.match_result_win_on_time_aria || "").trim();
  const railLossOnTime = String(railChrome.json?.match_result_loss_on_time_aria || "").trim();
  const railDrawOnTime = String(railChrome.json?.match_result_draw_on_time_aria || "").trim();
  const railWinAria = String(railChrome.json?.match_result_win_aria || "").trim();
  const railLossAria = String(railChrome.json?.match_result_loss_aria || "").trim();
  const railDrawAria = String(railChrome.json?.match_result_draw_aria || "").trim();
  assert(railWinOnTime, "play_rail_chrome.match_result_win_on_time_aria missing (mig 438)");
  assert(railLossOnTime, "play_rail_chrome.match_result_loss_on_time_aria missing (mig 438)");
  assert(railDrawOnTime, "play_rail_chrome.match_result_draw_on_time_aria missing (mig 438)");
  assert(
    /on\s*time/i.test(railWinOnTime),
    `rail win on-time aria must say on time: ${railWinOnTime}`,
  );
  assert(
    /on\s*time/i.test(railLossOnTime),
    `rail loss on-time aria must say on time: ${railLossOnTime}`,
  );
  assert(
    /on\s*time/i.test(railDrawOnTime),
    `rail draw on-time aria must say on time: ${railDrawOnTime}`,
  );
  assert(
    railWinOnTime.toLowerCase() !== railWinAria.toLowerCase(),
    `on-time win aria must differ from generic match_result_win_aria (${railWinAria})`,
  );
  assert(
    railLossOnTime.toLowerCase() !== railLossAria.toLowerCase(),
    `on-time loss aria must differ from generic match_result_loss_aria (${railLossAria})`,
  );
  assert(
    railDrawOnTime.toLowerCase() !== railDrawAria.toLowerCase(),
    `on-time draw aria must differ from generic match_result_draw_aria (${railDrawAria})`,
  );

  const start = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(
    start.status === 201 || start.status === 200,
    `start game ${start.status}: ${JSON.stringify(start.json)}`,
  );
  const g = start.json;
  assert(g?.id, "game id missing");
  assert(g.clock_active === true, "clock_active must be true on start");
  assert(
    g.time_control_seconds === clock.initial_seconds,
    `tc=${g.time_control_seconds} want ${clock.initial_seconds}`,
  );
  const fullMs = clock.initial_seconds * 1000;
  assert(
    typeof g.clock_p1_remaining_ms === "number" && g.clock_p1_remaining_ms > 0,
    "p1 remaining",
  );
  assert(
    typeof g.clock_p2_remaining_ms === "number" && g.clock_p2_remaining_ms > 0,
    "p2 remaining",
  );
  // P1 may have already ticked a few ms between Arm and payload snapshot.
  assert(g.clock_p1_remaining_ms <= fullMs, `p1 ${g.clock_p1_remaining_ms} > full ${fullMs}`);
  assert(
    g.clock_p1_remaining_ms >= fullMs - 5000,
    `p1 drained too far: ${g.clock_p1_remaining_ms}`,
  );
  // P2 is idle at start - should still be full TC.
  assert(g.clock_p2_remaining_ms === fullMs, `p2 ${g.clock_p2_remaining_ms} want ${fullMs}`);
  assert(typeof g.clock_server_now_ms === "number" && g.clock_server_now_ms > 0, "server now");
  assert(
    g.clock_increment_seconds === clock.increment_seconds,
    `increment stamp want ${clock.increment_seconds} got ${g.clock_increment_seconds}`,
  );

  // Premature flag must fail closed (clock still running).
  const early = await api(`/api/v1/games/${g.id}/clock-flag`, { method: "POST", token });
  assert(early.status === 400, `early flag want 400 got ${early.status}`);
  assert(
    String(early.json?.error || "")
      .toLowerCase()
      .includes("clock still running"),
    `early flag error: ${JSON.stringify(early.json)}`,
  );

  const state = await api(`/api/v1/games/${g.id}/state`, { token });
  assert(state.status === 200, `state ${state.status}`);
  assert(state.json?.clock_active === true, "state clock_active");
  assert(state.json?.outcome == null, "game must still be live after early flag");
  assert(!state.json?.end_reason, "live game must not carry end_reason");

  // Persist-on-GET: remaining must not rewind above the prior snapshot (within tick noise).
  assert(
    typeof state.json.clock_p1_remaining_ms === "number" &&
      state.json.clock_p1_remaining_ms <= g.clock_p1_remaining_ms + 50,
    `p1 rewound: was ${g.clock_p1_remaining_ms} now ${state.json.clock_p1_remaining_ms}`,
  );

  // Server debit advances on GET (authoritative, not cosmetic client-only).
  await new Promise((r) => setTimeout(r, 1100));
  const later = await api(`/api/v1/games/${g.id}/state`, { token });
  assert(later.status === 200, `later state ${later.status}`);
  assert(
    later.json.clock_p1_remaining_ms < state.json.clock_p1_remaining_ms,
    `p1 did not debit on GET: ${state.json.clock_p1_remaining_ms} -> ${later.json.clock_p1_remaining_ms}`,
  );
  assert(
    later.json.clock_p2_remaining_ms === fullMs,
    `p2 should stay full while P1 to move: ${later.json.clock_p2_remaining_ms}`,
  );

  // True flag-fall (lab): e2e expire active seat, then claim (or GET sync finishes).
  const expired = await api(`/api/v1/games/${g.id}/e2e/expire-clock`, {
    method: "POST",
    token,
  });
  assert(
    expired.status === 200,
    `e2e expire-clock ${expired.status}: ${JSON.stringify(expired.json)} (need DAMA_ALLOW_E2E_AUTH=1)`,
  );
  assert(expired.json?.clock_p1_remaining_ms === 0, "active seat remaining must be 0 after expire");

  const flagged = await api(`/api/v1/games/${g.id}/clock-flag`, { method: "POST", token });
  assert(flagged.status === 200, `flag claim ${flagged.status}: ${JSON.stringify(flagged.json)}`);
  assert(flagged.json?.outcome === 2, `flag winner want P2 got ${flagged.json?.outcome}`);
  assert(flagged.json?.end_reason === "clock_flag", `end_reason=${flagged.json?.end_reason}`);
  assert(flagged.json?.clock_active === false, "clock_active must be false after flag");

  // GetGameState alone must finish a flagged seat (sweeper/hydrate path; no client claim).
  const g2start = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(g2start.status === 201 || g2start.status === 200, `hydrate game start ${g2start.status}`);
  const g2id = g2start.json?.id;
  assert(g2id, "hydrate game id");
  const g2exp = await api(`/api/v1/games/${g2id}/e2e/expire-clock`, { method: "POST", token });
  assert(g2exp.status === 200, `hydrate expire ${g2exp.status}`);
  const g2state = await api(`/api/v1/games/${g2id}/state`, { token });
  assert(g2state.status === 200, `hydrate state ${g2state.status}`);
  assert(g2state.json?.outcome === 2, `hydrate flag winner want P2 got ${g2state.json?.outcome}`);
  assert(
    g2state.json?.end_reason === "clock_flag",
    `hydrate end_reason=${g2state.json?.end_reason}`,
  );
  assert(g2state.json?.clock_active === false, "hydrate clock_active false");

  // Invite / challenge must stamp the chosen preset (not platform fallback only).
  const stamp = Date.now();
  const aTok = await mintToken();
  const bSess = await api("/api/v1/auth/e2e/session", {
    method: "POST",
    body: {
      username: `clk_inv_b_${stamp}`,
      email: `clk_inv_b_${stamp}@e2e.test`,
    },
  });
  assert(bSess.status === 200 && bSess.json?.access_token, "invite peer session");
  const bTok = String(bSess.json.access_token).trim();
  const bId = String(bSess.json.user?.id || "").trim();
  assert(bId, "invite peer user id");
  const preset60 = clock.presets.find((p) => p.seconds === 60);
  assert(preset60, "1 min preset required in match_clock.presets");
  const inv = await api("/api/v1/invites", {
    method: "POST",
    token: aTok,
    body: {
      to_user: bId,
      rated: false,
      preferred_color: "white",
      time_control_seconds: 60,
    },
  });
  assert(
    inv.status === 201 || inv.status === 200,
    `invite create ${inv.status}: ${JSON.stringify(inv.json)}`,
  );
  const inviteId = inv.json?.invite?.id;
  assert(inviteId, "invite id missing");
  const acc = await api(`/api/v1/invites/${inviteId}/accept`, { method: "POST", token: bTok });
  assert(acc.status === 200, `invite accept ${acc.status}: ${JSON.stringify(acc.json)}`);
  const inviteGameId = acc.json?.match?.game_id;
  assert(inviteGameId, "invite match game_id missing");
  const inviteState = await api(`/api/v1/games/${inviteGameId}/state`, { token: aTok });
  assert(inviteState.status === 200, `invite game state ${inviteState.status}`);
  assert(inviteState.json?.clock_active === true, "invite game clock_active");
  assert(
    inviteState.json?.time_control_seconds === 60,
    `invite TC want 60 got ${inviteState.json?.time_control_seconds}`,
  );
  assert(
    inviteState.json?.clock_p1_remaining_ms <= 60_000 &&
      inviteState.json?.clock_p1_remaining_ms > 50_000,
    `invite p1 remaining ${inviteState.json?.clock_p1_remaining_ms}`,
  );

  // Queue matchmaking stamps platform initial_seconds (not client invent).
  const qStamp = Date.now();
  const qA = await mintToken();
  const qBSess = await api("/api/v1/auth/e2e/session", {
    method: "POST",
    body: {
      username: `clk_q_b_${qStamp}`,
      email: `clk_q_b_${qStamp}@e2e.test`,
    },
  });
  assert(qBSess.status === 200 && qBSess.json?.access_token, "queue peer session");
  const qB = String(qBSess.json.access_token).trim();
  const q1 = await api("/api/v1/matchmaking/join", { method: "POST", token: qA });
  assert(q1.status === 200, `queue join A ${q1.status}: ${JSON.stringify(q1.json)}`);
  const q2 = await api("/api/v1/matchmaking/join", { method: "POST", token: qB });
  assert(q2.status === 200, `queue join B ${q2.status}: ${JSON.stringify(q2.json)}`);
  const queueGameId = q2.json?.match?.game_id || q1.json?.match?.game_id;
  assert(
    queueGameId,
    `queue match missing: A=${JSON.stringify(q1.json)} B=${JSON.stringify(q2.json)}`,
  );
  const queueState = await api(`/api/v1/games/${queueGameId}/state`, { token: qA });
  assert(queueState.status === 200, `queue game state ${queueState.status}`);
  assert(queueState.json?.clock_active === true, "queue game clock_active");
  assert(
    queueState.json?.time_control_seconds === clock.initial_seconds,
    `queue TC want ${clock.initial_seconds} got ${queueState.json?.time_control_seconds}`,
  );

  // True sweeper path: expire AI seat (now indexed on clock_active set), wait >2s,
  // then peek WITHOUT sync/GET - only sweeper may have finished the game.
  const g3start = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(g3start.status === 201 || g3start.status === 200, `sweeper game start ${g3start.status}`);
  const g3id = g3start.json?.id;
  assert(g3id, "sweeper game id");
  assert(g3start.json?.clock_active === true, "sweeper start clock_active");
  const g3exp = await api(`/api/v1/games/${g3id}/e2e/expire-clock`, { method: "POST", token });
  assert(g3exp.status === 200, `sweeper expire ${g3exp.status}`);
  assert(g3exp.json?.clock_p1_remaining_ms === 0, "sweeper expire remaining 0");
  assert(g3exp.json?.outcome == null, "sweeper expire must not finish yet");
  const g3peekEarly = await api(`/api/v1/games/${g3id}/e2e/peek-clock`, { token });
  assert(g3peekEarly.status === 200, `sweeper peek early ${g3peekEarly.status}`);
  assert(g3peekEarly.json?.outcome == null, "peek must not sync/finish before sweeper");
  await new Promise((r) => setTimeout(r, 2800));
  const g3peek = await api(`/api/v1/games/${g3id}/e2e/peek-clock`, { token });
  assert(g3peek.status === 200, `sweeper peek ${g3peek.status}`);
  assert(
    g3peek.json?.end_reason === "clock_flag",
    `sweeper peek end_reason=${g3peek.json?.end_reason}`,
  );
  assert(g3peek.json?.outcome === 2, `sweeper winner want P2 got ${g3peek.json?.outcome}`);
  assert(g3peek.json?.clock_active === false, "sweeper clock_active false");

  // Non-seat cannot burn the active clock (seat check before debit).
  const g4start = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(g4start.status === 201 || g4start.status === 200, `grief game start ${g4start.status}`);
  const g4id = g4start.json?.id;
  assert(g4id, "grief game id");
  // Snapshot via peek (no sync) so sweeper/GET debit cannot race the stranger assertion.
  const g4legal = await api(`/api/v1/games/${g4id}/state`, { token });
  assert(g4legal.status === 200, `grief before state ${g4legal.status}`);
  const moves = Array.isArray(g4legal.json.legal_moves) ? g4legal.json.legal_moves : [];
  assert(moves.length > 0, "grief legal_moves required");
  const mv = moves[0];
  const from = mv.from;
  const to = mv.to;
  assert(
    Array.isArray(from) && Array.isArray(to),
    `move coords from=${JSON.stringify(from)} to=${JSON.stringify(to)}`,
  );
  const stranger = await mintToken();
  const grief = await api(`/api/v1/games/${g4id}/move`, {
    method: "POST",
    token: stranger,
    body: { from, to },
  });
  assert(
    grief.status === 400,
    `non-seat move want 400 got ${grief.status}: ${JSON.stringify(grief.json)}`,
  );
  assert(
    String(grief.json?.error || "")
      .toLowerCase()
      .includes("not your turn"),
    `non-seat error: ${JSON.stringify(grief.json)}`,
  );
  const g4after = await api(`/api/v1/games/${g4id}/e2e/peek-clock`, { token });
  assert(g4after.status === 200, `grief peek ${g4after.status}`);
  // Stranger must not finish the game; AFK sweeper may still debit between peeks.
  assert(g4after.json?.outcome == null, "non-seat must not finish game");
  assert(g4after.json?.clock_active === true, "non-seat must leave clock active");

  // Move-path flag: expire then seated move finishes via ApplyMoveCore (not claim).
  const g5start = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(g5start.status === 201 || g5start.status === 200, `move-flag start ${g5start.status}`);
  const g5id = g5start.json?.id;
  assert(g5id, "move-flag game id");
  const g5state = await api(`/api/v1/games/${g5id}/state`, { token });
  assert(g5state.status === 200, `move-flag state ${g5state.status}`);
  const g5moves = Array.isArray(g5state.json.legal_moves) ? g5state.json.legal_moves : [];
  assert(g5moves.length > 0, "move-flag legal_moves required");
  const g5from = g5moves[0].from;
  const g5to = g5moves[0].to;
  const g5exp = await api(`/api/v1/games/${g5id}/e2e/expire-clock`, { method: "POST", token });
  assert(g5exp.status === 200, `move-flag expire ${g5exp.status}`);
  const g5move = await api(`/api/v1/games/${g5id}/move`, {
    method: "POST",
    token,
    body: { from: g5from, to: g5to },
  });
  assert(g5move.status === 200, `move-flag move ${g5move.status}: ${JSON.stringify(g5move.json)}`);
  assert(
    g5move.json?.end_reason === "clock_flag",
    `move-flag end_reason=${g5move.json?.end_reason}`,
  );
  assert(g5move.json?.outcome === 2, `move-flag winner want P2 got ${g5move.json?.outcome}`);
  assert(g5move.json?.clock_active === false, "move-flag clock_active false");

  // Increment grant after a completed ply (when DB match_clock.increment_seconds > 0).
  let incrementGranted = null;
  if (clock.increment_seconds > 0) {
    const g6start = await api("/api/v1/games/start", {
      method: "POST",
      token,
      body: { mode: "ai", ai_search_depth: 2 },
    });
    assert(g6start.status === 201 || g6start.status === 200, `inc start ${g6start.status}`);
    const g6id = g6start.json?.id;
    assert(g6id, "inc game id");
    const g6before = await api(`/api/v1/games/${g6id}/state`, { token });
    assert(g6before.status === 200, `inc before ${g6before.status}`);
    const g6moves = Array.isArray(g6before.json.legal_moves) ? g6before.json.legal_moves : [];
    assert(g6moves.length > 0, "inc legal_moves required");
    const p1Before = g6before.json.clock_p1_remaining_ms;
    const incMs = clock.increment_seconds * 1000;
    const g6move = await api(`/api/v1/games/${g6id}/move`, {
      method: "POST",
      token,
      body: { from: g6moves[0].from, to: g6moves[0].to },
    });
    assert(g6move.status === 200, `inc move ${g6move.status}: ${JSON.stringify(g6move.json)}`);
    assert(g6move.json?.outcome == null, "inc move must keep game live");
    // After human ply, turn is usually AI; P1 received increment when MustContinue cleared.
    // Allow debit noise during the request; remaining must still clear (p1Before - requestWindow + inc).
    const p1After = g6move.json.clock_p1_remaining_ms;
    assert(
      typeof p1After === "number" && p1After >= p1Before + incMs - 8000,
      `increment not granted: before=${p1Before} after=${p1After} incMs=${incMs}`,
    );
    incrementGranted = { game_id: g6id, before: p1Before, after: p1After, inc_ms: incMs };
  }

  // WS clock_flag claim (same ClaimClockFlagCore as REST; proves hub wiring + room match).
  const g7start = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(g7start.status === 201 || g7start.status === 200, `ws-flag start ${g7start.status}`);
  const g7id = g7start.json?.id;
  assert(g7id, "ws-flag game id");
  const g7exp = await api(`/api/v1/games/${g7id}/e2e/expire-clock`, { method: "POST", token });
  assert(g7exp.status === 200, `ws-flag expire ${g7exp.status}`);
  const wsUrl = `${base.replace(/^http/, "ws")}/ws/game?game_id=${encodeURIComponent(g7id)}&token=${encodeURIComponent(token)}`;
  const wsFlag = await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error("ws clock_flag timeout"));
    }, 8000);
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("ws clock_flag connect failed"));
    });
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg?.type === "welcome") {
        ws.send(JSON.stringify({ type: "clock_flag", game_id: g7id }));
        return;
      }
      if (msg?.type === "move_ack" && msg.game) {
        clearTimeout(timer);
        ws.close();
        resolve(msg.game);
        return;
      }
      if (msg?.type === "error") {
        clearTimeout(timer);
        ws.close();
        reject(new Error(`ws clock_flag error: ${msg.error}`));
      }
    });
  });
  assert(wsFlag?.end_reason === "clock_flag", `ws-flag end_reason=${wsFlag?.end_reason}`);
  assert(wsFlag?.outcome === 2, `ws-flag winner want P2 got ${wsFlag?.outcome}`);
  assert(wsFlag?.clock_active === false, "ws-flag clock_active false");

  // Insufficient-material draw on time: bare king vs bare king + flag-fall.
  const gDraw = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(
    gDraw.status === 201 || gDraw.status === 200,
    `clock_draw start ${gDraw.status}: ${JSON.stringify(gDraw.json)}`,
  );
  const gDrawId = gDraw.json?.id;
  assert(gDrawId, "clock_draw game id");
  const bare = await api(`/api/v1/games/${gDrawId}/e2e/bare-kings`, {
    method: "POST",
    token,
  });
  assert(bare.status === 200, `bare-kings ${bare.status}: ${JSON.stringify(bare.json)}`);
  const drawExp = await api(`/api/v1/games/${gDrawId}/e2e/expire-clock`, {
    method: "POST",
    token,
  });
  assert(drawExp.status === 200, `clock_draw expire ${drawExp.status}`);
  const drawFlag = await api(`/api/v1/games/${gDrawId}/clock-flag`, {
    method: "POST",
    token,
  });
  assert(
    drawFlag.status === 200,
    `clock_draw flag ${drawFlag.status}: ${JSON.stringify(drawFlag.json)}`,
  );
  assert(
    drawFlag.json?.end_reason === "clock_draw",
    `clock_draw end_reason=${drawFlag.json?.end_reason}`,
  );
  assert(drawFlag.json?.draw === true, "clock_draw draw=true");
  assert(
    String(drawFlag.json?.draw_reason || "").trim() === "insufficient_material",
    `clock_draw draw_reason=${drawFlag.json?.draw_reason} want insufficient_material`,
  );
  assert(
    drawFlag.json?.outcome === 0 || drawFlag.json?.outcome === null,
    `clock_draw outcome want draw got ${drawFlag.json?.outcome}`,
  );
  assert(drawFlag.json?.clock_active === false, "clock_draw clock_active false");

  // Concurrent flag claims: single-flight finalize (one history row; same outcome).
  const gRace = await api("/api/v1/games/start", {
    method: "POST",
    token,
    body: { mode: "ai", ai_search_depth: 2 },
  });
  assert(
    gRace.status === 201 || gRace.status === 200,
    `race start ${gRace.status}: ${JSON.stringify(gRace.json)}`,
  );
  const gRaceId = gRace.json?.id;
  assert(gRaceId, "race game id");
  const raceExp = await api(`/api/v1/games/${gRaceId}/e2e/expire-clock`, {
    method: "POST",
    token,
  });
  assert(raceExp.status === 200, `race expire ${raceExp.status}`);
  const [raceA, raceB] = await Promise.all([
    api(`/api/v1/games/${gRaceId}/clock-flag`, { method: "POST", token }),
    api(`/api/v1/games/${gRaceId}/clock-flag`, { method: "POST", token }),
  ]);
  assert(raceA.status === 200, `race claim A ${raceA.status}: ${JSON.stringify(raceA.json)}`);
  assert(raceB.status === 200, `race claim B ${raceB.status}: ${JSON.stringify(raceB.json)}`);
  assert(raceA.json?.end_reason === "clock_flag", `race A end_reason=${raceA.json?.end_reason}`);
  assert(raceB.json?.end_reason === "clock_flag", `race B end_reason=${raceB.json?.end_reason}`);
  assert(raceA.json?.outcome === raceB.json?.outcome, "race claims must agree on outcome");
  assert(
    raceA.json?.clock_active === false && raceB.json?.clock_active === false,
    "race clock inactive",
  );
  // Finalize is async - wait briefly then assert exactly one match_history row.
  let raceHistoryHits = 0;
  for (let i = 0; i < 20; i++) {
    const hist = await api("/api/v1/matches/me?skip=0&limit=50", { token });
    assert(hist.status === 200, `race history ${hist.status}: ${JSON.stringify(hist.json)}`);
    const rows = Array.isArray(hist.json?.matches) ? hist.json.matches : [];
    raceHistoryHits = rows.filter((m) => String(m?.game_id || "") === String(gRaceId)).length;
    if (raceHistoryHits >= 1) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(
    raceHistoryHits === 1,
    `race match_history hits=${raceHistoryHits} want exactly 1 for game ${gRaceId}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        game_id: g.id,
        time_control_seconds: g.time_control_seconds,
        clock_increment_seconds: g.clock_increment_seconds,
        toast_clock_flag: chrome.json.toast_clock_flag,
        you_won_on_time_message: chrome.json.you_won_on_time_message,
        end_reason: flagged.json.end_reason,
        outcome: flagged.json.outcome,
        invite_game_id: inviteGameId,
        invite_time_control_seconds: inviteState.json.time_control_seconds,
        hydrate_flag_game_id: g2id,
        hydrate_end_reason: g2state.json.end_reason,
        queue_game_id: queueGameId,
        queue_time_control_seconds: queueState.json.time_control_seconds,
        sweeper_flag_game_id: g3id,
        sweeper_end_reason: g3peek.json.end_reason,
        non_seat_rejected: true,
        move_flag_game_id: g5id,
        move_flag_end_reason: g5move.json.end_reason,
        increment_granted: incrementGranted,
        ws_flag_game_id: g7id,
        ws_flag_end_reason: wsFlag.end_reason,
        clock_draw_game_id: gDrawId,
        clock_draw_end_reason: drawFlag.json.end_reason,
        clock_draw_draw_reason: drawFlag.json.draw_reason,
        concurrent_flag_game_id: gRaceId,
        concurrent_flag_history_hits: raceHistoryHits,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
