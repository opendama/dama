/**
 * Challenge-link parity: open_link create ? B AcceptByToken ? A sees accepted+game_id.
 * Also proves invite_sent is not gated on to_user (creator wait arming).
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1";

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const r = await fetch(base + path, { ...opts, headers });
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

const stamp = Date.now();

(async () => {
  const clock = await req("/progression");
  assert(clock.status === 200, "progression");
  const presets = clock.body?.match_clock?.presets || [];
  const sec = presets.find((p) => typeof p?.seconds === "number" && p.seconds > 0)?.seconds;
  assert(sec > 0, `tc preset ${sec}`);

  const a = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `chal_a_${stamp}`,
      email: `chal_a_${stamp}@example.com`,
    }),
  });
  assert(a.status === 200 && a.body.access_token, "A session");
  const atok = a.body.access_token;
  const aid = a.body.user.id;

  const b = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `chal_b_${stamp}`,
      email: `chal_b_${stamp}@example.com`,
    }),
  });
  assert(b.status === 200 && b.body.access_token, "B session");
  const btok = b.body.access_token;

  const create = await req("/invites/", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      open_link: true,
      rated: false,
      preferred_color: "white",
      time_control_seconds: sec,
    }),
  });
  assert(create.status === 201 && create.body.invite?.id, "open_link create");
  const inviteId = create.body.invite.id;
  const tok = create.body.invite.share_token;
  assert(tok && String(tok).trim(), "share_token");
  assert(!(create.body.invite.to_user_id || "").trim(), "open link has empty to_user");

  const pendingA = await req("/invites/pending", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(pendingA.status === 200, "A pending list");
  const mine = (pendingA.body.invites || []).find((i) => i.id === inviteId);
  assert(
    mine && mine.from_user_id === aid && mine.status === "pending",
    "A sees own pending open invite",
  );

  const getPending = await req(`/invites/${inviteId}`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(
    getPending.status === 200 && getPending.body.invite?.status === "pending",
    "GET invite pending",
  );

  const accept = await req(`/invites/token/${encodeURIComponent(tok)}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
  });
  assert(accept.status === 200 && accept.body.match?.game_id, "B AcceptByToken");
  const gid = accept.body.match.game_id;
  assert(accept.body.invite?.status === "accepted", "invite accepted status");

  const getAccepted = await req(`/invites/${inviteId}`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(getAccepted.status === 200, "A GET after accept");
  assert(getAccepted.body.invite?.status === "accepted", "A sees accepted");
  assert(getAccepted.body.invite?.game_id === gid, "A sees game_id (challenger navigate signal)");

  const pendingAfter = await req("/invites/pending", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(
    !(pendingAfter.body.invites || []).some((i) => i.id === inviteId),
    "accepted invite leaves pending list",
  );

  console.log("PASS: e2e-challenge-link-check");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
