/**
 * E2E: admin Host trust policy GET/PUT (Sales → /payments/host-trust).
 * Requires API with DAMA_ALLOW_E2E_AUTH=1 and mig 532 chrome/nav applied.
 */
const base = (process.env.DAMA_API_BASE || "http://localhost:18080").replace(/\/$/, "");

async function req(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers,
    body: body != null ? body : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pickPolicy(p) {
  return {
    host_paid_create_requires_phone_kyc: p.host_paid_create_requires_phone_kyc,
    host_guarantee_requires_document_kyc: p.host_guarantee_requires_document_kyc,
    host_concurrent_open_paid_cap_phone_verified: p.host_concurrent_open_paid_cap_phone_verified,
    host_concurrent_open_paid_cap_document_verified:
      p.host_concurrent_open_paid_cap_document_verified,
    host_concurrent_open_paid_cap_new_host: p.host_concurrent_open_paid_cap_new_host,
    host_new_host_settled_paid_threshold: p.host_new_host_settled_paid_threshold,
    host_reputation_max_open_reports: p.host_reputation_max_open_reports,
    host_reputation_cancel_rate_bps: p.host_reputation_cancel_rate_bps,
    host_reputation_cancel_rate_min_sample: p.host_reputation_cancel_rate_min_sample,
  };
}

async function main() {
  const stamp = Date.now();
  const admin = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `host_trust_adm_${stamp}`,
      email: `host_trust_adm_${stamp}@example.com`,
      role: "superadmin",
    }),
  });
  if (admin.status === 404 || admin.status === 403) {
    console.error("SKIP: /auth/e2e/session unavailable (set DAMA_ALLOW_E2E_AUTH=1 on API).");
    process.exit(0);
  }
  assert(
    admin.status === 200 && admin.json?.access_token,
    `e2e session ${admin.status}: ${JSON.stringify(admin.json)}`,
  );
  const token = admin.json.access_token;

  const chrome = await req("/public/admin-console-chrome");
  assert(chrome.status === 200, `admin chrome ${chrome.status}`);
  const pay = chrome.json?.payments || {};
  for (const k of [
    "host_trust_page_title",
    "host_trust_tab_gates",
    "host_trust_tab_caps",
    "host_trust_tab_reputation",
    "host_trust_save_action",
    "host_trust_phone_kyc_label",
    "host_trust_cap_new_host_label",
    "host_trust_rep_open_reports_label",
  ]) {
    assert(String(pay[k] || "").trim(), `missing payments chrome ${k}`);
  }

  const nav = await req("/platform/console-nav", { token });
  assert(nav.status === 200, `console-nav ${nav.status}: ${JSON.stringify(nav.json)}`);
  const sections = nav.json?.sections || [];
  const items = sections.flatMap((s) => s.items || []);
  const leaf = items.find((it) => it.id === "pay-host-trust" || it.href === "/payments/host-trust");
  assert(leaf, "console_nav missing pay-host-trust leaf");

  const before = await req("/console/cash-rmg/policy", { token });
  assert(before.status === 200, `GET policy ${before.status}`);
  const original = pickPolicy(before.json);
  for (const [k, v] of Object.entries(original)) {
    assert(v !== undefined && v !== null, `policy missing ${k}`);
  }

  const bumped = {
    ...original,
    host_concurrent_open_paid_cap_new_host: Math.max(
      1,
      Number(original.host_concurrent_open_paid_cap_new_host) || 1,
    ),
  };
  // Flip phone gate, bump new-host cap by +0 (idempotent) then restore; use reports threshold toggle-safe.
  const edited = {
    ...bumped,
    host_paid_create_requires_phone_kyc: !original.host_paid_create_requires_phone_kyc,
    host_reputation_max_open_reports:
      Number(original.host_reputation_max_open_reports) === 5 ? 6 : 5,
  };

  const put = await req("/console/cash-rmg/host-trust-policy", {
    method: "PUT",
    token,
    body: JSON.stringify(edited),
  });
  assert(put.status === 200, `PUT policy ${put.status}: ${JSON.stringify(put.json)}`);
  assert(
    put.json.host_paid_create_requires_phone_kyc === edited.host_paid_create_requires_phone_kyc,
    "PUT did not persist phone gate",
  );
  assert(
    put.json.host_reputation_max_open_reports === edited.host_reputation_max_open_reports,
    "PUT did not persist open reports",
  );

  const mid = await req("/console/cash-rmg/policy", { token });
  assert(mid.status === 200, `GET mid ${mid.status}`);
  assert(
    mid.json.host_paid_create_requires_phone_kyc === edited.host_paid_create_requires_phone_kyc,
    "GET mid phone gate mismatch",
  );

  const bad = await req("/console/cash-rmg/host-trust-policy", {
    method: "PUT",
    token,
    body: JSON.stringify({ ...edited, host_concurrent_open_paid_cap_new_host: 0 }),
  });
  assert(bad.status === 400, `expected 400 for invalid cap, got ${bad.status}`);

  const restore = await req("/console/cash-rmg/host-trust-policy", {
    method: "PUT",
    token,
    body: JSON.stringify(original),
  });
  assert(restore.status === 200, `restore PUT ${restore.status}`);
  assert(
    restore.json.host_paid_create_requires_phone_kyc ===
      original.host_paid_create_requires_phone_kyc,
    "restore phone gate failed",
  );
  assert(
    restore.json.host_reputation_max_open_reports === original.host_reputation_max_open_reports,
    "restore open reports failed",
  );

  console.log("OK host-trust-policy e2e (get/put/validate/restore + chrome/nav)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
