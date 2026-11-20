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
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OfficialPauseChrome } from "@/types/official-pause-chrome";
import { isOfficialPauseChromeReady } from "@/types/official-pause-chrome";
import { useEffect, useState } from "react";

type Mode = "pause" | "resume" | "meta";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  chrome: OfficialPauseChrome | null | undefined;
  pending?: boolean;
  onConfirm: (vars: { reason_key?: string; note?: string }) => void;
  titleOverride?: string;
  descriptionOverride?: string;
  confirmOverride?: string;
  pendingOverride?: string;
  /** Seed reason/note when opening meta (or pause) so existing pause note is not wiped. */
  initialReasonKey?: string;
  initialNote?: string;
};

/** Official pause/resume/meta confirm using official-pause-chrome only. */
export function OfficialPauseConfirmDialog({
  open,
  onOpenChange,
  mode,
  chrome,
  pending,
  onConfirm,
  titleOverride,
  descriptionOverride,
  confirmOverride,
  pendingOverride,
  initialReasonKey,
  initialNote,
}: Props) {
  const ready = isOfficialPauseChromeReady(chrome) ? chrome : null;
  const [reasonKey, setReasonKey] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setReasonKey((initialReasonKey || "").trim());
      setNote((initialNote || "").trim());
    } else {
      setReasonKey("");
      setNote("");
    }
  }, [open, initialReasonKey, initialNote]);

  if (!ready) return null;

  const title = (
    (titleOverride || "").trim() ||
    (mode === "resume"
      ? ready.confirm_resume_title
      : mode === "meta"
        ? ready.meta_action
        : ready.confirm_pause_title)
  ).trim();
  const description = (
    (descriptionOverride || "").trim() ||
    (mode === "resume" ? ready.confirm_resume_description : ready.confirm_pause_description)
  ).trim();
  const confirmLabel = (
    (confirmOverride || "").trim() ||
    (mode === "resume"
      ? ready.confirm_resume
      : mode === "meta"
        ? ready.meta_action
        : ready.confirm_pause)
  ).trim();
  const pendingLabel = (
    (pendingOverride || "").trim() ||
    (mode === "resume"
      ? ready.resume_pending
      : mode === "meta"
        ? ready.meta_pending
        : ready.pause_pending)
  ).trim();
  const canSubmit = mode === "resume" || Boolean(reasonKey.trim());
  const showReason = mode === "pause" || mode === "meta";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md" closeLabel={ready.confirm_cancel || undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4">
          {showReason ? (
            <Field id="official-pause-reason" label={ready.reason_label}>
              <Select value={reasonKey || undefined} onValueChange={setReasonKey}>
                <SelectTrigger id="official-pause-reason">
                  <SelectValue placeholder={ready.reason_placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {ready.reasons
                    .filter((r) => Boolean((r.key || "").trim()))
                    .map((r) => {
                      const key = (r.key || "").trim();
                      return (
                        <SelectItem key={key} value={key}>
                          {r.label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field id="official-pause-note" label={ready.note_label}>
            <textarea
              id="official-pause-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={ready.note_placeholder}
              className={cn(
                "flex w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] transition-colors",
                "placeholder:text-[var(--dama-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {ready.confirm_cancel}
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={!canSubmit || Boolean(pending)}
            isLoading={Boolean(pending && pendingLabel)}
            pendingLabel={pendingLabel}
            onClick={() => {
              if (!canSubmit) return;
              onConfirm({
                reason_key: mode === "pause" || mode === "meta" ? reasonKey.trim() : undefined,
                // Always send note string; empty clears on meta (API omit would keep).
                note: note.trim(),
              });
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
