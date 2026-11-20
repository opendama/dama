"use client";

import { ChatEmojiPicker } from "@/components/chat/ChatEmojiPicker";
import { ChatMediaLightbox } from "@/components/chat/ChatMediaLightbox";
import { ChatSenderAvatar, type ChatSenderInfo } from "@/components/chat/ChatSenderAvatar";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { Button } from "@/components/ui/button";
import { resolveChatMediaUrl } from "@/hooks/query/useGameChatQuery";
import { formatChatMessageTime } from "@/lib/chat-time";
import { CountryFlag } from "@/lib/country-flag";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { ImagePlus, Loader2, Reply, Send, SmilePlus, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

export type ChatSenderHoverActions = {
  chrome: PlayRailChromeReady;
  signedIn?: boolean;
  isFriend?: boolean;
  requestPendingOutgoing?: boolean;
  onChallenge?: (player: RailPlayer) => void;
  onMessage?: (player: RailPlayer) => void;
  onAddFriend?: (player: RailPlayer) => void;
  onRemoveFriend?: (player: RailPlayer) => void;
  challengeBusy?: boolean;
  friendBusy?: boolean;
  addFriendBusy?: boolean;
  removeFriendBusy?: boolean;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type ChatThreadMessage = {
  id: string;
  user_id: string;
  username: string;
  avatar_thumb_url?: string | null;
  country_code?: string | null;
  body?: string | null;
  image_url?: string | null;
  reply_to_id?: string | null;
  reply_preview?: string | null;
  reactions?: ChatReaction[] | null;
  /** DM outbound: sent | delivered | read | pending | failed */
  receipt?: "sent" | "delivered" | "read" | "pending" | "failed" | string | null;
  /** Client outbox (Telegram pending/failed) - not from API. */
  local_status?: "pending" | "failed" | null;
  /** Multi-participant / game chat view count */
  seen_count?: number | null;
  seen_total?: number | null;
  created_at?: string;
};

/** DB-backed chat surface labels (play_rail_chrome / spectate_chrome). */
export type ChatThreadChrome = {
  chat_you_label: string;
  chat_reply_label: string;
  chat_react_action: string;
  chat_react_more_aria: string;
  chat_receipt_sent_aria: string;
  chat_receipt_seen_aria: string;
  chat_receipt_delivered_aria: string;
  chat_receipt_pending_aria: string;
  chat_receipt_failed_aria: string;
  chat_receipt_retry_action: string;
  chat_seen_by_prefix: string;
  chat_image_fallback_label: string;
  chat_emoji_search_placeholder: string;
  chat_emoji_search_empty: string;
  chat_emoji_results_prefix: string;
  chat_receipt_sent_glyph: string;
  chat_receipt_read_glyph: string;
  chat_receipt_delivered_glyph: string;
  chat_receipt_pending_glyph: string;
  chat_receipt_failed_glyph: string;
  chat_seen_count_glyph: string;
  chat_media_lightbox_title: string;
  chat_media_lightbox_close_aria: string;
  chat_date_today: string;
  chat_date_yesterday: string;
};

type BubbleProps = {
  msg: ChatThreadMessage;
  mine: boolean;
  nameMaxChars: string;
  nameTruncateSuffix: string;
  replyActionLabel: string;
  formatName: (name: string, max: string, suffix: string) => string;
  chrome: ChatThreadChrome;
  onReply?: (msg: ChatThreadMessage) => void;
  onJumpToReply?: (replyToId: string) => void;
  onReact?: (msg: ChatThreadMessage, emoji: string) => void;
  canReact?: boolean;
  /** Show ✓ / ✓✓ on own messages (DMs). */
  showReceipt?: boolean;
  /** Show Telegram-channel style view counts (game / group chat). */
  showSeenCount?: boolean;
  /** When set, sender avatar opens PlayerHoverCard + profile (new tab). */
  senderHover?: ChatSenderHoverActions | null;
  /** Failed outbox bubble tap → retry same clientId. */
  onRetryFailed?: (msg: ChatThreadMessage) => void;
};

function ReceiptTicks({
  receipt,
  localStatus,
  sentAria,
  seenAria,
  pendingAria,
  failedAria,
  sentGlyph,
  readGlyph,
  pendingGlyph,
  failedGlyph,
}: {
  receipt?: string | null;
  localStatus?: string | null;
  sentAria: string;
  seenAria: string;
  /** Retained for chrome contract; 1:1 UI maps delivered→sent single tick. */
  deliveredAria?: string;
  pendingAria: string;
  failedAria: string;
  sentGlyph: string;
  readGlyph: string;
  /** Retained for chrome contract; 1:1 UI maps delivered→sent single tick. */
  deliveredGlyph?: string;
  pendingGlyph: string;
  failedGlyph: string;
}) {
  const local = (localStatus || "").trim();
  const receiptStatus = (receipt || "").trim();
  // Pending / failed: chrome glyphs + aria only (never invent Clock / "!").
  if (local === "pending" || receiptStatus === "pending") {
    const glyph = pendingGlyph.trim();
    const label = pendingAria.trim();
    if (!glyph || !label) return null;
    return (
      <span
        className="ml-1 inline-flex translate-y-[1px] text-[11px] leading-none text-[var(--dama-muted)] opacity-90"
        aria-label={label}
        title={label}
      >
        {glyph}
      </span>
    );
  }
  if (local === "failed" || receiptStatus === "failed") {
    const glyph = failedGlyph.trim();
    const label = failedAria.trim();
    if (!glyph || !label) return null;
    return (
      <span
        className="ml-1 inline-flex translate-y-[1px] text-[11px] font-semibold leading-none text-red-500"
        aria-label={label}
        title={label}
      >
        {glyph}
      </span>
    );
  }
  // 1:1 ticks: ✓ sent until peer read watermark; ✓✓ brand when read.
  // "delivered" (if ever emitted) must not look like premature seen - same single tick as sent.
  if (receiptStatus !== "sent" && receiptStatus !== "delivered" && receiptStatus !== "read") {
    return null;
  }
  const read = receiptStatus === "read";
  const label = read ? seenAria : sentAria;
  const glyph = (read ? readGlyph : sentGlyph).trim();
  if (!glyph || !label.trim()) return null;
  return (
    <span
      className={cn(
        "ml-1 inline-flex translate-y-[1px] text-[11px] leading-none tracking-tighter",
        read ? "text-[var(--dama-brand)]" : "text-[var(--dama-muted)]",
      )}
      aria-label={label}
      title={label}
    >
      {glyph}
    </span>
  );
}

function SeenCountBadge({
  count,
  total,
  seenByPrefix,
  glyph,
}: {
  count?: number | null;
  total?: number | null;
  seenByPrefix: string;
  glyph: string;
}) {
  const n = typeof count === "number" && count > 0 ? count : 0;
  if (n <= 0) return null;
  const t = typeof total === "number" && total > 0 ? total : 0;
  const label = t > 0 && t >= n ? `${n}/${t}` : String(n);
  const title = `${seenByPrefix} ${label}`;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-[var(--dama-chat-bubble-peer)]/90 px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--dama-muted)] ring-1 ring-[var(--dama-border)]"
      title={title}
      aria-label={title}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </span>
  );
}

