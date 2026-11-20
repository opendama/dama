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
import { ComposeMessageModal } from "@/components/chat/ComposeMessageModal";
import { Button } from "@/components/ui/button";
import {
  type GameChatMessage,
  uploadChatImage,
  useGameChatQuery,
  useMarkGameChatReadMutation,
  usePostGameChatMutation,
  useReactGameChatMutation,
  useToggleGameChatMutation,
} from "@/hooks/query/useGameChatQuery";
import { useChatSenderHover } from "@/hooks/useChatSenderHover";
import { useChatVisibleMarkRead } from "@/hooks/useChatVisibleMarkRead";
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
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Observing = {
  p1Name: string;
  p1Rating?: number;
  p1Country?: string | null;
  p2Name: string;
  p2Rating?: number;
  p2Country?: string | null;
  timeLabel?: string;
};

type Props = {
  chrome: PlayRailChromeReady;
  gameId: string;
  signedIn: boolean;
  observing?: Observing;
};

export function GameChatPanel({ chrome, gameId, signedIn, observing }: Props) {
  const router = useRouter();
  const threadChrome = chatThreadChromeFrom(chrome);
  const maxLg = useMaxLg();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const myId = user?.id;
  const qc = useQueryClient();
  const chatQuery = useGameChatQuery(gameId, Boolean(gameId));
  const post = usePostGameChatMutation(token, gameId);
  const toggle = useToggleGameChatMutation(token, gameId);
  const react = useReactGameChatMutation(token, gameId);
  const markRead = useMarkGameChatReadMutation(token, gameId);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<GameChatMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const { messageTarget, setMessageTarget, hoverFor } = useChatSenderHover(chrome, signedIn);
  const listRef = useRef<HTMLUListElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastMarkedRef = useRef("");
  /** Telegram: stay pinned unless the user scrolls up into history. */
  const pinToLatestRef = useRef(true);

  const enabled = chatQuery.data?.enabled === true;
  const canToggle = Boolean(chatQuery.data?.can_toggle);
  const canPost = Boolean(chatQuery.data?.can_post) && enabled;
  const messages = chatQuery.data?.messages ?? [];
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

  const chatScrollRoot = useCallback((): HTMLElement | null => {
    return (
      resolveChatScrollRoot(messageScrollRef.current) ??
      resolveChatScrollRoot(listRef.current) ??
      messageScrollRef.current ??
      listRef.current
    );
  }, []);

  const stickToLatest = useCallback(
    (force = false) => {
      const root = chatScrollRoot();
      if (!root) return;
      if (!force && !pinToLatestRef.current && !isChatNearBottom(root)) return;
      pinToLatestRef.current = true;
      scrollChatToBottom(root);
    },
    [chatScrollRoot],
  );

  // Rebind scroll-pin listener when the open game chat changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gameId is the rebind key
  useEffect(() => {
    pinToLatestRef.current = true;
    const root = chatScrollRoot();
    if (!root) return;
    const onScroll = () => {
      pinToLatestRef.current = isChatNearBottom(root);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, [chatScrollRoot, gameId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stick when latest message / timeline changes
  useLayoutEffect(() => {
    stickToLatest(false);
  }, [latestMessageId, timeline.length, messages.length, stickToLatest]);

  const [markReadRoot, setMarkReadRoot] = useState<HTMLElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-resolve scroll root when message count changes
  useEffect(() => {
    setMarkReadRoot(chatScrollRoot());
  }, [messages.length, chatScrollRoot]);
  const messageKey = messages.map((m) => m.id).join(",");
  useChatVisibleMarkRead({
    root: markReadRoot,
    messageKey,
    enabled: signedIn && Boolean(token) && messages.length > 0,
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

  const wordCount = useMemo(() => {
    const t = text.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [text]);

  const jumpToReply = (replyToId: string) => {
    jumpToChatMessage(replyToId, chatScrollRoot());
  };

  const sendOutboxItem = useCallback(
    async (item: ChatOutboxItem) => {
      if (!token) throw new Error("");
      await post.mutateAsync({
        clientId: item.clientId,
        body: item.body || undefined,
        image_url: item.imageUrl || undefined,
        reply_to_id: item.replyToId,
        reply_preview: item.replyPreview,
      });
      stickToLatest(true);
    },
    [post, stickToLatest, token],
  );

  const drainGameOutbox = useCallback(() => {
    if (!myId || !token) return;
    void drainChatOutbox({
      userId: myId,
      kind: "game",
      gameId,
      send: async (item) => {
        try {
          await sendOutboxItem(item);
        } catch {
          toast.error(chrome.chat_toast_send_failed);
          throw new Error("game_chat_send_failed");
        }
      },
    });
  }, [chrome.chat_toast_send_failed, gameId, myId, sendOutboxItem, token]);

  useEffect(() => {
    if (!myId || !token || !user?.id) return;
    hydrateChatOutboxIntoCache({
      qc,
      userId: myId,
      token,
      me: {
        id: user.id,
        username: user.username,
        avatarThumbUrl: user.avatarThumbUrl,
      },
      kind: "game",
      gameId,
    });
    drainGameOutbox();
  }, [drainGameOutbox, gameId, myId, qc, token, user]);

  const onRetryFailed = useCallback(
    (msg: {
      id: string;
      body?: string | null;
      image_url?: string | null;
      reply_to_id?: string | null;
      reply_preview?: string | null;
      created_at?: string;
    }) => {
      if (!myId || !token || !user?.id) return;
      const clientId = (msg.id || "").trim();
      if (!clientId) return;
      const item = enqueueChatOutbox(myId, {
        clientId,
        kind: "game",
        gameId,
        body: msg.body || undefined,
        imageUrl: msg.image_url || undefined,
        replyToId: msg.reply_to_id || undefined,
        replyPreview: msg.reply_preview,
        status: "pending",
        createdAt: msg.created_at || new Date().toISOString(),
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
      drainGameOutbox();
    },
    [drainGameOutbox, gameId, myId, qc, token, user],
  );

  const send = () => {
    const body = text.trim();
    const image = imageUrl;
    const replyId = replyTo?.id;
    const replyPreview =
      replyTo?.body ||
      (replyTo?.image_url ? chrome.chat_image_fallback_label : null) ||
      replyTo?.reply_preview ||
      null;
    if (!signedIn || !token || !myId || !user?.id) return;
    if (!canPost) {
      toast.error(chrome.chat_toast_disabled);
      return;
    }
    if (!body && !image) return;
    const clientId = newChatClientId();
    pinToLatestRef.current = true;
    // Telegram: clear + optimistic bubble immediately; never await POST for UI.
    setText("");
    setImageUrl(null);
    setReplyTo(null);
    stickToLatest(true);
    const item = enqueueChatOutbox(myId, {
      clientId,
      kind: "game",
      gameId,
      body: body || undefined,
      imageUrl: image || undefined,
      replyToId: replyId,
      replyPreview,
      status: "pending",
      createdAt: new Date().toISOString(),
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
    drainGameOutbox();
  };

  const onPickFile = async (file: File | null) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      toast.error(chrome.chat_image_only_hint);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadChatImage(token, file, `/games/${gameId}/chat/image`);
      setImageUrl(url);
    } catch {
      toast.error(chrome.chat_toast_send_failed);
    } finally {
      setUploading(false);
    }
  };

  const onReact = (msg: GameChatMessage, emoji: string) => {
    if (!signedIn || !token) return;
    void react.mutateAsync({ messageId: msg.id, emoji }).catch(() => {
      toast.error(chrome.chat_toast_send_failed);
    });
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        // max-lg: natural height so PlayRailAside scrolls; lg+: fill + nested message scroll.
        maxLg ? "min-h-0 flex-none" : "h-full min-h-0 flex-1",
      )}
    >
      <ComposeMessageModal
        chrome={chrome}
        open={Boolean(messageTarget)}
        onOpenChange={(v) => {
          if (!v) setMessageTarget(null);
        }}
        target={messageTarget}
        onComposeStarted={() => {
          // Instant: leave game chat for DMs; PlayersPanel resume paints pending bubble from outbox.
          setMessageTarget(null);
          router.push("/?rail=players&sub=dms");
        }}
        onOpenedThread={({ threadId }) => {
          setMessageTarget(null);
          const tid = threadId.trim();
          if (!tid) return;
          router.push(`/?rail=players&sub=dms&thread=${encodeURIComponent(tid)}`);
        }}
      />
      {observing ? (
        <div className="shrink-0 border-b border-[var(--dama-border)] bg-[var(--dama-panel)]/90 px-3 py-2 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dama-muted)]">
            {chrome.observing_game_label}
          </p>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-[var(--dama-text)]">
            <CountryFlag code={observing.p1Country} />
            <span className="truncate">{observing.p1Name}</span>
            {observing.p1Rating != null ? (
              <span className="shrink-0 font-normal text-[var(--dama-muted)]">
                {chrome.rating_paren_open}
                {observing.p1Rating}
                {chrome.rating_paren_close}
              </span>
            ) : null}
            <span className="shrink-0 font-normal text-[var(--dama-muted)]">
              {chrome.vs_separator}
            </span>
            <CountryFlag code={observing.p2Country} />
            <span className="truncate">{observing.p2Name}</span>
            {observing.p2Rating != null ? (
              <span className="shrink-0 font-normal text-[var(--dama-muted)]">
                {chrome.rating_paren_open}
                {observing.p2Rating}
                {chrome.rating_paren_close}
              </span>
            ) : null}
            {observing.timeLabel ? (
              <span className="shrink-0 font-normal text-[var(--dama-muted)]">
                ({observing.timeLabel})
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* max-lg: grow with messages (aside scrolls). lg+: nested overflow scroller. */}
      <div
        ref={messageScrollRef}
        className={cn(
          "dama-chat-wallpaper",
          maxLg
            ? "relative w-full flex-none"
            : "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
        )}
        data-dama-chat-scroll=""
      >
        <ChatThreadBackdrop>
          <ul ref={listRef} className="flex w-full flex-col gap-0.5 py-2">
            {chatQuery.isLoading ? (
              <li className="p-4 text-center text-sm text-[var(--dama-muted)]">
                {chrome.chat_loading}
              </li>
            ) : chatQuery.isLoadingError ? (
              // Keep painted messages on poll/refetch blips (isRefetchError keeps data).
              <li className="p-4 text-center text-sm text-[var(--dama-muted)]">
                {(() => {
                  const err = chatQuery.error;
                  const code =
                    isAxiosError(err) &&
                    typeof err.response?.data === "object" &&
                    err.response?.data &&
                    "error" in err.response.data
                      ? String((err.response.data as { error?: string }).error || "")
                      : "";
                  if (code === "join_required") return chrome.chat_join_required_label;
                  return chrome.chat_load_failed_label;
                })()}
              </li>
            ) : messages.length === 0 ? (
              <li className="p-8 text-center text-sm text-[var(--dama-muted)]">
                {chrome.chat_empty}
              </li>
            ) : threadChrome ? (
              timeline.map((item) =>
                item.kind === "date" ? (
                  <ChatDateSeparator key={item.key} label={item.label} />
                ) : (
                  <ChatBubble
                    key={item.msg.id}
                    msg={item.msg}
                    mine={Boolean(myId) && item.msg.user_id === myId}
                    nameMaxChars={chrome.live_player_name_max_chars}
                    nameTruncateSuffix={chrome.name_truncate_suffix}
                    replyActionLabel={chrome.chat_reply_action}
                    formatName={formatPlayerNameDisplay}
                    chrome={threadChrome}
                    onReply={canPost ? (msg) => setReplyTo(msg as GameChatMessage) : undefined}
                    onJumpToReply={jumpToReply}
                    canReact={canPost && signedIn}
                    onReact={(msg, emoji) => onReact(msg as GameChatMessage, emoji)}
                    showSeenCount
                    senderHover={hoverFor(item.msg.user_id)}
                    onRetryFailed={onRetryFailed}
                  />
                ),
              )
            ) : null}
          </ul>
        </ChatThreadBackdrop>
      </div>

      <ChatStickyFooter>
        {threadChrome ? (
          <ChatComposer
            text={text}
            onTextChange={setText}
            imageUrl={imageUrl}
            onClearImage={() => setImageUrl(null)}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            placeholder={canPost ? chrome.chat_input_placeholder : chrome.chat_disabled_label}
            disabled={!signedIn || !canPost || uploading}
            sending={false}
            sendLabel={chrome.chat_send_action}
            sendingLabel={chrome.chat_sending}
            wordsLabel={chrome.dm_words_label}
            wordCount={wordCount}
            attachAria={chrome.chat_attach_image_aria}
            emojiAria={chrome.chat_emoji_aria}
            chrome={threadChrome}
            removeImageAria={chrome.remove_image_aria}
            replyCancelAria={chrome.chat_reply_cancel}
            fileRef={fileRef}
            inputRef={composerInputRef}
            autoFocus={signedIn && canPost}
            // Re-run focus when posting unlocks after the first chat payload.
            autoFocusKey={`${gameId}:${canPost ? "1" : "0"}`}
            onPickFile={(f) => void onPickFile(f)}
            onSend={send}
            header={
              <div className="flex items-center gap-3 border-b border-[var(--dama-border)]/60 bg-[var(--dama-chat-composer-bg)]/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold tracking-wide text-[var(--dama-text)]">
                    {enabled ? chrome.chat_enabled_label : chrome.chat_disabled_label}
                  </p>
                </div>
                {canToggle ? (
                  <Button
                    type="button"
                    variant={enabled ? "outline" : "play"}
                    size="sm"
                    className="h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold"
                    isLoading={toggle.isPending}
                    pendingLabel={
                      enabled ? chrome.chat_disable_pending : chrome.chat_enable_pending
                    }
                    onClick={() => {
                      void (async () => {
                        try {
                          await toggle.mutateAsync(!enabled);
                        } catch {
                          toast.error(chrome.chat_toast_toggle_failed);
                        }
                      })();
                    }}
                  >
                    {enabled ? chrome.chat_disable_action : chrome.chat_enable_action}
                  </Button>
                ) : null}
              </div>
            }
          />
        ) : null}
      </ChatStickyFooter>
    </div>
  );
}
