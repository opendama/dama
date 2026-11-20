"use client";

import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import {
  ChatBubble,
  ChatComposer,
  ChatStickyFooter,
  ChatThreadBackdrop,
  chatThreadChromeFrom,
  jumpToChatMessage,
} from "@/components/chat/ChatThreadUI";
import { ComposeMessageModal, type OpenedDmThread } from "@/components/chat/ComposeMessageModal";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import { InfiniteListEnd } from "@/components/ui/InfiniteListEnd";
import { Button } from "@/components/ui/button";
import {
  type DMMessage,
  useAcceptDMMutation,
  useCancelDMMutation,
  useDMMessagesInfinite,
  useDenyDMMutation,
  useMarkDMReadMutation,
  useReactDMMutation,
  useSendDMMutation,
} from "@/hooks/query/useDMsQuery";
import { uploadChatImage } from "@/hooks/query/useGameChatQuery";
import { useChatSenderHover } from "@/hooks/useChatSenderHover";
import { useChatVisibleMarkRead } from "@/hooks/useChatVisibleMarkRead";
import { resolveInfiniteScrollRoot, useInfinitePanelScroll } from "@/hooks/useInfinitePanelScroll";
import { useMaxLg } from "@/hooks/useMaxLg";
import { newChatClientId } from "@/lib/chat-optimistic";
import {
  type ChatOutboxItem,
  drainChatOutbox,
  enqueueChatOutbox,
  hydrateChatOutboxIntoCache,
  paintChatOutboxItem,
} from "@/lib/chat-outbox";
import { isChatNearBottom, resolveChatScrollRoot, scrollChatToBottom } from "@/lib/chat-scroll";
import { buildChatTimeline } from "@/lib/chat-time";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import {
  playRailImmersiveChatFillClass,
  playRailInnerListScrollClass,
  playRailPanelClass,
  playRailStickySubClass,
} from "@/lib/player-shell-ui";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useShellChromeStore } from "@/store/shell-chrome";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type DMPendingActions = {
  requestId: string;
  side: "in" | "out";
  status: string;
};

type Props = {
  chrome: PlayRailChromeReady;
  threadId: string;
  peerName: string;
  /** False for pending requests - history visible, compose locked until accept. */
  canCompose?: boolean;
  /** When set for a pending incoming/outgoing request, show Accept/Deny/Cancel in-thread. */
  pending?: DMPendingActions | null;
  onBack: () => void;
  /** Called after accept so parent can flip canCompose / clear pending. */
  onPendingResolved?: (next: { canCompose: boolean; status: string }) => void;
  /** Hover/compose Message → open another DM thread (Players rail). */
  onOpenThread?: (opts: OpenedDmThread) => void;
  /** Compose-new: paint opening shell immediately (do not wait on POST). */
  onComposeStarted?: (opts: {
    peerName: string;
    clientId: string;
    toUserId: string;
    body?: string;
    imageUrl?: string | null;
  }) => void;
  /** Compose-new fail: keep shell, mark that clientId failed for tap-to-retry. */
  onComposeFailed?: (opts: { clientId: string }) => void;
};

