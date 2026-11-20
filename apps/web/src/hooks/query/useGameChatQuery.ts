import { usePlayRailChromeQuery } from "@/hooks/query/usePlayRailChromeQuery";
import { restClient } from "@/lib/api";
import { mergeGameChatOutbox } from "@/lib/chat-dm-merge";
import {
  commitOptimisticGameChatMessage,
  failOptimisticGameChatMessage,
  upsertOptimisticGameChatMessage,
} from "@/lib/chat-optimistic";
import { dropChatOutboxMatchingServer } from "@/lib/chat-outbox";
import { apiRestUrl } from "@/lib/env";
import { QueryStale } from "@/lib/query-policy";
import { useAuthStore } from "@/store/auth";
import { isPlayRailChromeReady } from "@/types/play-rail-chrome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export { mergeGameChatOutbox } from "@/lib/chat-dm-merge";

export type ChatReactionAgg = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type GameChatMessage = {
  id: string;
  game_id: string;
  user_id: string;
  username: string;
  avatar_thumb_url?: string | null;
  country_code?: string | null;
  body?: string | null;
  image_url?: string | null;
  reply_to_id?: string | null;
  reply_preview?: string | null;
  reactions?: ChatReactionAgg[];
  seen_count?: number;
  seen_total?: number;
  /** Idempotency key echoed from API when present. */
  client_id?: string | null;
  /** Client-only Telegram outbox state (not from API). */
  local_status?: "pending" | "failed" | null;
  created_at: string;
};

export type GameChatPayload = {
  enabled: boolean;
  can_toggle: boolean;
  can_post: boolean;
  /** Peer messages + reactions after viewer watermark (Telegram-style). */
  unread_count: number;
  messages: GameChatMessage[];
};

function parsePollMs(raw: string | undefined): number | false {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  // Fail closed: no invented interval when chrome missing/invalid.
  if (!Number.isFinite(n) || n <= 0) return false;
  return n;
}

