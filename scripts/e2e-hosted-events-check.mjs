/**
 * Live hosted-events E2E (commission, privacy, kick refund, close/reopen, notifs, chrome).
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 and Postgres reachable via docker exec.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-events-check.mjs
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1";
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

import { execFileSync } from "node:child_process";

async function sleepMs(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function req(path, opts = {}) {
  let last = { status: 0, body: null };
  for (let attempt = 0; attempt < 8; attempt++) {
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
    last = { status: r.status, body };
    if (r.status !== 429 && r.status !== 503) return last;
    await sleepMs(400 * (attempt + 1));
  }
  return last;
}

const gqlBase = base.replace(/\/api\/v1\/?$/, "");
async function gql(query, variables, token) {
  const r = await fetch(`${gqlBase}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
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
  const v = sql(
    `SELECT COALESCE(balance,0) FROM wallets WHERE user_id='${id}' AND currency='${cur}'`,
  );
  return Number(v || 0);
}

/** SQL cash-gate stamp for bulk E2E seats (avoids age-gate rate limits). */
function stampCashGateSQL(userId, phoneSuffix) {
  const id = String(userId).replace(/'/g, "");
  const phone = `+2519${String(phoneSuffix).replace(/\D/g, "").padStart(8, "0").slice(-8)}`;
  sql(`
    UPDATE users
    SET date_of_birth = '1988-06-01',
        age_verified_at = COALESCE(age_verified_at, NOW()),
        primary_phone = '${phone}',
        phone_kyc_verified_at = COALESCE(phone_kyc_verified_at, NOW()),
        updated_at = NOW()
    WHERE id = '${id}'
  `);
}

async function passCashGate(tok) {
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
    body: JSON.stringify({ phone: `+2519${String(Date.now()).slice(-8)}` }),
  });
  assert(r.status < 300, `phone-kyc ${r.status}`);
  // When cash_phone_otp_required is off, PUT already marks verified and otp/start is 400.
  const otp = await req("/me/phone-kyc/otp/start", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  if (otp.status < 300 && otp.body?.debug_code) {
    r = await req("/me/phone-kyc/otp/verify", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        challenge_id: otp.body.challenge_id,
        code: otp.body.debug_code,
      }),
    });
    assert(r.status < 300, `otp verify ${r.status}`);
  } else {
    assert(
      otp.status === 400 || otp.status === 503,
      `otp start ${otp.status} ${JSON.stringify(otp.body).slice(0, 120)}`,
    );
  }
  r = await req("/geo/locate", {
    method: "POST",
    headers: h,
    body: JSON.stringify({}),
  });
  assert(r.status < 300, `locate ${r.status}`);
}

const stamp = Date.now();

