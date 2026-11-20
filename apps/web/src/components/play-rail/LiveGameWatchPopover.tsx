"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LiveGameWatchSkeleton } from "@/components/ui/shimmer-skeletons";
import type { LiveGameRow } from "@/hooks/query/useLiveGamesQuery";
import { apiRestUrl } from "@/lib/env";
import { filenameFromContentDisposition } from "@/lib/filename-from-content-disposition";
import { PLAYER_POPOVER_SURFACE } from "@/lib/player-card-popover";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Download, Eye } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  chrome: PlayRailChromeReady;
  game: LiveGameRow;
  children: ReactElement;
  onJoin: (gameId: string) => void;
  /** Kept for call-site compatibility; live-match popover is QR + join/download only. */
  onChallenge?: unknown;
  signedIn?: boolean;
  friendIds?: Set<string>;
  outgoingPendingIds?: Set<string>;
  friendsReady?: boolean;
  onAddFriend?: unknown;
  onRemoveFriend?: unknown;
  friendBusy?: boolean;
  addFriendBusyId?: string;
  removeFriendBusyId?: string;
  challengeBusy?: boolean;
};

function useFinePointerHover() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

function PopoverBody({
  chrome,
  game,
  onJoin,
  onClose,
  onPreviewQr,
  qrFailed,
  onQrFailed,
}: {
  chrome: PlayRailChromeReady;
  game: LiveGameRow;
  onJoin: (gameId: string) => void;
  onClose: () => void;
  onPreviewQr: () => void;
  qrFailed: boolean;
  onQrFailed: () => void;
}) {
  const [qrReady, setQrReady] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);
  const qrSrc = `${apiRestUrl()}/games/${encodeURIComponent(game.id)}/qr.png`;

  async function downloadQr() {
    if (qrDownloading) return;
    setQrDownloading(true);
    try {
      const res = await fetch(qrSrc);
      if (!res.ok) throw new Error("qr");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fromHeader = filenameFromContentDisposition(res.headers.get("Content-Disposition"));
      if (!fromHeader) throw new Error("qr filename");
      a.download = fromHeader;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(chrome.toast_qr_download_failed);
    } finally {
      setQrDownloading(false);
    }
  }

  if (!qrReady && !qrFailed) {
    return (
      <>
        <LiveGameWatchSkeleton />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt=""
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onLoad={() => setQrReady(true)}
          onError={onQrFailed}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--dama-text)]">
        {chrome.live_game_popover_title}
      </p>

      {qrFailed ? (
        <p className="text-center text-sm text-[var(--dama-danger)]">{chrome.qr_unavailable}</p>
      ) : (
        <button
          type="button"
          className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-lg border border-[var(--dama-border)] bg-[var(--dama-bg)] transition hover:border-[var(--dama-gold)]"
          onClick={onPreviewQr}
          aria-label={chrome.qr_preview_aria}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt=""
            className="h-full w-full object-contain p-1"
            onError={onQrFailed}
          />
        </button>
      )}

      <div className="grid grid-cols-1 gap-1.5">
        <Button
          type="button"
          variant="play"
          className="h-9 gap-1.5 text-xs"
          onClick={() => {
            onJoin(game.id);
            onClose();
          }}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {chrome.join_game_action}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 truncate text-xs"
          onClick={() => void downloadQr()}
          disabled={qrFailed || qrDownloading}
          isLoading={qrDownloading}
          pendingLabel={chrome.download_qr_pending}
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{chrome.download_qr_action}</span>
        </Button>
      </div>
    </div>
  );
}

/** Hover/click popover for a live game: QR preview + join + download only. */
export function LiveGameWatchPopover({ chrome, game, children, onJoin }: Props) {
  const fine = useFinePointerHover();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrFailedFor, setQrFailedFor] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  const qrFailed = qrFailedFor === game.id;

  const qrSrc = useMemo(
    () => `${apiRestUrl()}/games/${encodeURIComponent(game.id)}/qr.png`,
    [game.id],
  );

  const body = (
    <PopoverBody
      chrome={chrome}
      game={game}
      onJoin={onJoin}
      onClose={() => setOpen(false)}
      onPreviewQr={() => setQrOpen(true)}
      qrFailed={qrFailed}
      onQrFailed={() => setQrFailedFor(game.id)}
    />
  );

  const lightbox = (
    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
      <DialogContent
        className="max-w-sm border-[var(--dama-border)] bg-[var(--dama-card)]"
        closeLabel={chrome.qr_lightbox_close_aria}
      >
        <DialogTitle className="sr-only">{chrome.qr_preview_aria}</DialogTitle>
        {qrFailed ? (
          <p className="text-center text-sm text-[var(--dama-danger)]">{chrome.qr_unavailable}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt=""
            className="mx-auto h-64 w-64 object-contain"
            onError={() => setQrFailedFor(game.id)}
          />
        )}
        <Button type="button" variant="outline" onClick={() => setQrOpen(false)}>
          {chrome.qr_lightbox_close_aria}
        </Button>
      </DialogContent>
    </Dialog>
  );

  if (!ready) {
    return (
      <>
        {children}
        {lightbox}
      </>
    );
  }

  if (fine) {
    return (
      <>
        <HoverCard openDelay={160} closeDelay={140}>
          <HoverCardTrigger asChild>{children}</HoverCardTrigger>
          <HoverCardContent
            side="left"
            align="start"
            sideOffset={8}
            className={cn(PLAYER_POPOVER_SURFACE)}
          >
            {body}
          </HoverCardContent>
        </HoverCard>
        {lightbox}
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={8}
          className={cn(PLAYER_POPOVER_SURFACE)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {body}
        </PopoverContent>
      </Popover>
      {lightbox}
    </>
  );
}
