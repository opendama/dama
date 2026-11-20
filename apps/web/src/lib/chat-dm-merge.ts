import { isLocalChatId } from "./chat-optimistic";

/** Minimal message shape for outbox↔server merge (avoids importing React Query hooks in tests). */
export type DmMergeMessage = {
  id: string;
  client_id?: string | null;
  local_status?: "pending" | "failed" | null;
};

/** Collect pending/failed/local rows from cached infinite pages (refetch merge). */
export function collectDmOutbox<T extends DmMergeMessage>(
  pages: Array<{ messages?: T[] }> | undefined,
): T[] {
  const out: T[] = [];
  for (const page of pages ?? []) {
    for (const m of page.messages ?? []) {
      if (!m?.id) continue;
      if (m.local_status === "pending" || m.local_status === "failed" || isLocalChatId(m.id)) {
        out.push(m);
      }
    }
  }
  return out;
}

/**
 * Merge server page 0 with optimistic outbox rows.
 * Drops local rows whose id matches a server `client_id` (POST ack / refetch race).
 */
export function mergeDmPageWithOutbox<T extends DmMergeMessage>(serverMsgs: T[], outbox: T[]): T[] {
  const serverClientIds = new Set(
    serverMsgs.map((m) => (m.client_id || "").trim()).filter((id) => id.length > 0),
  );
  const byId = new Map<string, T>();
  for (const m of serverMsgs) byId.set(m.id, { ...m, local_status: null });
  for (const m of outbox) {
    if (serverClientIds.has(m.id)) continue;
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()];
}

type GameMergeMessage = DmMergeMessage & { created_at: string };

/**
 * Game chat poll merge: keep pending/failed/local rows from the previous payload
 * that the server has not yet acked via `client_id`.
 */
export function mergeGameChatOutbox<T extends GameMergeMessage>(
  server: T[],
  prev: T[] | undefined,
): T[] {
  const outbox = (prev ?? []).filter(
    (m) =>
      Boolean(m?.id) &&
      (m.local_status === "pending" || m.local_status === "failed" || isLocalChatId(m.id)),
  );
  return mergeDmPageWithOutbox(server, outbox).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}
