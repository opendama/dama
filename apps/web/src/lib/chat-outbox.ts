import type { QueryClient } from "@tanstack/react-query";
import type { DMMessage } from "../hooks/query/useDMsQuery";
import type { GameChatMessage } from "../hooks/query/useGameChatQuery";
import {
  failOptimisticDmMessage,
  failOptimisticGameChatMessage,
  upsertOptimisticDmMessage,
  upsertOptimisticGameChatMessage,
} from "./chat-optimistic";

export type ChatOutboxKind = "dm" | "game";

export type ChatOutboxStatus = "pending" | "failed" | "sending";

export type ChatOutboxItem = {
  clientId: string;
  kind: ChatOutboxKind;
  threadId?: string;
  /** Compose-new DM: peer user id before thread_id exists. */
  toUserId?: string;
  gameId?: string;
  body?: string;
  imageUrl?: string;
  replyToId?: string;
  replyPreview?: string | null;
  status: ChatOutboxStatus;
  createdAt: string;
  peerName?: string;
};

type OutboxAuthor = {
  id: string;
  username?: string | null;
  avatarThumbUrl?: string | null;
};

/** Durable localStorage key for a user's chat outbox. */
export function chatOutboxStorageKey(userId: string): string {
  return `dama-chat-outbox:${userId.trim()}`;
}

