"use client";

import { InfiniteListEnd } from "@/components/ui/InfiniteListEnd";
import { Button } from "@/components/ui/button";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useAdminMarkAllNotificationsRead,
  useAdminMarkNotificationRead,
} from "@/hooks/mutation/useAdminNotificationMutations";
import {
  useAdminNotificationsInfinite,
  useAdminNotificationsUnread,
} from "@/hooks/query/useAdminNotificationsQuery";
import { useInfinitePanelScroll } from "@/hooks/useInfinitePanelScroll";
import { useNotificationHrefNavigate } from "@/hooks/useNotificationHrefNavigate";
import { formatNotificationWhen } from "@/lib/format-notification-when";
import { invalidateAdminAvatars } from "@/lib/invalidate";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function bellAriaWithCount(aria: string, count: number, fmt: string | undefined): string {
  if (!aria) return "";
  if (count <= 0) return aria;
  const template = (fmt || "").trim();
  if (!template || !template.includes("{aria}") || !template.includes("{count}")) {
    return aria;
  }
  return template.replaceAll("{aria}", aria).replaceAll("{count}", String(count));
}

export function AdminNotificationBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigateHref = useNotificationHrefNavigate();
  const unread = useAdminNotificationsUnread(token);
  const prevUnreadRef = useRef<number | null>(null);
  const resolvedPageSize =
    unread.data?.chrome?.list_page_size && unread.data.chrome.list_page_size > 0
      ? unread.data.chrome.list_page_size
      : 0;
  const [stablePageSize, setStablePageSize] = useState(resolvedPageSize);
  useEffect(() => {
    if (resolvedPageSize > 0) setStablePageSize(resolvedPageSize);
  }, [resolvedPageSize]);
  const pageSize = resolvedPageSize > 0 ? resolvedPageSize : stablePageSize;

  useEffect(() => {
    const next = unread.data?.count;
    if (typeof next !== "number") return;
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = next;
    if (prev !== null && next > prev) {
      void invalidateAdminAvatars(qc);
    }
  }, [qc, unread.data?.count]);

  const list = useAdminNotificationsInfinite(token, pageSize, open);
  const markOne = useAdminMarkNotificationRead(token);
  const markAll = useAdminMarkAllNotificationsRead(token);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const chrome = unread.data?.chrome || list.data?.pages?.[0]?.chrome;
  const bellAria = chrome?.bell_aria?.trim() || "";
  const panelTitle = chrome?.panel_title?.trim() || "";
  const count = unread.data?.count ?? 0;
  const badgeLabel = (unread.data?.badge_label || "").trim();
  const triggerAria = bellAriaWithCount(bellAria, count, chrome?.bell_aria_count_fmt);
  const loadingMoreLabel = chrome?.loading_more?.trim() || "";
  const markReadPending = chrome?.mark_read_pending?.trim() || "";

  const items = useMemo<NotificationItem[]>(() => {
    const pages = list.data?.pages ?? [];
    const out: NotificationItem[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const item of page.items ?? []) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [list.data?.pages]);

  const fetchNextPage = useCallback(() => {
    void list.fetchNextPage();
  }, [list.fetchNextPage]);

  useInfinitePanelScroll({
    enabled: open && Boolean(bellAria && panelTitle) && !list.isPending,
    scrollRef,
    sentinelRef,
    hasNextPage: Boolean(list.hasNextPage),
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage,
    // Identity only - never item count / isFetchingNextPage (cascades pages).
    layoutKey: open ? "open" : "closed",
  });

  if (!bellAria || !panelTitle) {
    if (unread.isPending && !unread.data && !unread.isError) {
      return (
        <div
          className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-[var(--dama-surface)]"
          aria-hidden
        />
      );
    }
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative px-2"
          aria-label={triggerAria}
        >
          <Bell className="h-4 w-4" />
          {badgeLabel ? (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--dama-panel)] bg-[var(--dama-text)] px-1 text-[10px] font-semibold tabular-nums text-[var(--dama-bg)]"
              aria-hidden
            >
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        sticky="always"
        className="dama-float z-[100] w-[min(20rem,calc(100vw-1.5rem))] border-[var(--dama-border-strong)] bg-[var(--dama-panel)] p-0"
      >
        <div className="flex items-center justify-between border-b border-[var(--dama-border)] px-3 py-2">
          <p className="text-sm font-medium text-[var(--dama-text)]">{panelTitle}</p>
          {chrome?.mark_all_read && count > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              isLoading={Boolean(chrome.mark_all_pending?.trim()) && markAll.isPending}
              pendingLabel={chrome.mark_all_pending || undefined}
              onClick={() => markAll.mutate()}
            >
              {chrome.mark_all_read}
            </Button>
          ) : null}
        </div>
        <FetchProgressBar
          active={
            (list.isFetching && !list.isFetchingNextPage && !list.isPending && items.length > 0) ||
            markOne.isPending ||
            markAll.isPending
          }
        />
        <div ref={scrollRef} className="max-h-80 overflow-y-auto">
          {list.isError ? (
            <p className="px-3 py-4 text-sm text-destructive">{chrome?.list_failed || ""}</p>
          ) : null}
          {list.isPending && items.length === 0 ? (
            <div className="space-y-3 px-3 py-4" aria-busy="true">
              <div className="h-4 w-40 animate-pulse rounded bg-[var(--dama-surface)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--dama-surface)]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--dama-surface)]" />
            </div>
          ) : null}
          {!list.isPending && items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-[var(--dama-muted)]">
              {chrome?.empty_message || ""}
            </p>
          ) : null}
          {items.map((item) => {
            const clickable = Boolean(item.href?.startsWith("/")) && !item.href?.startsWith("//");
            const go = () => {
              if (!clickable || !item.href) return;
              const href = item.href;
              void (async () => {
                if (!item.read) {
                  try {
                    await markOne.mutateAsync(item.id);
                  } catch {
                    /* still navigate - mark failure must not trap the admin */
                  }
                }
                setOpen(false);
                navigateHref(href);
              })();
            };
            return (
              <div
                key={item.id}
                role={clickable ? "link" : undefined}
                tabIndex={clickable ? 0 : undefined}
                className={cn(
                  "border-b border-[var(--dama-border)] px-3 py-3 text-sm last:border-0",
                  !item.read ? "bg-[var(--dama-surface)]" : "",
                  clickable
                    ? "cursor-pointer text-left transition hover:bg-[var(--dama-surface)]"
                    : "",
                )}
                onClick={clickable ? go : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        go();
                      }
                    : undefined
                }
              >
                <p className="font-medium text-[var(--dama-text)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--dama-muted)]">{item.body}</p>
                <span className="mt-1 block text-[10px] text-[var(--dama-muted)]">
                  {formatNotificationWhen(item.created_at)}
                </span>
                {!item.read && chrome?.mark_read ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-0 text-xs"
                    isLoading={Boolean(markReadPending) && markOne.isPending}
                    pendingLabel={markReadPending || undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markOne.mutate(item.id);
                    }}
                  >
                    {chrome.mark_read}
                  </Button>
                ) : null}
              </div>
            );
          })}
          <InfiniteListEnd
            sentinelRef={sentinelRef}
            loading={list.isFetchingNextPage}
            loadingLabel={loadingMoreLabel}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
