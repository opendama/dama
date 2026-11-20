/**
 * Host sizes catalog E2E (ads Campaign create-fee parity).
 * Dual Ethiopia/global fees, DataTable CRUD APIs, skip/go pagination, public resolve.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-host-sizes-check.mjs
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
    const retryable = r.status === 429 || r.status === 502 || r.status === 503;
    if (!retryable || attempt === maxAttempts) {
      return { status: r.status, body };
    }
    await sleep(1000 * attempt);
  }
  return { status: 503, body: { error: "transient" } };
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

async function main() {
  const dual = sql(`
    SELECT count(*) FILTER (
      WHERE (s->>'host_fee_ethiopia_amount')::numeric > 0
        AND upper(trim(s->>'host_fee_ethiopia_currency')) <> ''
        AND (s->>'host_fee_global_amount')::numeric > 0
        AND upper(trim(s->>'host_fee_global_currency')) <> ''
    ) || '/' || count(*)
    FROM platform_settings, jsonb_array_elements(value->'sizes') s
    WHERE key = 'events_catalog'
  `);
  assert(
    /^\d+\/\d+$/.test(dual) && dual.split("/")[0] === dual.split("/")[1],
    `db dual fees ${dual}`,
  );

  const blurb = sql(
    `SELECT value->>'host_fee_geo_blurb' FROM platform_settings WHERE key='events_admin_chrome'`,
  );
  assert(
    blurb.includes("{ethiopia}") && blurb.includes("{global}"),
    "chrome geo blurb placeholders",
  );

  const chrome = await req("/public/events-admin-chrome");
  assert(chrome.status === 200, `events-admin-chrome ${chrome.status}`);
  const keys = [
    "host_fee_geo_blurb",
    "host_fee_ethiopia_amount_label",
    "host_fee_global_amount_label",
    "sizes_add_action",
    "sizes_edit_action",
    "sizes_delete_action",
    "sizes_delete_confirm",
    "sizes_delete_pending",
    "list_page_size",
    "search_debounce_ms",
    "amount_currency_separator",
    "empty_value",
    "unlimited_players_label",
    "sizes_unlimited_toggle_label",
    "sizes_unlimited_blurb",
    "sizes_max_players_placeholder",
    "err_unlimited_arena_only",
    "err_unlimited_max_high_or_empty",
  ];
  for (const k of keys) {
    const raw = chrome.body?.[k];
    if (k === "amount_currency_separator") {
      assert(typeof raw === "string" && raw.length > 0, `chrome.${k}`);
      continue;
    }
    assert(String(raw || "").trim().length > 0, `chrome.${k}`);
  }
  assert(
    String(chrome.body.host_fee_geo_blurb).includes("{ethiopia}") &&
      String(chrome.body.host_fee_geo_blurb).includes("{global}"),
    "chrome blurb placeholders live",
  );
  const pageBlurb = String(chrome.body.page_blurb || "");
  assert(pageBlurb.includes("payment_currency"), "page_blurb payment_currency");
  assert(
    !/\bETB\b/.test(pageBlurb) && !/\bUSD\b/.test(pageBlurb),
    "page_blurb no hardcoded ETB/USD",
  );
  assert(
    String(chrome.body.err_host_fee_dual_required || "").trim().length > 0,
    "err_host_fee_dual_required",
  );

  const pay = await req("/payments/currency");
  assert(pay.status === 200, `payments/currency ${pay.status}`);
  const etCur = String(pay.body?.ethiopia || "")
    .trim()
    .toUpperCase();
  const glCur = String(pay.body?.global || "")
    .trim()
    .toUpperCase();
  assert(etCur.length === 3 && glCur.length === 3, `payment currencies ${etCur}/${glCur}`);

  const stamp = Date.now();
  const admin = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `host_sz_adm_${stamp}`,
      email: `host_sz_adm_${stamp}@example.com`,
      role: "superadmin",
    }),
  });
  assert(
    admin.status < 300 && admin.body?.access_token,
    `admin session ${admin.status} ${JSON.stringify(admin.body)}`,
  );
  const h = { Authorization: `Bearer ${admin.body.access_token}` };

  const enumsRes = await req("/platform/enums", { headers: h });
  assert(enumsRes.status === 200, `platform enums ${enumsRes.status}`);
  const arenaId = String(enumsRes.body?.hosted_event_arena_format || "").trim();
  assert(arenaId.length > 0, "hosted_event_arena_format from DB");
  const classicId = String(
    (enumsRes.body?.tournament_formats || []).find(
      (f) => String(f).trim() && String(f).trim() !== arenaId,
    ) || "",
  ).trim();
  assert(classicId.length > 0, "classic format id from DB (no invent)");

  const pageSize = Number(chrome.body.list_page_size);
  assert(Number.isFinite(pageSize) && pageSize > 0, `list_page_size ${pageSize}`);

  const list1 = await req(`/console/events/catalog/sizes?skip=0&limit=${pageSize}`, { headers: h });
  assert(list1.status === 200 && Array.isArray(list1.body?.sizes), `list page1 ${list1.status}`);
  assert(list1.body.sizes.length > 0, "list page1 has rows");
  for (const s of list1.body.sizes) {
    assert(
      s.host_fee_ethiopia_amount > 0 &&
        String(s.host_fee_ethiopia_currency || "").toUpperCase() === etCur &&
        s.host_fee_global_amount > 0 &&
        String(s.host_fee_global_currency || "").toUpperCase() === glCur,
      `row dual fees ${s.id}`,
    );
  }
  const meta1 = list1.body.meta || {};
  assert(typeof meta1.total === "number" && meta1.total >= list1.body.sizes.length, "meta.total");

  // Force skip/go pagination even when chrome page size exceeds catalog length.
  const pageTiny = await req("/console/events/catalog/sizes?skip=0&limit=1", { headers: h });
  assert(pageTiny.status === 200 && pageTiny.body?.sizes?.length === 1, "pagination limit=1");
  assert(pageTiny.body.meta?.has_more === true, "pagination has_more on page1");
  const page2 = await req("/console/events/catalog/sizes?skip=1&limit=1", { headers: h });
  assert(page2.status === 200 && page2.body?.sizes?.length === 1, "pagination page2");
  assert(page2.body.sizes[0].id !== pageTiny.body.sizes[0].id, "pagination pages disjoint");

  const id = `e2e_size_${Date.now()}`;
  const created = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id,
      label: "E2E Host Size",
      enabled: true,
      max_players: 8,
      host_fee_ethiopia_amount: 15,
      host_fee_global_amount: 4,
      allowed_format_ids: [classicId],
      sort_order: 999,
    }),
  });
  assert(created.status < 300, `create ${created.status} ${JSON.stringify(created.body)}`);
  assert(
    created.body?.host_fee_ethiopia_currency === etCur &&
      created.body?.host_fee_global_currency === glCur,
    `create locked currencies ${created.body?.host_fee_ethiopia_currency}/${created.body?.host_fee_global_currency}`,
  );

  const patched = await req(`/console/events/catalog/sizes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      label: "E2E Host Size Updated",
      enabled: true,
      max_players: 8,
      host_fee_ethiopia_amount: 16,
      host_fee_global_amount: 5,
      allowed_format_ids: [classicId],
      sort_order: 999,
    }),
  });
  assert(patched.status < 300, `update ${patched.status}`);
  assert(patched.body?.host_fee_ethiopia_amount === 16, "update ethiopia amount");
  assert(patched.body?.host_fee_global_amount === 5, "update global amount");

  const toggled = await req(`/console/events/catalog/sizes/${encodeURIComponent(id)}/active`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ active: false }),
  });
  assert(toggled.status < 300 && toggled.body?.enabled === false, `toggle off ${toggled.status}`);

  const filtered = await req(
    `/console/events/catalog/sizes?skip=0&limit=${pageSize}&q=${encodeURIComponent("E2E Host Size")}&status=inactive`,
    { headers: h },
  );
  assert(
    filtered.status === 200 &&
      Array.isArray(filtered.body?.sizes) &&
      filtered.body.sizes.some((s) => s.id === id),
    "filter q+status finds inactive create",
  );

  const badCreate = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `e2e_bad_${stamp}`,
      label: "Bad Dual",
      enabled: true,
      max_players: 8,
      host_fee_ethiopia_amount: 0,
      host_fee_global_amount: 4,
      allowed_format_ids: [classicId],
    }),
  });
  assert(badCreate.status === 400, `dual fee required reject ${badCreate.status}`);

  const pubET = await req("/events/catalog?lat=9.03&lng=38.74");
  assert(
    pubET.status === 200 && Array.isArray(pubET.body?.sizes),
    `public catalog ET ${pubET.status}`,
  );
  assert(
    String(pubET.body?.country_code || "") === "ET",
    `public catalog ET country ${pubET.body?.country_code}`,
  );
  const size8ET = (pubET.body.sizes || []).find((s) => s.id === "size_8");
  assert(size8ET, "public catalog ET has size_8");
  const swissPub = pubET.body?.swiss_rounds_by_max_players || {};
  assert(
    Object.keys(swissPub).length > 0,
    "public catalog swiss_rounds_by_max_players for Unlimited labeling",
  );
  assert(
    Number(size8ET.host_fee_amount) === 50 &&
      String(size8ET.host_fee_currency || "").toUpperCase() === etCur,
    `public ET fee ${size8ET.host_fee_amount} ${size8ET.host_fee_currency}`,
  );
  assert(
    !Object.prototype.hasOwnProperty.call(size8ET, "host_fee_ethiopia_amount") &&
      !Object.prototype.hasOwnProperty.call(size8ET, "host_fee_global_amount"),
    "public ET size has no dual admin fee keys",
  );

  const pubUS = await req("/events/catalog?lat=40.7128&lng=-74.0060");
  assert(
    pubUS.status === 200 && Array.isArray(pubUS.body?.sizes),
    `public catalog US ${pubUS.status}`,
  );
  assert(
    String(pubUS.body?.country_code || "") === "US",
    `public catalog US country ${pubUS.body?.country_code}`,
  );
  const size8US = (pubUS.body.sizes || []).find((s) => s.id === "size_8");
  assert(size8US, "public catalog US has size_8");
  assert(
    Number(size8US.host_fee_amount) === 5 &&
      String(size8US.host_fee_currency || "").toUpperCase() === glCur,
    `public US fee ${size8US.host_fee_amount} ${size8US.host_fee_currency}`,
  );
  assert(
    size8US.host_fee_amount !== size8ET.host_fee_amount ||
      size8US.host_fee_currency !== size8ET.host_fee_currency,
    "Ethiopia and global public fees must be distinct pairs",
  );

  const pubHit = (pubET.body.sizes || []).find((s) => s.id === id);
  assert(!pubHit, "disabled size omitted from public catalog");

  // Arena Unlimited: null max_players allowed only with Arena; classic formats rejected.
  const unlimitedId = `e2e_unlim_${stamp}`;
  const badUnlimitedKo = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `${unlimitedId}_bad`,
      label: "E2E Unlimited Bad KO",
      enabled: true,
      max_players: null,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [classicId],
      sort_order: 1001,
    }),
  });
  assert(
    badUnlimitedKo.status === 400 &&
      String(badUnlimitedKo.body?.error_key || "").trim() === "err_unlimited_arena_only",
    `unlimited knockout rejected ${badUnlimitedKo.status} ${JSON.stringify(badUnlimitedKo.body).slice(0, 200)}`,
  );

  // Present max_players under 2 must reject (never coerce to Unlimited null).
  const badLt2 = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `e2e_lt2_${stamp}`,
      label: "E2E Lt2 Reject",
      enabled: true,
      max_players: 1,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1001,
    }),
  });
  assert(
    badLt2.status === 400 && String(badLt2.body?.error_key || "").trim() === "err_catalog_invalid",
    `catalog max_players 1 rejected ${badLt2.status} ${JSON.stringify(badLt2.body).slice(0, 200)}`,
  );

  const badLt0 = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `e2e_lt0_${stamp}`,
      label: "E2E Lt0 Reject",
      enabled: true,
      max_players: 0,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1002,
    }),
  });
  assert(
    badLt0.status === 400 && String(badLt0.body?.error_key || "").trim() === "err_catalog_invalid",
    `catalog max_players 0 rejected ${badLt0.status} ${JSON.stringify(badLt0.body).slice(0, 200)}`,
  );

  const badNeg = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `e2e_neg_${stamp}`,
      label: "E2E Neg Reject",
      enabled: true,
      max_players: -1,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1003,
    }),
  });
  assert(
    badNeg.status === 400 && String(badNeg.body?.error_key || "").trim() === "err_catalog_invalid",
    `catalog max_players -1 rejected ${badNeg.status} ${JSON.stringify(badNeg.body).slice(0, 200)}`,
  );

  const unlimitedCreated = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: unlimitedId,
      label: "E2E Unlimited Arena",
      enabled: true,
      max_players: null,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1000,
    }),
  });
  assert(
    unlimitedCreated.status < 300,
    `unlimited create ${unlimitedCreated.status} ${JSON.stringify(unlimitedCreated.body)}`,
  );
  assert(
    unlimitedCreated.body?.max_players == null,
    `unlimited max_players null got ${unlimitedCreated.body?.max_players}`,
  );
  assert(
    Array.isArray(unlimitedCreated.body?.allowed_format_ids) &&
      unlimitedCreated.body.allowed_format_ids.length === 1 &&
      unlimitedCreated.body.allowed_format_ids[0] === arenaId,
    "unlimited arena-only formats",
  );

  // PUT present max under 2 must reject (never coerce to Unlimited).
  const badPutLt2 = await req(`/console/events/catalog/sizes/${encodeURIComponent(unlimitedId)}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      label: "E2E Unlimited Arena",
      enabled: true,
      max_players: 1,
      host_fee_ethiopia_amount: 20,
      host_fee_global_amount: 6,
      allowed_format_ids: [arenaId],
      sort_order: 1000,
    }),
  });
  assert(
    badPutLt2.status === 400 &&
      String(badPutLt2.body?.error_key || "").trim() === "err_catalog_invalid",
    `catalog PUT max_players 1 rejected ${badPutLt2.status} ${JSON.stringify(badPutLt2.body).slice(0, 200)}`,
  );

  // DB classic seat ceiling + 1 is the smallest Community high Unlimited.
  let classicCeiling = 0;
  for (const k of Object.keys(swissPub)) {
    const n = Number.parseInt(String(k).trim(), 10);
    if (Number.isFinite(n) && n >= 2 && n > classicCeiling) classicCeiling = n;
  }
  assert(classicCeiling >= 2, `classic seat ceiling from public swiss ${classicCeiling}`);
  const justAbove = classicCeiling + 1;
  const boundaryId = `e2e_bound_${stamp}`;
  const badBoundKo = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `${boundaryId}_bad`,
      label: "E2E Boundary Bad KO",
      enabled: true,
      max_players: justAbove,
      host_fee_ethiopia_amount: 25,
      host_fee_global_amount: 7,
      allowed_format_ids: [classicId],
      sort_order: 1001,
    }),
  });
  assert(
    badBoundKo.status === 400 &&
      String(badBoundKo.body?.error_key || "").trim() === "err_unlimited_arena_only",
    `ceiling+1 knockout rejected ${badBoundKo.status} ${JSON.stringify(badBoundKo.body).slice(0, 200)}`,
  );
  const boundArena = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: boundaryId,
      label: "E2E Boundary Arena",
      enabled: true,
      max_players: justAbove,
      host_fee_ethiopia_amount: 25,
      host_fee_global_amount: 7,
      allowed_format_ids: [arenaId],
      sort_order: 1001,
    }),
  });
  assert(boundArena.status < 300, `ceiling+1 Arena size ${boundArena.status}`);
  assert(
    boundArena.body?.max_players === justAbove,
    `ceiling+1 max_players ${boundArena.body?.max_players}`,
  );
  const delBound = await req(`/console/events/catalog/sizes/${encodeURIComponent(boundaryId)}`, {
    method: "DELETE",
    headers: h,
  });
  assert(delBound.status < 300, `delete boundary size ${delBound.status}`);

  const highCapId = `e2e_high_${stamp}`;
  const badHighKo = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: `${highCapId}_bad`,
      label: "E2E High Cap Bad KO",
      enabled: true,
      max_players: 10000,
      host_fee_ethiopia_amount: 25,
      host_fee_global_amount: 7,
      allowed_format_ids: [classicId],
      sort_order: 1002,
    }),
  });
  assert(
    badHighKo.status === 400 &&
      String(badHighKo.body?.error_key || "").trim() === "err_unlimited_arena_only",
    `high cap knockout rejected ${badHighKo.status} ${JSON.stringify(badHighKo.body).slice(0, 200)}`,
  );

  const highCap = await req("/console/events/catalog/sizes", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      id: highCapId,
      label: "E2E High Cap Arena",
      enabled: true,
      max_players: 10000,
      host_fee_ethiopia_amount: 25,
      host_fee_global_amount: 7,
      allowed_format_ids: [arenaId],
      sort_order: 1002,
    }),
  });
  assert(highCap.status < 300, `high cap create ${highCap.status}`);
  assert(highCap.body?.max_players === 10000, "high cap max_players 10000");

  const highKoPatch = await req(`/console/events/catalog/sizes/${encodeURIComponent(highCapId)}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      label: "E2E High Cap Arena",
      enabled: true,
      max_players: 10000,
      host_fee_ethiopia_amount: 25,
      host_fee_global_amount: 7,
      allowed_format_ids: [classicId],
      sort_order: 1002,
    }),
  });
  assert(
    highKoPatch.status === 400 &&
      String(highKoPatch.body?.error_key || "").trim() === "err_unlimited_arena_only",
    `high cap patch knockout rejected ${highKoPatch.status} ${JSON.stringify(highKoPatch.body).slice(0, 200)}`,
  );

  const seedUnlimited = (list1.body.sizes || []).find((s) => s.id === "size_unlimited");
  if (seedUnlimited) {
    assert(seedUnlimited.max_players == null, "seed size_unlimited max null");
  }
  const pubUnlimited = (pubET.body.sizes || []).find((s) => s.id === "size_unlimited");
  if (pubUnlimited) {
    assert(
      pubUnlimited.max_players == null || pubUnlimited.max_players === undefined,
      "public size_unlimited uncapped",
    );
    assert(
      Array.isArray(pubUnlimited.allowed_format_ids) &&
        pubUnlimited.allowed_format_ids.includes(arenaId),
      "public size_unlimited allows arena",
    );
  }

  const delUnlimited = await req(
    `/console/events/catalog/sizes/${encodeURIComponent(unlimitedId)}`,
    { method: "DELETE", headers: h },
  );
  assert(delUnlimited.status < 300, `delete unlimited ${delUnlimited.status}`);
  const delHigh = await req(`/console/events/catalog/sizes/${encodeURIComponent(highCapId)}`, {
    method: "DELETE",
    headers: h,
  });
  assert(delHigh.status < 300, `delete high cap ${delHigh.status}`);

  // Catalog PUT must preserve sizes owned by DataTable CRUD (stale empty sizes must not wipe).
  const beforePut = await req("/console/events/catalog", { headers: h });
  assert(
    beforePut.status === 200 && Array.isArray(beforePut.body?.sizes),
    "catalog get before put",
  );
  const sizeCountBefore = beforePut.body.sizes.length;
  const putBody = { ...beforePut.body, sizes: [] };
  const put = await req("/console/events/catalog", {
    method: "PUT",
    headers: h,
    body: JSON.stringify(putBody),
  });
  assert(put.status === 200, `catalog put ${put.status}`);
  assert(
    Array.isArray(put.body?.sizes) && put.body.sizes.length === sizeCountBefore,
    `catalog put preserved sizes ${put.body?.sizes?.length} vs ${sizeCountBefore}`,
  );
  assert(
    put.body.sizes.some((s) => s.id === id && s.enabled === false),
    "catalog put kept inactive e2e size",
  );

  const del = await req(`/console/events/catalog/sizes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: h,
  });
  assert(del.status < 300, `delete ${del.status}`);

  const gone = await req(
    `/console/events/catalog/sizes?skip=0&limit=${pageSize}&q=${encodeURIComponent(id)}`,
    { headers: h },
  );
  assert(
    gone.status === 200 && !(gone.body?.sizes || []).some((s) => s.id === id),
    "deleted size gone from list",
  );

  console.log("E2E_PASS host-sizes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