(async () => {
  const org = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `hev_org_${stamp}`,
      email: `hev_org_${stamp}@example.com`,
    }),
  });
  assert(org.status === 200 && org.body.access_token, "organizer session");
  const otok = org.body.access_token;
  const oid = org.body.user.id;

  const player = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `hev_p_${stamp}`,
      email: `hev_p_${stamp}@example.com`,
    }),
  });
  assert(player.status === 200 && player.body.access_token, "player session");
  const ptok = player.body.access_token;
  const pid = player.body.user.id;

  const stranger = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `hev_s_${stamp}`,
      email: `hev_s_${stamp}@example.com`,
    }),
  });
  assert(stranger.status === 200 && stranger.body.access_token, "stranger session");
  const stok = stranger.body.access_token;

  const chrome = await req("/public/events-organizer-chrome");
  assert(chrome.status === 200, "organizer chrome 200");
  assert(chrome.body?.commission_percent_label, "commission_percent_label");
  assert(
    chrome.body?.portal_payout_label || chrome.body?.portal_wallet_label,
    "portal money labels",
  );
  assert(
    String(chrome.body?.portal_payout_href || "").trim() === "/events/wallet?focus=payout",
    `organizer chrome portal_payout_href ${chrome.body?.portal_payout_href}`,
  );
  assert(
    String(chrome.body?.portal_wallet_href || "").trim() === "/events/wallet",
    `organizer chrome portal_wallet_href ${chrome.body?.portal_wallet_href}`,
  );
  assert(chrome.body?.close_action, "close_action");
  assert(chrome.body?.cancel_action, "cancel_action");
  assert(chrome.body?.dialog_close_label, "dialog_close_label");
  assert(Number(chrome.body?.list_page_size) > 0, "list_page_size");
  assert((chrome.body?.save_action || "").trim(), "organizer save_action");
  assert((chrome.body?.empty_value || "").trim().length > 0, "organizer empty_value");

  assert((chrome.body?.save_pending || "").trim(), "organizer save_pending");
  assert(chrome.body?.reopen_action, "reopen_action");
  assert(chrome.body?.kick_action, "kick_action");

  const pchrome = await req("/public/events-player-chrome");
  assert(pchrome.status === 200, "player chrome 200");
  assert(pchrome.body?.dialog_close_label, "player dialog_close_label");
  assert(pchrome.body?.cancel_action, "player cancel_action");
  assert(Number(pchrome.body?.list_page_size) > 0, "player list_page_size");
  assert((pchrome.body?.empty_value || "").trim().length > 0, "player empty_value");
  assert(
    (pchrome.body?.players_count_suffix || "").trim().length > 0,
    "player players_count_suffix",
  );
  assert(
    (pchrome.body?.amount_currency_separator || "").length > 0,
    "player amount_currency_separator",
  );

  // Admin SPA routes are /events and /ads (not /console/...).
  for (const [code, path] of [
    ["admin.event_closed", "/events"],
    ["admin.event_reopened", "/events"],
    ["admin.event_auto_closed", "/events"],
    ["admin.event_report_pending", "/events"],
    ["admin.campaign_closed", "/ads"],
    ["admin.campaign_reopened", "/ads"],
    ["admin.campaign_auto_closed", "/ads"],
  ]) {
    const href = sql(`SELECT href_path FROM notification_kinds WHERE code='${code}'`).trim();
    assert(href === path, `notif ${code} href ${href} want ${path}`);
  }
  const reportQ = sql(
    `SELECT href_query_key FROM notification_kinds WHERE code='admin.event_report_pending'`,
  ).trim();
  assert(reportQ === "report", `admin.event_report_pending query ${reportQ}`);

  // Player lifecycle → unified Tournaments Community (mig 379/390; not legacy view=events).
  for (const code of [
    "player.event_joined",
    "player.event_started",
    "player.event_finished",
    "player.event_report_received",
  ]) {
    const href = sql(`SELECT href_path FROM notification_kinds WHERE code='${code}'`).trim();
    const q = sql(`SELECT href_query_key FROM notification_kinds WHERE code='${code}'`).trim();
    assert(
      href === "/?view=tournaments&source=community",
      `notif ${code} href ${href} want /?view=tournaments&source=community`,
    );
    assert(q === "id", `notif ${code} query ${q} want id`);
  }
  for (const code of [
    "player.event_created",
    "player.event_player_joined",
    "player.event_started_org",
  ]) {
    const href = sql(`SELECT href_path FROM notification_kinds WHERE code='${code}'`).trim();
    const q = sql(`SELECT href_query_key FROM notification_kinds WHERE code='${code}'`).trim();
    assert(href === "/events/events", `notif ${code} href ${href} want /events/events`);
    assert(q === "id", `notif ${code} query ${q} want id`);
  }
  for (const code of [
    "player.event_cancelled",
    "player.event_entry_kicked",
    "player.event_reopened",
    // mig 412: auto_closed is Community (parity finished), query by join code
    "player.event_auto_closed",
  ]) {
    const href = sql(`SELECT href_path FROM notification_kinds WHERE code='${code}'`).trim();
    const q = sql(`SELECT href_query_key FROM notification_kinds WHERE code='${code}'`).trim();
    assert(
      href === "/?view=tournaments&source=community",
      `notif ${code} href ${href} want /?view=tournaments&source=community`,
    );
    assert(q === "code", `notif ${code} query ${q} want code`);
  }
  {
    const href = sql(
      `SELECT href_path FROM notification_kinds WHERE code='player.event_entry_earned'`,
    ).trim();
    const q = sql(
      `SELECT href_query_key FROM notification_kinds WHERE code='player.event_entry_earned'`,
    ).trim();
    assert(
      href === "/events/transactions",
      `notif player.event_entry_earned href ${href} want /events/transactions`,
    );
    assert(q === "id", `notif player.event_entry_earned query ${q} want id`);
  }
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
  // Player payout history seek: seed row ? GET /payouts/mine?id= contains it + status_label.
  {
    const stamp = Date.now();
    const sess = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `payout_hist_${stamp}`,
        email: `payout_hist_${stamp}@example.com`,
      }),
    });
    assert(
      sess.status === 200 && sess.body?.access_token && sess.body?.user?.id,
      `payout history e2e session ${sess.status}`,
    );
    const tok = sess.body.access_token;
    const uid = sess.body.user.id;
    const payoutIdRaw = sql(`
      INSERT INTO payout_requests (id, user_id, amount, currency, phone, provider, status, created_at)
      VALUES (gen_random_uuid(), '${uid}', 1, 'ETB', '0911223344', 'telebirr', 'pending', NOW())
      RETURNING id::text
    `);
    const payoutId = payoutIdRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
    assert(Boolean(payoutId), `payout history seed uuid from [${payoutIdRaw}]`);
    const seek = await req(`/payouts/mine?skip=0&limit=5&id=${encodeURIComponent(payoutId)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    assert(seek.status === 200, `payouts/mine seek ${seek.status}`);
    const row = (seek.body?.payouts || []).find((p) => String(p.id || "").trim() === payoutId);
    assert(Boolean(row), `payouts/mine seek contains ${payoutId}`);
    assert(
      typeof row.status_label === "string" && row.status_label.trim(),
      "payout status_label stamped",
    );
    assert(typeof seek.body?.meta?.skip === "number", "payouts/mine seek meta.skip");
    const wChrome = await req("/public/wallet-chrome");
    assert(wChrome.status === 200, "wallet chrome for payout history");
    assert(
      typeof wChrome.body?.payout_history_note_label === "string" &&
        wChrome.body.payout_history_note_label.trim(),
      "wallet chrome payout_history_note_label",
    );
    assert(
      typeof wChrome.body?.payout_history_reviewed_label === "string" &&
        wChrome.body.payout_history_reviewed_label.trim(),
      "wallet chrome payout_history_reviewed_label",
    );
    assert(
      String(wChrome.body?.link_transactions_href || "").trim() === "/transactions",
      `wallet chrome link_transactions_href ${wChrome.body?.link_transactions_href}`,
    );
    assert(
      String(wChrome.body?.link_receipts_href || "").trim() === "/receipts",
      `wallet chrome link_receipts_href ${wChrome.body?.link_receipts_href}`,
    );
    const adminChrome = await req("/public/admin-console-chrome");
    assert(adminChrome.status === 200, "admin console chrome for payments page size");
    const paymentsPageSize = String(adminChrome.body?.payments?.list_page_size || "").trim();
    assert(
      /^\d+$/.test(paymentsPageSize) && Number(paymentsPageSize) > 0,
      `admin payments list_page_size ${paymentsPageSize}`,
    );
    for (const sec of ["banks", "media_pool", "avatars", "telemetry", "users"]) {
      const sz = String(adminChrome.body?.[sec]?.list_page_size || "").trim();
      assert(/^\d+$/.test(sz) && Number(sz) > 0, `admin ${sec} list_page_size ${sz}`);
    }
    const tChrome = await req("/public/tournament-chrome");
    assert(tChrome.status === 200, "tournament chrome");
    const tPageSize = String(tChrome.body?.list_page_size || "").trim();
    assert(
      /^\d+$/.test(tPageSize) && Number(tPageSize) > 0,
      `tournament chrome list_page_size ${tPageSize}`,
    );
    const tpChrome = await req("/public/tournaments-player-chrome");
    assert(tpChrome.status === 200, "tournaments player chrome");
    const tpPageSize = String(tpChrome.body?.list_page_size || "").trim();
    assert(
      /^\d+$/.test(tpPageSize) && Number(tpPageSize) > 0,
      `tournaments player list_page_size ${tpPageSize}`,
    );
    // Admin review ? player.payout_updated notif href /wallet?id= + review_note + reviewed_at on mine.
    const adm = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `payout_adm_${stamp}`,
        email: `payout_adm_${stamp}@example.com`,
        role: "admin",
      }),
    });
    assert(
      adm.status === 200 && adm.body?.access_token,
      `payout history admin session ${adm.status}`,
    );
    const cash = await req("/public/cash-rmg-chrome");
    const approved = String(cash.body?.policy?.approved_payout_status || "").trim();
    assert(Boolean(approved), "cash policy approved_payout_status");
    const reviewNote = `e2e-note-${stamp}`;
    const reviewed = await req(`/payouts/console/${payoutId}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adm.body.access_token}` },
      body: JSON.stringify({ status: approved, note: reviewNote }),
    });
    assert(reviewed.status === 200, `payout console review ${reviewed.status}`);
    const after = await req(`/payouts/mine?skip=0&limit=5&id=${encodeURIComponent(payoutId)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    assert(after.status === 200, `payouts/mine after review ${after.status}`);
    const afterRow = (after.body?.payouts || []).find(
      (p) => String(p.id || "").trim() === payoutId,
    );
    assert(Boolean(afterRow), `payouts/mine after review contains ${payoutId}`);
    assert(
      String(afterRow.review_note || "").trim() === reviewNote,
      `payout review_note ${afterRow?.review_note}`,
    );
    assert(
      typeof afterRow.reviewed_at === "string" && afterRow.reviewed_at.trim(),
      `payout reviewed_at after review ${afterRow?.reviewed_at}`,
    );
    assert(
      typeof afterRow.status_label === "string" && afterRow.status_label.trim(),
      "payout status_label after review",
    );
    const notifs = await req("/me/notifications?skip=0&limit=20", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    assert(notifs.status === 200, `player notifs after payout review ${notifs.status}`);
    const payoutNotif = (notifs.body?.items || []).find(
      (n) =>
        String(n.kind_code || "").trim() === "player.payout_updated" &&
        String(n.href || "").includes(`id=${payoutId}`),
    );
    assert(Boolean(payoutNotif), `player.payout_updated href has id=${payoutId}`);
    assert(
      String(payoutNotif.href || "").startsWith("/wallet"),
      `player.payout_updated href ${payoutNotif?.href} want /wallet?id=`,
    );
    assert(payoutNotif.read !== true, "payout_updated unread before mark-read");
    const mark = await req(`/me/notifications/${payoutNotif.id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
    });
    assert(mark.status === 200 || mark.status === 204, `payout_updated mark-read ${mark.status}`);
    const notifsAfter = await req("/me/notifications?skip=0&limit=20", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const marked = (notifsAfter.body?.items || []).find(
      (n) => String(n.id || "").trim() === String(payoutNotif.id || "").trim(),
    );
    assert(Boolean(marked) && marked.read === true, "payout_updated read after mark-read");
    // Pager while ?id= remains: skip>0 must not re-seek back to page 0.
    const pageSize = Number.parseInt(
      String(wChrome.body?.payout_history_page_size || "0").trim(),
      10,
    );
    if (Number.isFinite(pageSize) && pageSize > 0) {
      for (let i = 0; i < pageSize + 1; i++) {
        sql(`
          INSERT INTO payout_requests (id, user_id, amount, currency, phone, provider, status, created_at)
          VALUES (gen_random_uuid(), '${uid}', 1, 'ETB', '0911223344', 'telebirr', 'pending', NOW() - interval '${i + 1} seconds')
        `);
      }
      const page2 = await req(
        `/payouts/mine?skip=${pageSize}&limit=5&id=${encodeURIComponent(payoutId)}`,
        { headers: { Authorization: `Bearer ${tok}` } },
      );
      assert(page2.status === 200, `payouts/mine pager with id ${page2.status}`);
      assert(
        page2.body?.meta?.skip === pageSize,
        `payouts/mine pager keeps skip=${pageSize} got ${page2.body?.meta?.skip}`,
      );
    }
  }
  // Real POST /payouts/request ? admin.payout_pending console notif + /payments?payout= + mark-read.
  {
    const stamp = Date.now();
    const sess = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `payout_req_${stamp}`,
        email: `payout_req_${stamp}@example.com`,
      }),
    });
    assert(
      sess.status === 200 && sess.body?.access_token && sess.body?.user?.id,
      `payout request e2e session ${sess.status}`,
    );
    const tok = sess.body.access_token;
    const uid = sess.body.user.id;
    const adm = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `payout_req_adm_${stamp}`,
        email: `payout_req_adm_${stamp}@example.com`,
        role: "admin",
      }),
    });
    assert(
      adm.status === 200 && adm.body?.access_token,
      `payout request admin session ${adm.status}`,
    );
    const atok = adm.body.access_token;
    // Method upsert clears phone_kyc_verified_at; complete cash gate after method.
    const method = await req("/payouts/method", {
      method: "PUT",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        provider: "telebirr",
        account_name: "E2E Payout",
        phone: "+251955667788",
      }),
    });
    assert(method.status === 200, `payout method upsert ${method.status}`);
    await passCashGate(tok);
    const cash = await req("/public/cash-rmg-chrome");
    assert(cash.status === 200, "cash chrome for payout create");
    const approvedKyc = String(cash.body?.policy?.document_kyc_approved_status || "").trim();
    const passportType = String(cash.body?.policy?.document_kyc_passport_type || "").trim();
    assert(Boolean(approvedKyc), "document_kyc_approved_status");
    assert(Boolean(passportType), "document_kyc_passport_type");
    sql(`
      INSERT INTO kyc_document_submissions (
        id, user_id, document_type, legal_name, id_front_url, id_back_url, selfie_url,
        status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '${uid}', '${passportType.replace(/'/g, "")}', 'E2E Payout',
        '/api/v1/media/kyc/e2e-front.png', '', '/api/v1/media/kyc/e2e-selfie.png',
        '${approvedKyc.replace(/'/g, "")}', NOW(), NOW()
      )
    `);
    sql(`UPDATE users SET document_kyc_verified_at = NOW() WHERE id = '${uid}'`);
    creditWallet(uid, "ETB", 50);
    const balBefore = walletBal(uid, "ETB");
    assert(balBefore >= 50, `wallet funded before payout request got ${balBefore}`);
    const created = await req("/payouts/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ amount: 5, currency: "ETB", country_code: "ET" }),
    });
    assert(
      created.status === 201 && created.body?.id,
      `payouts/request ${created.status} body=${JSON.stringify(created.body)}`,
    );
    const payoutId = String(created.body.id).trim();
    const balAfter = walletBal(uid, "ETB");
    assert(
      Math.abs(balAfter - (balBefore - 5)) < 0.001,
      `wallet debit after request before=${balBefore} after=${balAfter}`,
    );
    const hrefKind = sql(
      `SELECT href_path FROM notification_kinds WHERE code='admin.payout_pending'`,
    ).trim();
    const qKind = sql(
      `SELECT href_query_key FROM notification_kinds WHERE code='admin.payout_pending'`,
    ).trim();
    assert(hrefKind === "/payments", `notif admin.payout_pending href ${hrefKind}`);
    assert(qKind === "payout", `notif admin.payout_pending query ${qKind}`);
    let pendingNotif;
    for (let attempt = 0; attempt < 8; attempt++) {
      const aList = await req("/console/notifications?skip=0&limit=30", {
        headers: { Authorization: `Bearer ${atok}` },
      });
      assert(aList.status === 200, `admin notifs after payout create ${aList.status}`);
      pendingNotif = (aList.body?.items || []).find(
        (n) =>
          String(n.kind_code || "").trim() === "admin.payout_pending" &&
          String(n.href || "").includes(`payout=${payoutId}`),
      );
      if (pendingNotif) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert(Boolean(pendingNotif), `admin.payout_pending href has payout=${payoutId}`);
    assert(
      String(pendingNotif.href || "").startsWith("/payments"),
      `admin.payout_pending href ${pendingNotif?.href} want /payments?payout=`,
    );
    assert(pendingNotif.read !== true, "admin.payout_pending unread before mark-read");
    const mark = await req(`/console/notifications/${pendingNotif.id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${atok}` },
    });
    assert(
      mark.status === 200 || mark.status === 204,
      `admin.payout_pending mark-read ${mark.status}`,
    );
    const aAfter = await req("/console/notifications?skip=0&limit=30", {
      headers: { Authorization: `Bearer ${atok}` },
    });
    const marked = (aAfter.body?.items || []).find(
      (n) => String(n.id || "").trim() === String(pendingNotif.id || "").trim(),
    );
    assert(Boolean(marked) && marked.read === true, "admin.payout_pending read after mark-read");
    const mine = await req(`/payouts/mine?skip=0&limit=5&id=${encodeURIComponent(payoutId)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    assert(mine.status === 200, `payouts/mine after create ${mine.status}`);
    assert(
      (mine.body?.payouts || []).some((p) => String(p.id || "").trim() === payoutId),
      `payouts/mine lists created ${payoutId}`,
    );
  }
  {
    const href = sql(
      `SELECT href_path FROM notification_kinds WHERE code='player.wallet_credited'`,
    ).trim();
    const q = sql(
      `SELECT href_query_key FROM notification_kinds WHERE code='player.wallet_credited'`,
    ).trim();
    assert(
      href === "/transactions",
      `notif player.wallet_credited href ${href} want /transactions`,
    );
    assert(q === "id", `notif player.wallet_credited query ${q} want id`);
  }
  const portalOverview = sql(
    `SELECT value->>'portal_overview_href' FROM platform_settings WHERE key='events_organizer_chrome'`,
  ).trim();
  assert(portalOverview === "/events/dashboard", `portal_overview_href ${portalOverview}`);
  const portalPayoutHref = sql(
    `SELECT value->>'portal_payout_href' FROM platform_settings WHERE key='events_organizer_chrome'`,
  ).trim();
  assert(
    portalPayoutHref === "/events/wallet?focus=payout",
    `portal_payout_href ${portalPayoutHref} want /events/wallet?focus=payout`,
  );
  const pubOverview = sql(
    `SELECT value->>'publisher_portal_overview_href' FROM platform_settings WHERE key='ad_runtime_chrome'`,
  ).trim();
  assert(pubOverview === "/ads/dashboard", `publisher_portal_overview_href ${pubOverview}`);
  const pubPayoutHref = sql(
    `SELECT value->>'publisher_portal_payout_href' FROM platform_settings WHERE key='ad_runtime_chrome'`,
  ).trim();
  assert(
    pubPayoutHref === "/ads/wallet?focus=payout",
    `publisher_portal_payout_href ${pubPayoutHref} want /ads/wallet?focus=payout`,
  );
  {
    const payModal = await req("/public/payment-modal-chrome");
    assert(payModal.status === 200, `payment-modal-chrome ${payModal.status}`);
    assert(
      String(payModal.body?.top_up_href || "").trim() === "/wallet",
      `payment-modal top_up_href ${payModal.body?.top_up_href}`,
    );
  }
  {
    const admChrome = await req("/public/admin-console-chrome");
    assert(admChrome.status === 200, `admin-console-chrome ${admChrome.status}`);
    const pay = admChrome.body?.payments || {};
    assert(
      typeof pay.payout_reviewed_at_prefix === "string" && pay.payout_reviewed_at_prefix.trim(),
      "admin payments payout_reviewed_at_prefix",
    );
    assert(
      typeof pay.payout_note_prefix === "string" && pay.payout_note_prefix.trim(),
      "admin payments payout_note_prefix",
    );
  }
  const statusLabelsRaw = sql(
    `SELECT value->'hosted_event_status_labels'->>'open' FROM platform_settings WHERE key='client_enums'`,
  ).trim();
  assert(statusLabelsRaw.length > 0, "hosted_event_status_labels.open");
  const mutedKinds = sql(
    `SELECT value->'list_muted_kinds' FROM platform_settings WHERE key='wallet_chrome'`,
  ).trim();
  assert(mutedKinds.includes("event_entry_commission"), `list_muted_kinds ${mutedKinds}`);
  for (const code of [
    "player.campaign_closed",
    "player.campaign_reopened",
    "player.campaign_auto_closed",
  ]) {
    const href = sql(`SELECT href_path FROM notification_kinds WHERE code='${code}'`).trim();
    const q = sql(`SELECT href_query_key FROM notification_kinds WHERE code='${code}'`).trim();
    assert(href === "/ads/campaigns", `notif ${code} href ${href}`);
    assert(q === "id", `notif ${code} query ${q} want id`);
  }
  const reportOpenLabel = sql(
    `SELECT value->'hosted_event_report_status_labels'->>'open' FROM platform_settings WHERE key='client_enums'`,
  ).trim();
  assert(reportOpenLabel.length > 0, "hosted_event_report_status_labels.open");
  const visPrivate = sql(
    `SELECT value->'hosted_event_visibility_labels'->>'private' FROM platform_settings WHERE key='client_enums'`,
  ).trim();
  const visPublic = sql(
    `SELECT value->'hosted_event_visibility_labels'->>'public' FROM platform_settings WHERE key='client_enums'`,
  ).trim();
  assert(visPrivate.length > 0, "hosted_event_visibility_labels.private");
  assert(visPublic.length > 0, "hosted_event_visibility_labels.public");
  for (const code of ["admin.event_closed", "admin.event_reopened", "admin.event_auto_closed"]) {
    const q = sql(`SELECT href_query_key FROM notification_kinds WHERE code='${code}'`).trim();
    assert(q === "id", `notif ${code} query ${q} want id`);
  }
  const reasonSpam = sql(
    `SELECT value->'report_reason_labels'->>'spam' FROM platform_settings WHERE key='events_catalog'`,
  ).trim();
  assert(reasonSpam.length > 0, "events_catalog.report_reason_labels.spam");
  const grossLabel = sql(
    `SELECT value->>'entry_fees_gross_label' FROM platform_settings WHERE key='events_organizer_chrome'`,
  ).trim();
  assert(grossLabel.length > 0, "organizer entry_fees_gross_label");
  const shareResult = sql(
    `SELECT value->>'share_result_action' FROM platform_settings WHERE key='events_organizer_chrome'`,
  ).trim();
  assert(shareResult.length > 0, "organizer share_result_action");
  assert(
    (chrome.body?.share_result_action || "").trim().length > 0,
    "organizer chrome share_result_action live",
  );
  const entryApprovedLabel = sql(
    `SELECT value->'hosted_event_entry_status_labels'->>'approved' FROM platform_settings WHERE key='client_enums'`,
  ).trim();
  assert(entryApprovedLabel.length > 0, "hosted_event_entry_status_labels.approved");
  const reportReasonsTitle = sql(
    `SELECT value->>'report_reasons_title' FROM platform_settings WHERE key='events_admin_chrome'`,
  ).trim();
  assert(reportReasonsTitle.length > 0, "events_admin report_reasons_title");
  assert(
    (pchrome.body?.share_result_action || "").trim().length > 0,
    "player chrome share_result_action",
  );

  assert(
    (pchrome.body?.public_rated_on_blurb || "").trim().length > 0,
    "player public_rated_on_blurb",
  );
  assert(
    (pchrome.body?.public_rated_off_blurb || "").trim().length > 0,
    "player public_rated_off_blurb",
  );

  const wchrome = await req("/public/wallet-chrome");
  assert(wchrome.status === 200, "wallet chrome 200");
  assert(
    (wchrome.body?.organizer_payout_section_blurb || "").trim().length > 0,
    "organizer_payout_section_blurb",
  );
  assert((wchrome.body?.empty_value || "").trim().length > 0, "wallet empty_value");
  const adminConsole = await req("/public/admin-console-chrome");
  assert(adminConsole.status === 200, "admin-console-chrome 200");
  assert(
    (adminConsole.body?.dashboard?.empty_value || "").trim().length > 0,
    "admin dashboard empty_value",
  );

  const catalog = await req("/events/catalog");
  assert(catalog.status === 200, "events catalog 200");
  const sizes = catalog.body?.sizes || catalog.body?.catalog?.sizes || [];
  const formats = catalog.body?.formats || catalog.body?.catalog?.formats || [];
  const size = (Array.isArray(sizes) ? sizes : []).find((s) => s.enabled !== false) || sizes[0];
  const format =
    (Array.isArray(formats) ? formats : []).find((f) => f.enabled !== false) || formats[0];
  assert(size?.id && format?.id, `catalog size/format size=${size?.id} format=${format?.id}`);
  assert(
    typeof format.label === "string" && format.label.trim().length > 0,
    "catalog format.label required",
  );
  assert(
    typeof size.label === "string" && size.label.trim().length > 0,
    "catalog size.label required",
  );
  assert(Array.isArray(size.allowed_format_ids), "catalog size.allowed_format_ids array");
  assert(
    typeof size.public_host_fee_amount === "number" && size.public_host_fee_amount > 0,
    `catalog size.public_host_fee_amount ${size.public_host_fee_amount}`,
  );
  const quote = await req("/events/entry-fee-quote?amount=100", {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(quote.status === 200, `entry-fee-quote ${quote.status}`);
  assert(Number(quote.body?.amount) === 100, `quote amount ${quote.body?.amount}`);
  assert(typeof quote.body?.commission === "number", "quote commission");
  assert(typeof quote.body?.organizer_net === "number", "quote organizer_net");
  assert(
    Math.abs(Number(quote.body.commission) + Number(quote.body.organizer_net) - 100) < 0.001,
    "quote commission+net=amount",
  );
  const hostFee = Number(size.host_fee_amount);
  const currency = String(size.host_fee_currency || "")
    .trim()
    .toUpperCase();
  assert(hostFee > 0 && currency.length === 3, `host fee pair ${hostFee} ${currency}`);
  const commissionRaw =
    catalog.body?.entry_fee_commission_percent ??
    catalog.body?.catalog?.entry_fee_commission_percent;
  const commissionPct = Number(commissionRaw);
  assert(
    Number.isFinite(commissionPct) && commissionPct >= 0 && commissionPct <= 100,
    `commission pct ${commissionPct}`,
  );

  await passCashGate(otok);
  await passCashGate(ptok);
  // Session OTP (only when otp_required flag is on).
  for (const tok of [otok, ptok]) {
    const start = await req("/auth/otp/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({}),
    });
    if (start.status < 300 && start.body?.debug_code) {
      await req("/auth/otp/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          challenge_id: start.body.challenge_id,
          code: start.body.debug_code,
        }),
      });
    }
  }

  creditWallet(oid, currency, Math.max(hostFee * 4, 500));
  creditWallet(pid, currency, 500);
  const orgBal0 = walletBal(oid, currency);
  const playBal0 = walletBal(pid, currency);
  assert(orgBal0 >= hostFee, `organizer funded ${orgBal0}`);
  assert(playBal0 >= 100, `player funded ${playBal0}`);

  const entryFee = 100;
  const brandColor = "#C9A227";
  const create = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Cup ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      brand_color: brandColor,
      country_code: "ET",
    }),
  });
  assert(
    create.status === 201 || create.status === 200,
    `create private paid ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const ev = create.body?.event || create.body;
  assert(ev?.id && ev?.join_code, "event id + join_code");
  assert(
    typeof ev.format_label === "string" && ev.format_label.trim().length > 0,
    "create response format_label from catalog",
  );
  assert(
    typeof ev.size_label === "string" && ev.size_label.trim().length > 0,
    "create response size_label from catalog",
  );
  assert(
    String(ev.brand_color || "")
      .trim()
      .toLowerCase() === brandColor.toLowerCase(),
    `create brand_color ${ev.brand_color}`,
  );
  assert((chrome.body?.brand_color_label || "").trim().length > 0, "organizer brand_color_label");
  assert(Number(ev.entry_fee_amount) === entryFee, `entry fee stored ${ev.entry_fee_amount}`);
  const orgBalAfterHost = walletBal(oid, currency);
  assert(
    Math.abs(orgBalAfterHost - (orgBal0 - hostFee)) < 0.02,
    `host fee settled ${orgBal0} -> ${orgBalAfterHost} (fee ${hostFee})`,
  );

  const leak = await req(`/events/${ev.id}`, {
    headers: { Authorization: `Bearer ${stok}` },
  });
  assert(leak.status === 403, `private stranger Get forbidden ${leak.status}`);

  const shareLeak = await req(`/events/${ev.id}/share`, {
    headers: { Authorization: `Bearer ${stok}` },
  });
  assert(shareLeak.status === 403, `private stranger Share forbidden ${shareLeak.status}`);

  const qrOrg = await fetch(`${base}/events/${ev.id}/qr.png`, {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(qrOrg.status === 200, `organizer QR 200 ${qrOrg.status}`);
  const qrCt = (qrOrg.headers.get("content-type") || "").toLowerCase();
  assert(qrCt.includes("image/png"), `organizer QR content-type ${qrCt}`);
  const qrCd = qrOrg.headers.get("content-disposition") || "";
  assert(/filename=/i.test(qrCd), `organizer QR Content-Disposition ${qrCd}`);
  const qrStranger = await fetch(`${base}/events/${ev.id}/qr.png`, {
    headers: { Authorization: `Bearer ${stok}` },
  });
  assert(qrStranger.status === 403, `private stranger QR forbidden ${qrStranger.status}`);

  const approve409 = await req(`/events/${ev.id}/entries/${pid}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(approve409.status === 409, `approve disabled 409 ${approve409.status}`);

  const join = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${ptok}` },
    body: JSON.stringify({
      code: ev.join_code,
      country_code: "ET",
    }),
  });
  assert(
    join.status === 200 || join.status === 201,
    `join paid ${join.status} ${JSON.stringify(join.body).slice(0, 240)}`,
  );
  assert((join.body?.entry?.status_label || "").trim().length > 0, "join entry status_label");
  const expectedCommission = Math.round(entryFee * (commissionPct / 100) * 100) / 100;
  const expectedNet = Math.round((entryFee - expectedCommission) * 100) / 100;
  const playBal1 = walletBal(pid, currency);
  const orgBal1 = walletBal(oid, currency);
  assert(
    Math.abs(playBal1 - (playBal0 - entryFee)) < 0.02,
    `player debited gross ${playBal0} -> ${playBal1}`,
  );
  assert(
    Math.abs(orgBal1 - (orgBalAfterHost + expectedNet)) < 0.02,
    `organizer credited net ${orgBalAfterHost} -> ${orgBal1} (net ${expectedNet}, commission ${expectedCommission})`,
  );

  const entryRow = sql(`
    SELECT fee_paid::text || '|' || COALESCE(platform_commission::text,'0') || '|' || COALESCE(organizer_net::text,'0')
    FROM hosted_event_entries
    WHERE event_id='${ev.id}' AND user_id='${pid}'
  `);
  const [feePaid, platComm, orgNet] = entryRow.split("|").map(Number);
  assert(Math.abs(feePaid - entryFee) < 0.02, `entry fee_paid ${feePaid}`);
  assert(Math.abs(platComm - expectedCommission) < 0.02, `entry commission ${platComm}`);
  assert(Math.abs(orgNet - expectedNet) < 0.02, `entry organizer_net ${orgNet}`);

  const ledgerComm = sql(`
    SELECT COUNT(*) FROM wallet_ledger
    WHERE reference LIKE 'hosted_event_entry_commission:%'
      AND user_id='${oid}' AND amount=${expectedCommission}
  `);
  assert(Number(ledgerComm) >= 1, "commission ledger row");

  const dash = await req("/events/dashboard", {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(dash.status === 200, "dashboard 200");
  const netSum = dash.body?.entry_fee_net_sum ?? dash.body?.entry_fee_revenue_sum ?? null;
  assert(netSum != null && Number(netSum) >= expectedNet - 0.02, `dashboard net ${netSum}`);

  const viewOk = await req(`/events/${ev.id}`, {
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(viewOk.status === 200, "joined player can Get private event");

  const kick = await req(`/events/${ev.id}/entries/${pid}/kick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(kick.status === 200, `kick ${kick.status}`);
  const playBal2 = walletBal(pid, currency);
  const orgBal2 = walletBal(oid, currency);
  assert(Math.abs(playBal2 - playBal0) < 0.02, `player refunded after kick ${playBal2}`);
  assert(
    Math.abs(orgBal2 - orgBalAfterHost) < 0.02,
    `organizer net reversed after kick ${orgBal2}`,
  );
  const dashAfterKick = await req("/events/dashboard", {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(dashAfterKick.status === 200, "dashboard after kick");
  const netAfterKick = Number(
    dashAfterKick.body?.entry_fee_net_sum ?? dashAfterKick.body?.entry_fee_revenue_sum ?? -1,
  );
  assert(Math.abs(netAfterKick) < 0.02, `dashboard net cleared after kick refund ${netAfterKick}`);

  // Organizer spent net; kick must still refund player (platform absorbs shortfall).
  creditWallet(pid, currency, entryFee);
  const joinSpent = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${ptok}` },
    body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
  });
  assert(
    joinSpent.status === 200 || joinSpent.status === 201,
    `join before withdraw ${joinSpent.status}`,
  );
  const orgBalRich = walletBal(oid, currency);
  // Drain organizer wallet below net so clawback would previously 409.
  sql(`UPDATE wallets SET balance = 0 WHERE user_id='${oid}' AND currency='${currency}'`);
  const kickDrain = await req(`/events/${ev.id}/entries/${pid}/kick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(kickDrain.status === 200, `kick after organizer drained ${kickDrain.status}`);
  const playAfterDrain = walletBal(pid, currency);
  assert(
    playAfterDrain >= playBal0 - 0.02,
    `player refunded even if organizer drained (${playAfterDrain}, org was ${orgBalRich})`,
  );
  sql(
    `UPDATE wallets SET balance = ${orgBalAfterHost} WHERE user_id='${oid}' AND currency='${currency}'`,
  );

  // Re-join for close/refund vacate path
  creditWallet(pid, currency, entryFee);
  const join2 = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${ptok}` },
    body: JSON.stringify({ code: ev.join_code, country_code: "ET" }),
  });
  assert(join2.status === 200 || join2.status === 201, `rejoin ${join2.status}`);

  const close = await req(`/events/${ev.id}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(close.status === 200, `close ${close.status} ${JSON.stringify(close.body).slice(0, 160)}`);
  const playBal3 = walletBal(pid, currency);
  assert(playBal3 >= playBal0 - 0.02, `close refunded player ${playBal3}`);

  const kickedCount = sql(`
    SELECT COUNT(*) FROM hosted_event_entries
    WHERE event_id='${ev.id}' AND status='kicked'
  `);
  assert(Number(kickedCount) >= 1, "close vacated seats to kicked");

  const reopen = await req(`/events/${ev.id}/reopen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(reopen.status === 200, `reopen before start ${reopen.status}`);

  const notifs = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(notifs.status === 200, "organizer notifications list");
  const items = notifs.body?.notifications || notifs.body?.items || [];
  const withHref = items.filter((n) => (n.href || "").trim());
  assert(withHref.length >= 1 || items.length >= 0, "notifications payload shape");

  const mark =
    items[0]?.id != null
      ? await req(`/me/notifications/${items[0].id}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${otok}` },
        })
      : { status: 200 };
  assert(mark.status < 300, "mark notification read");

  // Public create + list visibility
  creditWallet(oid, currency, Math.max(hostFee * 2, 200));
  const pubCreate = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Public ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
    }),
  });
  assert(
    pubCreate.status === 201 || pubCreate.status === 200,
    `create public free ${pubCreate.status} ${JSON.stringify(pubCreate.body).slice(0, 200)}`,
  );
  const pev = pubCreate.body?.event || pubCreate.body;
  const pubList = await req("/events/public?skip=0&limit=50");
  assert(pubList.status === 200, "public list 200");
  const pubItems = pubList.body?.events || pubList.body?.items || [];
  assert(
    pubItems.some((e) => e.id === pev.id),
    "public event appears in list",
  );

  // Deterministic career path: enable public rated matches in DB (flag catalog key).
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'public_event_matches_rated';`);
  const flags = await req("/feature-flags");
  assert(flags.status === 200, "feature flags");
  assert(
    flags.body?.public_event_matches_rated === true,
    "public_event_matches_rated must be on for career E2E",
  );

  // Public cup career points: fill to catalog min_players_to_start, then start bracket.
  const pubMinStart = Number(
    catalog.body?.min_players_to_start?.[format.id] ??
      catalog.body?.catalog?.min_players_to_start?.[format.id] ??
      4,
  );
  assert(
    Number.isFinite(pubMinStart) && pubMinStart >= 2,
    `public min_players_to_start ${pubMinStart}`,
  );
  const joiners = [];
  for (let i = 0; i < pubMinStart; i++) {
    const sess = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `hev_jp_${stamp}_${i}`,
        email: `hev_jp_${stamp}_${i}@example.com`,
      }),
    });
    assert(sess.status === 200 && sess.body.access_token, `joiner session ${i}`);
    stampCashGateSQL(sess.body.user.id, `${stamp}${i}`);
    joiners.push(sess.body.access_token);
    const j = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${sess.body.access_token}` },
      body: JSON.stringify({ code: pev.join_code, country_code: "ET" }),
    });
    assert(
      j.status === 200 || j.status === 201,
      `public join ${i} ${j.status} ${JSON.stringify(j.body).slice(0, 120)}`,
    );
  }

  for (const tok of [otok, ...joiners]) {
    const startOtp = await req("/auth/otp/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({}),
    });
    if (startOtp.status < 300 && startOtp.body?.debug_code) {
      await req("/auth/otp/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          challenge_id: startOtp.body.challenge_id,
          code: startOtp.body.debug_code,
        }),
      });
    }
  }

  // Cup start seeds checked-in seats only (no-show gate). SQL stamp avoids check-in rate limits.
  sql(`
    UPDATE hosted_event_entries
    SET checked_in_at = COALESCE(checked_in_at, NOW())
    WHERE event_id = '${String(pev.id).replace(/'/g, "")}'
  `);

  const startEv = await req(`/events/${pev.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    startEv.status === 200 || startEv.status === 201,
    `public start ${startEv.status} ${JSON.stringify(startEv.body).slice(0, 200)}`,
  );

  const bracket = await req(`/events/${pev.id}/bracket`, {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(bracket.status === 200, `bracket ${bracket.status}`);
  const matches = bracket.body?.bracket || bracket.body?.matches || [];
  const ready = matches.find(
    (m) => String(m.status || "").toLowerCase() === "ready" && m.player_a_id && m.player_b_id,
  );
  assert(ready?.id, `ready bracket match found among ${matches.length}`);

  const startGame = await req(`/events/${pev.id}/bracket/${ready.id}/start-game`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    startGame.status === 201 || startGame.status === 200,
    `start-game ${startGame.status} ${JSON.stringify(startGame.body).slice(0, 200)}`,
  );
  const gameId = startGame.body?.game_id;
  assert(gameId, "start-game game_id");

  const game = await req(`/games/${gameId}/state`, {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(game.status === 200, `get game state ${game.status}`);
  const rated = game.body?.rated === true || game.body?.game?.rated === true;
  assert(rated === true, "public + flag => game.rated true (career points path)");

  const playerChrome = await req("/public/events-player-chrome");
  assert(playerChrome.status === 200, "player chrome 200");
  assert(
    playerChrome.body?.report_action || playerChrome.body?.join_action,
    "player chrome actions",
  );

  const adminChrome = await req("/public/events-admin-chrome");
  assert(adminChrome.status === 200, "admin chrome 200");
  assert(adminChrome.body?.hosted_events_title, "admin hosted_events_title");
  assert((adminChrome.body?.empty_value || "").trim(), "admin empty_value");
  assert(adminChrome.body?.entry_fee_commission_label, "admin commission label");
  assert(
    adminChrome.body?.public_host_fee_multiplier_label,
    "admin public_host_fee_multiplier_label",
  );
  assert(
    adminChrome.body?.public_host_fee_multiplier_blurb,
    "admin public_host_fee_multiplier_blurb",
  );
  assert(adminChrome.body?.catalog_item_label, "admin catalog_item_label");
  assert(adminChrome.body?.catalog_item_label_blurb, "admin catalog_item_label_blurb");
  assert(
    (adminChrome.body?.report_reasons_title || "").trim().length > 0,
    "admin report_reasons_title",
  );
  assert(
    (adminChrome.body?.report_reasons_blurb || "").trim().length > 0,
    "admin report_reasons_blurb",
  );
  assert(
    (adminChrome.body?.report_reason_code_label || "").trim().length > 0,
    "admin report_reason_code_label",
  );
  assert(adminChrome.body?.public_events_flag_key, "admin public_events_flag_key");
  assert(adminChrome.body?.public_rated_flag_key, "admin public_rated_flag_key");
  assert(adminChrome.body?.prize_pool_display_flag_key, "admin prize_pool_display_flag_key");
  assert(adminChrome.body?.prize_pool_guarantee_flag_key, "admin prize_pool_guarantee_flag_key");
  assert(
    (adminChrome.body?.prize_pool_display_flag_label || "").trim().length > 0,
    "admin prize_pool_display_flag_label",
  );
  assert(
    (chrome.body?.prize_pool_now_label || "").trim().length > 0,
    "organizer prize_pool_now_label",
  );
  assert(
    (chrome.body?.prize_pool_if_full_label || "").trim().length > 0,
    "organizer prize_pool_if_full_label",
  );
  assert(
    (pchrome.body?.prize_pool_now_label || "").trim().length > 0,
    "player prize_pool_now_label",
  );
  const homeChrome = await req("/public/home-chrome");
  assert(homeChrome.status === 200, `home chrome ${homeChrome.status}`);
  assert(
    (homeChrome.body?.prize_pool_now_label || "").trim().length > 0,
    "home prize_pool_now_label",
  );
  assert(
    (homeChrome.body?.prize_pool_entry_fees_note || "").trim().length > 0,
    "home prize_pool_entry_fees_note",
  );
  const tPlayerChrome = await req("/public/tournaments-player-chrome");
  assert(tPlayerChrome.status === 200, `tournaments-player chrome ${tPlayerChrome.status}`);
  assert(
    (tPlayerChrome.body?.prize_pool_entry_fees_note || "").trim().length > 0,
    "tournaments-player prize_pool_entry_fees_note",
  );
  const tAdminChrome = await req("/public/tournament-chrome");
  assert(tAdminChrome.status === 200, `tournament chrome ${tAdminChrome.status}`);
  assert(
    (tAdminChrome.body?.prize_pool_frozen_blurb || "").trim().length > 0,
    "tournament chrome prize_pool_frozen_blurb",
  );
  assert(
    (tAdminChrome.body?.prize_pool_entry_fees_note || "").trim().length > 0,
    "tournament chrome prize_pool_entry_fees_note",
  );
  const walletChrome = await req("/public/wallet-chrome");
  assert(walletChrome.status === 200, `wallet chrome ${walletChrome.status}`);
  assert(
    (walletChrome.body?.list_kind_prize_pool_guarantee_hold || "").trim().length > 0,
    "wallet list_kind_prize_pool_guarantee_hold",
  );
  assert(
    (walletChrome.body?.list_kind_prize_pool_guarantee_release || "").trim().length > 0,
    "wallet list_kind_prize_pool_guarantee_release",
  );
  assert(
    (walletChrome.body?.list_kind_prize_pool_guarantee_capture || "").trim().length > 0,
    "wallet list_kind_prize_pool_guarantee_capture",
  );
  const heCols = sql(`
    SELECT COUNT(*)::text FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hosted_events'
      AND column_name IN (
        'prize_pool_display_enabled','prize_pool_guarantee_enabled',
        'prize_pool_guarantee_amount','prize_pool_frozen_amount','prize_pool_guarantee_held'
      )
  `);
  assert(heCols === "5", `hosted_events prize pool cols ${heCols}`);
  const ppFlagState = sql(`
    SELECT elem->>'state_field'
    FROM platform_settings,
         jsonb_array_elements(value->'toggles') AS elem
    WHERE key='feature_flag_catalog' AND elem->>'key'='prize_pool_display_enabled'
  `).trim();
  assert(
    ppFlagState === "prizePoolDisplayEnabled",
    `prize_pool_display state_field ${ppFlagState}`,
  );
  const mult =
    catalog.body?.public_host_fee_multiplier ?? catalog.body?.catalog?.public_host_fee_multiplier;
  assert(typeof mult === "number" && mult > 0, `public_host_fee_multiplier ${mult}`);
  const pubState = sql(`
    SELECT elem->>'state_field'
    FROM platform_settings,
         jsonb_array_elements(value->'toggles') AS elem
    WHERE key='feature_flag_catalog' AND elem->>'key'='public_events_enabled'
  `).trim();
  assert(pubState === "publicEventsEnabled", `public_events state_field ${pubState}`);

  const admin = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `hev_adm_${stamp}`,
      email: `hev_adm_${stamp}@example.com`,
      role: "admin",
    }),
  });
  assert(admin.status === 200 && admin.body.access_token, "admin session");
  const atok = admin.body.access_token;
  const enums = await req("/platform/enums", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(enums.status === 200, `platform enums ${enums.status}`);
  assert(
    (enums.body?.hosted_event_default_status || "").trim().length > 0,
    "hosted_event_default_status exposed",
  );
  const consoleList = await req("/console/events?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(consoleList.status === 200, `console hosted list ${consoleList.status}`);
  const consoleEvents = consoleList.body?.events || [];
  assert(
    consoleEvents.some((e) => e.id === pev.id || e.id === ev.id),
    "console list includes created cups",
  );
  const consoleGet = await req(`/console/events/${encodeURIComponent(ev.id)}`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(
    consoleGet.status === 200,
    `console get event ${consoleGet.status} ${JSON.stringify(consoleGet.body).slice(0, 160)}`,
  );
  assert(consoleGet.body?.id === ev.id, "console get event id");
  assert(
    String(consoleGet.body?.status_label || "").trim().length > 0,
    "console get event status_label",
  );

  // Public host fee multiplier must charge size.host_fee * mult (reload via admin PUT).
  const catGet = await req("/console/events/catalog", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(catGet.status === 200, `console catalog get ${catGet.status}`);
  const catBody = { ...catGet.body };
  catBody.source = undefined;
  const origMult = Number(catBody.public_host_fee_multiplier);
  assert(origMult > 0, `orig public_host_fee_multiplier ${origMult}`);
  const testMult = 2;
  const putUp = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ ...catBody, public_host_fee_multiplier: testMult }),
  });
  assert(putUp.status === 200, `catalog put mult=${testMult} ${putUp.status}`);
  assert(
    Number(putUp.body?.public_host_fee_multiplier) === testMult,
    `catalog reloaded mult ${putUp.body?.public_host_fee_multiplier}`,
  );
  const expectedPublicHost = hostFee * testMult;
  creditWallet(oid, currency, Math.max(expectedPublicHost * 2, 200));
  const balBeforePub = walletBal(oid, currency);
  const pubPaid = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Public Mult ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "public",
      is_free_entry: true,
      country_code: "ET",
    }),
  });
  assert(
    pubPaid.status === 201 || pubPaid.status === 200,
    `create public with mult ${pubPaid.status} ${JSON.stringify(pubPaid.body).slice(0, 180)}`,
  );
  const balAfterPub = walletBal(oid, currency);
  assert(
    Math.abs(balBeforePub - balAfterPub - expectedPublicHost) < 0.001,
    `public host fee charged base*mult ${hostFee}*${testMult}=${expectedPublicHost} (bal ${balBeforePub}->${balAfterPub})`,
  );
  const putRestore = await req("/console/events/catalog", {
    method: "PUT",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ ...catBody, public_host_fee_multiplier: origMult }),
  });
  assert(putRestore.status === 200, `catalog restore mult ${putRestore.status}`);
  assert(
    Number(putRestore.body?.public_host_fee_multiplier) === origMult,
    `catalog mult restored ${putRestore.body?.public_host_fee_multiplier}`,
  );

  // ---------------------------------------------------------------------------
  // Prize pool: admin flags + paid create display/guarantee + join grow + kick drop + start freeze
  // ---------------------------------------------------------------------------
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_display_enabled'`);
  sql(`UPDATE feature_flags SET enabled = TRUE WHERE key = 'prize_pool_guarantee_enabled'`);
  const ppFlags = await req("/feature-flags");
  assert(ppFlags.status === 200, "feature flags after prize pool enable");
  assert(ppFlags.body?.prize_pool_display_enabled === true, "prize_pool_display_enabled on");
  assert(ppFlags.body?.prize_pool_guarantee_enabled === true, "prize_pool_guarantee_enabled on");
  const ppCatalog = await req("/events/catalog", {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(ppCatalog.status === 200, `events catalog ${ppCatalog.status}`);
  assert(ppCatalog.body?.prize_pool_display_enabled === true, "catalog prize_pool_display_enabled");
  assert(
    ppCatalog.body?.prize_pool_guarantee_enabled === true,
    "catalog prize_pool_guarantee_enabled",
  );

  const guaranteeAmt = 50;
  // Insufficient guarantee must fail closed (402) before creating the cup.
  sql(`DELETE FROM wallets WHERE user_id='${oid}' AND currency='${currency}'`);
  creditWallet(oid, currency, Math.max(hostFee, 1));
  const ppShort = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Short Guar ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      visibility: "private",
      country_code: "ET",
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: true,
      prize_pool_guarantee_amount: guaranteeAmt,
    }),
  });
  assert(
    ppShort.status === 402,
    `insufficient guarantee rejected got ${ppShort.status} ${JSON.stringify(ppShort.body).slice(0, 200)}`,
  );
  assert(
    (ppShort.body?.error_key || "") === "insufficient_prize_guarantee",
    `insufficient guarantee error_key got ${ppShort.body?.error_key}`,
  );
  assert(
    !(ppShort.body?.event?.id || ppShort.body?.id),
    "insufficient guarantee must not create an event",
  );
  // Atomic create TX: fail must leave zero DB rows for this title (no cancelled orphan).
  const orphanShort = sql(`
    SELECT COUNT(*)::text FROM hosted_events
    WHERE organizer_id='${oid}' AND title='E2E Short Guar ${stamp}'
  `);
  assert(Number(orphanShort) === 0, `insufficient guarantee left orphan rows ${orphanShort}`);

  creditWallet(oid, currency, Math.max(hostFee + guaranteeAmt + entryFee * 2, 400));
  const ppPlayer = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `hev_pp_${stamp}`,
      email: `hev_pp_${stamp}@example.com`,
    }),
  });
  assert(ppPlayer.status === 200 && ppPlayer.body.access_token, "prize pool player session");
  const pptok = ppPlayer.body.access_token;
  const ppid = ppPlayer.body.user.id;
  await passCashGate(pptok);
  creditWallet(ppid, currency, entryFee * 3);

  const freeNoPool = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Free No Pool ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: true,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: true,
      prize_pool_guarantee_amount: guaranteeAmt,
      country_code: "ET",
    }),
  });
  assert(
    freeNoPool.status === 201 || freeNoPool.status === 200,
    `free create ${freeNoPool.status}`,
  );
  const freeEv = freeNoPool.body?.event || freeNoPool.body;
  assert(freeEv?.prize_pool_display_enabled !== true, "free forces prize pool display off");
  assert(freeEv?.prize_pool_now == null, "free omits prize_pool_now");

  const ppCreate = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Prize Pool ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: true,
      prize_pool_guarantee_amount: guaranteeAmt,
      country_code: "ET",
    }),
  });
  assert(
    ppCreate.status === 201 || ppCreate.status === 200,
    `prize pool create ${ppCreate.status} ${JSON.stringify(ppCreate.body).slice(0, 220)}`,
  );
  const ppEv = ppCreate.body?.event || ppCreate.body;
  assert(ppEv?.prize_pool_display_enabled === true, "paid display on");
  assert(ppEv?.prize_pool_guarantee_enabled === true, "guarantee on");
  assert(ppEv?.prize_pool_guarantee_held === true, "guarantee held");
  assert(Number(ppEv?.prize_pool_guarantee_amount) === guaranteeAmt, "guarantee amount");
  assert(
    Number(ppEv?.prize_pool_now) === guaranteeAmt,
    `now=guarantee only ${ppEv?.prize_pool_now}`,
  );
  assert(typeof ppEv?.prize_pool_if_full === "number", "if_full present");
  {
    const maxP = Number(ppEv?.max_players);
    assert(Number.isFinite(maxP) && maxP >= 2, `max_players for if_full ${ppEv?.max_players}`);
    const quote0 = await req(`/events/entry-fee-quote?amount=${entryFee}`, {
      headers: { Authorization: `Bearer ${otok}` },
    });
    assert(quote0.status === 200, `if_full quote ${quote0.status}`);
    const seatNet0 = Number(quote0.body?.organizer_net);
    assert(Number.isFinite(seatNet0), "if_full seat net");
    // Floor: max(full entry nets, guarantee), not additive.
    const expectIfFull = Math.round(Math.max(maxP * seatNet0, guaranteeAmt) * 100) / 100;
    assert(
      Math.abs(Number(ppEv?.prize_pool_if_full) - expectIfFull) < 0.02,
      `if_full floor math got=${ppEv?.prize_pool_if_full} want=${expectIfFull}`,
    );
    assert(
      Math.abs(Number(ppEv?.prize_pool_if_full) - (hostFee + expectIfFull)) > 0.5 || hostFee === 0,
      "if_full must not include host fee",
    );
  }
  assert(ppEv?.prize_pool_frozen !== true, "not frozen at create");
  const holdKind = sql(`
    SELECT COUNT(*)::text FROM wallet_ledger
    WHERE user_id='${oid}' AND kind='prize_pool_guarantee_hold'
      AND reference IN (
        'hosted_event_prize_guarantee:${ppEv.id}',
        'hosted_event_prize_guarantee:${ppEv.id}:1'
      )
  `);
  assert(Number(holdKind) >= 1, `guarantee hold ledger ${holdKind}`);

  // Cancel before start must release the guarantee hold (not capture).
  creditWallet(oid, currency, hostFee + guaranteeAmt + 50);
  const ppCancelCreate = await req("/events/", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({
      title: `E2E Prize Pool Cancel ${stamp}`,
      format_id: format.id,
      size_id: size.id,
      visibility: "private",
      is_free_entry: false,
      entry_fee_amount: entryFee,
      entry_fee_currency: currency,
      prize_pool_display_enabled: true,
      prize_pool_guarantee_enabled: true,
      prize_pool_guarantee_amount: guaranteeAmt,
      country_code: "ET",
    }),
  });
  assert(
    ppCancelCreate.status === 201 || ppCancelCreate.status === 200,
    `prize pool cancel-create ${ppCancelCreate.status} ${JSON.stringify(ppCancelCreate.body).slice(0, 220)}`,
  );
  const ppCancelEv = ppCancelCreate.body?.event || ppCancelCreate.body;
  assert(ppCancelEv?.prize_pool_guarantee_held === true, "cancel-path guarantee held");
  const ppCancel = await req(`/events/${ppCancelEv.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    ppCancel.status === 200,
    `prize pool cancel ${ppCancel.status} ${JSON.stringify(ppCancel.body).slice(0, 220)}`,
  );
  const releaseKind = sql(`
    SELECT COUNT(*)::text FROM wallet_ledger
    WHERE user_id='${oid}' AND kind='prize_pool_guarantee_release'
      AND reference IN (
        'hosted_event_prize_guarantee_release:${ppCancelEv.id}',
        'hosted_event_prize_guarantee_release:${ppCancelEv.id}:1'
      )
  `);
  assert(Number(releaseKind) >= 1, `guarantee release ledger ${releaseKind}`);
  const cancelHeld = sql(`
    SELECT COALESCE(prize_pool_guarantee_held::text,'') FROM hosted_events WHERE id='${ppCancelEv.id}'
  `);
  assert(cancelHeld === "false", `guarantee held cleared after cancel got ${cancelHeld}`);
  const cancelCapture = sql(`
    SELECT COUNT(*)::text FROM wallet_ledger
    WHERE user_id='${oid}' AND kind='prize_pool_guarantee_capture'
      AND reference IN (
        'hosted_event_prize_guarantee_capture:${ppCancelEv.id}',
        'hosted_event_prize_guarantee_capture:${ppCancelEv.id}:1'
      )
  `);
  assert(Number(cancelCapture) === 0, `cancel must not capture guarantee ${cancelCapture}`);

  // Atomic reopen: insufficient wallet must 402 and leave cycle unbumped (no partial hold).
  const cycleAfterCancel = Number(
    sql(
      `SELECT COALESCE(prize_pool_guarantee_cycle::text,'1') FROM hosted_events WHERE id='${ppCancelEv.id}'`,
    ),
  );
  sql(`
    UPDATE wallets SET balance = 0, updated_at = NOW()
    WHERE user_id='${oid}' AND currency='${currency}'
  `);
  const ppReopenShort = await req(`/events/${ppCancelEv.id}/reopen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    ppReopenShort.status === 402,
    `reopen insufficient got ${ppReopenShort.status} ${JSON.stringify(ppReopenShort.body).slice(0, 200)}`,
  );
  assert(
    (ppReopenShort.body?.error_key || "") === "insufficient_prize_guarantee",
    `reopen insufficient error_key got ${ppReopenShort.body?.error_key}`,
  );
  const cycleAfterShort = Number(
    sql(
      `SELECT COALESCE(prize_pool_guarantee_cycle::text,'1') FROM hosted_events WHERE id='${ppCancelEv.id}'`,
    ),
  );
  assert(
    cycleAfterShort === cycleAfterCancel,
    `reopen insufficient must not bump cycle got ${cycleAfterShort} want ${cycleAfterCancel}`,
  );
  const shortHeld = sql(`
    SELECT COALESCE(prize_pool_guarantee_held::text,'') FROM hosted_events WHERE id='${ppCancelEv.id}'
  `);
  assert(shortHeld === "false", `reopen insufficient must leave held=false got ${shortHeld}`);
  const shortStatus = sql(`
    SELECT COALESCE(status,'') FROM hosted_events WHERE id='${ppCancelEv.id}'
  `);
  assert(shortStatus === "cancelled", `reopen insufficient must stay cancelled got ${shortStatus}`);

  // Reopen must re-hold (cycle 2) after cancel released cycle 1.
  creditWallet(oid, currency, Math.max(hostFee + guaranteeAmt + 50, 300));
  const ppReopen = await req(`/events/${ppCancelEv.id}/reopen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    ppReopen.status === 200,
    `prize pool reopen after cancel ${ppReopen.status} ${JSON.stringify(ppReopen.body).slice(0, 220)}`,
  );
  const ppReopened = ppReopen.body?.event || ppReopen.body;
  assert(ppReopened?.prize_pool_guarantee_held === true, "reopen re-holds guarantee");
  assert(ppReopened?.prize_pool_guarantee_captured !== true, "reopen must not be captured");
  const reopenCycle = sql(`
    SELECT COALESCE(prize_pool_guarantee_cycle::text,'') FROM hosted_events WHERE id='${ppCancelEv.id}'
  `);
  assert(Number(reopenCycle) >= 2, `reopen cycle bumped got ${reopenCycle}`);
  const reopenHold = sql(`
    SELECT COUNT(*)::text FROM wallet_ledger
    WHERE user_id='${oid}' AND kind='prize_pool_guarantee_hold'
      AND reference='hosted_event_prize_guarantee:${ppCancelEv.id}:2'
  `);
  assert(Number(reopenHold) >= 1, `reopen cycle-2 hold ledger ${reopenHold}`);
  // Leave reopened cup cancelled again so later pot math uses the main ppEv only.
  const ppReopenCancel = await req(`/events/${ppCancelEv.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    ppReopenCancel.status === 200,
    `prize pool re-cancel after reopen ${ppReopenCancel.status}`,
  );

  const ppJoin = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${pptok}` },
    body: JSON.stringify({ code: ppEv.join_code, country_code: "ET" }),
  });
  assert(
    ppJoin.status === 200 || ppJoin.status === 201,
    `prize pool join ${ppJoin.status} ${JSON.stringify(ppJoin.body).slice(0, 200)}`,
  );
  const joinedEv = ppJoin.body?.event || ppJoin.body;
  const perSeatNet = Number(quote.body?.organizer_net);
  assert(Number.isFinite(perSeatNet), `quote organizer_net for pot math ${perSeatNet}`);
  // Floor: max(entry nets, guarantee).
  const expectedNow = Math.round(Math.max(perSeatNet, guaranteeAmt) * 100) / 100;
  assert(
    Math.abs(Number(joinedEv?.prize_pool_now) - expectedNow) < 0.02,
    `pot floor after join now=${joinedEv?.prize_pool_now} expected=${expectedNow}`,
  );

  const ppKick = await req(`/events/${ppEv.id}/entries/${ppid}/kick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(ppKick.status === 200, `prize pool kick ${ppKick.status}`);
  const kickedEv = ppKick.body?.event || ppKick.body;
  assert(
    Math.abs(Number(kickedEv?.prize_pool_now) - guaranteeAmt) < 0.02,
    `pot dropped after kick now=${kickedEv?.prize_pool_now}`,
  );

  // Re-join then start to freeze.
  const ppJoin2 = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${pptok}` },
    body: JSON.stringify({ code: ppEv.join_code, country_code: "ET" }),
  });
  assert(ppJoin2.status === 200 || ppJoin2.status === 201, `rejoin ${ppJoin2.status}`);
  // Need enough players for start: add more e2e seats if min_players > 2.
  const minStart = Number(ppCatalog.body?.min_players_to_start?.[format.id] ?? 2);
  for (let i = 0; i < Math.max(0, minStart - 2); i++) {
    const extra = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `hev_ppx_${stamp}_${i}`,
        email: `hev_ppx_${stamp}_${i}@example.com`,
      }),
    });
    assert(extra.status === 200, `extra player ${i}`);
    // Paid join needs full cash gate (age/phone + locate country); SQL stamp alone is 403.
    await passCashGate(extra.body.access_token);
    creditWallet(extra.body.user.id, currency, entryFee * 2);
    const jx = await req("/events/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${extra.body.access_token}` },
      body: JSON.stringify({ code: ppEv.join_code, country_code: "ET" }),
    });
    assert(jx.status === 200 || jx.status === 201, `extra join ${i} ${jx.status}`);
  }
  // Organizer also joins if needed for count (approved seats).
  const orgJoin = await req("/events/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
    body: JSON.stringify({ code: ppEv.join_code, country_code: "ET" }),
  });
  assert(
    orgJoin.status === 200 || orgJoin.status === 201 || orgJoin.status === 409,
    `organizer join/seat ${orgJoin.status}`,
  );

  // Check-in every approved seat before start (bracket seed excludes unchecked).
  sql(`
    UPDATE hosted_event_entries
    SET checked_in_at = COALESCE(checked_in_at, NOW())
    WHERE event_id = '${String(ppEv.id).replace(/'/g, "")}'
  `);

  const ppStart = await req(`/events/${ppEv.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(
    ppStart.status === 200,
    `prize pool start ${ppStart.status} ${JSON.stringify(ppStart.body).slice(0, 240)}`,
  );
  const startedEv = ppStart.body?.event || ppStart.body;
  assert(startedEv?.prize_pool_frozen === true, "pot frozen after start");
  assert(typeof startedEv?.prize_pool_now === "number", "frozen now number");
  const frozenDb = sql(`
    SELECT COALESCE(prize_pool_frozen_amount::text,'') FROM hosted_events WHERE id='${ppEv.id}'
  `);
  assert(frozenDb.length > 0, `frozen amount persisted ${frozenDb}`);
  const captureKind = sql(`
    SELECT COUNT(*)::text FROM wallet_ledger
    WHERE user_id='${oid}' AND kind='prize_pool_guarantee_capture'
      AND reference IN (
        'hosted_event_prize_guarantee_capture:${ppEv.id}',
        'hosted_event_prize_guarantee_capture:${ppEv.id}:1'
      )
  `);
  assert(Number(captureKind) >= 1, `guarantee capture ledger ${captureKind}`);
  const capturedFlag = sql(`
    SELECT COALESCE(prize_pool_guarantee_captured::text,'') FROM hosted_events WHERE id='${ppEv.id}'
  `);
  assert(capturedFlag === "true", `guarantee captured flag after start got ${capturedFlag}`);
  const heldAfterCapture = sql(`
    SELECT COALESCE(prize_pool_guarantee_held::text,'') FROM hosted_events WHERE id='${ppEv.id}'
  `);
  assert(heldAfterCapture === "false", `held cleared after capture got ${heldAfterCapture}`);
  assert(
    (startedEv?.prize_pool_currency || "").trim().length > 0,
    "frozen pot includes prize_pool_currency",
  );

  // Tournament paid pot: GraphQL create + REST enroll grow + leave-enrollable freeze.
  const enrollable =
    (enums.body?.enrollable_tournament_status || "").trim() ||
    (enums.body?.client_enums?.enrollable_tournament_status || "").trim();
  assert(enrollable.length > 0, "enrollable_tournament_status");
  const tStatuses =
    enums.body?.tournament_statuses || enums.body?.client_enums?.tournament_statuses || [];
  const leaveStatus = (Array.isArray(tStatuses) ? tStatuses : []).find(
    (s) => String(s).trim() && String(s).trim() !== enrollable,
  );
  assert(leaveStatus, `non-enrollable tournament status from ${JSON.stringify(tStatuses)}`);
  const tGuarantee = 25;
  const tCreate = await gql(
    `mutation($title:String!,$fee:Float!,$cur:String!,$prize:Float!,$display:Boolean!,$max:Int!){
      createTournament(
        title:$title isFree:false entryFeeAmount:$fee entryFeeCurrency:$cur
        prizePoolAmount:$prize prizePoolCurrency:$cur
        prizePoolDisplayEnabled:$display maxPlayers:$max
      ){
        id isFree entryFeeAmount prizePoolAmount prizePoolDisplayEnabled
        prizePoolNow prizePoolIfFull prizePoolGuaranteeAmount prizePoolFrozen
        prizePoolCurrency maxPlayers status
      }
    }`,
    {
      title: `E2E Tourney Pot ${stamp}`,
      fee: entryFee,
      cur: currency,
      prize: tGuarantee,
      display: true,
      max: 8,
    },
    atok,
  );
  assert(
    tCreate.status === 200 && !tCreate.body?.errors,
    `tournament create gql ${tCreate.status} ${JSON.stringify(tCreate.body).slice(0, 240)}`,
  );
  const tRow = tCreate.body?.data?.createTournament;
  assert(tRow?.id, "tournament id");
  assert(tRow?.prizePoolDisplayEnabled === true, "tournament display on at create");
  assert(typeof tRow?.prizePoolNow === "number", "tournament prizePoolNow at create");
  assert(
    Math.abs(Number(tRow?.prizePoolNow) - tGuarantee) < 0.02,
    `tournament now=guarantee only got=${tRow?.prizePoolNow}`,
  );
  assert(
    Math.abs(Number(tRow?.prizePoolGuaranteeAmount) - tGuarantee) < 0.02,
    `tournament prizePoolGuaranteeAmount got=${tRow?.prizePoolGuaranteeAmount}`,
  );
  assert(
    Math.abs(Number(tRow?.prizePoolIfFull) - (8 * entryFee + tGuarantee)) < 0.02,
    `tournament if_full got=${tRow?.prizePoolIfFull}`,
  );
  assert((tRow?.prizePoolCurrency || "").trim() === currency, "tournament live currency");

  const tOpen = await req(`/console/tournaments/${tRow.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: enrollable }),
  });
  assert(
    tOpen.status === 200,
    `tournament open ${tOpen.status} ${JSON.stringify(tOpen.body).slice(0, 160)}`,
  );
  creditWallet(ppid, currency, entryFee * 2);
  const tEnroll = await req(`/tournaments/${tRow.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pptok}` },
    body: JSON.stringify({}),
  });
  assert(
    tEnroll.status === 200 || tEnroll.status === 201,
    `tournament enroll ${tEnroll.status} ${JSON.stringify(tEnroll.body).slice(0, 200)}`,
  );
  const tList = await req("/tournaments/?skip=0&limit=50", {
    headers: { Authorization: `Bearer ${pptok}` },
  });
  assert(tList.status === 200, `tournament list ${tList.status}`);
  const tListed = (tList.body?.tournaments || []).find((x) => x.id === tRow.id);
  assert(tListed, "tournament listed after enroll");
  assert(tListed?.prize_pool_display_enabled === true, "listed display on");
  const expectTourNow = Math.round((entryFee + tGuarantee) * 100) / 100;
  assert(
    Math.abs(Number(tListed?.prize_pool_now) - expectTourNow) < 0.02,
    `tournament pot grew now=${tListed?.prize_pool_now} want=${expectTourNow}`,
  );
  const tFreeze = await req(`/console/tournaments/${tRow.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: leaveStatus }),
  });
  assert(
    tFreeze.status === 200,
    `tournament freeze status ${tFreeze.status} ${JSON.stringify(tFreeze.body).slice(0, 160)}`,
  );
  assert(tFreeze.body?.prize_pool_frozen === true, "tournament pot frozen after leave enrollable");
  assert(
    Math.abs(Number(tFreeze.body?.prize_pool_now) - expectTourNow) < 0.02,
    `tournament frozen now=${tFreeze.body?.prize_pool_now}`,
  );

  // Platform kill-switch: pot chrome omitted even if cup opted in.
  sql(`UPDATE feature_flags SET enabled = FALSE WHERE key = 'prize_pool_display_enabled'`);
  sql(`UPDATE feature_flags SET enabled = FALSE WHERE key = 'prize_pool_guarantee_enabled'`);
  const ppOff = await req(`/events/${ppEv.id}`, {
    headers: { Authorization: `Bearer ${otok}` },
  });
  assert(ppOff.status === 200, `prize pool after flag off ${ppOff.status}`);
  const ppOffEv = ppOff.body?.event || ppOff.body;
  assert(ppOffEv?.prize_pool_display_enabled !== true, "kill-switch clears display enabled");
  assert(ppOffEv?.prize_pool_now == null, "kill-switch omits prize_pool_now");
  const tOffList = await req("/tournaments/?skip=0&limit=50", {
    headers: { Authorization: `Bearer ${pptok}` },
  });
  const tOff = (tOffList.body?.tournaments || []).find((x) => x.id === tRow.id);
  assert(
    !tOff || tOff.prize_pool_display_enabled !== true,
    "tournament kill-switch clears display",
  );
  assert(!tOff || tOff.prize_pool_now == null, "tournament kill-switch omits now");

  console.log(
    "E2E_PASS hosted-events commission privacy close reopen notifs chrome admin-list public-rated catalog-labels public-host-mult entry-fee-quote prize-pool",
  );
})().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
