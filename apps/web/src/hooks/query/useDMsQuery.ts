import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import type { PlayersSearchRow } from "@/hooks/query/usePlayersSearchQuery";
import { restClient } from "@/lib/api";
import { collectDmOutbox, mergeDmPageWithOutbox } from "@/lib/chat-dm-merge";
import {
  commitOptimisticDmMessage,
  failOptimisticDmMessage,
  invalidateDmListsOnly,
  upsertOptimisticDmMessage,
} from "@/lib/chat-optimistic";
import { dropChatOutboxMatchingServer } from "@/lib/chat-outbox";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import { QueryStale } from "@/lib/query-policy";
import { useAuthStore } from "@/store/auth";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export { collectDmOutbox, mergeDmPageWithOutbox } from "@/lib/chat-dm-merge";

export type DMRequestRow = {
  id: string;
  status: string;
  side: "in" | "out";
  preview: string;
  body?: string | null;
  image_url?: string | null;
  thread_id?: string | null;
  created_at: string;
  /** Peer messages after viewer read watermark (Telegram-style). */
  unread_count?: number;
  last_message_at?: string | null;
  player?: PlayersSearchRow;
};

export type DMReactionAgg = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type DMMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  username: string;
  avatar_thumb_url?: string | null;
  country_code?: string | null;
  body?: string | null;
  image_url?: string | null;
  reply_to_id?: string | null;
  reply_preview?: string | null;
  request_id?: string | null;
  reactions?: DMReactionAgg[];
  receipt?: "sent" | "delivered" | "read" | "pending" | "failed" | string | null;
  /** Idempotency key echoed from API when present. */
  client_id?: string | null;
  /** Client-only Telegram outbox state (not from API). */
  local_status?: "pending" | "failed" | null;
  created_at: string;
};

function invalidateDMs(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["dms"] });
}

function parsePollMs(raw: string | undefined): number | false {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return false;
  return n;
}

