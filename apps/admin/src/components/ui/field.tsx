"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type * as React from "react";

/**
 * Trim Field: label + control + reserved description line so sibling fields stay aligned.
 */
export function Field({
  id,
  label,
  description,
  error,
  descriptionWrap = false,
  className,
  children,
}: {
  id?: string;
  label?: string;
  description?: string;
  error?: string;
  /** When true, description can wrap (longer operator guidance). */
  descriptionWrap?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const title = (label || "").trim();
  if (!title) return null;
  const err = (error || "").trim();
  const desc = err ? "" : description?.trim() || "";
  const under = err || desc;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="line-clamp-1 min-h-5 leading-5" title={title}>
        {title}
      </Label>
      <div className="min-h-10 w-full [&>textarea]:min-h-[min(32dvh,16rem)]">{children}</div>
      <p
        className={cn(
          "min-h-5 text-xs leading-5",
          err ? "text-[var(--dama-danger)]" : "text-[var(--dama-muted)]",
          descriptionWrap || err ? "text-pretty" : "line-clamp-1",
        )}
        title={under || undefined}
        role={err ? "alert" : undefined}
      >
        {under ? under : "\u00a0"}
      </p>
    </div>
  );
}
