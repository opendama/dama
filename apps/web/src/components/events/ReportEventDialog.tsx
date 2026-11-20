"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useReportHostedEventMutation } from "@/hooks/mutation/useReportHostedEventMutation";
import { useReportTournamentMutation } from "@/hooks/mutation/useReportTournamentMutation";
import {
  softCommunityReportNoteLabel,
  softCommunityReportReasonLabel,
  softCommunityReportSubmitAction,
} from "@/lib/community-player-chrome-soft";
import { eventsDialogShellStyle } from "@/lib/events-dialog-shell-style";
import {
  softHostingCancelAction,
  softHostingReportTitle,
} from "@/lib/hosting-organizer-chrome-soft";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type ReportEventChrome = {
  report_title: string;
  report_reason_label: string;
  report_note_label: string;
  report_submit_action: string;
  cancel_action: string;
  dialog_shell_max_width?: string;
  dialog_shell_max_height_ratio?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  /** Defaults to hosted events report endpoint. */
  reportTarget?: "event" | "tournament";
  reasonCodes: string[];
  /** DB labels keyed by reason code; fail-closed empty when missing. */
  reasonLabels?: Record<string, string>;
  emptyValue?: string;
  chrome: ReportEventChrome;
  token: string;
  closeLabel: string;
};

export function ReportEventDialog({
  open,
  onOpenChange,
  eventId,
  reportTarget = "event",
  reasonCodes,
  reasonLabels,
  emptyValue,
  chrome,
  token,
  closeLabel,
}: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const reportEvent = useReportHostedEventMutation(token);
  const reportTournament = useReportTournamentMutation(token);
  const reportPending =
    reportTarget === "tournament" ? reportTournament.isPending : reportEvent.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="w-full max-h-none"
        style={eventsDialogShellStyle(chrome) ?? undefined}
        closeLabel={closeLabel.trim() || undefined}
      >
        <DialogHeader>
          <DialogTitle>{softHostingReportTitle(chrome.report_title)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field
            id="report-reason"
            label={softCommunityReportReasonLabel(chrome.report_reason_label)}
          >
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger id="report-reason">
                <SelectValue
                  placeholder={softCommunityReportReasonLabel(chrome.report_reason_label)}
                />
              </SelectTrigger>
              <SelectContent>
                {reasonCodes.map((code) => {
                  const label = (reasonLabels?.[code] || "").trim() || (emptyValue || "").trim();
                  return (
                    <SelectItem key={code} value={code} disabled={!label}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field id="report-note" label={softCommunityReportNoteLabel(chrome.report_note_label)}>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={cn(
                "flex w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] transition-colors",
                "placeholder:text-[var(--dama-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </Field>
        </div>
        <DialogFooter>
          {softHostingCancelAction(chrome.cancel_action) ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {softHostingCancelAction(chrome.cancel_action)}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="gold"
            disabled={!eventId || !reason || reportPending}
            isLoading={reportPending}
            onClick={() => {
              if (!eventId || !reason) return;
              const onSuccess = () => {
                setReason("");
                setNote("");
                onOpenChange(false);
              };
              if (reportTarget === "tournament") {
                reportTournament.mutate(
                  { tournamentId: eventId, reason_code: reason, note: note.trim() },
                  { onSuccess },
                );
                return;
              }
              reportEvent.mutate(
                { eventId, reason_code: reason, note: note.trim() },
                { onSuccess },
              );
            }}
          >
            {softCommunityReportSubmitAction(chrome.report_submit_action)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