/** Your sent messages on the left; received messages on the right. */
export function ChatBubble({
  msg,
  mine,
  nameMaxChars,
  nameTruncateSuffix,
  replyActionLabel,
  formatName,
  chrome,
  onReply,
  onJumpToReply,
  onReact,
  canReact,
  showReceipt,
  showSeenCount,
  senderHover,
  onRetryFailed,
}: BubbleProps) {
  const replyId = (msg.reply_to_id || "").trim();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const reactions = msg.reactions ?? [];

  const sender: ChatSenderInfo = {
    id: msg.user_id,
    username: msg.username,
    avatarThumbUrl: msg.avatar_thumb_url,
    countryCode: msg.country_code,
  };

  const senderAvatar =
    senderHover && (msg.user_id || "").trim() ? (
      <ChatSenderAvatar
        chrome={senderHover.chrome}
        sender={sender}
        self={mine}
        signedIn={senderHover.signedIn}
        isFriend={senderHover.isFriend}
        requestPendingOutgoing={senderHover.requestPendingOutgoing}
        onChallenge={senderHover.onChallenge}
        onMessage={senderHover.onMessage}
        onAddFriend={senderHover.onAddFriend}
        onRemoveFriend={senderHover.onRemoveFriend}
        challengeBusy={senderHover.challengeBusy}
        friendBusy={senderHover.friendBusy}
        addFriendBusy={senderHover.addFriendBusy}
        removeFriendBusy={senderHover.removeFriendBusy}
      />
    ) : null;

  const emojiChrome = {
    searchPlaceholder: chrome.chat_emoji_search_placeholder,
    searchEmpty: chrome.chat_emoji_search_empty,
    resultsPrefix: chrome.chat_emoji_results_prefix,
  };

  const createdAtMs = msg.created_at ? Date.parse(msg.created_at) : 0;
  const timeLabel = formatChatMessageTime(msg.created_at);
  const localStatus = (msg.local_status || "").trim();
  const receiptStatus = (msg.receipt || "").trim();
  const isFailed = localStatus === "failed" || receiptStatus === "failed";
  const pendingOrFailed =
    localStatus === "pending" ||
    localStatus === "failed" ||
    receiptStatus === "pending" ||
    isFailed;
  const canRetryFailed = Boolean(mine && isFailed && onRetryFailed);
  const showMetaRow =
    Boolean(timeLabel) || (showReceipt && mine) || showSeenCount || pendingOrFailed;

  return (
    <li
      id={`chat-msg-${msg.id}`}
      data-chat-msg-id={msg.id}
      data-chat-msg-at={Number.isFinite(createdAtMs) ? String(createdAtMs) : "0"}
      className={cn(
        "group flex w-full gap-2 px-3 py-1",
        mine ? "justify-start" : "justify-end",
        pendingOrFailed && "opacity-80",
      )}
    >
      {mine ? senderAvatar : null}

      <div
        className={cn(
          "flex min-w-0 max-w-[min(85%,22rem)] flex-col gap-0.5",
          mine ? "items-start" : "items-end",
        )}
      >
        <p className="flex min-w-0 items-center gap-1 px-1 text-[11px] font-semibold text-[var(--dama-muted)]">
          <span className="truncate">
            {mine
              ? chrome.chat_you_label
              : formatName(msg.username, nameMaxChars, nameTruncateSuffix)}
          </span>
          {!mine ? <CountryFlag code={msg.country_code} /> : null}
        </p>

        <div
          role={canRetryFailed ? "button" : undefined}
          tabIndex={canRetryFailed ? 0 : undefined}
          aria-label={canRetryFailed ? chrome.chat_receipt_retry_action : undefined}
          title={canRetryFailed ? chrome.chat_receipt_failed_aria : undefined}
          onClick={
            canRetryFailed
              ? () => {
                  onRetryFailed?.(msg);
                }
              : undefined
          }
          onKeyDown={
            canRetryFailed
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRetryFailed?.(msg);
                  }
                }
              : undefined
          }
          className={cn(
            "relative min-w-0 max-w-full overflow-hidden rounded-2xl px-3 py-2 text-sm shadow-sm",
            mine
              ? "rounded-bl-md bg-[var(--dama-chat-bubble-mine)] text-[var(--dama-chat-bubble-mine-fg)]"
              : "rounded-br-md border border-[var(--dama-border)] bg-[var(--dama-chat-bubble-peer)] text-[var(--dama-text)]",
            canRetryFailed &&
              "cursor-pointer ring-1 ring-red-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
          )}
        >
          {msg.reply_preview ? (
            <button
              type="button"
              className={cn(
                "mb-1.5 flex w-full flex-col gap-0.5 rounded-lg border-l-[3px] px-2 py-1.5 text-left text-[11px] transition-colors",
                mine
                  ? "border-[var(--dama-brand)]/70 bg-black/5 hover:bg-black/10 dark:bg-white/10"
                  : "border-[var(--dama-brand)] bg-[var(--dama-bg)]/50 hover:bg-[var(--dama-hover)]",
              )}
              disabled={!replyId || !onJumpToReply}
              onClick={(e) => {
                e.stopPropagation();
                if (replyId && onJumpToReply) onJumpToReply(replyId);
              }}
            >
              <span className="font-semibold text-[var(--dama-brand)]">
                <Reply className="mr-1 inline h-3 w-3" aria-hidden />
                {chrome.chat_reply_label}
              </span>
              <span className="line-clamp-2 text-[var(--dama-muted)]">{msg.reply_preview}</span>
            </button>
          ) : null}

          {msg.image_url ? (
            <button
              type="button"
              className="mb-1 block max-w-full overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(msg.image_url || null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveChatMediaUrl(msg.image_url)}
                alt=""
                className="max-h-52 max-w-full cursor-zoom-in object-contain transition-opacity hover:opacity-95"
              />
            </button>
          ) : null}

          {msg.body ? (
            <p className="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
              {msg.body}
            </p>
          ) : null}

          {showMetaRow ? (
            <div
              className={cn(
                "mt-1 flex items-center gap-1.5",
                mine ? "justify-start" : "justify-end",
              )}
            >
              {showSeenCount ? (
                <SeenCountBadge
                  count={msg.seen_count}
                  total={msg.seen_total}
                  seenByPrefix={chrome.chat_seen_by_prefix}
                  glyph={chrome.chat_seen_count_glyph}
                />
              ) : null}
              {timeLabel ? (
                <time
                  dateTime={msg.created_at || undefined}
                  className="text-[10px] tabular-nums leading-none text-[var(--dama-muted)] opacity-90"
                >
                  {timeLabel}
                </time>
              ) : null}
              {(showReceipt || pendingOrFailed) && mine ? (
                <ReceiptTicks
                  receipt={msg.receipt}
                  localStatus={msg.local_status}
                  sentAria={chrome.chat_receipt_sent_aria}
                  seenAria={chrome.chat_receipt_seen_aria}
                  deliveredAria={chrome.chat_receipt_delivered_aria}
                  pendingAria={chrome.chat_receipt_pending_aria}
                  failedAria={chrome.chat_receipt_failed_aria}
                  sentGlyph={chrome.chat_receipt_sent_glyph}
                  readGlyph={chrome.chat_receipt_read_glyph}
                  deliveredGlyph={chrome.chat_receipt_delivered_glyph}
                  pendingGlyph={chrome.chat_receipt_pending_glyph}
                  failedGlyph={chrome.chat_receipt_failed_glyph}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {reactions.length > 0 ? (
          <div
            className={cn("flex flex-wrap gap-1 px-0.5", mine ? "justify-start" : "justify-end")}
          >
            {reactions.map((r) => {
              // Own reaction: click deletes anytime. Peer chips are display-only
              // (add/replace only via React → full emoji picker; one per user).
              const canRemoveOwn = Boolean(canReact && onReact && r.reacted);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  disabled={!canRemoveOwn}
                  aria-label={canRemoveOwn ? chrome.chat_react_action : undefined}
                  onClick={() => {
                    if (canRemoveOwn) onReact?.(msg, r.emoji);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors",
                    r.reacted
                      ? "cursor-pointer border-[var(--dama-brand)]/50 bg-[var(--dama-brand)]/15 hover:bg-[var(--dama-brand)]/25"
                      : "cursor-default border-[var(--dama-border)] bg-[var(--dama-chat-bubble-peer)]/80 disabled:opacity-100",
                  )}
                >
                  <span className="dama-emoji">{r.emoji}</span>
                  <span className="tabular-nums text-[var(--dama-muted)]">{r.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          className={cn(
            // Always visible (touch + desktop). Hover-only hid Reply on phones/tablets.
            "flex items-center gap-1",
            mine ? "justify-start" : "justify-end",
          )}
        >
          {onReply ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[var(--dama-brand)] hover:bg-[var(--dama-hover)]"
              onClick={() => onReply(msg)}
            >
              <Reply className="h-3.5 w-3.5" aria-hidden />
              {replyActionLabel}
            </button>
          ) : null}
          {canReact && onReact ? (
            <ChatEmojiPicker
              ariaLabel={chrome.chat_react_action}
              chrome={emojiChrome}
              side="top"
              align={mine ? "start" : "end"}
              modal
              onPick={(emoji) => onReact(msg, emoji)}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[var(--dama-muted)] hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
              >
                <SmilePlus className="h-3.5 w-3.5" aria-hidden />
                {chrome.chat_react_action}
              </button>
            </ChatEmojiPicker>
          ) : null}
        </div>
      </div>

      {!mine ? senderAvatar : null}
      <ChatMediaLightbox
        url={lightbox}
        onClose={() => setLightbox(null)}
        title={chrome.chat_media_lightbox_title}
        closeAria={chrome.chat_media_lightbox_close_aria}
      />
    </li>
  );
}

/** Soft Telegram-like chat canvas - fills the scrollport even when few messages. */
export function ChatThreadBackdrop({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("dama-chat-wallpaper relative min-h-full w-full flex-1", className)}>
      {children}
    </div>
  );
}

/** Docked bottom chrome: disable toggle + composer (sibling of the message scroller). */
export function ChatStickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-20 shrink-0 border-t border-[var(--dama-border)] bg-[var(--dama-chat-composer-bg)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--dama-chat-composer-bg)]/85 max-lg:sticky max-lg:bottom-0">
      {children}
    </div>
  );
}

type ComposerProps = {
  text: string;
  onTextChange: (v: string) => void;
  imageUrl: string | null;
  onClearImage: () => void;
  replyTo: ChatThreadMessage | null;
  onClearReply: () => void;
  placeholder: string;
  disabled: boolean;
  sending: boolean;
  sendLabel: string;
  sendingLabel: string;
  wordsLabel: string;
  wordCount: number;
  attachAria: string;
  emojiAria: string;
  chrome: ChatThreadChrome;
  removeImageAria: string;
  replyCancelAria: string;
  fileRef: RefObject<HTMLInputElement | null>;
  /** Optional external textarea ref (Telegram-style keep-focus after send). */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /**
   * When true and not disabled, focus the textarea on open / when `autoFocusKey` changes
   * (Telegram/WhatsApp: caret ready to type when a chat opens).
   */
  autoFocus?: boolean;
  /** Remount/refocus key - e.g. threadId or gameId. */
  autoFocusKey?: string;
  onPickFile: (file: File | null) => void;
  onSend: () => void;
  footer?: ReactNode;
  header?: ReactNode;
};

/** Shared bottom composer - attach, emoji, input, send. */
export function ChatComposer({
  text,
  onTextChange,
  imageUrl,
  onClearImage,
  replyTo,
  onClearReply,
  placeholder,
  disabled,
  sending,
  sendLabel,
  sendingLabel,
  wordsLabel,
  wordCount,
  attachAria,
  emojiAria,
  chrome,
  removeImageAria,
  replyCancelAria,
  fileRef,
  inputRef: inputRefProp,
  autoFocus = false,
  autoFocusKey,
  onPickFile,
  onSend,
  footer,
  header,
}: ComposerProps) {
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = inputRefProp ?? localInputRef;
  const emojiChrome = {
    searchPlaceholder: chrome.chat_emoji_search_placeholder,
    searchEmpty: chrome.chat_emoji_search_empty,
    resultsPrefix: chrome.chat_emoji_results_prefix,
  };

  const restoreComposerFocus = () => {
    const el = inputRef.current;
    if (!el || el.disabled) return;
    // preventScroll: default focus() scrolls the page and fights stick-to-bottom (flicker).
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  };

  // Open thread / modal: put caret in the input (Telegram/WhatsApp/Slack).
  // Multi-retry: rail swap, dialog enter, and sticky scroll often steal first focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: autoFocusKey re-runs focus when thread/game unlock changes
  useEffect(() => {
    if (!autoFocus || disabled) return;
    let cancelled = false;
    const focusInput = () => {
      if (cancelled) return;
      const el = inputRef.current;
      if (!el || el.disabled) return;
      if (document.activeElement !== el) el.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(focusInput);
    });
    const timers = [50, 150, 300].map((ms) => window.setTimeout(focusInput, ms));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [autoFocus, autoFocusKey, disabled, inputRef]);

  const keepFocusSend = () => {
    onSend();
    // Telegram: caret stays put - never blur/refocus if already focused.
    requestAnimationFrame(restoreComposerFocus);
  };

  return (
    <div className="shrink-0">
      {header}
      {replyTo ? (
        <div className="flex items-start gap-2 border-b border-[var(--dama-border)]/60 bg-[color-mix(in_srgb,var(--dama-brand)_10%,transparent)] px-3 py-2">
          <div className="min-w-0 flex-1 border-l-[3px] border-[var(--dama-brand)] pl-2">
            <p className="truncate text-[11px] font-semibold text-[var(--dama-brand)]">
              {replyTo.username}
            </p>
            <p className="truncate text-xs text-[var(--dama-muted)]">
              {replyTo.body || (replyTo.image_url ? chrome.chat_image_fallback_label : "")}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-[var(--dama-muted)]"
            aria-label={replyCancelAria}
            onClick={onClearReply}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {imageUrl ? (
        <div className="flex items-center gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-14 w-14 rounded-lg object-cover ring-1 ring-[var(--dama-border)]"
          />
          <button
            type="button"
            className="text-[var(--dama-muted)]"
            aria-label={removeImageAria}
            onClick={onClearImage}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/*
        Immersive chat zeros --dama-bottom-pad-extra; keep only a tight pad + safe-area
        so the composer sits flush with the bottom edge (no white band under the input).
      */}
      <div className="px-2.5 pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <div className="flex items-end gap-1.5 rounded-2xl border border-[var(--dama-border)] bg-[var(--dama-chat-input-bg)] px-1.5 py-1 shadow-sm focus-within:border-[var(--dama-brand)]">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              onPickFile(f);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 rounded-full px-0"
            aria-label={attachAria}
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
          </Button>
          <ChatEmojiPicker
            ariaLabel={emojiAria}
            chrome={emojiChrome}
            disabled={disabled}
            onPick={(e) => {
              onTextChange(text + e);
              requestAnimationFrame(restoreComposerFocus);
            }}
          />
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            // Native hint for first paint; JS retries above cover sheet/rail animations.
            // biome-ignore lint/a11y/noAutofocus: intentional chat open UX (Telegram/WhatsApp)
            autoFocus={Boolean(autoFocus) && !disabled}
            rows={1}
            className="max-h-28 min-h-[2.25rem] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[var(--dama-text)] outline-none placeholder:text-[var(--dama-muted)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                // Do not gate on `sending` - Telegram allows rapid consecutive sends.
                if (!disabled && (text.trim() || imageUrl)) keepFocusSend();
              }
            }}
          />
          {/*
            Icon-only send: never use Button isLoading+pendingLabel here - that injects
            "Sending…" text into a h-9 w-9 control and expands/collapses the row (flicker).
            Telegram keeps a fixed-size send glyph; outbox bubbles carry pending state.
          */}
          <Button
            type="button"
            variant="play"
            size="sm"
            className="h-9 w-9 shrink-0 rounded-full px-0"
            disabled={disabled || (!text.trim() && !imageUrl)}
            aria-busy={sending || undefined}
            aria-label={sending ? sendingLabel : sendLabel}
            onClick={keepFocusSend}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
        <p className="mt-1 px-1 text-right text-[10px] tabular-nums text-[var(--dama-muted)]">
          {wordsLabel}: {wordCount}
        </p>
        {footer}
      </div>
    </div>
  );
}

/** Smooth-scroll + brief highlight a message by id. */
export function jumpToChatMessage(messageId: string, root?: HTMLElement | null): void {
  const id = messageId.trim();
  if (!id) return;
  const scope = root ?? document;
  const el =
    scope.querySelector<HTMLElement>(`[data-chat-msg-id="${CSS.escape(id)}"]`) ??
    document.getElementById(`chat-msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("chat-msg-flash");
  window.setTimeout(() => el.classList.remove("chat-msg-flash"), 1400);
}

/** Pick chat thread chrome fields from play-rail / spectate chrome. */
export function chatThreadChromeFrom(
  chrome: Partial<ChatThreadChrome> & Record<string, string | undefined>,
): ChatThreadChrome | null {
  const keys: (keyof ChatThreadChrome)[] = [
    "chat_you_label",
    "chat_reply_label",
    "chat_react_action",
    "chat_react_more_aria",
    "chat_receipt_sent_aria",
    "chat_receipt_seen_aria",
    "chat_receipt_delivered_aria",
    "chat_receipt_pending_aria",
    "chat_receipt_failed_aria",
    "chat_receipt_retry_action",
    "chat_seen_by_prefix",
    "chat_image_fallback_label",
    "chat_emoji_search_placeholder",
    "chat_emoji_search_empty",
    "chat_emoji_results_prefix",
    "chat_receipt_sent_glyph",
    "chat_receipt_read_glyph",
    "chat_receipt_delivered_glyph",
    "chat_receipt_pending_glyph",
    "chat_receipt_failed_glyph",
    "chat_seen_count_glyph",
    "chat_media_lightbox_title",
    "chat_media_lightbox_close_aria",
    "chat_date_today",
    "chat_date_yesterday",
  ];
  const out = {} as ChatThreadChrome;
  for (const k of keys) {
    const v = (chrome[k] || "").trim();
    if (!v) return null;
    out[k] = v;
  }
  return out;
}
