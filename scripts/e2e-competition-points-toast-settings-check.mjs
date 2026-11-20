/**
 * E2E: admin points-toast settings CRUD (labels + notif templates) round-trip; restore.
 *
 *   $env:DAMA_API_BASE='http://127.0.0.1:18080/api/v1'
 *   node scripts/e2e-competition-points-toast-settings-check.mjs
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");

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

async function main() {
  const stamp = Date.now().toString(36);
  const admin = await e2eSession(`pts_adm_${stamp}`, `pts_adm_${stamp}@ex.com`, "admin");
  const h = { Authorization: `Bearer ${admin.tok}` };

  const get0 = await req("/console/competition/points-toast-settings", { headers: h });
  assert(get0.status === 200, `get points-toast-settings ${get0.status}`);
  const orig = get0.body || {};
  assert(orig.arena_points_label, "arena_points_label from DB");
  assert(orig.standings_points_label, "standings_points_label from DB");
  assert(orig.toast_points_awarded_fmt, "toast_points_awarded_fmt from DB");
  assert(orig.notif_title_template, "notif_title_template from DB");
  assert(orig.notif_body_template, "notif_body_template from DB");
  assert(
    (orig.notif_body_template.match(/%/g) || []).filter((x, i, a) => {
      // rough: count non-escaped % - backend validates verbs
      return true;
    }).length >= 1,
    "notif body has placeholders",
  );

  const probe = {
    arena_points_label: `ArenaPts_${stamp}`,
    standings_points_label: `StandPts_${stamp}`,
    toast_points_awarded_fmt: `+{points} {label} [${stamp}]`,
    notif_title_template: `Points earned ${stamp}`,
    notif_body_template: `You earned +%s %s in "%s" (${stamp}).`,
  };
  const put = await req("/console/competition/points-toast-settings", {
    method: "PUT",
    headers: h,
    body: JSON.stringify(probe),
  });
  assert(put.status === 200, `put ${put.status} ${JSON.stringify(put.body).slice(0, 180)}`);
  assert(put.body?.arena_points_label === probe.arena_points_label, "arena label persisted");
  assert(
    put.body?.standings_points_label === probe.standings_points_label,
    "standings label persisted",
  );
  assert(put.body?.notif_title_template === probe.notif_title_template, "notif title persisted");
  assert(put.body?.notif_body_template === probe.notif_body_template, "notif body persisted");

  const bad = await req("/console/competition/points-toast-settings", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      ...probe,
      notif_body_template: "missing verbs",
    }),
  });
  assert(bad.status === 400, `body without 3 %s rejected ${bad.status}`);

  const badFmt = await req("/console/competition/points-toast-settings", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      ...probe,
      toast_points_awarded_fmt: "no placeholders",
    }),
  });
  assert(badFmt.status === 400, `toast fmt without {points}/{label} rejected ${badFmt.status}`);

  const unread = await req("/me/notifications/unread-count", { headers: h });
  assert(unread.status === 200, `unread chrome ${unread.status}`);
  assert(
    String(unread.body?.chrome?.toast_points_awarded_fmt || "").includes("{points}"),
    "notification_chrome exposes toast_points_awarded_fmt",
  );

  const restore = await req("/console/competition/points-toast-settings", {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      arena_points_label: orig.arena_points_label,
      standings_points_label: orig.standings_points_label,
      toast_points_awarded_fmt: orig.toast_points_awarded_fmt,
      notif_title_template: orig.notif_title_template,
      notif_body_template: orig.notif_body_template,
    }),
  });
  assert(restore.status === 200, "restore 200");
  assert(restore.body?.arena_points_label === orig.arena_points_label, "arena label restored");

  console.log("E2E_PASS: competition points toast settings CRUD");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
