"use client";

import { apiWsUrl } from "@/lib/env";
import { invalidateAdminAvatars, invalidateAdminUsers } from "@/lib/invalidate";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Console listens on matchmaking WS for `avatar_updated` so the pending
 * avatars queue refreshes without waiting for the 15s poll.
 */
export function AdminAvatarRealtime() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  useEffect(() => {
    if (!hydrated || !token) return;
    const base = apiWsUrl()
      .replace(/\/$/, "")
      .replace(/\/game$/, "");
    const url = `${base}/matchmaking?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string };
        if (msg.type === "avatar_updated") {
          void invalidateAdminAvatars(qc);
          void invalidateAdminUsers(qc);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, [hydrated, token, qc]);

  return null;
}
