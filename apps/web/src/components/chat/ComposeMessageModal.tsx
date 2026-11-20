"use client";

import { ChatComposer, chatThreadChromeFrom } from "@/components/chat/ChatThreadUI";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSendDMMutation } from "@/hooks/query/useDMsQuery";
import { uploadChatImage } from "@/hooks/query/useGameChatQuery";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { newChatClientId } from "@/lib/chat-optimistic";
import {
  dropChatOutboxMatchingServer,
  enqueueChatOutbox,
  updateChatOutboxItem,
} from "@/lib/chat-outbox";
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Mail } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type MessageTarget = {
  id: string;
  username: string;
  avatarThumbUrl?: string | null;
  avatarFullUrl?: string | null;
};

export type OpenedDmThread = {
  threadId: string;
  peerName: string;
  canCompose: boolean;
  requestId?: string;
  side?: "in" | "out";
  status?: string;
};

type Props = {
  chrome: PlayRailChromeReady;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MessageTarget | null;
  /**
   * Telegram: modal closes immediately; parent can show a loading shell
   * (chrome.dm_chat_loading) until onOpenedThread / onComposeFailed.
   */
  /** Fired immediately on send (modal already cleared/closed). Draft paints the opening shell bubble. */
  onComposeStarted?: (opts: {
    peerName: string;
    clientId: string;
    toUserId: string;
    body?: string;
    imageUrl?: string | null;
  }) => void;
  /** Fired when POST resolves a thread_id (open the real DM thread). */
  onOpenedThread?: (opts: OpenedDmThread) => void;
  /**
   * Fired when background send fails after the modal already closed.
   * Parent must keep the opening shell and mark that clientId failed (tap-to-retry) - never wipe.
   */
  onComposeFailed?: (opts: { clientId: string }) => void;
};

export function ComposeMessageModal({
  chrome,
  open,
  onOpenChange,
  target,
  onComposeStarted,
  onOpenedThread,
  onComposeFailed,
}: Props) {
  const threadChrome = chatThreadChromeFrom(chrome);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const send = useSendDMMutation(token);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  const wordCount = useMemo(() => {
    const t = text.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [text]);

  const liveTarget = usePublicPlayerQuery(target?.id, Boolean(target?.id) && open);
  const thumb = (
    liveTarget.data?.player?.avatar_full_url ||
    liveTarget.data?.player?.avatar_thumb_url ||
    target?.avatarFullUrl ||
    target?.avatarThumbUrl ||
    ""
  ).trim();
  const reset = () => {
    setText("");
    setImageUrl(null);
  };

  const onSend = () => {
    if (!token || !target?.id || !userId) return;
    const body = text.trim();
    if (!body && !imageUrl) return;
    const peerName = target.username;
    const toUserId = target.id;
    const clientId = newChatClientId();
    const image = imageUrl;
    // Telegram: durable outbox + clear/close + opening bubble; POST in the background.
    enqueueChatOutbox(userId, {
      clientId,
      kind: "dm",
      toUserId,
      body: body || undefined,
      imageUrl: image || undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
      peerName,
    });
    reset();
    onOpenChange(false);
    onComposeStarted?.({
      peerName,
      clientId,
      toUserId,
      body: body || undefined,
      imageUrl: image,
    });
    send.mutate(
      {
        clientId,
        to_user_id: toUserId,
        body: body || undefined,
        image_url: image || undefined,
      },
      {
        onSuccess: (data) => {
          dropChatOutboxMatchingServer(userId, [{ client_id: clientId }]);
          const tid = (data.thread_id || data.message?.thread_id || "").trim();
          if (tid && onOpenedThread) {
            const reqStatus = (data.request?.status || "").trim();
            const reqId = (data.request?.id || "").trim();
            // Pending DM request still locks compose until accept (message echo ≠ accepted).
            const canCompose = !data.request || reqStatus === "accepted";
            onOpenedThread({
              threadId: tid,
              peerName,
              canCompose,
              requestId: reqId || undefined,
              side: data.request ? "out" : undefined,
              status: reqStatus || undefined,
            });
            return;
          }
          // No thread_id - keep shell, mark failed for tap-to-retry (same client_id).
          updateChatOutboxItem(userId, clientId, { status: "failed" });
          onComposeFailed?.({ clientId });
          toast.error(chrome.dm_toast_failed);
        },
        onError: () => {
          updateChatOutboxItem(userId, clientId, { status: "failed" });
          onComposeFailed?.({ clientId });
          toast.error(chrome.dm_toast_failed);
        },
      },
    );
  };

  const onPickFile = (file: File | null) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      toast.error(chrome.chat_image_only_hint);
      return;
    }
    setUploading(true);
    void uploadChatImage(token, file, "/dms/image")
      .then((url) => setImageUrl(url))
      .catch(() => toast.error(chrome.dm_toast_failed))
      .finally(() => setUploading(false));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="max-w-md overflow-hidden border-[var(--dama-border)] bg-[var(--dama-panel)] p-0"
        onOpenAutoFocus={(e) => {
          // Prefer the message field over the close control (Telegram compose UX).
          // Multi-retry: dialog enter animation often steals the first focus.
          e.preventDefault();
          const focusComposer = () => {
            const el = composerInputRef.current;
            if (!el || el.disabled) return;
            if (document.activeElement !== el) el.focus({ preventScroll: true });
          };
          requestAnimationFrame(() => {
            requestAnimationFrame(focusComposer);
          });
          window.setTimeout(focusComposer, 50);
          window.setTimeout(focusComposer, 150);
          window.setTimeout(focusComposer, 300);
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--dama-border)] px-4 py-3">
          <DialogTitle className="text-base font-semibold text-[var(--dama-text)]">
            {chrome.dm_modal_title}
          </DialogTitle>
        </div>
        {target ? (
          <div className="flex items-center gap-3 border-b border-[var(--dama-border)] px-4 py-3">
            <DamaUserAvatar
              src={thumb}
              className="h-10 w-10 shrink-0 rounded-full ring-1 ring-[var(--dama-border)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-[var(--dama-text)]">
                {target.username}
              </span>
              <HostTrustBadge
                label={liveTarget.data?.player?.host_trust_badge}
                tier={liveTarget.data?.player?.host_trust_tier}
                className="mt-0.5 text-[9px]"
              />
            </span>
            <Mail className="h-4 w-4 shrink-0 text-[var(--dama-muted)]" aria-hidden />
          </div>
        ) : null}
        {threadChrome ? (
          <ChatComposer
            text={text}
            onTextChange={setText}
            imageUrl={imageUrl}
            onClearImage={() => setImageUrl(null)}
            replyTo={null}
            onClearReply={() => undefined}
            placeholder={chrome.dm_input_placeholder}
            disabled={!target || uploading}
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
            autoFocus={open && Boolean(target)}
            autoFocusKey={target?.id ?? ""}
            onPickFile={onPickFile}
            onSend={onSend}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
