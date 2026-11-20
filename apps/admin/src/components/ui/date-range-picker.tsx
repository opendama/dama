"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  isRadixSelectPortalTarget,
  releaseBodyPointerEvents,
} from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

export type DateRangeValue = {
  from: string | null;
  to: string | null;
};

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

function rangeFromValue(value: DateRangeValue): DateRange | undefined {
  const from = parseISODate(value.from);
  const to = parseISODate(value.to);
  if (!from && !to) return undefined;
  return { from, to };
}

function valueFromRange(range: DateRange | undefined): DateRangeValue {
  return {
    from: range?.from ? toISODate(range.from) : null,
    to: range?.to ? toISODate(range.to) : null,
  };
}

function formatMaskDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}/${d.getFullYear()}`;
}

function useWideCalendar(minWidthPx = 640) {
  const [wide, setWide] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [minWidthPx]);
  return wide;
}

/** Trim DateRangePicker - chrome-gated labels; Apply commits; Clear resets. */
export function DateRangePicker({
  id,
  value,
  onChange,
  placeholder,
  clearLabel,
  applyLabel,
  locale,
  numberOfMonths,
  className,
}: {
  id?: string;
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  placeholder: string;
  clearLabel: string;
  applyLabel: string;
  locale: string;
  numberOfMonths: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(() => rangeFromValue(value));
  const wide = useWideCalendar();
  const months =
    Number.isFinite(numberOfMonths) && numberOfMonths >= 1 ? Math.floor(numberOfMonths) : 0;
  const visibleMonths = months < 1 ? 0 : wide ? months : 1;

  const label = React.useMemo(() => {
    const from = parseISODate(value.from);
    const to = parseISODate(value.to);
    if (from && to) {
      return `${formatMaskDate(from)} - ${formatMaskDate(to)}`;
    }
    if (from) {
      return formatMaskDate(from);
    }
    return placeholder;
  }, [value.from, value.to, placeholder]);

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(rangeFromValue(value));
    setOpen(next);
    if (!next) {
      releaseBodyPointerEvents();
      window.setTimeout(releaseBodyPointerEvents, 0);
    }
  };

  if (visibleMonths < 1) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Popover modal open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              // Match Input/SelectTrigger h-10 so AdminFilterBar items-end keeps search aligned (Trim).
              "flex h-10 w-full max-w-full items-center justify-between gap-2 text-left font-normal sm:w-auto",
              !value.from && "text-[var(--dama-muted)]",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="pointer-events-auto flex w-auto max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0"
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (isRadixSelectPortalTarget(e.target)) {
              e.preventDefault();
            }
          }}
        >
          <div className="max-h-[min(22.5rem,calc(var(--radix-popover-content-available-height,100dvh)-3.5rem))] overflow-y-auto overscroll-contain">
            <Calendar
              mode="range"
              captionLayout="dropdown"
              defaultMonth={draft?.from ?? rangeFromValue(value)?.from}
              selected={draft}
              onSelect={(range) => setDraft(range)}
              numberOfMonths={visibleMonths}
              startMonth={new Date(new Date().getFullYear() - 40, 0, 1)}
              endMonth={new Date(new Date().getFullYear() + 1, 11, 1)}
              formatters={{
                formatMonthDropdown: (date) => {
                  const loc = locale.trim();
                  if (!loc) return date.toLocaleString("default", { month: "short" });
                  try {
                    return new Intl.DateTimeFormat(loc, { month: "short" }).format(date);
                  } catch {
                    return date.toLocaleString("default", { month: "short" });
                  }
                },
              }}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--dama-border)] bg-[var(--dama-card)] p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(undefined);
                onChange({ from: null, to: null });
                setOpen(false);
              }}
            >
              {clearLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="gold"
              onClick={() => {
                onChange(valueFromRange(draft));
                setOpen(false);
              }}
            >
              {applyLabel}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
