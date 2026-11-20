import type { QueryClient } from "@tanstack/react-query";
import type { DMMessage } from "../hooks/query/useDMsQuery";
import type { GameChatMessage, GameChatPayload } from "../hooks/query/useGameChatQuery";

/** Client-only id prefix - never collide with server UUIDs. */
export function newChatClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isLocalChatId(id: string): boolean {
  return id.startsWith("local-");
}

type DmInfiniteData = {
  pages: Array<{
    messages?: DMMessage[];
    threadId?: string;
    meta?: unknown;
  }>;
  pageParams: unknown[];
};

function sortByCreatedAt<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/** Append / upsert an optimistic DM into every matching infinite-messages cache. */
export function upsertOptimisticDmMessage(qc: QueryClient, threadId: string, msg: DMMessage): void {
  const tid = threadId.trim();
  if (!tid || !msg.id) return;
  qc.setQueriesData<DmInfiniteData>({ queryKey: ["dms", "messages", "infinite", tid] }, (old) => {
    if (!old?.pages?.length) {
      return {
        pages: [{ messages: [msg], threadId: tid }],
        pageParams: [0],
      };
    }
    const pages = old.pages.map((page, index) => {
      const rest = (page.messages ?? []).filter((m) => m.id !== msg.id);
      if (index === 0) {
        return { ...page, messages: [...rest, msg] };
      }
      return { ...page, messages: rest };
    });
    return { ...old, pages };
  });
}

/** Replace a local optimistic row with the server message (dedupe by server id). */
export function commitOptimisticDmMessage(
  qc: QueryClient,
  threadId: string,
  clientId: string,
  serverMsg: DMMessage,
): void {
  const tid = threadId.trim();
  if (!tid || !clientId || !serverMsg?.id) return;
  qc.setQueriesData<DmInfiniteData>({ queryKey: ["dms", "messages", "infinite", tid] }, (old) => {
    if (!old?.pages?.length) {
      return {
        pages: [{ messages: [serverMsg], threadId: tid }],
        pageParams: [0],
      };
    }
    const pages = old.pages.map((page, index) => {
      const rest = (page.messages ?? []).filter((m) => m.id !== clientId && m.id !== serverMsg.id);
      if (index === 0) {
        return { ...page, messages: [...rest, serverMsg] };
      }
      return { ...page, messages: rest };
    });
    return { ...old, pages };
  });
}

/** Mark a local DM row failed (keep bubble; do not wipe siblings). */
export function failOptimisticDmMessage(qc: QueryClient, threadId: string, clientId: string): void {
  const tid = threadId.trim();
  if (!tid || !clientId) return;
  qc.setQueriesData<DmInfiniteData>({ queryKey: ["dms", "messages", "infinite", tid] }, (old) => {
    if (!old?.pages?.length) return old;
    const pages = old.pages.map((page) => ({
      ...page,
      messages: (page.messages ?? []).map((m) =>
        m.id === clientId
          ? { ...m, receipt: "failed" as const, local_status: "failed" as const }
          : m,
      ),
    }));
    return { ...old, pages };
  });
}

/** Invalidate DM list/request queries without refetching open thread messages. */
export function invalidateDmListsOnly(qc: QueryClient): void {
  void qc.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (key[0] !== "dms") return false;
      return key[1] !== "messages";
    },
  });
}

export function upsertOptimisticGameChatMessage(
  qc: QueryClient,
  gameId: string,
  token: string,
  msg: GameChatMessage,
): void {
  const gid = gameId.trim();
  if (!gid || !msg.id) return;
  qc.setQueryData<GameChatPayload>(["game-chat", gid, token], (old) => {
    if (!old) {
      return {
        enabled: true,
        can_toggle: false,
        can_post: true,
        unread_count: 0,
        messages: [msg],
      };
    }
    const rest = old.messages.filter((m) => m.id !== msg.id);
    return { ...old, messages: sortByCreatedAt([...rest, msg]) };
  });
}

export function commitOptimisticGameChatMessage(
  qc: QueryClient,
  gameId: string,
  token: string,
  clientId: string,
  serverMsg: GameChatMessage,
): void {
  const gid = gameId.trim();
  if (!gid || !clientId || !serverMsg?.id) return;
  qc.setQueryData<GameChatPayload>(["game-chat", gid, token], (old) => {
    if (!old) {
      return {
        enabled: true,
        can_toggle: false,
        can_post: true,
        unread_count: 0,
        messages: [serverMsg],
      };
    }
    const rest = old.messages.filter((m) => m.id !== clientId && m.id !== serverMsg.id);
    return { ...old, messages: sortByCreatedAt([...rest, serverMsg]) };
  });
}

export function failOptimisticGameChatMessage(
  qc: QueryClient,
  gameId: string,
  token: string,
  clientId: string,
): void {
  const gid = gameId.trim();
  if (!gid || !clientId) return;
  qc.setQueryData<GameChatPayload>(["game-chat", gid, token], (old) => {
    if (!old) return old;
    return {
      ...old,
      messages: old.messages.map((m) =>
        m.id === clientId ? { ...m, local_status: "failed" as const } : m,
      ),
    };
  });
}