export function useGameChatQuery(gameId: string | null | undefined, enabled = true) {
  const id = (gameId || "").trim();
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const chromeQuery = usePlayRailChromeQuery(Boolean(id) && enabled);
  const chrome = isPlayRailChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const pollMs = parsePollMs(chrome?.chat_poll_interval_ms);
  return useQuery({
    queryKey: ["game-chat", id, token ?? ""] as const,
    enabled: Boolean(id && token) && enabled,
    staleTime: QueryStale.live,
    refetchInterval: pollMs,
    queryFn: async (): Promise<GameChatPayload> => {
      const { data } = await restClient.get<GameChatPayload>(`/games/${id}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const prev = qc.getQueryData<GameChatPayload>(["game-chat", id, token ?? ""]);
      const serverMsgs = Array.isArray(data.messages) ? data.messages : [];
      const userId = useAuthStore.getState().user?.id || "";
      if (userId) dropChatOutboxMatchingServer(userId, serverMsgs);
      return {
        enabled: data.enabled === true,
        can_toggle: Boolean(data.can_toggle),
        can_post: Boolean(data.can_post),
        unread_count: typeof data.unread_count === "number" ? data.unread_count : 0,
        // Preserve in-flight optimistic bubbles across poll / WS invalidate.
        messages: mergeGameChatOutbox(serverMsgs, prev?.messages),
      };
    },
  });
}

export type PostGameChatVariables = {
  clientId: string;
  body?: string;
  image_url?: string;
  reply_to_id?: string;
  reply_preview?: string | null;
};

export function usePostGameChatMutation(token: string | null | undefined, gameId: string) {
  const qc = useQueryClient();
  const gid = gameId.trim();
  return useMutation({
    mutationFn: async (body: PostGameChatVariables) => {
      if (!token) throw new Error("");
      const { clientId, reply_preview: _preview, ...rest } = body;
      const client_id = (clientId || "").trim();
      const payload = {
        ...rest,
        ...(client_id ? { client_id } : {}),
      };
      const { data } = await restClient.post<{ message: GameChatMessage }>(
        `/games/${gid}/chat`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data.message;
    },
    onMutate: async (vars) => {
      if (!token) return;
      const me = useAuthStore.getState().user;
      if (!me?.id) return;
      const clientId = (vars.clientId || "").trim();
      if (!clientId) return;
      // Preserve outbox bubble timestamp on retry / drain.
      let createdAt = new Date().toISOString();
      const prev = qc.getQueryData<GameChatPayload>(["game-chat", gid, token]);
      const hit = prev?.messages?.find((m) => m.id === clientId);
      if (hit?.created_at) createdAt = hit.created_at;
      const optimistic: GameChatMessage = {
        id: clientId,
        game_id: gid,
        user_id: me.id,
        username: me.username || "",
        avatar_thumb_url: me.avatarThumbUrl ?? null,
        body: vars.body ?? null,
        image_url: vars.image_url ?? null,
        reply_to_id: vars.reply_to_id ?? null,
        reply_preview: vars.reply_preview ?? null,
        client_id: clientId,
        local_status: "pending",
        created_at: createdAt,
      };
      upsertOptimisticGameChatMessage(qc, gid, token, optimistic);
    },
    onSuccess: (serverMsg, vars) => {
      if (!token) return;
      const clientId = (vars.clientId || serverMsg.client_id || "").trim();
      commitOptimisticGameChatMessage(qc, gid, token, clientId || vars.clientId, {
        ...serverMsg,
        local_status: null,
      });
      const uid = useAuthStore.getState().user?.id || "";
      if (uid && clientId) dropChatOutboxMatchingServer(uid, [{ client_id: clientId }]);
      // Do not invalidate the open thread - avoids refetch race wiping the commit.
    },
    onError: (_err, vars) => {
      if (!token) return;
      failOptimisticGameChatMessage(qc, gid, token, vars.clientId);
    },
  });
}

export function useToggleGameChatMutation(token: string | null | undefined, gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!token) throw new Error("");
      const { data } = await restClient.patch<{ enabled: boolean }>(
        `/games/${gameId}/chat`,
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data.enabled;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["game-chat", gameId] }),
  });
}

export function useReactGameChatMutation(token: string | null | undefined, gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { messageId: string; emoji: string }) => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<{
        message_id: string;
        reactions: ChatReactionAgg[];
      }>(
        `/games/${gameId}/chat/messages/${opts.messageId}/reactions`,
        { emoji: opts.emoji },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["game-chat", gameId] }),
  });
}

export function useMarkGameChatReadMutation(token: string | null | undefined, gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { messageId?: string }) => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<{ marked: number; seen_total: number }>(
        `/games/${gameId}/chat/read`,
        { message_id: opts?.messageId || undefined },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["game-chat", gameId] }),
  });
}

/** Resolve API-relative media paths so previews work on the Next.js origin. */
export function resolveChatMediaUrl(raw: string): string {
  const u = (raw || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/api/v1/")) {
    const rest = apiRestUrl().replace(/\/$/, "");
    const origin = rest.replace(/\/api\/v1$/i, "");
    return `${origin}${u}`;
  }
  if (u.startsWith("/")) {
    const rest = apiRestUrl().replace(/\/$/, "");
    const origin = rest.replace(/\/api\/v1$/i, "");
    return `${origin}${u}`;
  }
  return u;
}

export async function uploadChatImage(token: string, file: File, path: string): Promise<string> {
  // Use fetch (not axios): restClient defaults Content-Type to application/json,
  // which breaks multipart uploads. Omit Content-Type so the browser sets the boundary.
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${apiRestUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    credentials: "include",
  });
  const data = (await res.json()) as { image_url?: string; error?: string };
  if (!res.ok) {
    // Stable machine code - UI toasts use play_rail chrome, never invent English.
    throw new Error((data.error || "").trim() || "upload_failed");
  }
  const url = resolveChatMediaUrl((data.image_url || "").trim());
  if (!url) throw new Error("upload_failed");
  return url;
}