export async function fetchDMRequest(
  token: string,
  requestId: string,
): Promise<{
  request: {
    id: string;
    status: string;
    from_user_id: string;
    to_user_id: string;
    thread_id?: string | null;
    preview?: string;
  };
  player?: PlayersSearchRow;
} | null> {
  const id = requestId.trim();
  if (!token || !id) return null;
  try {
    const { data } = await restClient.get<{
      request?: {
        id: string;
        status: string;
        from_user_id: string;
        to_user_id: string;
        thread_id?: string | null;
        preview?: string;
      };
      player?: PlayersSearchRow;
    }>(`/dms/requests/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!data.request?.id) return null;
    return { request: data.request, player: data.player };
  } catch {
    return null;
  }
}

/** True when the caller can list messages for the thread (membership gate). */
export async function probeDMThreadAccess(token: string, threadId: string): Promise<boolean> {
  const id = threadId.trim();
  if (!token || !id) return false;
  try {
    await restClient.get(`/dms/threads/${id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch {
    return false;
  }
}

export function useDMRequestsQuery(token: string | null | undefined) {
  const chromeQuery = usePlayRailChromeQuery(Boolean(token));
  const chrome = isPlayRailChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const pollMs = parsePollMs(chrome?.dm_requests_poll_interval_ms);
  return useQuery({
    queryKey: ["dms", "requests", token ?? ""] as const,
    enabled: Boolean(token),
    staleTime: QueryStale.live,
    refetchInterval: pollMs,
    queryFn: async () => {
      const { data } = await restClient.get<{
        incoming?: DMRequestRow[];
        outgoing?: DMRequestRow[];
        pending_incoming?: number;
        unread_total?: number;
      }>("/dms/requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
        pendingIncoming: typeof data.pending_incoming === "number" ? data.pending_incoming : 0,
        unreadTotal: typeof data.unread_total === "number" ? data.unread_total : 0,
      };
    },
  });
}

/** Trim-bell infinite scroll for the DMs requests rail tab. Optional q is server-side peer username search. */
export function useDMRequestsInfinite(
  token: string | null | undefined,
  limit: number,
  enabled = true,
  q = "",
) {
  const pageSize = limit > 0 ? limit : 0;
  const needle = q.trim();
  return useInfiniteQuery({
    queryKey: ["dms", "requests", "infinite", token ?? "", pageSize, needle] as const,
    enabled: Boolean(token) && pageSize > 0 && enabled,
    staleTime: QueryStale.live,
    // Polling every infinite page reshuffles scroll; badge poll stays on non-infinite query.
    refetchOnWindowFocus: true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<{
        requests?: DMRequestRow[];
        meta?: SkipPaginationMeta;
        pending_incoming?: number;
        unread_total?: number;
      }>("/dms/requests", {
        params: { skip: pageParam, limit: pageSize, q: needle || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        requests: Array.isArray(data.requests) ? data.requests : [],
        meta: data.meta,
        pendingIncoming: typeof data.pending_incoming === "number" ? data.pending_incoming : 0,
        unreadTotal: typeof data.unread_total === "number" ? data.unread_total : 0,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.requests?.length ?? 0),
  });
}

export function useDMMessagesQuery(
  token: string | null | undefined,
  threadId: string | null | undefined,
) {
  const id = (threadId || "").trim();
  const chromeQuery = usePlayRailChromeQuery(Boolean(token && id));
  const chrome = isPlayRailChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const pollMs = parsePollMs(chrome?.dm_poll_interval_ms);
  return useQuery({
    queryKey: ["dms", "messages", id, token ?? ""] as const,
    enabled: Boolean(token && id),
    staleTime: QueryStale.live,
    refetchInterval: pollMs,
    queryFn: async () => {
      const { data } = await restClient.get<{ messages?: DMMessage[]; thread_id?: string }>(
        `/dms/threads/${id}/messages`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return {
        messages: Array.isArray(data.messages) ? data.messages : [],
        threadId: (data.thread_id || id).trim(),
      };
    },
  });
}

/** Trim-bell pages of DM thread messages (skip into older). */
export function useDMMessagesInfinite(
  token: string | null | undefined,
  threadId: string | null | undefined,
  limit: number,
  enabled = true,
) {
  const id = (threadId || "").trim();
  const pageSize = limit > 0 ? limit : 0;
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: ["dms", "messages", "infinite", id, token ?? "", pageSize] as const,
    enabled: Boolean(token && id) && pageSize > 0 && enabled,
    staleTime: QueryStale.live,
    // No refetchInterval on infinite history - refetching every page jumps the thread scroller.
    // Focus refetch + isError UI used to blank the thread on a single blip (RQ keeps data but
    // sets isRefetchError). Rely on invalidate-after-send / mount instead.
    refetchOnWindowFocus: false,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<{
        messages?: DMMessage[];
        thread_id?: string;
        meta?: SkipPaginationMeta;
      }>(`/dms/threads/${id}/messages`, {
        params: { skip: pageParam, limit: pageSize },
        headers: { Authorization: `Bearer ${token}` },
      });
      const serverMsgs = Array.isArray(data.messages) ? data.messages : [];
      const userId = useAuthStore.getState().user?.id || "";
      if (userId) dropChatOutboxMatchingServer(userId, serverMsgs);
      // First page (newest): re-attach in-flight optimistic outbox across WS invalidate.
      let messages = serverMsgs;
      if (pageParam === 0) {
        const prev = qc.getQueryData<{ pages: Array<{ messages?: DMMessage[] }> }>([
          "dms",
          "messages",
          "infinite",
          id,
          token ?? "",
          pageSize,
        ]);
        messages = mergeDmPageWithOutbox(serverMsgs, collectDmOutbox(prev?.pages));
      }
      return {
        messages,
        threadId: (data.thread_id || id).trim(),
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.messages?.length ?? 0),
  });
}

export type SendDMVariables = {
  /** Required for in-thread optimistic paint; omit for compose-new-DM modal. */
  clientId?: string;
  to_user_id?: string;
  thread_id?: string;
  body?: string;
  image_url?: string;
  reply_to_id?: string;
  reply_preview?: string | null;
};

export function useSendDMMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SendDMVariables) => {
      if (!token) throw new Error("");
      const { clientId, reply_preview: _preview, ...rest } = body;
      const client_id = (clientId || "").trim();
      const payload = {
        ...rest,
        ...(client_id ? { client_id } : {}),
      };
      const { data } = await restClient.post<{
        request?: DMRequestRow;
        message?: DMMessage;
        thread_id?: string | null;
      }>("/dms/messages", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onMutate: async (vars) => {
      const threadId = (vars.thread_id || "").trim();
      const clientId = (vars.clientId || "").trim();
      if (!threadId || !clientId) return;
      const me = useAuthStore.getState().user;
      if (!me?.id) return;
      // Preserve outbox bubble timestamp on retry / drain (do not reshuffle the thread).
      let createdAt = new Date().toISOString();
      const caches = qc.getQueriesData<{ pages?: Array<{ messages?: DMMessage[] }> }>({
        queryKey: ["dms", "messages", "infinite", threadId],
      });
      for (const [, data] of caches) {
        for (const page of data?.pages ?? []) {
          const hit = (page.messages ?? []).find((m) => m.id === clientId);
          if (hit?.created_at) {
            createdAt = hit.created_at;
            break;
          }
        }
      }
      const optimistic: DMMessage = {
        id: clientId,
        thread_id: threadId,
        user_id: me.id,
        username: me.username || "",
        avatar_thumb_url: me.avatarThumbUrl ?? null,
        body: vars.body ?? null,
        image_url: vars.image_url ?? null,
        reply_to_id: vars.reply_to_id ?? null,
        reply_preview: vars.reply_preview ?? null,
        client_id: clientId,
        receipt: "pending",
        local_status: "pending",
        created_at: createdAt,
      };
      upsertOptimisticDmMessage(qc, threadId, optimistic);
    },
    onSuccess: (data, vars) => {
      const threadId = (vars.thread_id || data.thread_id || "").trim();
      const clientId = (vars.clientId || data.message?.client_id || "").trim();
      if (threadId && clientId && data.message) {
        commitOptimisticDmMessage(qc, threadId, clientId, {
          ...data.message,
          local_status: null,
        });
        const uid = useAuthStore.getState().user?.id || "";
        if (uid) dropChatOutboxMatchingServer(uid, [{ client_id: clientId }]);
      }
      // Refresh request/list badges only - do not refetch open thread (avoids race wipe).
      invalidateDmListsOnly(qc);
    },
    onError: (_err, vars) => {
      const threadId = (vars.thread_id || "").trim();
      const clientId = (vars.clientId || "").trim();
      if (threadId && clientId) failOptimisticDmMessage(qc, threadId, clientId);
    },
  });
}

export function useAcceptDMMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!token) throw new Error("");
      await restClient.post(
        `/dms/requests/${requestId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => invalidateDMs(qc),
  });
}

export function useDenyDMMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!token) throw new Error("");
      await restClient.post(
        `/dms/requests/${requestId}/deny`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => invalidateDMs(qc),
  });
}

export function useCancelDMMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!token) throw new Error("");
      await restClient.delete(`/dms/requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => invalidateDMs(qc),
  });
}

export function useReactDMMutation(token: string | null | undefined, threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { messageId: string; emoji: string }) => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<{
        message_id: string;
        reactions: DMReactionAgg[];
      }>(
        `/dms/threads/${threadId}/messages/${opts.messageId}/reactions`,
        { emoji: opts.emoji },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data;
    },
    onSuccess: () => invalidateDMs(qc),
  });
}

export function useMarkDMReadMutation(token: string | null | undefined, threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { messageId?: string }) => {
      if (!token) throw new Error("");
      await restClient.post(
        `/dms/threads/${threadId}/read`,
        { message_id: opts?.messageId || undefined },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => invalidateDMs(qc),
  });
}