export function DMThreadPanel({
  chrome,
  threadId,
  peerName,
  canCompose = true,
  pending = null,
  onBack,
  onPendingResolved,
  onOpenThread,
  onComposeStarted,
  onComposeFailed,
}: Props) {
  const threadChrome = chatThreadChromeFrom(chrome);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const qc = useQueryClient();
  const maxLg = useMaxLg();
  const setImmersiveChat = useShellChromeStore((s) => s.setImmersiveChat);
  // Hide mobile bottom nav for composer space; do not freeze the max-lg aside scrollport.
  useEffect(() => {
    setImmersiveChat(true);
    return () => setImmersiveChat(false);
  }, [setImmersiveChat]);
  const pageSize = parseListPageSize(chrome.list_page_size);
  const msgsQuery = useDMMessagesInfinite(token, threadId, pageSize, true);
  const send = useSendDMMutation(token);
  const react = useReactDMMutation(token, threadId);
  const markRead = useMarkDMReadMutation(token, threadId);
  const acceptDm = useAcceptDMMutation(token);
  const lastMarkedRef = useRef("");
  const denyDm = useDenyDMMutation(token);
  const cancelDm = useCancelDMMutation(token);
  const { messageTarget, setMessageTarget, hoverFor } = useChatSenderHover(chrome, true);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DMMessage | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listSentinelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const prependAnchorRef = useRef<number | null>(null);
  /** Telegram: stay pinned unless the user scrolls up into history. */
  const pinToLatestRef = useRef(true);
  const messages = useMemo(() => {
    const pages = msgsQuery.data?.pages ?? [];
    const byId = new Map<string, DMMessage>();
    for (let i = pages.length - 1; i >= 0; i--) {
      for (const m of pages[i]?.messages ?? []) {
        if (m?.id) byId.set(m.id, m);
      }
    }
    return [...byId.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [msgsQuery.data?.pages]);
  const timeline = useMemo(
    () =>
      threadChrome
        ? buildChatTimeline(messages, {
            chat_date_today: threadChrome.chat_date_today,
            chat_date_yesterday: threadChrome.chat_date_yesterday,
          })
        : [],
    [messages, threadChrome],
  );
  const latestMessageId = messages.length > 0 ? (messages[messages.length - 1]?.id ?? "") : "";

  const stickToLatest = useCallback((force = false) => {
    const root =
      resolveChatScrollRoot(scrollRef.current) ??
      resolveInfiniteScrollRoot(scrollRef.current) ??
      scrollRef.current;
    if (!root) return;
    if (!force && !pinToLatestRef.current && !isChatNearBottom(root)) return;
    pinToLatestRef.current = true;
    scrollChatToBottom(root);
  }, []);

  // Rebind scroll-pin listener when the open DM thread changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: threadId is the rebind key
  useEffect(() => {
    pinToLatestRef.current = true;
    const root =
      resolveChatScrollRoot(scrollRef.current) ??
      resolveInfiniteScrollRoot(scrollRef.current) ??
      scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      pinToLatestRef.current = isChatNearBottom(root);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, [threadId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stick when timeline / latest id changes
  useLayoutEffect(() => {
    const root =
      resolveChatScrollRoot(scrollRef.current) ??
      resolveInfiniteScrollRoot(scrollRef.current) ??
      scrollRef.current;
    if (!root) return;
    const anchor = prependAnchorRef.current;
    if (anchor != null) {
      root.scrollTop = root.scrollHeight - anchor;
      prependAnchorRef.current = null;
      pinToLatestRef.current = isChatNearBottom(root);
      return;
    }
    stickToLatest(false);
  }, [latestMessageId, timeline.length, messages.length, stickToLatest]);

  const fetchOlder = useCallback(() => {
    const root =
      resolveChatScrollRoot(scrollRef.current) ??
      resolveInfiniteScrollRoot(scrollRef.current) ??
      scrollRef.current;
    if (root) prependAnchorRef.current = root.scrollHeight - root.scrollTop;
    void msgsQuery.fetchNextPage();
  }, [msgsQuery.fetchNextPage]);

  useInfinitePanelScroll({
    // isLoadingError only - a background refetch blip must not freeze older-page loading.
    enabled: pageSize > 0 && !msgsQuery.isPending && !msgsQuery.isLoadingError,
    scrollRef: scrollRef as RefObject<HTMLElement | null>,
    sentinelRef: listSentinelRef,
    hasNextPage: Boolean(msgsQuery.hasNextPage),
    isFetchingNextPage: msgsQuery.isFetchingNextPage,
    fetchNextPage: fetchOlder,
    layoutKey: threadId,
  });

  const wordCount = useMemo(() => {
    const t = text.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [text]);

  const jumpToReply = (replyToId: string) => {
    const root = resolveInfiniteScrollRoot(scrollRef.current);
    jumpToChatMessage(replyToId, root);
  };

  const [markReadRoot, setMarkReadRoot] = useState<HTMLElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-resolve scroll root when message count changes
  useLayoutEffect(() => {
    setMarkReadRoot(resolveInfiniteScrollRoot(scrollRef.current) ?? scrollRef.current);
  }, [messages.length]);
  const messageKey = messages.map((m) => m.id).join(",");
  useChatVisibleMarkRead({
    root: markReadRoot,
    messageKey,
    enabled: Boolean(token) && messages.length > 0,
    onMarkRead: (messageId) => {
      if (!token || messageId === lastMarkedRef.current) return;
      lastMarkedRef.current = messageId;
      markRead.mutate(
        { messageId },
        {
          onError: () => {
            lastMarkedRef.current = "";
          },
        },
      );
    },
  });

  const sendOutboxItem = useCallback(
    async (item: ChatOutboxItem) => {
      if (!token) throw new Error("");
      await send.mutateAsync({
        clientId: item.clientId,
        thread_id: threadId,
        body: item.body || undefined,
        image_url: item.imageUrl || undefined,
        reply_to_id: item.replyToId,
        reply_preview: item.replyPreview,
      });
      stickToLatest(true);
    },
    [send, stickToLatest, threadId, token],
  );

  const drainDmOutbox = useCallback(() => {
    if (!userId || !token) return;
    void drainChatOutbox({
      userId,
      kind: "dm",
      threadId,
      send: async (item) => {
        try {
          await sendOutboxItem(item);
        } catch {
          toast.error(chrome.dm_toast_failed);
          throw new Error("dm_send_failed");
        }
      },
    });
  }, [chrome.dm_toast_failed, sendOutboxItem, threadId, token, userId]);

  // Hydrate durable pending/failed into RQ, then drain ordered queue for this thread.
  useEffect(() => {
    if (!userId || !token || !user?.id) return;
    hydrateChatOutboxIntoCache({
      qc,
      userId,
      token,
      me: {
        id: user.id,
        username: user.username,
        avatarThumbUrl: user.avatarThumbUrl,
      },
      kind: "dm",
      threadId,
    });
    drainDmOutbox();
  }, [drainDmOutbox, qc, threadId, token, user, userId]);

  const onRetryFailed = useCallback(
    (msg: {
      id: string;
      body?: string | null;
      image_url?: string | null;
      reply_to_id?: string | null;
      reply_preview?: string | null;
      created_at?: string;
    }) => {
      if (!userId || !token || !user?.id) return;
      const clientId = (msg.id || "").trim();
      if (!clientId) return;
      // Re-queue same clientId (idempotent retry); preserve payload from the failed bubble.
      const item = enqueueChatOutbox(userId, {
        clientId,
        kind: "dm",
        threadId,
        body: msg.body || undefined,
        imageUrl: msg.image_url || undefined,
        replyToId: msg.reply_to_id || undefined,
        replyPreview: msg.reply_preview,
        status: "pending",
        createdAt: msg.created_at || new Date().toISOString(),
        peerName,
      });
      paintChatOutboxItem(
        qc,
        item,
        {
          id: user.id,
          username: user.username,
          avatarThumbUrl: user.avatarThumbUrl,
        },
        token,
      );
      drainDmOutbox();
    },
    [drainDmOutbox, peerName, qc, threadId, token, user, userId],
  );

  const onSend = () => {
    const body = text.trim();
    const image = imageUrl;
    const replyId = replyTo?.id;
    const replyPreview =
      replyTo?.body ||
      (replyTo?.image_url ? chrome.chat_image_fallback_label : null) ||
      replyTo?.reply_preview ||
      null;
    if (!token || !userId || !user?.id || (!body && !image)) return;
    const clientId = newChatClientId();
    pinToLatestRef.current = true;
    // Telegram: clear + paint optimistic bubble immediately; never await POST for UI.
    setText("");
    setImageUrl(null);
    setReplyTo(null);
    stickToLatest(true);
    const item = enqueueChatOutbox(userId, {
      clientId,
      kind: "dm",
      threadId,
      body: body || undefined,
      imageUrl: image || undefined,
      replyToId: replyId,
      replyPreview,
      status: "pending",
      createdAt: new Date().toISOString(),
      peerName,
    });
    paintChatOutboxItem(
      qc,
      item,
      {
        id: user.id,
        username: user.username,
        avatarThumbUrl: user.avatarThumbUrl,
      },
      token,
    );
    drainDmOutbox();
  };

  const onPickFile = (file: File | null) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      toast.error(chrome.chat_image_only_hint);
      return;
    }
    void uploadChatImage(token, file, "/dms/image")
      .then(setImageUrl)
      .catch(() => toast.error(chrome.dm_toast_failed));
  };

  return (
    <div className={cn(playRailPanelClass, !maxLg && playRailImmersiveChatFillClass)}>
      <ComposeMessageModal
        chrome={chrome}
        open={Boolean(messageTarget)}
        onOpenChange={(v) => {
          if (!v) setMessageTarget(null);
        }}
        target={messageTarget}
        onComposeStarted={(draft) => {
          setMessageTarget(null);
          onComposeStarted?.(draft);
        }}
        onComposeFailed={(opts) => {
          onComposeFailed?.(opts);
        }}
        onOpenedThread={(opts) => {
          setMessageTarget(null);
          onOpenThread?.(opts);
        }}
      />
      <div className={cn(playRailStickySubClass, "flex shrink-0 items-center gap-2 px-3 py-2")}>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="truncate text-sm font-semibold text-[var(--dama-text)]">{peerName}</p>
      </div>
      {/* max-lg: aside scrolls (chat="auto"). lg+: nested message scroller. */}
      <PlayRailScrollPort ref={scrollRef} chat={maxLg ? "auto" : "messages"}>
        <ChatThreadBackdrop>
          <ul
            ref={listRef}
            className={cn(playRailInnerListScrollClass, "flex flex-col gap-0.5 py-2")}
          >
            <li className="list-none">
              <InfiniteListEnd
                sentinelRef={listSentinelRef}
                loading={msgsQuery.isFetchingNextPage}
                loadingLabel={chrome.loading_more}
              />
            </li>
            {msgsQuery.isPending || pageSize <= 0 ? (
              <li className="p-4 text-center text-sm text-[var(--dama-muted)]">
                {chrome.dm_chat_loading}
              </li>
            ) : msgsQuery.isLoadingError ? (
              // Only hard-fail when the first fetch failed (no cached pages).
              // RQ sets isError on background refetch failures while keeping data -
              // that used to blank the thread as "Could not load messages".
              <li className="p-4 text-center text-sm text-[var(--dama-muted)]">
                {chrome.dm_load_failed_label}
              </li>
            ) : messages.length === 0 ? (
              <li className="p-8 text-center text-sm text-[var(--dama-muted)]">
                {chrome.dm_chat_empty}
              </li>
            ) : threadChrome ? (
              timeline.map((item) =>
                item.kind === "date" ? (
                  <ChatDateSeparator key={item.key} label={item.label} />
                ) : (
                  <ChatBubble
                    key={item.msg.id}
                    msg={item.msg}
                    mine={item.msg.user_id === userId}
                    nameMaxChars={chrome.live_player_name_max_chars}
                    nameTruncateSuffix={chrome.name_truncate_suffix}
                    replyActionLabel={chrome.dm_reply_action}
                    formatName={formatPlayerNameDisplay}
                    chrome={threadChrome}
                    onReply={canCompose ? (msg) => setReplyTo(msg as DMMessage) : undefined}
                    onJumpToReply={jumpToReply}
                    canReact={canCompose && Boolean(token)}
                    onReact={(msg, emoji) => {
                      void react.mutateAsync({ messageId: msg.id, emoji }).catch(() => {
                        toast.error(chrome.dm_toast_failed);
                      });
                    }}
                    showReceipt
                    senderHover={hoverFor(item.msg.user_id)}
                    onRetryFailed={onRetryFailed}
                  />
                ),
              )
            ) : null}
          </ul>
        </ChatThreadBackdrop>
      </PlayRailScrollPort>
      <ChatStickyFooter>
        {!canCompose && pending?.status === "pending" && pending.side === "in" ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            <p className="text-xs text-[var(--dama-muted)]">{chrome.dm_request_pending_label}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="play"
                size="sm"
                className="h-8 flex-1 text-xs"
                isLoading={acceptDm.isPending}
                pendingLabel={chrome.dm_accepting}
                disabled={denyDm.isPending}
                onClick={() => {
                  void (async () => {
                    try {
                      await acceptDm.mutateAsync(pending.requestId);
                      toast.success(chrome.dm_toast_accepted);
                      onPendingResolved?.({ canCompose: true, status: "accepted" });
                    } catch {
                      toast.error(chrome.dm_toast_failed);
                    }
                  })();
                }}
              >
                {chrome.dm_accept_action}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 text-xs"
                isLoading={denyDm.isPending}
                pendingLabel={chrome.dm_denying}
                disabled={acceptDm.isPending}
                onClick={() => {
                  void (async () => {
                    try {
                      await denyDm.mutateAsync(pending.requestId);
                      toast.success(chrome.dm_toast_denied);
                      onPendingResolved?.({ canCompose: false, status: "denied" });
                      onBack();
                    } catch {
                      toast.error(chrome.dm_toast_failed);
                    }
                  })();
                }}
              >
                {chrome.dm_deny_action}
              </Button>
            </div>
          </div>
        ) : !canCompose && pending?.status === "pending" && pending.side === "out" ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            <p className="text-xs text-[var(--dama-muted)]">{chrome.dm_request_outgoing_label}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              isLoading={cancelDm.isPending}
              pendingLabel={chrome.dm_cancelling}
              onClick={() => {
                void (async () => {
                  try {
                    await cancelDm.mutateAsync(pending.requestId);
                    toast.success(chrome.dm_toast_cancelled);
                    // Drop provisional thread state; list filters cancelled + message deleted.
                    onPendingResolved?.({ canCompose: false, status: "cancelled" });
                    void msgsQuery.refetch();
                    onBack();
                  } catch {
                    toast.error(chrome.dm_toast_failed);
                  }
                })();
              }}
            >
              {chrome.dm_cancel_action}
            </Button>
          </div>
        ) : !canCompose ? (
          <p className="px-3 py-2 text-xs text-[var(--dama-muted)]">
            {pending?.status === "denied"
              ? chrome.dm_request_denied_label
              : pending?.status === "cancelled"
                ? chrome.dm_request_cancelled_label
                : chrome.dm_request_pending_label}
          </p>
        ) : threadChrome ? (
          <ChatComposer
            text={text}
            onTextChange={setText}
            imageUrl={imageUrl}
            onClearImage={() => setImageUrl(null)}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            placeholder={chrome.dm_input_placeholder}
            disabled={false}
            // Never gate on isPending - Telegram allows rapid multi-send; bubbles track outbox.
            sending={false}
            sendLabel={chrome.dm_send_action}
            sendingLabel={chrome.dm_sending}
            wordsLabel={chrome.dm_words_label}
            wordCount={wordCount}
            attachAria={chrome.dm_attach_image_aria}
            emojiAria={chrome.dm_emoji_aria}
            chrome={threadChrome}
            removeImageAria={chrome.remove_image_aria}
            replyCancelAria={chrome.dm_reply_cancel}
            fileRef={fileRef}
            inputRef={composerInputRef}
            autoFocus
            autoFocusKey={threadId}
            onPickFile={onPickFile}
            onSend={onSend}
          />
        ) : null}
      </ChatStickyFooter>
    </div>
  );
}
