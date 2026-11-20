"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

export type MediaDropzoneChrome = {
  drop_title: string;
  drop_hint: string;
  browse_action: string;
  replace_action: string;
  remove_action: string;
  uploading_label: string;
  selected_label: string;
};

export type MediaDropzoneProps = {
  id?: string;
  label: string;
  chrome: MediaDropzoneChrome;
  accept?: string;
  capture?: "user" | "environment";
  disabled?: boolean;
  busy?: boolean;
  /** Highlight empty/required after a submit attempt. */
  invalid?: boolean;
  /** Chrome-owned validation copy under the dropzone. */
  error?: string;
  previewUrl?: string;
  /** When set without previewUrl (e.g. local video pick), show selected state. */
  selectedName?: string;
  className?: string;
  onFile: (file: File) => void | Promise<void>;
  onClear?: () => void;
};

/** shadcn-style image dropzone: drag / drop / click. DB chrome only. */
export function MediaDropzone({
  id: idProp,
  label,
  chrome,
  accept = "image/*",
  capture,
  disabled = false,
  busy = false,
  invalid = false,
  error,
  previewUrl,
  selectedName,
  className,
  onFile,
  onClear,
}: MediaDropzoneProps) {
  const autoId = useId();
  const id = idProp || autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  /** Per-instance only - never share across sibling dropzones. */
  const [localBusy, setLocalBusy] = useState(false);
  const showBusy = busy || localBusy;
  const locked = disabled || showBusy;
  const hasPreview = Boolean((previewUrl || "").trim());
  const selectedLabel = (selectedName || "").trim();
  const hasSelected = hasPreview || Boolean(selectedLabel);
  const err = (error || "").trim();
  const showInvalid = invalid || Boolean(err);

  const takeFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file || locked) return;
      setLocalBusy(true);
      try {
        await onFile(file);
      } finally {
        setLocalBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [locked, onFile],
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium",
          showInvalid ? "text-[var(--dama-danger)]" : "text-[var(--dama-text)]",
        )}
      >
        {label}
      </label>
      {/* biome-ignore lint/a11y/useSemanticElements: drop zone needs div for drag/drop + nested file input */}
      <div
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-disabled={locked}
        aria-busy={showBusy}
        aria-invalid={showInvalid || undefined}
        aria-label={label}
        onKeyDown={(e) => {
          if (locked) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!locked) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!locked) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          void takeFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (!locked) inputRef.current?.click();
        }}
        className={cn(
          "relative flex min-h-[9.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-[var(--dama-brand)] bg-[var(--dama-brand)]/5"
            : showInvalid
              ? "border-[var(--dama-danger)] bg-[var(--dama-danger)]/5"
              : "border-[var(--dama-border)] bg-[var(--dama-panel)] hover:border-[var(--dama-border-strong)]",
          locked && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          capture={capture}
          disabled={locked}
          className="sr-only"
          onChange={(e) => {
            void takeFile(e.target.files?.[0]);
          }}
        />
        {showBusy ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[var(--dama-muted)]" aria-hidden />
            <p className="text-sm text-[var(--dama-muted)]">{chrome.uploading_label}</p>
          </>
        ) : hasPreview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="h-24 w-36 rounded-md border border-[var(--dama-border)] object-cover"
            />
            <p className="text-xs text-[var(--dama-muted)]">{chrome.selected_label}</p>
          </>
        ) : selectedLabel ? (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--dama-border)] bg-[var(--dama-card)] text-[var(--dama-muted)]">
              <Upload className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--dama-text)]">{chrome.selected_label}</p>
              <p className="max-w-full truncate text-xs text-[var(--dama-muted)]">
                {selectedLabel}
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--dama-border)] bg-[var(--dama-card)] text-[var(--dama-muted)]">
              <Upload className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--dama-text)]">{chrome.drop_title}</p>
              <p className="text-xs text-[var(--dama-muted)]">{chrome.drop_hint}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-1.5 text-xs font-medium text-[var(--dama-text)]">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              {chrome.browse_action}
            </span>
          </>
        )}
      </div>
      {hasSelected && !showBusy ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={locked}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {chrome.replace_action}
          </Button>
          {onClear ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={locked}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              {chrome.remove_action}
            </Button>
          ) : null}
        </div>
      ) : null}
      {err ? (
        <p className="text-xs text-[var(--dama-danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
