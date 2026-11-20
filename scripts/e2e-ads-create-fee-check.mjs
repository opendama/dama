/**
 * Live ads create-fee E2E (pay-to-create parity with hosted events host fee).
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 and Postgres via docker exec.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-ads-create-fee-check.mjs
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1";
const pgUser = process.env.DAMA_POSTGRES_USER || "dama";
const pgDb = process.env.DAMA_POSTGRES_DB || "dama";
const pgContainer = process.env.DAMA_POSTGRES_CONTAINER || "dama_postgres";

import { execFileSync } from "node:child_process";

async function req(path, opts = {}) {
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
    body: JSON.stringify({ phone: "+251955667799" }),
  });
  assert(r.status < 300, `phone-kyc ${r.status}`);
  // When cash_phone_otp_required is off, phone-kyc PUT already marks verified.
  // OTP start correctly returns 400 in that mode - only challenge when required.
  const flags = await req("/feature-flags");
  const otpRequired = flags.body?.cash_phone_otp_required === true;
  if (otpRequired) {
    const otp = await req("/me/phone-kyc/otp/start", {
      method: "POST",
      headers: h,
      body: JSON.stringify({}),
    });
    assert(otp.status < 300 && otp.body?.debug_code, `otp start ${otp.status}`);
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
      String(r.body?.status || "").toLowerCase() === "verified" || r.status < 300,
      `phone-kyc verified without otp status=${r.body?.status}`,
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
  const pricingET = await req("/ads/pricing?lat=9.03&lng=38.74");
  assert(pricingET.status === 200, `pricing ET ${pricingET.status}`);
  const fee = Number(pricingET.body?.campaign_create_fee_amount);
  const currency = String(pricingET.body?.campaign_create_fee_currency || "").toUpperCase();
  assert(fee > 0 && currency === "ETB", `Ethiopia create fee ${fee} ${currency}`);
  assert(String(pricingET.body?.country_code || "") === "ET", "Ethiopia country_code");

  const pricingUS = await req("/ads/pricing?lat=40.7128&lng=-74.0060");
  assert(pricingUS.status === 200, `pricing US ${pricingUS.status}`);
  const feeUS = Number(pricingUS.body?.campaign_create_fee_amount);
  const currencyUS = String(pricingUS.body?.campaign_create_fee_currency || "").toUpperCase();
  assert(feeUS > 0 && currencyUS === "USD", `global create fee ${feeUS} ${currencyUS}`);
  assert(String(pricingUS.body?.country_code || "") === "US", "global country_code");
  assert(
    feeUS !== fee || currencyUS !== currency,
    "Ethiopia and global fees must be distinct pairs",
  );

  const enums = await req("/platform/enums");
  assert(enums.status === 200, "client enums");
  assert(
    String(enums.body?.archived_campaign_status || "").trim().length > 0,
    "archived_campaign_status",
  );
  assert(
    String(enums.body?.reopen_campaign_status || "").trim().length > 0,
    "reopen_campaign_status",
  );
  assert(
    (enums.body?.campaign_statuses || []).includes(enums.body.archived_campaign_status),
    "archived in campaign_statuses",
  );
  const creativeType = enums.body?.default_creative_type || (enums.body?.creative_types || [])[0];
  assert(creativeType, `creative type ${creativeType}`);
  assert(
    String(enums.body?.creative_type_labels?.[creativeType] || "").trim().length > 0,
    `creative_type_labels.${creativeType}`,
  );

  const pub = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `ads_pub_${stamp}`,
      email: `ads_pub_${stamp}@example.com`,
    }),
  });
  assert(pub.status === 200 && pub.body.access_token, "publisher session");
  const tok = pub.body.access_token;
  const uid = pub.body.user.id;

  await passCashGate(tok);

  const noPin = await req("/ads/campaigns", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      title: `NoPin ${stamp}`,
      creative_type: creativeType,
      geo_targets: [{ country: "ET" }],
      country_code: "ET",
    }),
  });
  assert(noPin.status === 400, `map pin required ${noPin.status}`);

  // Addis pin (same coords as spatial smoke); fee currency resolves at pin.
  const etPin = { country: "ET", lat: 9.03, lng: 38.74 };
  const broke = await req("/ads/campaigns", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      title: `Broke ${stamp}`,
      creative_type: creativeType,
      geo_targets: [etPin],
      country_code: "ET",
    }),
  });
  assert(broke.status === 402 || broke.status === 400, `unfunded create blocked ${broke.status}`);
  const orphan = sql(`
    SELECT COUNT(*) FROM ad_campaigns
    WHERE publisher_id='${String(uid).replace(/'/g, "")}'
      AND title='Broke ${stamp}'
  `);
  assert(Number(orphan) === 0, `unfunded create rolled back (orphans=${orphan})`);

  creditWallet(uid, currency, Math.max(fee * 2, 100));
  const bal0 = walletBal(uid, currency);
  assert(bal0 >= fee, `funded ${bal0}`);

  const create = await req("/ads/campaigns", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      title: `Paid Cup Ad ${stamp}`,
      creative_type: creativeType,
      geo_targets: [etPin],
      country_code: "ET",
    }),
  });
  assert(
    create.status === 201 || create.status === 200,
    `create paid ${create.status} ${JSON.stringify(create.body).slice(0, 200)}`,
  );
  const camp = create.body;
  assert(camp?.id, "campaign id");
  const bal1 = walletBal(uid, currency);
  assert(
    Math.abs(bal1 - (bal0 - fee)) < 0.02,
    `create fee settled ${bal0} -> ${bal1} (fee ${fee})`,
  );

  const ledger = sql(`
    SELECT COUNT(*) FROM wallet_ledger
    WHERE user_id='${String(uid).replace(/'/g, "")}'
      AND kind='campaign_create_fee'
      AND reference='ad_campaign:${String(camp.id).replace(/'/g, "")}'
      AND UPPER(TRIM(currency))='ETB'
  `);
  assert(Number(ledger) === 1, "campaign_create_fee ledger row ETB");

  // Admin for dual-fee chrome/console asserts + temporary US cash allowlist (policy is ET-only by default).
  const admin = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `ads_adm_${stamp}`,
      email: `ads_adm_${stamp}@example.com`,
      role: "superadmin",
    }),
  });
  assert(admin.status === 200 && admin.body.access_token, "admin session");
  const atok = admin.body.access_token;
  const ah = { Authorization: `Bearer ${atok}` };

  // Global USD path (NYC pin) - open US jurisdiction briefly, locate GPS, settle USD fee, restore ET-only.
  const allowUS = await req("/console/cash-rmg/allowed-countries", {
    method: "PUT",
    headers: ah,
    body: JSON.stringify({ country_codes: ["ET", "US"] }),
  });
  assert(
    allowUS.status === 200,
    `allow US cash ${allowUS.status} ${JSON.stringify(allowUS.body).slice(0, 160)}`,
  );
  try {
    const locateUS = await req("/geo/locate", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ latitude: 40.7128, longitude: -74.006 }),
    });
    assert(locateUS.status < 300, `locate US ${locateUS.status}`);

    const usPin = { country: "US", lat: 40.7128, lng: -74.006 };
    creditWallet(uid, currencyUS, Math.max(feeUS * 2, 20));
    const balUS0 = walletBal(uid, currencyUS);
    assert(balUS0 >= feeUS, `funded USD ${balUS0}`);
    const createUS = await req("/ads/campaigns", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        title: `Paid Global Ad ${stamp}`,
        creative_type: creativeType,
        geo_targets: [usPin],
        country_code: "US",
      }),
    });
    assert(
      createUS.status === 201 || createUS.status === 200,
      `create paid USD ${createUS.status} ${JSON.stringify(createUS.body).slice(0, 200)}`,
    );
    const campUS = createUS.body;
    assert(campUS?.id, "global campaign id");
    const balUS1 = walletBal(uid, currencyUS);
    assert(
      Math.abs(balUS1 - (balUS0 - feeUS)) < 0.02,
      `global create fee settled ${balUS0} -> ${balUS1} (fee ${feeUS} ${currencyUS})`,
    );
    const ledgerUS = sql(`
      SELECT COUNT(*) FROM wallet_ledger
      WHERE user_id='${String(uid).replace(/'/g, "")}'
        AND kind='campaign_create_fee'
        AND reference='ad_campaign:${String(campUS.id).replace(/'/g, "")}'
        AND UPPER(TRIM(currency))='USD'
    `);
    assert(Number(ledgerUS) === 1, "campaign_create_fee ledger row USD");
  } finally {
    const restore = await req("/console/cash-rmg/allowed-countries", {
      method: "PUT",
      headers: ah,
      body: JSON.stringify({ country_codes: ["ET"] }),
    });
    assert(restore.status === 200, `restore ET-only cash ${restore.status}`);
  }

  const playback = await req("/ads/playback", {
    headers: { Authorization: `Bearer ${tok}` },
  });
  assert(playback.status === 200, `playback ${playback.status}`);
  const sc = playback.body?.schedule_chrome || {};
  for (const k of [
    "cancel_action",
    "dialog_close_label",
    "search_campaigns_label",
    "search_campaigns_placeholder",
    "filter_status_label",
    "filter_status_all",
    "view_action",
    "list_page_size",
    "empty_value",
    "unlimited_cap_placeholder",
    "save_action",
    "save_pending",
    "toast_campaign_title_saved",
    "patch_title_locked",
  ]) {
    assert(String(sc[k] || "").trim().length > 0, `schedule_chrome.${k}`);
  }
  assert(Number(sc.list_page_size) > 0, "schedule_chrome list_page_size numeric");

  const newTitle = `Renamed Cup Ad ${stamp}`;
  const rename = await req(`/ads/campaigns/${camp.id}/title`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ title: newTitle }),
  });
  assert(
    rename.status === 200,
    `title patch ${rename.status} ${JSON.stringify(rename.body).slice(0, 200)}`,
  );
  assert(rename.body?.title === newTitle, `title saved ${rename.body?.title}`);

  const getOne = await req(`/ads/campaigns/${camp.id}`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  assert(
    getOne.status === 200,
    `get campaign ${getOne.status} ${JSON.stringify(getOne.body).slice(0, 200)}`,
  );
  assert(getOne.body?.id === camp.id, "get campaign id");
  assert(String(getOne.body?.status_label || "").trim().length > 0, "get campaign status_label");
  assert(
    String(getOne.body?.creative_type_label || "").trim().length > 0,
    "get campaign creative_type_label",
  );
  const list = await req("/ads/campaigns?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${tok}` },
  });
  assert(list.status === 200, `list campaigns ${list.status}`);
  const listed = (list.body?.campaigns || []).find((c) => c?.id === camp.id);
  assert(listed, "list includes created campaign");
  assert(String(listed?.status_label || "").trim().length > 0, "list campaign status_label");
  assert(
    String(listed?.creative_type_label || "").trim().length > 0,
    "list campaign creative_type_label",
  );
  for (const code of [
    "admin.campaign_closed",
    "admin.campaign_reopened",
    "admin.campaign_auto_closed",
  ]) {
    const q = sql(`SELECT href_query_key FROM notification_kinds WHERE code='${code}'`).trim();
    assert(q === "id", `notif ${code} query ${q} want id`);
  }

  const chrome = await req("/public/admin-console-chrome");
  assert(chrome.status === 200, `admin chrome ${chrome.status}`);
  const progChrome = chrome.body?.progression || {};
  for (const k of [
    "campaign_create_fees_section_title",
    "campaign_create_fee_ethiopia_label",
    "campaign_create_fee_ethiopia_currency_label",
    "campaign_create_fee_global_label",
    "campaign_create_fee_global_currency_label",
    "campaign_create_fee_geo_blurb",
  ]) {
    assert(String(progChrome[k] || "").trim().length > 0, `progression chrome.${k}`);
  }
  assert(
    String(progChrome.campaign_create_fee_ethiopia_label).trim() === "Ethiopia campaign create fee",
    `Ethiopia fee label naming got=${progChrome.campaign_create_fee_ethiopia_label}`,
  );
  assert(
    String(progChrome.campaign_create_fee_ethiopia_currency_label).trim() ===
      "Ethiopia campaign create fee currency",
    `Ethiopia fee currency label naming got=${progChrome.campaign_create_fee_ethiopia_currency_label}`,
  );
  assert(
    String(progChrome.campaign_create_fee_global_label).trim() === "Global campaign create fee",
    `Global fee label naming got=${progChrome.campaign_create_fee_global_label}`,
  );
  assert(
    String(progChrome.campaign_create_fee_global_currency_label).trim() ===
      "Global campaign create fee currency",
    `Global fee currency label naming got=${progChrome.campaign_create_fee_global_currency_label}`,
  );
  assert(
    String(progChrome.campaign_create_fee_ethiopia_label).trim() !== "Campaign create fee",
    "must not use bare Campaign create fee label",
  );

  const consoleProg = await req("/console/progression", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(consoleProg.status === 200, `console progression ${consoleProg.status}`);
  const ap = consoleProg.body?.ad_pricing || {};
  assert(Number(ap.campaign_create_fee_ethiopia_amount) > 0, "console ethiopia fee amount");
  assert(Number(ap.campaign_create_fee_global_amount) > 0, "console global fee amount");
  assert(
    String(ap.campaign_create_fee_ethiopia_currency || "").toUpperCase() === "ETB",
    "console ethiopia fee currency",
  );
  assert(
    String(ap.campaign_create_fee_global_currency || "").toUpperCase() === "USD",
    "console global fee currency",
  );
  assert(
    Number(ap.campaign_create_fee_ethiopia_amount) === fee,
    `console ethiopia matches Addis pricing ${ap.campaign_create_fee_ethiopia_amount} vs ${fee}`,
  );
  assert(
    Number(ap.campaign_create_fee_global_amount) === feeUS,
    `console global matches NYC pricing ${ap.campaign_create_fee_global_amount} vs ${feeUS}`,
  );

  const consoleGet = await req(`/console/ads/campaigns/${encodeURIComponent(camp.id)}`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(
    consoleGet.status === 200,
    `console get campaign ${consoleGet.status} ${JSON.stringify(consoleGet.body).slice(0, 160)}`,
  );
  assert(consoleGet.body?.id === camp.id, "console get campaign id");
  assert(
    String(consoleGet.body?.status_label || "").trim().length > 0,
    "console get campaign status_label",
  );
  assert(
    String(consoleGet.body?.creative_type_label || "").trim().length > 0,
    "console get campaign creative_type_label",
  );

  console.log("E2E_PASS ads-create-fee");
})().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