export function chatOutboxScopeKey(
  item: Pick<ChatOutboxItem, "kind" | "threadId" | "gameId" | "toUserId">,
): string {
  if (item.kind === "dm") {
    const tid = (item.threadId || "").trim();
    if (tid) return `dm:${tid}`;
    const peer = (item.toUserId || "").trim();
    if (peer) return `dm:compose:${peer}`;
    return "dm:";
  }
  return `game:${(item.gameId || "").trim()}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isOutboxItem(raw: unknown): raw is ChatOutboxItem {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  const clientId = typeof o.clientId === "string" ? o.clientId.trim() : "";
  const kind = o.kind;
  const status = o.status;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  if (!clientId || !createdAt) return false;
  if (kind !== "dm" && kind !== "game") return false;
  if (status !== "pending" && status !== "failed" && status !== "sending") return false;
  return true;
}

/** Load durable outbox rows for a user (empty when SSR / missing). */
export function loadChatOutbox(userId: string): ChatOutboxItem[] {
  const uid = userId.trim();
  if (!uid || !canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(chatOutboxStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxItem).map((item) => ({
      ...item,
      clientId: item.clientId.trim(),
      threadId: item.threadId?.trim() || undefined,
      toUserId: item.toUserId?.trim() || undefined,
      gameId: item.gameId?.trim() || undefined,
      body: item.body,
      imageUrl: item.imageUrl,
      replyToId: item.replyToId,
      replyPreview: item.replyPreview ?? null,
      peerName: item.peerName,
    }));
  } catch {
    return [];
  }
}

/** Persist full outbox snapshot for a user. */
export function saveChatOutbox(userId: string, items: ChatOutboxItem[]): void {
  const uid = userId.trim();
  if (!uid || !canUseStorage()) return;
  try {
    window.localStorage.setItem(chatOutboxStorageKey(uid), JSON.stringify(items));
  } catch {
    // Quota / private mode - fail closed (in-memory send still works via RQ).
  }
}

function sortByCreatedAt(items: ChatOutboxItem[]): ChatOutboxItem[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function matchesScope(
  item: ChatOutboxItem,
  scope: { kind: ChatOutboxKind; threadId?: string; gameId?: string; toUserId?: string },
): boolean {
  if (item.kind !== scope.kind) return false;
  if (scope.kind === "dm") {
    return (
      chatOutboxScopeKey(item) ===
      chatOutboxScopeKey({
        kind: "dm",
        threadId: scope.threadId,
        toUserId: scope.toUserId,
      })
    );
  }
  return (item.gameId || "").trim() === (scope.gameId || "").trim();
}

/** Append or replace by clientId; keeps per-scope FIFO by createdAt. */
export function enqueueChatOutbox(userId: string, item: ChatOutboxItem): ChatOutboxItem {
  const uid = userId.trim();
  const clientId = item.clientId.trim();
  const nextItem: ChatOutboxItem = {
    ...item,
    clientId,
    threadId: item.threadId?.trim() || undefined,
    gameId: item.gameId?.trim() || undefined,
    status: item.status || "pending",
    createdAt: item.createdAt || new Date().toISOString(),
  };
  const rest = loadChatOutbox(uid).filter((i) => i.clientId !== clientId);
  rest.push(nextItem);
  saveChatOutbox(uid, sortByCreatedAt(rest));
  return nextItem;
}

/** Remove a committed (acked) outbox row. */
export function removeChatOutboxItem(userId: string, clientId: string): void {
  const uid = userId.trim();
  const cid = clientId.trim();
  if (!uid || !cid) return;
  const next = loadChatOutbox(uid).filter((i) => i.clientId !== cid);
  saveChatOutbox(uid, next);
}

export function updateChatOutboxItem(
  userId: string,
  clientId: string,
  patch: Partial<Omit<ChatOutboxItem, "clientId">>,
): ChatOutboxItem | null {
  const uid = userId.trim();
  const cid = clientId.trim();
  if (!uid || !cid) return null;
  const items = loadChatOutbox(uid);
  const idx = items.findIndex((i) => i.clientId === cid);
  if (idx < 0) return null;
  const prev = items[idx];
  if (!prev) return null;
  const updated: ChatOutboxItem = {
    ...prev,
    ...patch,
    clientId: cid,
    kind: patch.kind ?? prev.kind,
    status: patch.status ?? prev.status,
    createdAt: patch.createdAt ?? prev.createdAt,
  };
  items[idx] = updated;
  saveChatOutbox(uid, sortByCreatedAt(items));
  return updated;
}

/** Mark failed → pending so drain will retry the same clientId. */
export function requeueChatOutboxItem(userId: string, clientId: string): ChatOutboxItem | null {
  return updateChatOutboxItem(userId, clientId, { status: "pending" });
}

/** Drop durable rows whose clientId appears on server messages (merge on fetch). */
export function dropChatOutboxMatchingServer(
  userId: string,
  serverMsgs: Array<{ client_id?: string | null }>,
): void {
  const uid = userId.trim();
  if (!uid) return;
  const matched = new Set(
    serverMsgs.map((m) => (m.client_id || "").trim()).filter((id) => id.length > 0),
  );
  if (matched.size === 0) return;
  const prev = loadChatOutbox(uid);
  const next = prev.filter((i) => !matched.has(i.clientId));
  if (next.length !== prev.length) saveChatOutbox(uid, next);
}

function toDmMessage(item: ChatOutboxItem, me: OutboxAuthor): DMMessage {
  const failed = item.status === "failed";
  return {
    id: item.clientId,
    thread_id: (item.threadId || "").trim(),
    user_id: me.id,
    username: me.username || "",
    avatar_thumb_url: me.avatarThumbUrl ?? null,
    body: item.body ?? null,
    image_url: item.imageUrl ?? null,
    reply_to_id: item.replyToId ?? null,
    reply_preview: item.replyPreview ?? null,
    client_id: item.clientId,
    receipt: failed ? "failed" : "pending",
    local_status: failed ? "failed" : "pending",
    created_at: item.createdAt,
  };
}

function toGameMessage(item: ChatOutboxItem, me: OutboxAuthor): GameChatMessage {
  const failed = item.status === "failed";
  return {
    id: item.clientId,
    game_id: (item.gameId || "").trim(),
    user_id: me.id,
    username: me.username || "",
    avatar_thumb_url: me.avatarThumbUrl ?? null,
    body: item.body ?? null,
    image_url: item.imageUrl ?? null,
    reply_to_id: item.replyToId ?? null,
    reply_preview: item.replyPreview ?? null,
    client_id: item.clientId,
    local_status: failed ? "failed" : "pending",
    created_at: item.createdAt,
  };
}

/** Paint durable pending/failed rows into RQ (sending → pending on hydrate). */
export function hydrateChatOutboxIntoCache(opts: {
  qc: QueryClient;
  userId: string;
  token: string;
  me: OutboxAuthor;
  kind?: ChatOutboxKind;
  threadId?: string;
  gameId?: string;
}): void {
  const uid = opts.userId.trim();
  if (!uid || !opts.me?.id) return;
  let items = loadChatOutbox(uid);
  let dirty = false;
  items = items.map((item) => {
    if (item.status !== "sending") return item;
    dirty = true;
    return { ...item, status: "pending" as const };
  });
  if (dirty) saveChatOutbox(uid, items);

  for (const item of items) {
    if (item.status !== "pending" && item.status !== "failed") continue;
    if (
      opts.kind &&
      !matchesScope(item, { kind: opts.kind, threadId: opts.threadId, gameId: opts.gameId })
    ) {
      continue;
    }
    const threadId = (item.threadId || "").trim();
    const gameId = (item.gameId || "").trim();
    if (item.kind === "dm" && threadId) {
      upsertOptimisticDmMessage(opts.qc, threadId, toDmMessage(item, opts.me));
    } else if (item.kind === "game" && gameId && opts.token) {
      upsertOptimisticGameChatMessage(opts.qc, gameId, opts.token, toGameMessage(item, opts.me));
    }
  }
}

/** Paint one enqueued row into the open thread cache. */
export function paintChatOutboxItem(
  qc: QueryClient,
  item: ChatOutboxItem,
  me: OutboxAuthor,
  token: string,
): void {
  if (!me?.id) return;
  const threadId = (item.threadId || "").trim();
  const gameId = (item.gameId || "").trim();
  if (item.kind === "dm" && threadId) {
    upsertOptimisticDmMessage(qc, threadId, toDmMessage(item, me));
  } else if (item.kind === "game" && gameId && token) {
    upsertOptimisticGameChatMessage(qc, gameId, token, toGameMessage(item, me));
  }
}

const drainLocks = new Map<string, Promise<void>>();

export type DrainChatOutboxOpts = {
  userId: string;
  kind: ChatOutboxKind;
  threadId?: string;
  toUserId?: string;
  gameId?: string;
  /** Perform the network send for one item (throw on failure). */
  send: (item: ChatOutboxItem) => Promise<void>;
  qc?: QueryClient;
  token?: string;
};

/**
 * Drain pending items for one scope in createdAt order.
 * On failure: mark failed (and RQ if qc given), then continue with the next pending.
 */
export function drainChatOutbox(opts: DrainChatOutboxOpts): Promise<void> {
  const scope = chatOutboxScopeKey({
    kind: opts.kind,
    threadId: opts.threadId,
    toUserId: opts.toUserId,
    gameId: opts.gameId,
  });
  const prev = drainLocks.get(scope) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => drainScopeOnce(opts));
  drainLocks.set(
    scope,
    run.finally(() => {
      if (drainLocks.get(scope) === run) drainLocks.delete(scope);
    }),
  );
  return run;
}

async function drainScopeOnce(opts: DrainChatOutboxOpts): Promise<void> {
  const uid = opts.userId.trim();
  if (!uid) return;
  const scope = {
    kind: opts.kind,
    threadId: opts.threadId,
    toUserId: opts.toUserId,
    gameId: opts.gameId,
  };

  for (;;) {
    const pending = sortByCreatedAt(
      loadChatOutbox(uid).filter((i) => matchesScope(i, scope) && i.status === "pending"),
    );
    const next = pending[0];
    if (!next) return;

    updateChatOutboxItem(uid, next.clientId, { status: "sending" });
    try {
      await opts.send(next);
      removeChatOutboxItem(uid, next.clientId);
    } catch {
      updateChatOutboxItem(uid, next.clientId, { status: "failed" });
      if (opts.qc) {
        if (next.kind === "dm" && next.threadId) {
          failOptimisticDmMessage(opts.qc, next.threadId, next.clientId);
        } else if (next.kind === "game" && next.gameId && opts.token) {
          failOptimisticGameChatMessage(opts.qc, next.gameId, opts.token, next.clientId);
        }
      }
      // Continue with the next pending item (Telegram-grade ordered outbox).
    }
  }
}
