import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ChatOutboxItem,
  chatOutboxStorageKey,
  drainChatOutbox,
  dropChatOutboxMatchingServer,
  enqueueChatOutbox,
  loadChatOutbox,
  removeChatOutboxItem,
  requeueChatOutboxItem,
  saveChatOutbox,
} from "./chat-outbox";

const USER = "user-test-1";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function baseItem(
  over: Partial<ChatOutboxItem> & Pick<ChatOutboxItem, "clientId">,
): ChatOutboxItem {
  return {
    kind: "dm",
    threadId: "thread-a",
    body: "hi",
    status: "pending",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("chat-outbox", () => {
  beforeEach(() => {
    const store = memoryStorage();
    vi.stubGlobal("window", { localStorage: store } as Window & typeof globalThis);
    vi.stubGlobal("localStorage", store);
    saveChatOutbox(USER, []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enqueues in createdAt order per scope", () => {
    enqueueChatOutbox(
      USER,
      baseItem({ clientId: "local-b", body: "b", createdAt: "2026-01-01T00:00:02.000Z" }),
    );
    enqueueChatOutbox(
      USER,
      baseItem({ clientId: "local-a", body: "a", createdAt: "2026-01-01T00:00:01.000Z" }),
    );
    enqueueChatOutbox(
      USER,
      baseItem({
        clientId: "local-c",
        threadId: "thread-b",
        body: "other",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const all = loadChatOutbox(USER);
    expect(all.map((i) => i.clientId)).toEqual(["local-c", "local-a", "local-b"]);
    expect(chatOutboxStorageKey(USER)).toBe(`dama-chat-outbox:${USER}`);
  });

  it("durable roundtrip via mocked localStorage", () => {
    enqueueChatOutbox(
      USER,
      baseItem({
        clientId: "local-1",
        body: "persist me",
        imageUrl: "https://example/x.png",
        replyToId: "msg-9",
        replyPreview: "earlier",
        peerName: "Ada",
        createdAt: "2026-02-01T12:00:00.000Z",
      }),
    );
    const raw = localStorage.getItem(chatOutboxStorageKey(USER));
    expect(raw).toBeTruthy();
    // Simulate remount: clear in-memory assumptions and reload.
    const again = loadChatOutbox(USER);
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({
      clientId: "local-1",
      kind: "dm",
      threadId: "thread-a",
      body: "persist me",
      imageUrl: "https://example/x.png",
      replyToId: "msg-9",
      replyPreview: "earlier",
      peerName: "Ada",
      status: "pending",
    });
  });

  it("duplicate clientId commit replaces row; remove drops it", () => {
    enqueueChatOutbox(USER, baseItem({ clientId: "local-dup", body: "first" }));
    enqueueChatOutbox(USER, baseItem({ clientId: "local-dup", body: "second", status: "pending" }));
    expect(loadChatOutbox(USER)).toHaveLength(1);
    expect(loadChatOutbox(USER)[0]?.body).toBe("second");
    removeChatOutboxItem(USER, "local-dup");
    expect(loadChatOutbox(USER)).toHaveLength(0);
    // Server ack with matching client_id also drops durable row.
    enqueueChatOutbox(USER, baseItem({ clientId: "local-ack", body: "x" }));
    dropChatOutboxMatchingServer(USER, [{ client_id: "local-ack" }]);
    expect(loadChatOutbox(USER)).toHaveLength(0);
  });

  it("compose-new scope keys by toUserId and survives durable roundtrip", () => {
    enqueueChatOutbox(
      USER,
      baseItem({
        clientId: "local-compose",
        threadId: undefined,
        toUserId: "peer-9",
        peerName: "Peer",
        body: "first hello",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    );
    const loaded = loadChatOutbox(USER);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.toUserId).toBe("peer-9");
    expect(loaded[0]?.peerName).toBe("Peer");
    // Unrelated server ack must not wipe compose draft.
    dropChatOutboxMatchingServer(USER, [{ client_id: "other-id" }]);
    expect(loadChatOutbox(USER)).toHaveLength(1);
    // Matching client_id ack drops the durable compose row (duplicate-merge).
    dropChatOutboxMatchingServer(USER, [{ client_id: "local-compose" }]);
    expect(loadChatOutbox(USER)).toHaveLength(0);
  });

  it("fail-then-retry drains serially and requeues same clientId", async () => {
    enqueueChatOutbox(
      USER,
      baseItem({ clientId: "local-1", body: "one", createdAt: "2026-01-01T00:00:01.000Z" }),
    );
    enqueueChatOutbox(
      USER,
      baseItem({ clientId: "local-2", body: "two", createdAt: "2026-01-01T00:00:02.000Z" }),
    );

    const attempts: string[] = [];
    let failFirst = true;
    await drainChatOutbox({
      userId: USER,
      kind: "dm",
      threadId: "thread-a",
      send: async (item) => {
        attempts.push(item.clientId);
        if (item.clientId === "local-1" && failFirst) {
          failFirst = false;
          throw new Error("network");
        }
      },
    });

    expect(attempts).toEqual(["local-1", "local-2"]);
    const afterFail = loadChatOutbox(USER);
    expect(afterFail).toHaveLength(1);
    expect(afterFail[0]?.clientId).toBe("local-1");
    expect(afterFail[0]?.status).toBe("failed");

    const requeued = requeueChatOutboxItem(USER, "local-1");
    expect(requeued?.status).toBe("pending");
    expect(requeued?.clientId).toBe("local-1");

    await drainChatOutbox({
      userId: USER,
      kind: "dm",
      threadId: "thread-a",
      send: async (item) => {
        attempts.push(`retry:${item.clientId}`);
      },
    });

    expect(attempts).toEqual(["local-1", "local-2", "retry:local-1"]);
    expect(loadChatOutbox(USER)).toHaveLength(0);
  });
});
