/**
 * Live notifications E2E against local API (DAMA_ALLOW_E2E_AUTH=1).
 * Covers: chrome, friend emit, invite emit, mark one/all, pagination scroll,
 * admin chrome, account_status emit via admin active toggle.
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:8080/api/v1";

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

const stamp = Date.now();

(async () => {
  const player = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_p_${stamp}`,
      email: `nchk_p_${stamp}@example.com`,
    }),
  });
  assert(player.status === 200 && player.body.access_token, "player session");
  const ptok = player.body.access_token;
  const pid = player.body.user.id;

  const admin = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_a_${stamp}`,
      email: `nchk_a_${stamp}@example.com`,
      role: "admin",
    }),
  });
  assert(admin.status === 200 && admin.body.access_token, "admin session");
  const atok = admin.body.access_token;

  const unread0 = await req("/me/notifications/unread-count", {
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(unread0.status === 200, "player unread-count status");
  assert(unread0.body.chrome?.bell_aria, "chrome bell_aria");
  assert(unread0.body.chrome?.panel_title, "chrome panel_title");
  assert(unread0.body.chrome?.list_page_size > 0, "chrome list_page_size");
  assert(unread0.body.chrome?.poll_interval_ms > 0, "chrome poll_interval_ms");
  assert(unread0.body.chrome?.loading_more, "chrome loading_more");
  assert(unread0.body.chrome?.mark_all_read, "chrome mark_all_read");

  const friend = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_f_${stamp}`,
      email: `nchk_f_${stamp}@example.com`,
    }),
  });
  assert(friend.status === 200, "friend session");
  const ftok = friend.body.access_token;

  const add = await req(`/friends/${pid}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ftok}` },
  });
  assert(add.status === 201, "friend request emits path");
  const requestId = add.body?.request?.id;
  assert(requestId, "friend request id returned");

  let unread = await req("/me/notifications/unread-count", {
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(unread.body.count >= 1, `friend notif unread count=${unread.body.count}`);
  assert(String(unread.body.badge_label || "").length > 0, "badge_label set");

  const list = await req("/me/notifications?skip=0&limit=5", {
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(list.status === 200 && (list.body.items || []).length >= 1, "player list items");
  assert(list.body.meta && typeof list.body.meta.total === "number", "list meta.total");
  const first = list.body.items[0];
  assert(first.kind_code === "player.friend_request", `kind=${first.kind_code}`);
  assert(first.title && first.body, "title+body rendered");
  assert(first.href === "/?rail=players&sub=requests", `href=${first.href}`);

  const mark = await req(`/me/notifications/${first.id}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(mark.status === 200 && mark.body.status === "ok", "mark one read");

  unread = await req("/me/notifications/unread-count", {
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(
    unread.body.count === 0 || unread.body.count < unread0.body.count + 1,
    "unread dropped after mark",
  );

  // friend request deny ? requester gets friend_request_denied
  const denyA = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_deny_a_${stamp}`,
      email: `nchk_deny_a_${stamp}@example.com`,
    }),
  });
  const denyB = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_deny_b_${stamp}`,
      email: `nchk_deny_b_${stamp}@example.com`,
    }),
  });
  assert(denyA.body.access_token && denyB.body.access_token, "deny sessions");
  const denyReq = await req(`/friends/${denyB.body.user.id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${denyA.body.access_token}` },
  });
  assert(denyReq.status === 201 && denyReq.body?.request?.id, "deny flow request create");
  const denied = await req(`/friends/requests/${denyReq.body.request.id}/deny`, {
    method: "POST",
    headers: { Authorization: `Bearer ${denyB.body.access_token}` },
  });
  assert(denied.status === 200, `friend deny status=${denied.status}`);
  await new Promise((r) => setTimeout(r, 400));
  const denyList = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${denyA.body.access_token}` },
  });
  assert(
    (denyList.body.items || []).some(
      (i) =>
        i.kind_code === "player.friend_request_denied" && i.href === "/?rail=players&sub=requests",
    ),
    "friend_request_denied deep-link present",
  );

  // friend request cancel ? recipient gets friend_request_cancelled
  const cancelA = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_cancel_a_${stamp}`,
      email: `nchk_cancel_a_${stamp}@example.com`,
    }),
  });
  const cancelB = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_cancel_b_${stamp}`,
      email: `nchk_cancel_b_${stamp}@example.com`,
    }),
  });
  assert(cancelA.body.access_token && cancelB.body.access_token, "cancel sessions");
  const cancelReq = await req(`/friends/${cancelB.body.user.id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cancelA.body.access_token}` },
  });
  assert(cancelReq.status === 201 && cancelReq.body?.request?.id, "cancel flow request create");
  const cancelled = await req(`/friends/requests/${cancelReq.body.request.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${cancelA.body.access_token}` },
  });
  assert(cancelled.status === 200, `friend cancel status=${cancelled.status}`);
  await new Promise((r) => setTimeout(r, 400));
  const cancelList = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${cancelB.body.access_token}` },
  });
  assert(
    (cancelList.body.items || []).some(
      (i) =>
        i.kind_code === "player.friend_request_cancelled" &&
        i.href === "/?rail=players&sub=requests",
    ),
    "friend_request_cancelled deep-link present",
  );

  const invite = await req("/invites/", {
    method: "POST",
    headers: { Authorization: `Bearer ${ptok}` },
    body: JSON.stringify({
      to_user: friend.body.user.username,
      rated: false,
      preferred_color: "white",
      time_control_seconds: 180,
    }),
  });
  assert(invite.status === 201, "invite create");

  const fUnread = await req("/me/notifications/unread-count", {
    headers: { Authorization: `Bearer ${ftok}` },
  });
  assert(fUnread.body.count >= 1, "invite_received unread on friend");

  // account_status via admin deactivate then reactivate (list after reactivate;
  // disabled JWT may be blocked from /me while inactive)
  const deact = await req(`/console/users/${friend.body.user.id}/active`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ active: false }),
  });
  assert(deact.status === 200, "admin deactivate");
  const react = await req(`/console/users/${friend.body.user.id}/active`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ active: true }),
  });
  assert(react.status === 200, "admin reactivate");
  const friend2 = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: friend.body.user.username,
      email: `nchk_f_${stamp}@example.com`,
    }),
  });
  assert(friend2.status === 200 && friend2.body.access_token, "friend re-session");
  const fList = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${friend2.body.access_token}` },
  });
  assert(fList.status === 200, "friend list after reactivate");
  assert(
    (fList.body.items || []).some((i) => i.kind_code === "player.account_status"),
    `account_status notification present kinds=${(fList.body.items || []).map((i) => i.kind_code).join(",")}`,
  );

  // pagination: 11 unique friend adds onto one user
  const users = [];
  for (let i = 0; i < 12; i++) {
    const u = await req("/auth/e2e/session", {
      method: "POST",
      body: JSON.stringify({
        username: `nchk_pg_${stamp}_${i}`,
        email: `nchk_pg_${stamp}_${i}@example.com`,
      }),
    });
    assert(u.body.access_token, `pg user ${i}`);
    users.push(u.body);
  }
  const target = users[0];
  let friendAdds = 0;
  for (let i = 1; i < 12; i++) {
    const fr = await req(`/friends/${target.user.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${users[i].access_token}` },
    });
    assert(
      fr.status === 201,
      `friend add ${i} status=${fr.status} body=${JSON.stringify(fr.body)}`,
    );
    friendAdds += 1;
  }
  assert(friendAdds === 11, `friendAdds=${friendAdds}`);
  // Allow brief replication lag on remote pools.
  let p1;
  for (let attempt = 0; attempt < 8; attempt++) {
    p1 = await req("/me/notifications?skip=0&limit=5", {
      headers: { Authorization: `Bearer ${target.access_token}` },
    });
    if ((p1.body.meta?.total ?? 0) >= 11) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const p2 = await req("/me/notifications?skip=5&limit=5", {
    headers: { Authorization: `Bearer ${target.access_token}` },
  });
  const ids1 = (p1.body.items || []).map((i) => i.id);
  const ids2 = (p2.body.items || []).map((i) => i.id);
  assert(p1.body.meta?.total >= 11, `pagination total=${p1.body.meta?.total}`);
  assert(p1.body.meta?.has_more === true, "has_more");
  assert(p1.body.meta?.next_skip === 5, "next_skip=5");
  assert(ids1.length === 5 && ids2.length === 5, "page sizes");
  assert(!ids1.some((id) => ids2.includes(id)), "no page overlap");

  const bad = await req("/me/notifications", {
    headers: { Authorization: `Bearer ${ptok}` },
  });
  assert(bad.status === 400, "skip/limit required");

  const aUnread = await req("/console/notifications/unread-count", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(aUnread.status === 200 && aUnread.body.chrome?.bell_aria, "admin unread chrome");
  const aList = await req("/console/notifications?skip=0&limit=10", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(aList.status === 200 && Array.isArray(aList.body.items), "admin list");

  // friend_removed
  const frA = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_rm_a_${stamp}`,
      email: `nchk_rm_a_${stamp}@example.com`,
    }),
  });
  const frB = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_rm_b_${stamp}`,
      email: `nchk_rm_b_${stamp}@example.com`,
    }),
  });
  assert(frA.body.access_token && frB.body.access_token, "friend_removed sessions");
  const reqCreate = await req(`/friends/${frB.body.user.id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${frA.body.access_token}` },
  });
  assert(reqCreate.status === 201 && reqCreate.body?.request?.id, "friend request for remove flow");
  const acceptRm = await req(`/friends/requests/${reqCreate.body.request.id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${frB.body.access_token}` },
  });
  assert(acceptRm.status === 200, `friend accept status=${acceptRm.status}`);
  const rem = await req(`/friends/${frB.body.user.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${frA.body.access_token}` },
  });
  assert(rem.status === 200 || rem.status === 204, `friend remove status=${rem.status}`);
  await new Promise((r) => setTimeout(r, 600));
  const remList = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${frB.body.access_token}` },
  });
  assert(
    (remList.body.items || []).some((i) => i.kind_code === "player.friend_removed"),
    "friend_removed kind present",
  );
  // Accept notifies the requester (A), not the acceptor (B).
  const acceptList = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${frA.body.access_token}` },
  });
  assert(
    (acceptList.body.items || []).some(
      (i) =>
        i.kind_code === "player.friend_request_accepted" && i.href === "/?rail=players&sub=friends",
    ),
    "friend_request_accepted deep-link present",
  );

  // invite_declined (REST). invite_cancelled emits on WS invite_cancel (same service.Cancel).
  const invFrom = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_inv_a_${stamp}`,
      email: `nchk_inv_a_${stamp}@example.com`,
    }),
  });
  const invTo = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `nchk_inv_b_${stamp}`,
      email: `nchk_inv_b_${stamp}@example.com`,
    }),
  });
  const inv1 = await req("/invites/", {
    method: "POST",
    headers: { Authorization: `Bearer ${invFrom.body.access_token}` },
    body: JSON.stringify({
      to_user: invTo.body.user.username,
      rated: false,
      preferred_color: "white",
      time_control_seconds: 180,
    }),
  });
  const inviteId = inv1.body.id || inv1.body.invite?.id;
  assert(inv1.status === 201 && inviteId, `invite for decline id=${inviteId}`);
  const decl = await req(`/invites/${inviteId}/decline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${invTo.body.access_token}` },
  });
  assert(decl.status === 200 || decl.status === 204, `invite decline status=${decl.status}`);
  await new Promise((r) => setTimeout(r, 400));
  const afterDecl = await req("/me/notifications?skip=0&limit=20", {
    headers: { Authorization: `Bearer ${invFrom.body.access_token}` },
  });
  assert(
    (afterDecl.body.items || []).some((i) => i.kind_code === "player.invite_declined"),
    "invite_declined kind present",
  );

  // admin deep-link list q filters (empty match is ok; endpoint must accept q)
  for (const path of [
    "/payments/receipts?skip=0&limit=5&q=deadbeef-dead-dead-dead-deadbeefdead",
    "/console/avatars?skip=0&limit=5&q=deadbeef-dead-dead-dead-deadbeefdead",
    "/kyc/documents/console?status=pending&skip=0&limit=5&q=deadbeef-dead-dead-dead-deadbeefdead",
    "/payouts/console?skip=0&limit=5&q=deadbeef-dead-dead-dead-deadbeefdead",
  ]) {
    const qRes = await req(path, { headers: { Authorization: `Bearer ${atok}` } });
    assert(qRes.status === 200, `admin q filter ${path.split("?")[0]} status=${qRes.status}`);
  }

  await req("/me/notifications/read-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${ptok}` },
  });

  console.log("E2E_NOTIFICATIONS_COMPLETE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
