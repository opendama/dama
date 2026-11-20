"use client";

import { useMarkNotificationRead } from "@/hooks/mutation/useNotificationMutations";
import {
  notificationsInfiniteQueryKey,
  useNotificationsInfinite,
  useNotificationsUnread,
} from "@/hooks/query/useNotificationsQuery";
import { softCompetitionPointsLabel } from "@/lib/community-player-chrome-soft";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const POINTS_KIND = "player.competition_points_awarded";

function formatPointsToast(fmt: string, args: string[] | undefined): string {
  const points = (args?.[0] || "").trim();
  const label = softCompetitionPointsLabel(args?.[1]);
  if (!fmt.includes("{points}") || !fmt.includes("{label}")) return "";
  if (!points || !label) return "";
  return fmt.replaceAll("{points}", points).replaceAll("{label}", label).trim();
}

/** Toasts DB-driven `toast_points_awarded_fmt` for unread competition points awards. */
export function CompetitionPointsToast({ accessToken }: { accessToken?: string | null }) {
  const qc = useQueryClient();
  const markOne = useMarkNotificationRead(accessToken);
  const unread = useNotificationsUnread(accessToken);
  const unreadCount = unread.data?.count ?? 0;
  const toastFmt = (unread.data?.chrome?.toast_points_awarded_fmt || "").trim();
  const open = Boolean(accessToken) && unreadCount > 0;
  const list = useNotificationsInfinite(accessToken, 20, open);
  const seenRef = useRef<Set<string>>(new Set());
  const lastUnreadRef = useRef(0);
  const mutateRef = useRef(markOne.mutate);
  mutateRef.current = markOne.mutate;

  // When unread rises while list is soft-stale, refetch so new awards toast immediately.
  useEffect(() => {
    if (!accessToken || unreadCount <= 0) {
      lastUnreadRef.current = unreadCount;
      return;
    }
    if (unreadCount > lastUnreadRef.current) {
      void qc.invalidateQueries({
        queryKey: notificationsInfiniteQueryKey(accessToken, 20),
      });
    }
    lastUnreadRef.current = unreadCount;
  }, [accessToken, unreadCount, qc]);

  useEffect(() => {
    if (!toastFmt) return;
    const pages = list.data?.pages ?? [];
    for (const page of pages) {
      for (const item of page.items ?? []) {
        if (!item?.id || item.read || item.kind_code !== POINTS_KIND) continue;
        if (seenRef.current.has(item.id)) continue;
        seenRef.current.add(item.id);
        const text = formatPointsToast(toastFmt, item.body_args);
        if (text) toast.success(text);
        mutateRef.current(item.id);
      }
    }
  }, [list.data, toastFmt]);

  return null;
}
