"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { releaseBodyPointerEvents } from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s: string | null | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const parts = s.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y == null || m == null || d == null) return undefined;
  return new Date(y, m - 1, d);
}

function formatMaskDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}/${d.getFullYear()}`;
}

/**
 * Single-date picker (shadcn Calendar + Popover).
 * Default modal={false} for page-level forms (avoids stuck body pointer-events).
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  modal = false,
}: {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder: string;
  disabled?: boolean;
  locale?: string;
  className?: string;
  modal?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseISODate(value);
  // Birth-date / age-gate range: full adult lifespan, never invent a 20-year window.
  const now = React.useMemo(() => new Date(), []);
  const startMonth = React.useMemo(() => new Date(now.getFullYear() - 120, 0, 1), [now]);
  const endMonth = React.useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      releaseBodyPointerEvents();
      window.setTimeout(releaseBodyPointerEvents, 0);
      window.setTimeout(releaseBodyPointerEvents, 50);
    }
  }, []);

  return (
    <Popover modal={modal} open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "mt-1 flex w-full items-center justify-between gap-2 text-left font-normal",
            !selected && "text-[var(--dama-muted)]",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? formatMaskDate(selected) : placeholder || "\u00a0"}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="pointer-events-auto z-[250] w-auto overflow-visible p-0"
        align="start"
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          releaseBodyPointerEvents();
        }}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISODate(d));
            handleOpenChange(false);
          }}
          defaultMonth={selected ?? new Date(now.getFullYear() - 21, now.getMonth(), 1)}
          startMonth={startMonth}
          endMonth={endMonth}
          disabled={{ after: now }}
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
