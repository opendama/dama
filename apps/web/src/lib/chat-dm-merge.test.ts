import { describe, expect, it } from "vitest";
import {
  type DmMergeMessage,
  collectDmOutbox,
  mergeDmPageWithOutbox,
  mergeGameChatOutbox,
} from "./chat-dm-merge";

function msg(
  over: Partial<DmMergeMessage> &
    Pick<DmMergeMessage, "id"> & { body?: string; created_at?: string },
): DmMergeMessage & { body?: string; created_at?: string } {
  return { ...over };
}

describe("mergeDmPageWithOutbox", () => {
  it("preserves pending outbox rows across server refetch", () => {
    const server = [msg({ id: "srv-1", client_id: "local-acked", body: "hi" })];
    const outbox = [
      msg({ id: "local-pending", local_status: "pending", body: "still sending" }),
      msg({ id: "local-acked", local_status: "pending", body: "duplicate" }),
    ];
    const merged = mergeDmPageWithOutbox(server, outbox);
    const ids = merged.map((m) => m.id).sort();
    expect(ids).toEqual(["local-pending", "srv-1"]);
    expect(merged.find((m) => m.id === "srv-1")?.local_status).toBeNull();
  });

  it("collectDmOutbox pulls pending/failed/local ids from pages", () => {
    const pages = [
      {
        messages: [
          msg({ id: "srv-1", body: "ok" }),
          msg({ id: "local-1", local_status: "pending", body: "p" }),
          msg({ id: "local-2", local_status: "failed", body: "f" }),
        ],
      },
    ];
    const collected = collectDmOutbox(pages);
    expect(collected.map((m) => m.id).sort()).toEqual(["local-1", "local-2"]);
  });
});

describe("mergeGameChatOutbox", () => {
  it("keeps unacked pending/failed across poll and sorts by created_at", () => {
    const prev = [
      msg({
        id: "local-old",
        local_status: "pending",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      msg({
        id: "local-acked",
        local_status: "pending",
        created_at: "2026-01-01T00:00:02.000Z",
      }),
      msg({
        id: "srv-keep",
        created_at: "2026-01-01T00:00:01.000Z",
      }),
    ];
    const server = [
      msg({
        id: "srv-1",
        client_id: "local-acked",
        created_at: "2026-01-01T00:00:02.000Z",
      }),
      msg({
        id: "srv-keep",
        created_at: "2026-01-01T00:00:01.000Z",
      }),
    ];
    const merged = mergeGameChatOutbox(server, prev);
    expect(merged.map((m) => m.id)).toEqual(["local-old", "srv-keep", "srv-1"]);
  });
});
