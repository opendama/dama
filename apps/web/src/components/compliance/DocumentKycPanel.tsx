"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MediaDropzone } from "@/components/ui/media-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useCashRmgChromeQuery } from "@/hooks/query/useCashRmgChromeQuery";
import { useMediaUploadChromeQuery } from "@/hooks/query/useMediaUploadChromeQuery";
import { extractApiErrorMessage, isDocKycIncompleteError } from "@/lib/chrome-api-error";
import { apiRestUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useAuthStore } from "@/store/auth";
import { docKycTypeLabel, isCashRmgChromeReady } from "@/types/cash-rmg";
import { isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Submission = {
  id: string;
  document_type: string;
  legal_name: string;
  id_front_url: string;
  id_back_url: string;
  selfie_url: string;
  status: string;
  review_note?: string;
};

type DocumentKycPanelProps = {
  /** Notifies parent when approved status changes (wallet payout gate). */
  onApprovedChange?: (approved: boolean) => void;
  /** When true, skip outer card + title (parent dialog already provides chrome). */
  embedded?: boolean;
};

type DraftResult = { ok: true; id: string } | { ok: false; kind: "incomplete" | "failed" };

/** Government-ID document KYC for payouts (ID front/back + selfie). */
export function DocumentKycPanel({ onApprovedChange, embedded = false }: DocumentKycPanelProps) {
  const token = useAuthStore((s) => s.token);
  const chromeQuery = useCashRmgChromeQuery(Boolean(token));
  const mediaChromeQuery = useMediaUploadChromeQuery(Boolean(token));
  const ready = isCashRmgChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const mediaChrome = isMediaUploadChromeReady(mediaChromeQuery.data)
    ? mediaChromeQuery.data
    : undefined;
  const [docType, setDocType] = useState("national_id");
  const [legalName, setLegalName] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [selfie, setSelfie] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [serverApproved, setServerApproved] = useState(false);
  /** Which form action is in flight - only that button shows loading. */
  const [busyAction, setBusyAction] = useState<"draft" | "submit" | null>(null);
  /** Which dropzone is uploading (`doc-kyc-front` | `doc-kyc-back` | `doc-kyc-selfie`). */
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  /**
   * After attempt: highlight only fields required for that action.
   * - draft: type + legal name
   * - submit: type + legal name + required media
   */
  const [errorMode, setErrorMode] = useState<"none" | "draft" | "submit">("none");
  const actionBusy = busyAction != null || uploadingSlot != null;

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiRestUrl()}/kyc/documents/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearSessionAndBounceToLogin();
      return;
    }
    const json = (await res.json().catch(() => ({}))) as {
      submission?: Submission | null;
      document_kyc_types?: string[];
      approved?: boolean;
    };
    const ok = json.approved === true;
    setServerApproved(ok);
    if (json.submission) {
      setSubmission(json.submission);
      setDocType(json.submission.document_type);
      setLegalName(json.submission.legal_name);
      setFront(json.submission.id_front_url);
      setBack(json.submission.id_back_url || "");
      setSelfie(json.submission.selfie_url);
    }
    if (json.document_kyc_types?.length && !json.submission) {
      const first = json.document_kyc_types[0];
      if (first) setDocType(first);
    }
    onApprovedChange?.(ok);
  }, [token, onApprovedChange]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;
  if (chromeQuery.isLoading) {
    return (
      <div
        className={
          embedded
            ? "space-y-3 overflow-visible"
            : "space-y-3 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4"
        }
        aria-hidden
      >
        {embedded ? null : <ShimmerBlock className="h-5 w-48" />}
        <ShimmerBlock className="h-4 w-full max-w-md" />
        <ShimmerBlock className="h-10 w-full rounded-md" />
        <ShimmerBlock className="h-28 w-full rounded-md" />
        <ShimmerBlock className="h-10 w-36 rounded-md" />
      </div>
    );
  }
  if (!ready) {
    const unavailable = (chromeQuery.data?.chrome?.cash_rmg_unavailable || "").trim();
    return unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null;
  }
  const chrome = ready.chrome;
  const policy = ready.policy;
  const types = policy.document_kyc_types ?? [];
  const passportType = (policy.document_kyc_passport_type || "").trim();
  const approved = (policy.document_kyc_approved_status || "").trim();
  const pending = (policy.document_kyc_pending_status || "").trim();
  const rejected = (policy.document_kyc_rejected_status || "").trim();
  if (!passportType || !approved || !pending || !rejected) {
    const unavailable = (chrome.cash_rmg_unavailable || "").trim();
    return unavailable ? <p className="text-sm text-[var(--dama-danger)]">{unavailable}</p> : null;
  }
  // Lock from server HasApprovedDocument (CURRENT_DATE), not client Date.now().
  const locked =
    submission?.status === pending || (submission?.status === approved && serverApproved);

  const incompleteMsg = (chrome.doc_kyc_incomplete_error || chrome.doc_kyc_failed || "").trim();
  const failedMsg = (chrome.doc_kyc_failed || "").trim();
  const needsBack = docType !== passportType;
  const missingLegal = !legalName.trim();
  const missingFront = !front.trim();
  const missingBack = needsBack && !back.trim();
  const missingSelfie = !selfie.trim();
  const missingType = !docType.trim() || types.length === 0;

  function isIncompleteApiError(errBody: string): boolean {
    return isDocKycIncompleteError(errBody, chrome.doc_kyc_incomplete_error || "");
  }

  /** Chrome-only toast - never pass Error.message / raw response / JSON envelopes. */
  function toastChrome(kind: "incomplete" | "failed", mode: "draft" | "submit" = "submit") {
    if (kind === "incomplete") {
      setErrorMode(mode);
      // Prefer incomplete chrome; never fall through to a second "failed" toast.
      const msg = extractApiErrorMessage(incompleteMsg) || incompleteMsg || failedMsg;
      if (msg && !msg.trim().startsWith("{")) toast.error(msg);
      // Focus first invalid control after paint.
      queueMicrotask(() => {
        const root =
          document.getElementById("doc-kyc-legal-name") ||
          document.getElementById("doc-kyc-type") ||
          document.getElementById("doc-kyc-front");
        root?.focus?.();
      });
      return;
    }
    const msg = extractApiErrorMessage(failedMsg) || failedMsg;
    if (msg && !msg.trim().startsWith("{")) toast.error(msg);
  }

  async function upload(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${apiRestUrl()}/kyc/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (res.status === 401) {
      clearSessionAndBounceToLogin();
      throw new Error("unauthorized");
    }
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) throw new Error(failedMsg);
    return json.url;
  }

  async function persistDraft(): Promise<DraftResult> {
    const res = await fetch(`${apiRestUrl()}/kyc/documents/draft`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: docType,
        legal_name: legalName,
        id_front_url: front,
        id_back_url: back,
        selfie_url: selfie,
      }),
    });
    if (res.status === 401) {
      clearSessionAndBounceToLogin();
      return { ok: false, kind: "failed" };
    }
    const json = (await res.json().catch(() => ({}))) as {
      submission?: Submission;
      error?: string;
    };
    if (!res.ok) {
      const apiErr = extractApiErrorMessage(json.error ?? json);
      return {
        ok: false,
        kind: isIncompleteApiError(apiErr) ? "incomplete" : "failed",
      };
    }
    if (json.submission) setSubmission(json.submission);
    return { ok: true, id: (json.submission?.id || "").trim() };
  }

  async function saveDraft() {
    if (missingType || missingLegal) {
      toastChrome("incomplete", "draft");
      return;
    }
    setBusyAction("draft");
    try {
      const result = await persistDraft();
      if (!result.ok) {
        toastChrome(result.kind, "draft");
        return;
      }
      const msg = (chrome.doc_kyc_success || "").trim();
      if (msg) toast.success(msg);
      setErrorMode("none");
    } catch {
      toastChrome("failed", "draft");
    } finally {
      setBusyAction(null);
    }
  }

  async function submit() {
    if (missingType || missingLegal || missingFront || missingBack || missingSelfie) {
      toastChrome("incomplete", "submit");
      return;
    }
    setBusyAction("submit");
    try {
      const draft = await persistDraft();
      if (!draft.ok) {
        toastChrome(draft.kind, "submit");
        return;
      }
      if (!draft.id) {
        toastChrome("incomplete", "submit");
        return;
      }
      const res = await fetch(`${apiRestUrl()}/kyc/documents/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: draft.id }),
      });
      if (res.status === 401) {
        clearSessionAndBounceToLogin();
        toastChrome("failed", "submit");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        submission?: Submission;
        error?: string;
      };
      if (!res.ok) {
        const apiErr = extractApiErrorMessage(json.error ?? json);
        toastChrome(isIncompleteApiError(apiErr) ? "incomplete" : "failed", "submit");
        return;
      }
      if (json.submission) setSubmission(json.submission);
      toast.success((chrome.doc_kyc_success || "").trim());
      setErrorMode("none");
    } catch {
      toastChrome("failed", "submit");
    } finally {
      setBusyAction(null);
    }
  }

  const statusLabel =
    submission?.status === approved
      ? chrome.doc_kyc_approved_label
      : submission?.status === pending
        ? chrome.doc_kyc_pending_label
        : submission?.status === rejected
          ? chrome.doc_kyc_rejected_label
          : "";

  const showDraftErrors = errorMode === "draft" || errorMode === "submit";
  const showSubmitErrors = errorMode === "submit";
  const fieldErr = errorMode !== "none" ? incompleteMsg : "";

  return (
    <section
      className={
        embedded
          ? "space-y-3 overflow-visible"
          : "space-y-3 overflow-visible rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-4"
      }
    >
      {embedded ? null : <h2 className="font-medium">{chrome.doc_kyc_title}</h2>}
      <p className="text-sm text-[var(--dama-muted)]">{chrome.doc_kyc_blurb}</p>
      {statusLabel ? (
        <p className="text-sm font-medium">
          {statusLabel}
          {submission?.review_note ? ` - ${submission.review_note}` : ""}
        </p>
      ) : null}
      <Field
        id="doc-kyc-type"
        label={chrome.doc_kyc_type_label}
        error={showDraftErrors && missingType ? fieldErr : undefined}
      >
        <Select
          value={docType || undefined}
          disabled={locked || actionBusy || types.length === 0}
          onValueChange={setDocType}
        >
          <SelectTrigger
            id="doc-kyc-type"
            className="mt-1 w-full"
            aria-invalid={showDraftErrors && missingType ? true : undefined}
          >
            <SelectValue placeholder={chrome.doc_kyc_type_label} />
          </SelectTrigger>
          <SelectContent collisionPadding={16}>
            {types.map((t) => {
              const labeled = docKycTypeLabel(chrome, t);
              return (
                <SelectItem key={t} value={t} disabled={!labeled}>
                  {labeled}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Field>
      <Field
        id="doc-kyc-legal-name"
        label={chrome.doc_kyc_legal_name_label}
        error={showDraftErrors && missingLegal ? fieldErr : undefined}
      >
        <Input
          id="doc-kyc-legal-name"
          className="mt-1"
          value={legalName}
          disabled={locked || actionBusy}
          aria-invalid={showDraftErrors && missingLegal ? true : undefined}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder={
            (chrome.doc_kyc_legal_name_placeholder || "").trim() || chrome.doc_kyc_legal_name_label
          }
          autoComplete="name"
        />
      </Field>
      {mediaChrome ? (
        (
          [
            {
              id: "doc-kyc-front",
              label: chrome.doc_kyc_front_label || "",
              set: setFront,
              clear: () => setFront(""),
              value: front,
              missing: missingFront,
            },
            ...(docType === passportType
              ? []
              : [
                  {
                    id: "doc-kyc-back",
                    label: chrome.doc_kyc_back_label || "",
                    set: setBack,
                    clear: () => setBack(""),
                    value: back,
                    missing: missingBack,
                  },
                ]),
            {
              id: "doc-kyc-selfie",
              label: chrome.doc_kyc_selfie_label || "",
              set: setSelfie,
              clear: () => setSelfie(""),
              value: selfie,
              missing: missingSelfie,
            },
          ] as {
            id: string;
            label: string;
            set: (v: string) => void;
            clear: () => void;
            value: string;
            missing: boolean;
          }[]
        ).map((field) => (
          <MediaDropzone
            key={field.id}
            id={field.id}
            label={field.label}
            chrome={mediaChrome}
            disabled={locked || (uploadingSlot != null && uploadingSlot !== field.id)}
            busy={uploadingSlot === field.id}
            invalid={showSubmitErrors && field.missing}
            error={showSubmitErrors && field.missing ? fieldErr : undefined}
            previewUrl={field.value}
            onClear={locked || uploadingSlot != null ? undefined : field.clear}
            onFile={async (f) => {
              setUploadingSlot(field.id);
              try {
                const url = await upload(f);
                field.set(url);
              } catch {
                toastChrome("failed");
              } finally {
                setUploadingSlot(null);
              }
            }}
          />
        ))
      ) : mediaChromeQuery.isLoading ? (
        <ShimmerBlock className="h-28 w-full rounded-xl" />
      ) : (
        <p className="text-sm text-[var(--dama-danger)]" role="alert">
          {(mediaChromeQuery.data?.media_upload_unavailable || "").trim()}
        </p>
      )}
      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            isLoading={busyAction === "draft"}
            disabled={actionBusy && busyAction !== "draft"}
            pendingLabel={chrome.doc_kyc_submit_pending}
            onClick={() => void saveDraft()}
          >
            {chrome.doc_kyc_save_draft_action}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="gold"
            isLoading={busyAction === "submit"}
            disabled={actionBusy && busyAction !== "submit"}
            pendingLabel={chrome.doc_kyc_submit_pending}
            onClick={() => void submit()}
          >
            {chrome.doc_kyc_submit_action}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
