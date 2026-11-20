/**
 * Live E2E: game chat + DMs + chrome + notifications (DAMA_ALLOW_E2E_AUTH=1).
 */
const base = process.env.DAMA_API_BASE || "http://127.0.0.1:8080/api/v1";

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  // JSON body gets Content-Type; multipart FormData must set its own boundary.
  if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(base + path, {
    ...opts,
    headers,
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

/** 1x1 PNG - real image bytes for Cloudinary/local chat upload prove. */
function tinyPngBytes() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function uploadChatImage(path, token, bytes, filename, contentType) {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: contentType }), filename);
  return req(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
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
  const rail = await req("/public/play-rail-chrome");
  assert(rail.status === 200, "play-rail-chrome status");
  for (const k of [
    "sub_dms",
    "message_action",
    "watch_tab_chat",
    "chat_disable_action",
    "chat_enable_action",
    "dm_preview_max_chars",
    "dm_preview_truncate_suffix",
    "dm_image_preview_label",
    "chat_reply_preview_max_chars",
    "chat_loading",
    "dm_chat_loading",
    "chat_poll_interval_ms",
    "dm_poll_interval_ms",
    "dm_requests_poll_interval_ms",
    "more_options_aria",
    "chat_emoji_set",
    "remove_image_aria",
    "match_intro_vs_label",
    "match_intro_duration_ms",
    "match_intro_aria",
    "chat_join_required_label",
    "chat_load_failed_label",
    "dm_open_failed",
    "dm_load_failed_label",
    "chat_emoji_search_placeholder",
    "chat_emoji_search_empty",
    "chat_emoji_results_prefix",
    "chat_react_action",
    "chat_react_more_aria",
    "chat_you_label",
    "chat_reply_label",
    "chat_receipt_sent_aria",
    "chat_receipt_seen_aria",
    "chat_seen_by_prefix",
    "chat_image_fallback_label",
    "chat_receipt_sent_glyph",
    "chat_receipt_read_glyph",
    "chat_receipt_delivered_aria",
    "chat_receipt_delivered_glyph",
    "chat_seen_count_glyph",
    "chat_receipt_pending_aria",
    "chat_receipt_pending_glyph",
    "chat_receipt_failed_aria",
    "chat_receipt_failed_glyph",
    "chat_receipt_retry_action",
    "chat_media_lightbox_title",
    "chat_media_lightbox_close_aria",
  ]) {
    assert(typeof rail.body[k] === "string" && rail.body[k].trim(), `chrome.${k}`);
  }

  const emojiCat = await req("/public/chat-emoji-catalog");
  assert(emojiCat.status === 200, "chat-emoji-catalog status");
  assert(
    Array.isArray(emojiCat.body?.categories) && emojiCat.body.categories.length >= 8,
    "emoji categories",
  );
  assert(
    Array.isArray(emojiCat.body?.quick_reactions) && emojiCat.body.quick_reactions.length >= 6,
    "quick_reactions",
  );
  const emojiTotal = emojiCat.body.categories.reduce(
    (n, c) => n + ((c.emojis || []).length || 0),
    0,
  );
  assert(emojiTotal >= 500, `emoji catalog size (${emojiTotal})`);
  assert(rail.body.dm_preview_max_chars.trim() === "20", "preview max 20");
  assert(rail.body.dm_preview_truncate_suffix.trim() === "...", "preview suffix ...");
  assert(
    Number.parseInt(rail.body.chat_reply_preview_max_chars, 10) === 80,
    "reply preview max 80",
  );
  assert(Number.parseInt(rail.body.match_intro_duration_ms, 10) === 3200, "intro 3200ms");

  const spectate = await req("/public/spectate-chrome");
  assert(spectate.status === 200, "spectate-chrome status");
  assert(spectate.body.watch_tab_chat?.trim(), "spectate watch_tab_chat");
  for (const k of [
    "chat_emoji_search_placeholder",
    "chat_react_action",
    "chat_you_label",
    "chat_receipt_sent_glyph",
    "chat_receipt_read_glyph",
    "chat_receipt_delivered_aria",
    "chat_receipt_delivered_glyph",
    "chat_seen_count_glyph",
    "chat_receipt_pending_aria",
    "chat_receipt_pending_glyph",
    "chat_receipt_failed_aria",
    "chat_receipt_failed_glyph",
    "chat_receipt_retry_action",
    "chat_media_lightbox_title",
    "chat_media_lightbox_close_aria",
    "chat_disable_action",
    "chat_input_placeholder",
    "chat_send_action",
  ]) {
    assert(typeof spectate.body[k] === "string" && spectate.body[k].trim(), `spectate.${k}`);
  }
  // Single ✓ vs ✓✓ must differ; play_rail + spectate chrome stay aligned (no glyph drift).
  assert(
    rail.body.chat_receipt_sent_glyph.trim() !== rail.body.chat_receipt_read_glyph.trim(),
    "play_rail sent glyph must differ from read glyph (single vs double check)",
  );
  assert(
    [...(rail.body.chat_receipt_sent_glyph || "")].length <
      [...(rail.body.chat_receipt_read_glyph || "")].length,
    "play_rail sent glyph shorter than read glyph (✓ vs ✓✓)",
  );
  for (const k of [
    "chat_receipt_sent_glyph",
    "chat_receipt_read_glyph",
    "chat_receipt_sent_aria",
    "chat_receipt_seen_aria",
  ]) {
    assert(
      String(spectate.body[k] || "").trim() === String(rail.body[k] || "").trim(),
      `spectate.${k} must match play_rail (chrome drift)`,
    );
  }

  const a = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `chat_a_${stamp}`,
      email: `chat_a_${stamp}@example.com`,
    }),
  });
  assert(a.status === 200 && a.body.access_token, "user A session");
  const atok = a.body.access_token;
  const aid = a.body.user.id;

  const b = await req("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `chat_b_${stamp}`,
      email: `chat_b_${stamp}@example.com`,
    }),
  });
  assert(b.status === 200 && b.body.access_token, "user B session");
  const btok = b.body.access_token;
  const bid = b.body.user.id;

  // DM request with long body ? preview truncated to 20 + ...
  const long = "abcdefghijklmnopqrstuvwxyz0123456789";
  const composeClientId = `e2e-compose-${stamp}`;
  const dmSend = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ to_user_id: bid, body: long, client_id: composeClientId }),
  });
  assert(dmSend.status === 200 && dmSend.body.request?.id, "DM request created");
  const dmId = dmSend.body.request.id;
  const threadId = dmSend.body.request.thread_id || dmSend.body.thread_id;
  assert(threadId, "DM thread_id");
  assert(
    dmSend.body.message?.client_id === composeClientId,
    "compose-new request seed echoes client_id",
  );
  assert(
    dmSend.body.message?.receipt === "sent",
    "compose-new seed receipt=sent (single check until peer read)",
  );
  assert(
    dmSend.body.message?.receipt !== "delivered",
    "compose-new seed never premature receipt=delivered",
  );
  // Idempotent compose-new: same client_id returns the same request (no duplicate notify/row).
  const composeRetry = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ to_user_id: bid, body: long, client_id: composeClientId }),
  });
  assert(composeRetry.status === 200, "compose-new idempotent retry status");
  assert(
    composeRetry.body.request?.id === dmId,
    "compose-new idempotent retry returns same request id",
  );
  assert(
    composeRetry.body.message?.id === dmSend.body.message?.id,
    "compose-new idempotent retry returns same seed message id",
  );

  const listB = await req("/dms/requests", {
    headers: { Authorization: `Bearer ${btok}` },
  });
  assert(listB.status === 200, "B list DM requests");
  assert(listB.body.pending_incoming >= 1, "B pending_incoming");
  const incoming = (listB.body.incoming || []).find((r) => r.id === dmId);
  assert(incoming, "incoming request found");
  assert(
    incoming.preview === "abcdefghijklmnopqrst..." || incoming.preview.endsWith("..."),
    "preview truncated",
  );
  assert(incoming.preview.length <= 23, "preview length bound");

  const unreadB = await req("/me/notifications/unread-count", {
    headers: { Authorization: `Bearer ${btok}` },
  });
  assert(unreadB.status === 200, "B unread");

  const notifList = await req("/me/notifications?limit=20&skip=0", {
    headers: { Authorization: `Bearer ${btok}` },
  });
  assert(notifList.status === 200, "B notifications list");
  const dmNotif = (notifList.body.items || []).find((n) => n.kind_code === "player.dm_request");
  assert(dmNotif, "dm_request notification");
  assert(
    typeof dmNotif.href === "string" &&
      dmNotif.href.includes("rail=players") &&
      dmNotif.href.includes("sub=dms") &&
      dmNotif.href.includes(`dm=${dmId}`),
    `dm_request href deep-link: ${dmNotif.href}`,
  );

  const preAcceptMsg = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ thread_id: threadId, body: "too early" }),
  });
  assert(preAcceptMsg.status === 403, "thread chat blocked until accept");

  // Pending DM uniqueness (friend-request parity) while request still pending.
  const dup = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ to_user_id: bid, body: "duplicate pending" }),
  });
  assert(dup.status >= 400, "duplicate pending DM rejected");

  const accept = await req(`/dms/requests/${dmId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: "{}",
  });
  assert(accept.status === 200, "accept DM");

  const threadMsg = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({
      thread_id: threadId,
      body: "hello back ??",
      client_id: `e2e-client-${stamp}-b1`,
    }),
  });
  assert(threadMsg.status === 200 && threadMsg.body.message?.id, "thread message");
  assert(threadMsg.body.message?.receipt === "sent", "create response receipt=sent");
  assert(
    threadMsg.body.message?.client_id === `e2e-client-${stamp}-b1`,
    "create response echoes client_id",
  );
  const parentMsgId = threadMsg.body.message.id;

  // Idempotent retry: same client_id must return the same message row (no duplicate).
  const idempotent = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({
      thread_id: threadId,
      body: "hello back ??",
      client_id: `e2e-client-${stamp}-b1`,
    }),
  });
  assert(idempotent.status === 200, "idempotent retry status");
  assert(idempotent.body.message?.id === parentMsgId, "idempotent retry returns same message id");

  // Accepted-thread message notifies peer with thread= deep-link (not dm=).
  const notifA = await req("/me/notifications?limit=20&skip=0", {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(notifA.status === 200, "A notifications after thread message");
  const dmMsgNotif = (notifA.body.items || []).find(
    (n) =>
      n.kind_code === "player.dm_message" && String(n.href || "").includes(`thread=${threadId}`),
  );
  assert(dmMsgNotif, "dm_message notification with thread= deep-link");
  assert(
    String(dmMsgNotif.href).includes("/?rail=players&sub=dms") &&
      String(dmMsgNotif.href).includes(`thread=${threadId}`),
    `dm_message href deep-link: ${dmMsgNotif.href}`,
  );

  const replyMsg = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      thread_id: threadId,
      body: "replying to you",
      reply_to_id: parentMsgId,
    }),
  });
  assert(
    replyMsg.status === 200 && replyMsg.body.message?.reply_to_id === parentMsgId,
    "same-thread reply",
  );
  assert(
    typeof replyMsg.body.message?.reply_preview === "string" &&
      replyMsg.body.message.reply_preview.includes("hello back"),
    "reply_preview from parent body",
  );

  const badReply = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      thread_id: threadId,
      body: "cross reply",
      reply_to_id: "00000000-0000-4000-8000-000000000001",
    }),
  });
  assert(badReply.status >= 400, "cross-thread / unknown reply_to rejected");

  const msgs = await req(`/dms/threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(msgs.status === 200 && (msgs.body.messages || []).length >= 3, "thread has messages");

  // B marks thread read ? A's outbound messages show receipt=read (??).
  const markDmRead = await req(`/dms/threads/${threadId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ message_id: parentMsgId }),
  });
  assert(markDmRead.status === 200, "DM mark read");
  const msgsAfterRead = await req(`/dms/threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(msgsAfterRead.status === 200, "messages after peer read");
  const aOutbound = (msgsAfterRead.body.messages || []).filter((m) => m.user_id === aid);
  assert(aOutbound.length >= 1, "A outbound messages present");
  assert(
    aOutbound.some((m) => m.receipt === "read"),
    "A outbound has receipt=read after B mark-read",
  );

  // After peer has a read watermark, a newer outbound stays receipt=sent (single ✓)
  // until the peer actually advances the watermark past this message - never premature ✓✓.
  const unreadProbe = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      thread_id: threadId,
      body: "unread probe",
      client_id: `e2e-client-${stamp}-unread`,
    }),
  });
  assert(unreadProbe.status === 200 && unreadProbe.body.message?.id, "unread probe post");
  assert(
    unreadProbe.body.message?.receipt === "sent",
    "create response still receipt=sent before peer watermark advance",
  );
  const msgsUnread = await req(`/dms/threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(msgsUnread.status === 200, "messages for unread receipt");
  const unreadMsg = (msgsUnread.body.messages || []).find(
    (m) => m.id === unreadProbe.body.message.id,
  );
  assert(unreadMsg, "unread probe message listed");
  assert(
    unreadMsg.receipt === "sent",
    `expected receipt=sent (not premature delivered/read) got ${unreadMsg.receipt}`,
  );
  assert(
    unreadMsg.receipt !== "delivered" && unreadMsg.receipt !== "read",
    "stale peer watermark must not upgrade newer outbound to delivered/read",
  );
  const allOutboundReceipts = (msgsUnread.body.messages || [])
    .filter((m) => m.user_id === aid)
    .map((m) => m.receipt);
  assert(
    allOutboundReceipts.every((r) => r === "sent" || r === "read"),
    `outbound receipts must be sent|read only, got ${JSON.stringify(allOutboundReceipts)}`,
  );

  // Peer reads the new message → sender sees receipt=read (✓✓ brand on clients).
  const markUnreadProbe = await req(`/dms/threads/${threadId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ message_id: unreadProbe.body.message.id }),
  });
  assert(markUnreadProbe.status === 200, "DM mark-read unread probe");
  const msgsAfterUnreadRead = await req(`/dms/threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(msgsAfterUnreadRead.status === 200, "messages after unread probe mark-read");
  const readProbeMsg = (msgsAfterUnreadRead.body.messages || []).find(
    (m) => m.id === unreadProbe.body.message.id,
  );
  assert(readProbeMsg, "unread probe still listed after mark-read");
  assert(
    readProbeMsg.receipt === "read",
    `expected receipt=read after peer mark-read got ${readProbeMsg.receipt}`,
  );

  const dmReact = await req(
    `/dms/threads/${threadId}/messages/${encodeURIComponent(parentMsgId)}/reactions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${atok}` },
      body: JSON.stringify({ emoji: "??" }),
    },
  );
  assert(dmReact.status === 200 && Array.isArray(dmReact.body?.reactions), "DM react");
  assert(
    (dmReact.body.reactions || []).some((r) => r.emoji === "??" && r.count >= 1),
    "DM reaction aggregated",
  );

  // DM image upload (Cloudinary dama/chat or local allow) + image-only post.
  const png = tinyPngBytes();
  const dmUp = await uploadChatImage("/dms/image", atok, png, "dot.png", "image/png");
  assert(dmUp.status === 200 && (dmUp.body.image_url || "").trim(), "DM image upload");
  const dmImgUrl = String(dmUp.body.image_url).trim();
  assert(
    dmImgUrl.includes("dama/chat") || dmImgUrl.includes("/media/chat/"),
    "DM image URL under chat folder",
  );
  const dmImgPost = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ thread_id: threadId, image_url: dmImgUrl }),
  });
  assert(dmImgPost.status === 200 || dmImgPost.status === 201, "DM image-only message");

  const videoReject = await uploadChatImage(
    "/dms/image",
    atok,
    Buffer.from("not-a-video"),
    "clip.mp4",
    "video/mp4",
  );
  assert(videoReject.status >= 400, "video/mp4 chat upload rejected");

  // Game chat: auth + join required for list/post (no anonymous scrape).
  const fakeGame = "00000000-0000-4000-8000-000000000099";
  const chatAnon = await req(`/games/${fakeGame}/chat`);
  assert(chatAnon.status === 401 || chatAnon.status === 403, "anon chat list denied");

  const chatList = await req(`/games/${fakeGame}/chat`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(chatList.status === 403, "non-joined cannot list chat");

  const chatPostGuest = await req(`/games/${fakeGame}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ body: "spectator hello" }),
  });
  assert(chatPostGuest.status === 403, "non-joined cannot post chat");

  const badImg = await req("/dms/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      thread_id: threadId,
      image_url: "https://evil.example/x.png",
    }),
  });
  assert(badImg.status === 400, "arbitrary image_url rejected");

  const chatToggleDenied = await req(`/games/${fakeGame}/chat`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ enabled: false }),
  });
  assert(chatToggleDenied.status === 403, "non-seated cannot toggle");

  // Seated PvP: post ? disable ? blocked ? enable ? resume (players-only toggle).
  const inv = await req("/invites/", {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({
      to_user: b.body.user.username,
      rated: false,
      preferred_color: "white",
      time_control_seconds: 180,
    }),
  });
  assert(inv.status === 201, "invite create for chat");
  const inviteId = inv.body?.id || inv.body?.invite?.id;
  assert(inviteId, "invite id for chat");
  const invAccept = await req(`/invites/${encodeURIComponent(inviteId)}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({}),
  });
  assert(invAccept.status === 200 || invAccept.status === 201, "invite accept for chat");
  const pvpId =
    invAccept.body?.match?.game_id ||
    invAccept.body?.invite?.game_id ||
    invAccept.body?.game_id ||
    invAccept.body?.game?.id;
  assert(pvpId, "pvp game id for chat");

  // Brief retry: Redis seat visibility can lag a tick after invite accept.
  let chatListOk = { status: 0, body: null };
  for (let i = 0; i < 8; i++) {
    chatListOk = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
      headers: { Authorization: `Bearer ${atok}` },
    });
    if (chatListOk.status === 200) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(
    chatListOk.status === 200,
    `seated list chat status=${chatListOk.status} body=${JSON.stringify(chatListOk.body)}`,
  );
  assert(chatListOk.body?.enabled === true, "chat enabled by default");
  assert(chatListOk.body?.can_post === true, "seated can_post when enabled");
  assert(chatListOk.body?.can_toggle === true, "seated can_toggle");
  assert(typeof chatListOk.body?.seen_total === "number", "game chat seen_total");

  const gameClientId = `e2e-game-client-${stamp}-a1`;
  const chatPost = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ body: "hello board", client_id: gameClientId }),
  });
  assert(chatPost.status === 200 || chatPost.status === 201, "seated post chat");
  const postedId = chatPost.body?.message?.id || chatPost.body?.id;
  assert(postedId, "posted chat message id");
  assert(
    (chatPost.body?.message?.client_id || chatPost.body?.client_id) === gameClientId,
    "game chat echoes client_id",
  );
  const chatPostIdem = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ body: "hello board", client_id: gameClientId }),
  });
  assert(chatPostIdem.status === 200 || chatPostIdem.status === 201, "game chat idempotent retry");
  const idemId = chatPostIdem.body?.message?.id || chatPostIdem.body?.id;
  assert(idemId === postedId, "game chat idempotent retry returns same message id");

  const chatReply = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ body: "reply board", reply_to_id: postedId }),
  });
  assert(chatReply.status === 200 || chatReply.status === 201, "seated reply chat");

  const gameReact = await req(
    `/games/${encodeURIComponent(pvpId)}/chat/messages/${encodeURIComponent(postedId)}/reactions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${btok}` },
      body: JSON.stringify({ emoji: "??" }),
    },
  );
  assert(gameReact.status === 200 && Array.isArray(gameReact.body?.reactions), "game chat react");

  const gameRead = await req(`/games/${encodeURIComponent(pvpId)}/chat/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ message_id: postedId }),
  });
  assert(
    gameRead.status === 200 && typeof gameRead.body?.seen_total === "number",
    "game chat mark read",
  );

  const chatAfterRead = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    headers: { Authorization: `Bearer ${atok}` },
  });
  assert(chatAfterRead.status === 200, "game chat list after read");
  const seenMsg = (chatAfterRead.body.messages || []).find((m) => m.id === postedId);
  assert(seenMsg, "posted message still listed");
  assert(
    typeof seenMsg.seen_count === "number" && seenMsg.seen_count >= 1,
    "seen_count after mark-read",
  );

  const chatDisable = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ enabled: false }),
  });
  assert(chatDisable.status === 200, "player disable chat");

  const chatWhileOff = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ body: "should fail" }),
  });
  assert(chatWhileOff.status === 403, "post blocked when chat disabled");

  const chatHist = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    headers: { Authorization: `Bearer ${btok}` },
  });
  assert(chatHist.status === 200, "history visible when disabled");
  assert(chatHist.body?.enabled === false, "enabled false after disable");
  assert(chatHist.body?.can_post === false, "can_post false when disabled");
  assert((chatHist.body?.messages || []).length >= 2, "prior messages still listed");

  const chatEnable = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${btok}` },
    body: JSON.stringify({ enabled: true }),
  });
  assert(chatEnable.status === 200, "player re-enable chat");

  const chatResume = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ body: "resumed" }),
  });
  assert(chatResume.status === 200 || chatResume.status === 201, "post after re-enable");

  const gameUp = await uploadChatImage(
    `/games/${encodeURIComponent(pvpId)}/chat/image`,
    atok,
    png,
    "board.png",
    "image/png",
  );
  assert(gameUp.status === 200 && (gameUp.body.image_url || "").trim(), "game chat image upload");
  const gameImgUrl = String(gameUp.body.image_url).trim();
  assert(
    gameImgUrl.includes("dama/chat") || gameImgUrl.includes("/media/chat/"),
    "game chat image URL under chat folder",
  );
  const gameImgPost = await req(`/games/${encodeURIComponent(pvpId)}/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ body: "with pic", image_url: gameImgUrl }),
  });
  assert(gameImgPost.status === 200 || gameImgPost.status === 201, "game chat media+text");

  const mark = await req(`/me/notifications/${dmNotif.id}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${btok}` },
  });
  assert(mark.status === 200 || mark.status === 204, "mark dm notif read");

  console.log("PASS: e2e-chat-dm-check");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
