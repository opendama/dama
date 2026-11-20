/**
 * E2E: enable all formats, create/start KO / RR / Swiss / groups_knockout.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-formats-check.mjs
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1";
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

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
    if (r.status !== 429 || attempt === maxAttempts) {
      return { status: r.status, body };
    }
    await sleep(800 * attempt);
  }
  return { status: 429, body: { error: "rate limit exceeded" } };
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

async function e2eSession(username, email, role) {
  const body = { username, email };
  if (role) body.role = role;
  const r = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
  assert(
    r.status === 200 && r.body?.access_token && r.body?.user?.id,
    `e2e session ${username} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`,
  );
  return { tok: r.body.access_token, uid: r.body.user.id };
}

async function passCashGate(tok, phone) {
  const h = { Authorization: `Bearer ${tok}` };
  let r = await req("/me/age-gate", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ date_of_birth: "1988-06-01" }),
  });
  assert(r.status < 300 || r.body?.ok === true || r.status === 200, `age-gate ${r.status}`);
  r = await req("/me/phone-kyc", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ phone }),
  });
  assert(r.status < 300, `phone-kyc ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  const otp = await req("/me/phone-kyc/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  assert(
    otp.status < 300 && otp.body?.debug_code,
    `otp start ${otp.status} ${JSON.stringify(otp.body).slice(0, 120)}`,
  );
  r = await req("/me/phone-kyc/otp/verify", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      challenge_id: otp.body.challenge_id,
      code: otp.body.debug_code,
    }),
  });
  assert(r.status < 300, `otp verify ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  r = await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  assert(r.status < 300, `locate ${r.status}`);
}

async function main() {
  const stamp = Date.now();
  const org = await e2eSession(`fmt_org_${stamp}`, `fmt_org_${stamp}@example.com`);
  await passCashGate(org.tok, `+2519${String(stamp).slice(-8)}`);
  const players = [];
  for (let i = 0; i < 8; i++) {
    const p = await e2eSession(`fmt_p${i}_${stamp}`, `fmt_p${i}_${stamp}@example.com`);
    await passCashGate(p.tok, `+2519${String(stamp).slice(-7)}${i}`);
    players.push(p);
  }
  const admin = await e2eSession(`fmt_adm_${stamp}`, `fmt_adm_${stamp}@example.com`, "admin");
  const atok = admin.tok;

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

  const pub = await req("/events/catalog");
  assert(pub.status === 200, "public catalog");
  const enabledIds = (pub.body.formats || []).map((f) => f.id);
  for (const id of ["knockout", "round_robin", "swiss", "groups_knockout"]) {
    assert(enabledIds.includes(id), `public catalog includes ${id}`);
  }
  for (const k of [
    "hosted_event_entry_pending",
    "hosted_event_entry_approved",
    "hosted_event_entry_rejected",
    "hosted_event_entry_kicked",
  ]) {
    assert(typeof pub.body?.[k] === "string" && pub.body[k].trim(), `public catalog ${k}`);
  }

  const size =
    (pub.body.sizes || []).find((s) => s.enabled !== false && Number(s.max_players) >= 8) ||
    (pub.body.sizes || []).find((s) => s.enabled !== false) ||
    (pub.body.sizes || [])[0];
  assert(size?.id, "size available");
  const currency = size.host_fee_currency || "ETB";
  creditWallet(org.uid, currency, 50000);

  const enums = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enums.status === 200, `platform enums ${enums.status}`);
  const ko = enums.body.hosted_event_knockout_format;
  const rr = enums.body.hosted_event_round_robin_format;
  const sw = enums.body.hosted_event_swiss_format;
  const gk = enums.body.hosted_event_groups_knockout_format;
  assert(ko && rr && sw && gk, "format id enums present");

  const minMap = pub.body.min_players_to_start || {};
  const bracketReady = (enums.body.hosted_event_bracket_ready || "").trim();
  const bracketDone = (enums.body.hosted_event_bracket_done || "").trim();
  const bracketLive = (enums.body.hosted_event_bracket_live || "").trim();
  assert(bracketReady && bracketDone && bracketLive, "bracket status enums");
  for (const k of [
    "hosted_event_entry_pending",
    "hosted_event_entry_approved",
    "hosted_event_entry_rejected",
    "hosted_event_entry_kicked",
  ]) {
    assert(typeof enums.body?.[k] === "string" && enums.body[k].trim(), `platform enums ${k}`);
  }
  const phaseKnockout = enums.body.hosted_event_phase_knockout;
  const phaseSwiss = enums.body.hosted_event_phase_swiss;
  const phaseGroup = enums.body.hosted_event_phase_group;
  assert(phaseKnockout && phaseSwiss && phaseGroup, "phase enums");
  const eventFinished = (enums.body.hosted_event_finished_status || "").trim();
  assert(eventFinished, "event finished status enum");
  const tokByUid = new Map(players.map((p) => [p.uid, p.tok]));

  async function fetchBracket(eid) {
    const br = await req(`/events/${eid}/bracket`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    assert(br.status === 200, `bracket fetch ${br.status}`);
    return br.body.bracket || [];
  }

  async function fetchEvent(eid) {
    const ev = await req(`/events/${eid}`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    assert(ev.status === 200 && ev.body?.id, `event get ${ev.status}`);
    return ev.body;
  }

  /** Start each ready match and abandon as player B so A wins; loop until finished or stuck. */
  async function playThrough(formatId, eid, { expectFinish = true, maxSteps = 80 } = {}) {
    let steps = 0;
    while (steps < maxSteps) {
      steps++;
      const ev = await fetchEvent(eid);
      if (ev.status === eventFinished) {
        assert(ev.winner_id, `finish ${formatId} has winner`);
        assert(steps > 1, `finish ${formatId} advanced (${steps} steps)`);
        console.log(
          "OK:",
          `playthrough ${formatId} finished in ${steps} steps winner=${ev.winner_id}`,
        );
        return ev;
      }
      const matches = await fetchBracket(eid);
      const ready = matches.find(
        (m) => m.status === bracketReady && m.player_a_id && m.player_b_id && !m.game_id,
      );
      const live = matches.find(
        (m) =>
          (m.status === bracketLive || m.game_id) &&
          m.status !== bracketDone &&
          m.player_a_id &&
          m.player_b_id,
      );
      const target = ready || live;
      if (!target) {
        if (!expectFinish) {
          console.log("OK:", `playthrough ${formatId} stopped mid-run (no ready) after ${steps}`);
          return ev;
        }
        assert(false, `playthrough ${formatId} stuck: no ready/live match status=${ev.status}`);
      }
      let gameId = target.game_id;
      if (!gameId) {
        const sg = await req(`/events/${eid}/bracket/${target.id}/start-game`, {
          method: "POST",
          headers: { Authorization: `Bearer ${org.tok}` },
        });
        assert(
          sg.status < 300 && sg.body?.game_id,
          `start-game ${formatId} ${sg.status} ${JSON.stringify(sg.body).slice(0, 160)}`,
        );
        gameId = sg.body.game_id;
      }
      const loserTok = tokByUid.get(target.player_b_id);
      assert(loserTok, `loser token for ${target.player_b_id}`);
      const ab = await req(`/games/${gameId}/abandon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${loserTok}` },
        body: JSON.stringify({}),
      });
      assert(
        ab.status < 300,
        `abandon ${formatId} ${ab.status} ${JSON.stringify(ab.body).slice(0, 160)}`,
      );
    }
    assert(false, `playthrough ${formatId} exceeded ${maxSteps} steps`);
  }

  async function createAndStart(formatId, title, minPlayers) {
    creditWallet(org.uid, currency, 5000);
    const create = await req("/events/", {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
      body: JSON.stringify({
        title,
        format_id: formatId,
        size_id: size.id,
        visibility: "private",
        is_free_entry: true,
        entry_fee_amount: 0,
        entry_fee_currency: currency,
        country_code: "ET",
      }),
    });
    assert(
      create.status < 300 && create.body?.id,
      `create ${formatId} ${create.status} ${JSON.stringify(create.body).slice(0, 160)}`,
    );
    const eid = create.body.id;
    const code = create.body.join_code;
    for (let i = 0; i < minPlayers; i++) {
      const j = await req("/events/join", {
        method: "POST",
        headers: { Authorization: `Bearer ${players[i].tok}` },
        body: JSON.stringify({ code }),
      });
      assert(
        j.status < 300,
        `join ${formatId} p${i} ${j.status} ${JSON.stringify(j.body).slice(0, 100)}`,
      );
    }
    const start = await req(`/events/${eid}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    assert(
      start.status < 300,
      `start ${formatId} ${start.status} ${JSON.stringify(start.body).slice(0, 200)}`,
    );
    let bracket = start.body.bracket || [];
    if (!bracket.length) {
      const br = await req(`/events/${eid}/bracket`, {
        headers: { Authorization: `Bearer ${org.tok}` },
      });
      assert(
        br.status === 200 && (br.body.bracket || []).length > 0,
        `bracket ${formatId} ${br.status} n=${(br.body.bracket || []).length} ${JSON.stringify(br.body).slice(0, 120)}`,
      );
      bracket = br.body.bracket || [];
    } else {
      assert(bracket.length > 0, `bracket ${formatId} n=${bracket.length}`);
    }
    const st = await req(`/events/${eid}/standings`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    assert(st.status === 200 && Array.isArray(st.body.standings), `standings ${formatId}`);
    await sleep(500);
    return { eid, bracket };
  }

  // Knockout: play through to champion.
  {
    const { eid, bracket } = await createAndStart(
      ko,
      `E2E KO ${stamp}`,
      Math.max(Number(minMap.knockout) || 4, 4),
    );
    assert(
      bracket.every((m) => !m.phase || m.phase === phaseKnockout),
      "knockout phases",
    );
    await playThrough(ko, eid);
  }

  // Round robin: finish all games ? event finished + standings placed.
  {
    const { eid } = await createAndStart(
      rr,
      `E2E RR ${stamp}`,
      Math.max(Number(minMap.round_robin) || 3, 4),
    );
    await playThrough(rr, eid);
    const st = await req(`/events/${eid}/standings`, {
      headers: { Authorization: `Bearer ${org.tok}` },
    });
    assert(
      st.status === 200 && (st.body.standings || []).some((r) => Number(r.placement) === 1),
      "round_robin placement 1",
    );
  }

  // Swiss: after round 0 completes, round 1 must appear; then finish event.
  {
    const { eid, bracket } = await createAndStart(
      sw,
      `E2E Swiss ${stamp}`,
      Math.max(Number(minMap.swiss) || 6, 6),
    );
    assert(
      bracket.some((m) => m.phase === phaseSwiss && Number(m.round_index) === 0),
      "swiss round 0 present",
    );
    const round0 = bracket.filter(
      (m) =>
        m.phase === phaseSwiss && Number(m.round_index) === 0 && m.player_a_id && m.player_b_id,
    );
    for (const m of round0) {
      const sg = await req(`/events/${eid}/bracket/${m.id}/start-game`, {
        method: "POST",
        headers: { Authorization: `Bearer ${org.tok}` },
      });
      assert(sg.status < 300 && sg.body?.game_id, `swiss r0 start-game ${sg.status}`);
      const ab = await req(`/games/${sg.body.game_id}/abandon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokByUid.get(m.player_b_id)}` },
        body: JSON.stringify({}),
      });
      assert(ab.status < 300, `swiss r0 abandon ${ab.status}`);
    }
    const after = await fetchBracket(eid);
    assert(
      after.some((m) => m.phase === phaseSwiss && Number(m.round_index) === 1),
      "swiss advanced to round 1",
    );
    await playThrough(sw, eid);
  }

  // Groups ? knockout: group phase then KO; finish to champion.
  {
    const { eid, bracket } = await createAndStart(
      gk,
      `E2E Groups ${stamp}`,
      Math.max(Number(minMap.groups_knockout) || 8, 8),
    );
    assert(
      bracket.some((m) => m.phase === phaseGroup),
      "groups phase present",
    );
    await playThrough(gk, eid);
    const finalBr = await fetchBracket(eid);
    assert(
      finalBr.some((m) => m.phase === phaseKnockout && m.status === bracketDone),
      "groups reached knockout done",
    );
  }

  const orgChrome = await req("/public/events-organizer-chrome");
  assert(orgChrome.status === 200, "organizer chrome");
  for (const k of [
    "standings_title",
    "result_card_bg_color",
    "result_card_fg_color",
    "result_card_muted_color",
    "result_card_row_wash_color",
    "result_card_share_image_action",
    "result_card_filename",
    "result_card_title_font",
    "result_card_winners_font",
    "result_card_sponsor_font",
    "result_card_placement_font",
    "result_card_name_font",
    "result_card_header_wash_alpha",
    "result_card_width",
    "result_card_row_height",
    "result_card_header_height",
    "result_card_sponsor_height",
    "result_card_placements_max",
    "result_card_row_radius",
    "result_card_pad",
    "result_card_logo_size",
    "result_card_title_y",
    "result_card_winners_y",
    "result_card_body_gap",
    "result_card_rows_top_gap",
    "result_card_bottom_pad",
    "result_card_row_inset",
    "result_card_row_inner_gap",
    "result_card_placement_x",
    "result_card_name_x",
    "result_card_row_text_y",
    "result_card_sponsor_logo_w",
    "result_card_sponsor_logo_h",
    "result_card_sponsor_logo_gap",
    "result_card_logo_text_gap",
    "dialog_shell_max_height_ratio",
    "dialog_shell_max_width",
    "dialog_shell_inset_h",
    "dialog_shell_inset_v",
    "dialog_shell_loading_height",
    "branding_preview_height",
    "branding_preview_max_width",
    "dialog_scroll_max_height",
    "wide_dialog_max_width",
    "search_field_max_width",
    "list_blurb_max_width",
    "standings_table_min_width",
    "page_card_pad",
    "page_card_gap",
    "dashboard_tile_pad",
    "dashboard_tile_radius",
    "analytics_chip_pad_h",
    "analytics_chip_pad_v",
    "analytics_chip_radius",
    "group_label_template",
    "swiss_round_label_template",
    "phase_group_label",
    "phase_knockout_label",
    "prize_pool_display_label",
    "prize_pool_display_blurb",
    "prize_pool_guarantee_label",
    "prize_pool_guarantee_blurb",
    "prize_pool_guarantee_amount_label",
    "prize_pool_now_label",
    "prize_pool_if_full_label",
    "prize_pool_guaranteed_label",
    "prize_pool_frozen_blurb",
    "prize_pool_entry_fees_note",
    "insufficient_prize_guarantee",
    "prize_pool_unavailable",
  ]) {
    assert(
      typeof orgChrome.body?.[k] === "string" && orgChrome.body[k].trim(),
      `organizer chrome ${k}`,
    );
  }
  // Public catalog must not leak disabled format ids inside sizes (while all enabled).
  const enabledSet = new Set(enabledIds);
  for (const s of pub.body.sizes || []) {
    for (const fid of s.allowed_format_ids || []) {
      assert(enabledSet.has(fid), `size ${s.id} must not list format outside enabled set ${fid}`);
    }
  }
  assert(true, "public sizes only list enabled formats");

  const playerChrome = await req("/public/events-player-chrome");
  assert(playerChrome.status === 200, "player chrome");
  for (const k of [
    "panel_max_width",
    "browse_max_width",
    "standings_table_min_width",
    "page_card_pad",
    "page_card_gap",
    "dialog_shell_max_height_ratio",
    "dialog_shell_max_width",
    "dialog_shell_loading_height",
    "branding_preview_max_width",
    "dialog_scroll_max_height",
    "prize_pool_now_label",
    "prize_pool_if_full_label",
    "prize_pool_guaranteed_label",
    "prize_pool_frozen_blurb",
    "prize_pool_entry_fees_note",
  ]) {
    assert(
      typeof playerChrome.body?.[k] === "string" && playerChrome.body[k].trim(),
      `player chrome ${k}`,
    );
  }

  // Admin format toggle: disable later formats; organizer catalog must show knockout only.
  const catAfter = {
    ...(
      await req("/console/events/catalog", {
        headers: { Authorization: `Bearer ${atok}` },
      })
    ).body,
  };
  catAfter.source = undefined;
  catAfter.formats = (catAfter.formats || []).map((f) => ({
    ...f,
    enabled: f.id === ko,
  }));
  const putKoOnly = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify(catAfter),
  });
  assert(putKoOnly.status === 200, `catalog knockout-only ${putKoOnly.status}`);
  const pubKo = await req("/events/catalog");
  assert(pubKo.status === 200, "public catalog after knockout-only");
  const pubIds = (pubKo.body.formats || []).map((f) => f.id);
  assert(pubIds.length === 1 && pubIds[0] === ko, "organizer catalog shows only knockout");
  for (const s of pubKo.body.sizes || []) {
    for (const fid of s.allowed_format_ids || []) {
      assert(fid === ko, `size ${s.id} must not list disabled format ${fid}`);
    }
  }
  assert(true, "admin disable formats filters organizer create catalog");

  const walletChrome = await req("/public/wallet-chrome");
  assert(walletChrome.status === 200, "wallet chrome");
  for (const k of [
    "payout_history_title",
    "payout_history_empty",
    "payout_history_amount_label",
    "payout_history_status_label",
    "payout_history_date_label",
    "payout_history_note_label",
    "payout_history_reviewed_label",
    "payout_history_load_failed",
    "payout_history_page_size",
    "link_transactions_href",
    "link_receipts_href",
    "list_status_pending",
    "list_status_approved",
    "list_status_rejected",
    "list_status_paid",
    "empty_value",
  ]) {
    assert(
      typeof walletChrome.body?.[k] === "string" && walletChrome.body[k].trim(),
      `wallet chrome ${k}`,
    );
  }
  const mine = await req("/payouts/mine?skip=0&limit=5", {
    headers: { Authorization: `Bearer ${org.tok}` },
  });
  assert(mine.status === 200 && Array.isArray(mine.body?.payouts), `payouts/mine ${mine.status}`);
  {
    const href = sql(
      `SELECT href_path FROM notification_kinds WHERE code='player.payout_updated'`,
    ).trim();
    const q = sql(
      `SELECT href_query_key FROM notification_kinds WHERE code='player.payout_updated'`,
    ).trim();
    assert(href === "/wallet", `notif player.payout_updated href ${href} want /wallet`);
    assert(q === "id", `notif player.payout_updated query ${q} want id`);
  }
  // Seed a payout row so history seek + status_label are proven (DB-backed, no client invent).
  const payoutIdRaw = sql(`
    INSERT INTO payout_requests (id, user_id, amount, currency, phone, provider, status, created_at)
    VALUES (gen_random_uuid(), '${org.uid}', 1, 'ETB', '0911223344', 'telebirr', 'pending', NOW())
    RETURNING id::text
  `);
  const payoutId = payoutIdRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
  assert(Boolean(payoutId), `seed payout uuid parsed from [${payoutIdRaw}]`);
  const owner = sql(
    `SELECT user_id::text FROM payout_requests WHERE id::text='${payoutId}'`,
  ).trim();
  assert(owner === org.uid, `seed payout owner ${owner} want ${org.uid}`);
  const listed = await req("/payouts/mine?skip=0&limit=5", {
    headers: { Authorization: `Bearer ${org.tok}` },
  });
  assert(listed.status === 200, `payouts/mine after seed ${listed.status}`);
  assert(
    (listed.body?.payouts || []).some((p) => p.id === payoutId),
    `payouts/mine lists seeded ${payoutId}`,
  );
  const seek = await req(`/payouts/mine?skip=0&limit=5&id=${encodeURIComponent(payoutId)}`, {
    headers: { Authorization: `Bearer ${org.tok}` },
  });
  assert(seek.status === 200, `payouts/mine seek ${seek.status}`);
  const ids = (seek.body?.payouts || []).map((p) => String(p.id || "").trim());
  assert(ids.includes(payoutId), `payouts/mine seek contains ${payoutId}`);
  const labeled = (seek.body?.payouts || []).find((p) => String(p.id || "").trim() === payoutId);
  assert(
    typeof labeled?.status_label === "string" && labeled.status_label.trim(),
    "payout status_label stamped",
  );
  assert(
    typeof seek.body?.meta?.skip === "number",
    `payouts/mine seek meta.skip ${seek.body?.meta?.skip}`,
  );

  console.log("ALL FORMAT E2E CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
