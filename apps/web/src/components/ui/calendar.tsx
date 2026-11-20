"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { DayPicker, type DropdownProps, getDefaultClassNames } from "react-day-picker";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Month/year dropdown (Radix Select). Filters RDP's native-select overlay classes
 * (`opacity-0 absolute inset-0`) so our trigger stays visible and clickable.
 */
function CalendarDropdown({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
  disabled,
}: DropdownProps) {
  const selected = value == null || value === "" ? undefined : String(value);
  const selectedInOptions =
    selected != null && (options ?? []).some((o) => String(o.value) === selected);
  return (
    <Select
      value={selectedInOptions ? selected : undefined}
      disabled={disabled}
      onValueChange={(next) => {
        if (!onChange) return;
        onChange({
          target: { value: next },
        } as React.ChangeEvent<HTMLSelectElement>);
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "pointer-events-auto relative z-20 h-8 w-auto min-w-[4.75rem] gap-1 border-[var(--dama-border)] bg-[var(--dama-card)] px-2 text-sm font-medium shadow-none",
          className
            ?.split(/\s+/)
            .filter((t) => t && t !== "opacity-0" && t !== "absolute" && t !== "inset-0")
            .join(" "),
        )}
      >
        <SelectValue placeholder={ariaLabel || "\u2026"} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        collisionPadding={12}
        className="max-h-60 min-w-[var(--radix-select-trigger-width)] border-[var(--dama-border)] bg-[var(--dama-card)]"
      >
        {(options ?? []).map((option) => (
          <SelectItem
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * shadcn Calendar on react-day-picker v9.
 *
 * Critical: nav is `absolute inset-x-0 top-0` and otherwise steals clicks from
 * month/year dropdowns (and can feel like a "frozen" calendar). Industry fix
 * from shadcn/ui#10441 + react-day-picker#2936:
 *   nav → pointer-events-none
 *   prev/next → pointer-events-auto
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  components,
  startMonth: startMonthProp,
  endMonth: endMonthProp,
  formatters,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();
  const now = new Date();
  // Wide default year dropdown so callers that omit bounds still cover DOB / history.
  // Prefer explicit startMonth/endMonth on DateField (past) and DateTimeField (near future).
  const startMonth = startMonthProp ?? new Date(now.getFullYear() - 120, 0);
  const endMonth = endMonthProp ?? new Date(now.getFullYear() + 5, 11);

  return (
    <DayPicker
      {...props}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      navLayout="around"
      startMonth={startMonth}
      endMonth={endMonth}
      className={cn(
        "rdp-root pointer-events-auto bg-[var(--dama-card)] p-3 text-[var(--dama-text)]",
        className,
      )}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 sm:flex-row sm:gap-6", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        month_caption: cn(
          "relative flex h-9 w-full items-center justify-center px-8",
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          "select-none text-sm font-medium",
          captionLayout === "label"
            ? ""
            : "flex h-8 items-center gap-1 rounded-md pl-2 pr-1 [&>svg]:size-3.5 [&>svg]:text-[var(--dama-muted)]",
          defaultClassNames.caption_label,
        ),
        // Absolute full-width nav overlays caption/dropdowns - must ignore pointer events.
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 pointer-events-none",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "pointer-events-auto z-10 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "pointer-events-auto z-10 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
          defaultClassNames.button_next,
        ),
        dropdowns: cn(
          "relative z-10 flex h-9 w-full items-center justify-center gap-2 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn("relative z-10", defaultClassNames.dropdown_root),
        // Native select overlay classes - filtered out of custom SelectTrigger; kept for RDP internals.
        dropdown: cn("absolute inset-0 opacity-0", defaultClassNames.dropdown),
        month_grid: cn("relative z-0 w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-8 select-none rounded-md text-[0.8rem] font-normal text-[var(--dama-muted)]",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          defaultClassNames.day,
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has([aria-selected])]:bg-[color-mix(in_srgb,var(--dama-brand)_12%,transparent)] [&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day_button: cn(
          defaultClassNames.day_button,
          buttonVariants({ variant: "ghost" }),
          "pointer-events-auto h-8 w-8 p-0 font-normal aria-selected:opacity-100",
          "aria-selected:bg-[var(--dama-brand)] aria-selected:text-[var(--dama-cta-fg)] aria-selected:hover:bg-[var(--dama-brand)] aria-selected:hover:text-[var(--dama-cta-fg)]",
        ),
        range_start: cn("day-range-start", defaultClassNames.range_start),
        range_end: cn("day-range-end", defaultClassNames.range_end),
        // Brand after RDP defaults so accent/primary blue cannot win via tailwind-merge.
        selected: cn(
          defaultClassNames.selected,
          "bg-[var(--dama-brand)] text-[var(--dama-cta-fg)] hover:bg-[var(--dama-brand)] hover:text-[var(--dama-cta-fg)] focus:bg-[var(--dama-brand)] focus:text-[var(--dama-cta-fg)]",
        ),
        today: cn(
          defaultClassNames.today,
          "bg-[color-mix(in_srgb,var(--dama-brand)_12%,transparent)] text-[var(--dama-brand)] aria-selected:bg-[var(--dama-brand)] aria-selected:text-[var(--dama-cta-fg)]",
        ),
        outside: cn(
          defaultClassNames.outside,
          "day-outside text-[var(--dama-muted)] aria-selected:bg-[var(--dama-brand)] aria-selected:text-[var(--dama-cta-fg)]",
        ),
        disabled: cn(defaultClassNames.disabled, "text-[var(--dama-muted)] opacity-50"),
        range_middle: cn(
          defaultClassNames.range_middle,
          "aria-selected:bg-[color-mix(in_srgb,var(--dama-brand)_12%,transparent)] aria-selected:text-[var(--dama-text)]",
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Dropdown: CalendarDropdown,
        Chevron: ({ orientation, className: chevronClass, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", chevronClass)} {...chevronProps} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", chevronClass)} {...chevronProps} />;
          }
          return <ChevronDown className={cn("h-4 w-4", chevronClass)} {...chevronProps} />;
        },
        ...components,
      }}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
