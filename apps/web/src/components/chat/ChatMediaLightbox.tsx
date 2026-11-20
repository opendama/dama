"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { resolveChatMediaUrl } from "@/hooks/query/useGameChatQuery";
import { X } from "lucide-react";

type Props = {
  url: string | null;
  onClose: () => void;
  title: string;
  closeAria: string;
};

/** Telegram-style full-screen media preview (chrome-driven a11y). */
export function ChatMediaLightbox({ url, onClose, title, closeAria }: Props) {
  const src = url ? resolveChatMediaUrl(url) : "";
  const titleText = title.trim();
  const closeText = closeAria.trim();
  if (!titleText || !closeText) return null;

  return (
    <Dialog open={Boolean(url)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[95vh] max-w-[min(96vw,56rem)] border-none bg-black/95 p-0 shadow-2xl">
        <DialogTitle className="sr-only">{titleText}</DialogTitle>
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white/90 hover:bg-black/70"
          aria-label={closeText}
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="mx-auto max-h-[90vh] w-auto max-w-full object-contain" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
