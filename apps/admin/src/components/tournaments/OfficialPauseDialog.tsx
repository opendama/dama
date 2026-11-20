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
import { Textarea } from "@/components/ui/textarea";
import type { OfficialPauseChrome } from "@/types/official-pause-chrome";
import { isOfficialPauseChromeReady } from "@/types/official-pause-chrome";
import { useEffect, useState } from "react";

export type OfficialPauseDialogMode = "pause" | "resume" | "meta";

export function OfficialPauseDialog({
  open,
  onOpenChange,
  mode,
  chrome,
  isPending,
  onConfirm,
  titleOverride,
  descriptionOverride,
  confirmOverride,
  pendingOverride,
  initialReasonKey,
  initialNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: OfficialPauseDialogMode;
  chrome: OfficialPauseChrome | null | undefined;
  isPending?: boolean;
  onConfirm: (vars: { reasonKey: string; note: string }) => void;
  titleOverride?: string;
  descriptionOverride?: string;
  confirmOverride?: string;
  pendingOverride?: string;
  initialReasonKey?: string;
  initialNote?: string;
}) {
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

  if (!isOfficialPauseChromeReady(chrome)) return null;

  const needsReason = mode === "pause" || mode === "meta";
  const title = (
    (titleOverride || "").trim() ||
    (mode === "resume"
      ? chrome.confirm_resume_title
      : mode === "meta"
        ? chrome.meta_action
        : chrome.confirm_pause_title) ||
    ""
  ).trim();
  const description = (
    (descriptionOverride || "").trim() ||
    (mode === "resume" ? chrome.confirm_resume_description : chrome.confirm_pause_description) ||
    ""
  ).trim();
  const confirmLabel = (
    (confirmOverride || "").trim() ||
    (mode === "resume"
      ? chrome.confirm_resume
      : mode === "meta"
        ? chrome.meta_action
        : chrome.confirm_pause) ||
    ""
  ).trim();
  const pendingLabel = (
    (pendingOverride || "").trim() ||
    (mode === "resume"
      ? chrome.resume_pending
      : mode === "meta"
        ? chrome.meta_pending
        : chrome.pause_pending) ||
    ""
  ).trim();
  const cancelLabel = (chrome.confirm_cancel || "").trim();
  const reasonLabel = (chrome.reason_label || "").trim();
  const reasonPlaceholder = (chrome.reason_placeholder || "").trim();
  const noteLabel = (chrome.note_label || "").trim();
  const notePlaceholder = (chrome.note_placeholder || "").trim();

  if (!title || !description || !confirmLabel || !cancelLabel) return null;
  if (needsReason && (!reasonLabel || !reasonPlaceholder || chrome.reasons.length === 0)) {
    return null;
  }
  if (mode === "meta" && !(chrome.meta_action || "").trim()) return null;

  const canSubmit = !isPending && (!needsReason || Boolean(reasonKey.trim()));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={cancelLabel} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {needsReason ? (
            <Field label={reasonLabel}>
              <Select value={reasonKey || undefined} onValueChange={setReasonKey}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={reasonPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {chrome.reasons.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {noteLabel ? (
            <Field label={noteLabel}>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={notePlaceholder}
                rows={3}
                disabled={Boolean(isPending)}
              />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(isPending)}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            isLoading={Boolean(isPending)}
            pendingLabel={pendingLabel || undefined}
            onClick={() => {
              if (!canSubmit) return;
              onConfirm({ reasonKey: reasonKey.trim(), note: note.trim() });
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
