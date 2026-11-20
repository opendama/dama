"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Trim-style controlled confirm dialog on the shared DialogContent 90dvh shell.
 * Title + description + cancel + confirm required (fail closed).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  cancelPendingLabel,
  isPending,
  isPendingCancel,
  onConfirm,
  destructive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel?: string;
  cancelPendingLabel?: string;
  isPending?: boolean;
  isPendingCancel?: boolean;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const heading = (title || "").trim();
  const ready =
    Boolean(heading) &&
    Boolean(description.trim()) &&
    Boolean(cancelLabel.trim()) &&
    Boolean(confirmLabel.trim());
  const busy = Boolean(isPending || isPendingCancel);
  const closeLabel = (cancelLabel || "").trim();
  const cancelPending = (cancelPendingLabel || "").trim();
  const cancelLoading = Boolean(isPendingCancel && cancelPending);

  if (!ready) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={closeLabel} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            isLoading={cancelLoading}
            pendingLabel={cancelPending || undefined}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            isLoading={Boolean(pendingLabel?.trim()) && isPending}
            pendingLabel={pendingLabel}
            disabled={busy}
            onClick={() => onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
