"use client";

import { cn } from "@/lib/utils";
import type * as React from "react";

/**
 * Trim-style field: label + control + optional description / error under the control.
 * Description is helper copy - never substitute for a real placeholder on the input.
 * Error is DB/chrome-owned validation copy only (never invent client strings).
 */
export function Field({
  id,
  label,
  description,
  error,
  className,
  children,
}: {
  id?: string;
  label: string;
  description?: string;
  /** When set, shown as alert under the control (chrome / server copy only). */
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const title = label.trim();
  if (!title) return null;
  const err = (error || "").trim();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "block text-sm font-medium",
          err ? "text-[var(--dama-danger)]" : "text-[var(--dama-text)]",
        )}
      >
        {title}
      </label>
      {children}
      {err ? (
        <p className="text-xs text-[var(--dama-danger)]" role="alert">
          {err}
        </p>
      ) : description?.trim() ? (
        <p className="text-xs text-[var(--dama-muted)]">{description.trim()}</p>
      ) : null}
    </div>
  );
}
