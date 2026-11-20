"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { releaseBodyPointerEvents } from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

/** Local wall value: `YYYY-MM-DDTHH:mm` (datetime-local compatible). */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseLocalDateTime(s: string | null | undefined): Date | undefined {
  const raw = (s || "").trim();
  if (!raw) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(raw);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4] ?? "0");
  const mm = Number(m[5] ?? "0");
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return undefined;
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

function toLocalDateTimeValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatMaskDateTime(d: Date): string {
  const date = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${date} ${pad2(h)}:${pad2(d.getMinutes())} ${ampm}`;
}

type Period = "AM" | "PM";

function parseTimeDraft(raw: string): { hour12: number; minute: number; period: Period } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  const hh24 = m?.[1] != null ? Number.parseInt(m[1], 10) : 12;
  const minute = m?.[2] != null ? Number.parseInt(m[2], 10) : 0;
  const safeH = Number.isFinite(hh24) ? Math.min(23, Math.max(0, hh24)) : 12;
  const safeM = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;
  const period: Period = safeH >= 12 ? "PM" : "AM";
  let hour12 = safeH % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: safeM, period };
}

function toTimeDraft(hour12: number, minute: number, period: Period): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${pad2(h)}:${pad2(minute)}`;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: Period[] = ["AM", "PM"];

/**
 * Same hour / minute / AM-PM columns as Chrome's native time popup, but brand-colored
 * and in-document (native popup ignores accent-color and clips under Dialog/Popover).
 */
function TimeColumnPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { hour12, minute, period } = parseTimeDraft(value);
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);
  const periodRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll only the column scroller - never scrollIntoView (jumps the Popover).
    const scrollSelected = (root: HTMLDivElement | null, key: string) => {
      if (!root) return;
      const el = root.querySelector<HTMLElement>(`[data-time-opt="${key}"]`);
      if (!el) return;
      const top = el.offsetTop - root.clientHeight / 2 + el.clientHeight / 2;
      root.scrollTop = Math.max(0, top);
    };
    scrollSelected(hourRef.current, `h-${hour12}`);
    scrollSelected(minuteRef.current, `m-${minute}`);
    scrollSelected(periodRef.current, `p-${period}`);
  }, [hour12, minute, period]);

  const commit = (nextH: number, nextM: number, nextP: Period) => {
    onChange(toTimeDraft(nextH, nextM, nextP));
  };

  const colClass =
    "flex max-h-[min(11.5rem,calc(var(--radix-popover-content-available-height,100dvh)-6rem))] min-w-[3.25rem] flex-1 flex-col overflow-y-auto overscroll-contain rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] py-1 [scrollbar-width:thin]";

  const optClass = (selected: boolean) =>
    cn(
      "mx-1 flex h-8 shrink-0 items-center justify-center rounded-md px-2 text-sm tabular-nums transition-colors",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      selected
        ? "bg-[var(--dama-brand)] font-semibold text-[var(--dama-cta-fg)]"
        : "text-[var(--dama-text)] hover:bg-[color-mix(in_srgb,var(--dama-brand)_12%,transparent)]",
    );

  return (
    <div className="flex gap-2" aria-label="Time" aria-disabled={disabled || undefined}>
      <div ref={hourRef} className={colClass} aria-label="Hour">
        {HOURS_12.map((h) => (
          <button
            key={h}
            type="button"
            data-time-opt={`h-${h}`}
            aria-pressed={h === hour12}
            disabled={disabled}
            className={optClass(h === hour12)}
            onClick={() => commit(h, minute, period)}
          >
            {h}
          </button>
        ))}
      </div>
      <div ref={minuteRef} className={colClass} aria-label="Minute">
        {MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            data-time-opt={`m-${m}`}
            aria-pressed={m === minute}
            disabled={disabled}
            className={optClass(m === minute)}
            onClick={() => commit(hour12, m, period)}
          >
            {pad2(m)}
          </button>
        ))}
      </div>
      <div
        ref={periodRef}
        className={cn(colClass, "min-w-[3.5rem] flex-none")}
        aria-label="AM or PM"
      >
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            data-time-opt={`p-${p}`}
            aria-pressed={p === period}
            disabled={disabled}
            className={optClass(p === period)}
            onClick={() => commit(hour12, minute, p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * shadcn-style datetime field: trailing calendar icon, mask placeholder,
 * modal Popover Calendar + time row; column picker opens on time-row click (native parity).
 * Value is local `YYYY-MM-DDTHH:mm`.
 */
export function DateTimeField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (localDateTime: string) => void;
  /** Backend-owned empty mask, e.g. mm/dd/yyyy --:-- -- */
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [timeOpen, setTimeOpen] = React.useState(false);
  const selected = parseLocalDateTime(value);
  const [timeDraft, setTimeDraft] = React.useState(() =>
    selected ? `${pad2(selected.getHours())}:${pad2(selected.getMinutes())}` : "12:00",
  );

  React.useEffect(() => {
    const next = parseLocalDateTime(value);
    if (!next) return;
    setTimeDraft(`${pad2(next.getHours())}:${pad2(next.getMinutes())}`);
  }, [value]);

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setTimeOpen(false);
      releaseBodyPointerEvents();
      window.setTimeout(releaseBodyPointerEvents, 0);
    }
  }, []);

  const applyDay = (day: Date | undefined) => {
    if (!day) return;
    setTimeOpen(false);
    const [hhRaw, mmRaw] = timeDraft.split(":");
    const hh = Number.parseInt(hhRaw || "0", 10);
    const mm = Number.parseInt(mmRaw || "0", 10);
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      Number.isFinite(hh) ? hh : 0,
      Number.isFinite(mm) ? mm : 0,
      0,
      0,
    );
    onChange(toLocalDateTimeValue(next));
  };

  const applyTime = (raw: string) => {
    setTimeDraft(raw);
    if (!selected || !/^\d{2}:\d{2}$/.test(raw)) return;
    const [hhRaw, mmRaw] = raw.split(":");
    const hh = Number.parseInt(hhRaw || "0", 10);
    const mm = Number.parseInt(mmRaw || "0", 10);
    const next = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
      Number.isFinite(hh) ? hh : 0,
      Number.isFinite(mm) ? mm : 0,
      0,
      0,
    );
    onChange(toLocalDateTimeValue(next));
  };

  const timeLabel = (() => {
    const { hour12, minute, period } = parseTimeDraft(timeDraft);
    return `${pad2(hour12)} : ${pad2(minute)} ${period}`;
  })();

  const timeDisabled = Boolean(disabled || !selected);

  // modal: DateTimeField is used inside Dialogs (ads create) - keep dismissable layer.
  return (
    <Popover modal open={open} onOpenChange={handleOpenChange}>
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
            {selected ? formatMaskDateTime(selected) : placeholder || "\u00a0"}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="dama-float pointer-events-auto z-[260] flex w-auto max-h-[min(var(--radix-popover-content-available-height,100dvh),40rem)] flex-col overflow-hidden p-0"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions
        sticky="partial"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={applyDay}
            defaultMonth={selected}
            startMonth={new Date(new Date().getFullYear() - 1, 0, 1)}
            endMonth={new Date(new Date().getFullYear() + 5, 11, 1)}
            className="pointer-events-auto"
          />
        </div>
        <div className="shrink-0 border-t border-[var(--dama-border)] p-3">
          {/* Nested popover: columns open only on click (native clock-popup parity). */}
          <Popover modal={false} open={timeOpen} onOpenChange={setTimeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={timeDisabled}
                aria-haspopup="dialog"
                aria-expanded={timeOpen}
                aria-label="Select time"
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] px-3 text-sm tabular-nums outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]",
                  timeDisabled
                    ? "cursor-not-allowed text-[var(--dama-muted)] opacity-60"
                    : "cursor-pointer text-[var(--dama-text)] hover:border-[var(--dama-brand)]",
                  timeOpen && "border-[var(--dama-brand)] ring-2 ring-[var(--dama-brand)]",
                )}
              >
                <span>{timeLabel}</span>
                <Clock className="h-4 w-4 opacity-50" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              // Parent calendar is also a popover layer - allow outside dismiss on it.
              guardPortaledDismiss={false}
              className="dama-float z-[270] w-auto max-h-[min(var(--radix-popover-content-available-height,100dvh),20rem)] overflow-visible p-2"
              align="start"
              side="top"
              sideOffset={8}
              collisionPadding={12}
              avoidCollisions
              sticky="partial"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <TimeColumnPicker value={timeDraft} onChange={applyTime} disabled={timeDisabled} />
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  );
}
