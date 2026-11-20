/**
 * E2E: Community hosted cup description + prize_image + gallery (mig 533).
 * Covers free + paid cups, gallery-only after prize clear, gallery max=9, host-only 403,
 * description clear, logo separate, admin list thumb chrome heal.
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 and local Postgres via docker exec.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-hosted-event-prize-media-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
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
      headers: {
        ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(opts.headers || {}),
      },
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
    VALUES ('${id}', '${cur}', ${amt}, NOW())
    ON CONFLICT (user_id, currency)
    DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW();
  `);
}

/** Minimal 1x1 PNG. */
function tinyPngBlob() {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const buf = Buffer.from(b64, "base64");
  return new Blob([buf], { type: "image/png" });
}

async function uploadMultipart(path, token, fileName) {
  const form = new FormData();
  form.append("file", tinyPngBlob(), fileName);
  return req(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function main() {
  const cols = sql(`
    SELECT string_agg(column_name, ',' ORDER BY column_name)
    FROM information_schema.columns
    WHERE table_name='hosted_events'
      AND column_name IN ('description','prize_image_url','gallery')
  `);
  assert(cols === "description,gallery,prize_image_url", `hosted_events columns: ${cols}`);

  const orgChrome = await req("/public/events-organizer-chrome");
  assert(orgChrome.status === 200, `organizer chrome ${orgChrome.status}`);
  assert(orgChrome.body?.source === "database", "organizer chrome source=database");
  for (const k of [
    "description_label",
    "description_placeholder",
    "prize_media_section_title",
    "prize_media_section_blurb",
    "thumbnail_label",
    "gallery_label",
    "gallery_max_slots",
    "gallery_limit_reached",
    "toast_thumbnail_saved",
    "toast_gallery_saved",
    "media_upload_failed",
  ]) {
    assert(String(orgChrome.body?.[k] || "").trim(), `organizer chrome has ${k}`);
  }

  const playerChrome = await req("/public/events-player-chrome");
  assert(playerChrome.status === 200, `player chrome ${playerChrome.status}`);
  assert(
    String(playerChrome.body?.detail_description_label || "").trim(),
    "player chrome has detail_description_label",
  );

  const adminChrome = await req("/public/events-admin-chrome");
  assert(adminChrome.status === 200, `admin chrome ${adminChrome.status}`);
  for (const k of [
    "detail_description_label",
    "detail_prize_image_label",
    "detail_gallery_label",
    "gallery_empty",
    "thumbnail_label",
  ]) {
    assert(String(adminChrome.body?.[k] || "").trim(), `admin chrome has ${k}`);
  }
  const adminThumb = String(adminChrome.body?.thumbnail_label || "")
    .trim()
    .toLowerCase();
  assert(
    adminThumb !== "event logo" && adminThumb !== "logo",
    `admin list thumbnail_label not branding got "${adminChrome.body?.thumbnail_label}"`,
  );
  assert(
    String(adminChrome.body?.thumbnail_label || "").trim() !==
      String(adminChrome.body?.detail_logo_label || "").trim(),
    "admin thumbnail_label distinct from detail_logo_label",
  );

  const stamp = Date.now();
  const orgSess = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `prize_media_org_${stamp}`,
      email: `prize_media_org_${stamp}@example.com`,
    }),
  });
  if (orgSess.status === 404 || orgSess.status === 403) {
    console.error("SKIP: /auth/e2e/session unavailable (set DAMA_ALLOW_E2E_AUTH=1 on API).");
    process.exit(0);
  }
  assert(orgSess.status === 200 && orgSess.body?.access_token, `org session ${orgSess.status}`);
  const orgToken = orgSess.body.access_token;
  const orgId = orgSess.body.user?.id || orgSess.body.user_id;
  assert(orgId, "org user id");

  const catalog = await req("/events/catalog");
  assert(catalog.status === 200, `catalog ${catalog.status}`);
  const formats = catalog.body?.formats || [];
  const sizes = catalog.body?.sizes || [];
  const format = formats.find((f) => f.enabled && (f.id || "").trim());
  const size = sizes.find((s) => s.enabled && (s.id || "").trim());
  assert(format && size, "catalog format+size");

  const hostCur = (size.host_fee_currency || "ETB").trim() || "ETB";
  const hostFee = Number(size.host_fee_amount) || 0;
  if (hostFee > 0) creditWallet(orgId, hostCur, hostFee + 50);

  const desc = `E2E reward copy ${stamp}`;
  const publicVis =
    String(catalog.body?.hosted_event_public_visibility || "public").trim() || "public";
  const create = await req("/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({
      title: `Prize media cup ${stamp}`,
      description: desc,
      format_id: format.id,
      size_id: size.id,
      is_free_entry: true,
      visibility: publicVis,
    }),
  });
  assert(
    create.status === 201 || create.status === 200,
    `create ${create.status}: ${JSON.stringify(create.body)}`,
  );
  const ev = create.body;
  assert(ev?.id, "create id");
  assert(ev.description === desc, `create description got ${JSON.stringify(ev.description)}`);
  assert(Array.isArray(ev.gallery), "create gallery array");
  assert(ev.gallery.length === 0, "create gallery empty");

  const patch = await req(`/events/${ev.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({ description: `${desc} patched` }),
  });
  assert(patch.status === 200, `patch ${patch.status}`);
  assert(patch.body?.description === `${desc} patched`, "patch description");

  const prizeUp = await uploadMultipart(`/events/${ev.id}/prize-image`, orgToken, "prize.png");
  assert(prizeUp.status === 200, `prize upload ${prizeUp.status}: ${JSON.stringify(prizeUp.body)}`);
  assert(String(prizeUp.body?.prize_image_url || "").trim(), "prize_image_url set");

  const gal1 = await uploadMultipart(`/events/${ev.id}/gallery`, orgToken, "g1.png");
  assert(gal1.status === 200, `gallery1 ${gal1.status}`);
  assert((gal1.body?.gallery || []).length === 1, "gallery len 1");

  const getPub = await req(`/events/${ev.id}`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert(getPub.status === 200, `get ${getPub.status}: ${JSON.stringify(getPub.body)}`);
  assert(String(getPub.body?.prize_image_url || "").trim(), "public prize_image_url");
  assert((getPub.body?.gallery || []).length === 1, "public gallery len");
  assert(String(getPub.body?.description || "").includes("patched"), "public description");

  const logoUp = await uploadMultipart(`/events/${ev.id}/logo`, orgToken, "logo.png");
  assert(logoUp.status === 200, `logo ${logoUp.status}`);
  const logoUrl = String(logoUp.body?.logo_url || "").trim();
  const prizeUrl = String(logoUp.body?.prize_image_url || "").trim();
  assert(logoUrl && prizeUrl && logoUrl !== prizeUrl, "logo and prize stay separate");

  const clearPrize = await req(`/events/${ev.id}/prize-image`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert(clearPrize.status === 200, `clear prize ${clearPrize.status}`);
  assert(!String(clearPrize.body?.prize_image_url || "").trim(), "prize cleared");
  assert(String(clearPrize.body?.logo_url || "").trim() === logoUrl, "logo kept after prize clear");
  const galleryOnlyUrl = String((clearPrize.body?.gallery || [])[0] || "").trim();
  assert(galleryOnlyUrl, "gallery-only slot remains after prize clear");

  // Admin list thumb path: prize empty → first gallery (mig 534).
  const galOnlyPub = await req(`/events/${ev.id}`);
  assert(galOnlyPub.status === 200, `gallery-only public ${galOnlyPub.status}`);
  assert(!String(galOnlyPub.body?.prize_image_url || "").trim(), "gallery-only public prize empty");
  assert(
    String((galOnlyPub.body?.gallery || [])[0] || "").trim() === galleryOnlyUrl,
    "gallery-only public gallery[0]",
  );
  assert(
    String(galOnlyPub.body?.logo_url || "").trim() === logoUrl,
    "gallery-only public logo kept",
  );

  const adminEarly = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `prize_media_adm_early_${stamp}`,
      email: `prize_media_adm_early_${stamp}@example.com`,
      role: "superadmin",
    }),
  });
  assert(
    adminEarly.status === 200 && adminEarly.body?.access_token,
    `admin early ${adminEarly.status}`,
  );
  const adminEarlyToken = adminEarly.body.access_token;
  const consoleGalOnly = await req(`/console/events/${ev.id}`, {
    headers: { Authorization: `Bearer ${adminEarlyToken}` },
  });
  assert(consoleGalOnly.status === 200, `console gallery-only ${consoleGalOnly.status}`);
  assert(
    !String(consoleGalOnly.body?.prize_image_url || "").trim(),
    "console gallery-only prize empty",
  );
  assert(
    String((consoleGalOnly.body?.gallery || [])[0] || "").trim() === galleryOnlyUrl,
    "console gallery-only gallery[0]",
  );
  const consoleListGal = await req("/console/events?skip=0&limit=5", {
    headers: { Authorization: `Bearer ${adminEarlyToken}` },
  });
  assert(consoleListGal.status === 200, `console list gallery-only ${consoleListGal.status}`);
  const listedGal = (consoleListGal.body?.events || []).find((e) => e.id === ev.id);
  assert(listedGal, "console list includes gallery-only event");
  assert(!String(listedGal.prize_image_url || "").trim(), "console list gallery-only prize empty");
  assert(
    String((listedGal.gallery || [])[0] || "").trim() === galleryOnlyUrl,
    "console list gallery-only gallery[0]",
  );

  const remGal = await req(`/events/${ev.id}/gallery/0`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  assert(remGal.status === 200, `remove gallery ${remGal.status}`);
  assert((remGal.body?.gallery || []).length === 0, "gallery empty after remove");

  let filled = null;
  for (let i = 1; i <= 9; i++) {
    filled = await uploadMultipart(`/events/${ev.id}/gallery`, orgToken, `fill-${i}.png`);
    assert(filled.status === 200, `gallery fill ${i} ${filled.status}`);
    assert((filled.body?.gallery || []).length === i, `gallery fill len ${i}`);
  }
  const galOver = await uploadMultipart(`/events/${ev.id}/gallery`, orgToken, "fill-10.png");
  assert(galOver.status === 400, `gallery over-limit denied ${galOver.status}`);
  assert(
    String(galOver.body?.error_key || "") === "gallery_limit_reached",
    `gallery over-limit error_key got ${JSON.stringify(galOver.body)}`,
  );
  for (let left = 9; left > 0; left--) {
    const rem = await req(`/events/${ev.id}/gallery/0`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    assert(rem.status === 200, `gallery drain ${left} ${rem.status}`);
    assert((rem.body?.gallery || []).length === left - 1, `gallery drain len ${left - 1}`);
  }

  const otherSess = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `prize_media_other_${stamp}`,
      email: `prize_media_other_${stamp}@example.com`,
    }),
  });
  assert(
    otherSess.status === 200 && otherSess.body?.access_token,
    `other session ${otherSess.status}`,
  );
  const otherToken = otherSess.body.access_token;
  const otherPrize = await uploadMultipart(
    `/events/${ev.id}/prize-image`,
    otherToken,
    "other-prize.png",
  );
  assert(otherPrize.status === 403, `non-organizer prize upload denied ${otherPrize.status}`);
  const otherGal = await uploadMultipart(`/events/${ev.id}/gallery`, otherToken, "other-g.png");
  assert(otherGal.status === 403, `non-organizer gallery upload denied ${otherGal.status}`);
  const otherClear = await req(`/events/${ev.id}/prize-image`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  assert(otherClear.status === 403, `non-organizer prize clear denied ${otherClear.status}`);
  const otherRem = await req(`/events/${ev.id}/gallery/0`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  assert(otherRem.status === 403, `non-organizer gallery remove denied ${otherRem.status}`);

  // Paid cup: same prize media stack; money/escrow untouched by images.
  sql(`
    UPDATE users
    SET date_of_birth = '1988-06-01',
        age_verified_at = COALESCE(age_verified_at, NOW()),
        primary_phone = '+2519${String(stamp).replace(/\D/g, "").padStart(8, "0").slice(-8)}',
        phone_kyc_verified_at = COALESCE(phone_kyc_verified_at, NOW()),
        updated_at = NOW()
    WHERE id = '${String(orgId).replace(/'/g, "")}'
  `);
  const locate = await req("/geo/locate", {
    method: "POST",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({}),
  });
  assert(locate.status < 300, `paid org locate ${locate.status}`);
  if (hostFee > 0) creditWallet(orgId, hostCur, hostFee + 100);
  const paidDesc = `Paid reward copy ${stamp}`;
  const paidCreate = await req("/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({
      title: `Prize media paid ${stamp}`,
      description: paidDesc,
      format_id: format.id,
      size_id: size.id,
      is_free_entry: false,
      entry_fee_amount: 25,
      entry_fee_currency: hostCur,
      visibility: publicVis,
      country_code: "ET",
    }),
  });
  assert(
    paidCreate.status === 201 || paidCreate.status === 200,
    `paid create ${paidCreate.status}: ${JSON.stringify(paidCreate.body)}`,
  );
  const paidEv = paidCreate.body?.event || paidCreate.body;
  assert(paidEv?.id, "paid create id");
  assert(paidEv.is_free_entry === false, "paid is_free_entry false");
  assert(paidEv.description === paidDesc, "paid create description");
  assert(Array.isArray(paidEv.gallery) && paidEv.gallery.length === 0, "paid gallery empty");
  const paidPrize = await uploadMultipart(
    `/events/${paidEv.id}/prize-image`,
    orgToken,
    "paid-prize.png",
  );
  assert(paidPrize.status === 200, `paid prize upload ${paidPrize.status}`);
  assert(String(paidPrize.body?.prize_image_url || "").trim(), "paid prize_image_url set");
  assert(paidPrize.body?.is_free_entry === false, "paid prize upload keeps is_free_entry");
  const paidClearDesc = await req(`/events/${paidEv.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({ description: "" }),
  });
  assert(paidClearDesc.status === 200, `paid clear description ${paidClearDesc.status}`);
  assert(String(paidClearDesc.body?.description || "") === "", "paid description cleared");
  assert(
    String(paidClearDesc.body?.prize_image_url || "").trim(),
    "paid prize kept after desc clear",
  );
  const paidPublic = await req(`/events/${paidEv.id}`);
  assert(paidPublic.status === 200, `paid public get ${paidPublic.status}`);
  assert(paidPublic.body?.is_free_entry === false, "paid public is_free_entry");
  assert(String(paidPublic.body?.prize_image_url || "").trim(), "paid public prize_image_url");
  assert(Array.isArray(paidPublic.body?.gallery), "paid public gallery array");
  assert("description" in (paidPublic.body || {}), "paid public description key");

  const adminSess = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `prize_media_adm_${stamp}`,
      email: `prize_media_adm_${stamp}@example.com`,
      role: "superadmin",
    }),
  });
  assert(
    adminSess.status === 200 && adminSess.body?.access_token,
    `admin session ${adminSess.status}`,
  );
  const adminToken = adminSess.body.access_token;

  const consoleGet = await req(`/console/events/${ev.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    consoleGet.status === 200,
    `console get ${consoleGet.status}: ${JSON.stringify(consoleGet.body)}`,
  );
  assert(String(consoleGet.body?.description || "").includes("patched"), "console description");
  assert(Array.isArray(consoleGet.body?.gallery), "console gallery array");

  const consoleList = await req("/console/events?skip=0&limit=5", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    consoleList.status === 200,
    `console list ${consoleList.status}: ${JSON.stringify(consoleList.body)}`,
  );
  assert(Array.isArray(consoleList.body?.events), "console list events array");
  const listed = (consoleList.body.events || []).find((e) => e.id === ev.id);
  assert(listed, "console list includes created event");
  assert(String(listed.description || "").includes("patched"), "console list description");

  console.log("PASS: hosted event prize media e2e");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
