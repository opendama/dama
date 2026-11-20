"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

/**
 * Trim-style controlled confirm dialog.
 * Description + cancel + confirm required (fail closed).
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
  title?: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel?: string;
  /** Trim AlertModal cancel-pending (e.g. Declining…). */
  cancelPendingLabel?: string;
  isPending?: boolean;
  isPendingCancel?: boolean;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const ready =
    Boolean(description.trim()) && Boolean(cancelLabel.trim()) && Boolean(confirmLabel.trim());
  const shown = open && ready;
  const busy = Boolean(isPending || isPendingCancel);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, busy, onOpenChange]);

  if (!shown) return null;

  const cancelPending = (cancelPendingLabel || "").trim();
  const cancelLoading = Boolean(isPendingCancel && cancelPending);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onOpenChange(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onOpenChange(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title?.trim() ? "dama-confirm-title" : undefined}
        aria-describedby="dama-confirm-desc"
        className="w-full max-w-md rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {title?.trim() ? (
          <h2 id="dama-confirm-title" className="text-base font-semibold text-[var(--dama-text)]">
            {title}
          </h2>
        ) : null}
        <p
          id="dama-confirm-desc"
          className={`text-sm text-[var(--dama-muted)] ${title?.trim() ? "mt-2" : ""}`}
        >
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
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
        </div>
      </div>
    </div>
  );
}
