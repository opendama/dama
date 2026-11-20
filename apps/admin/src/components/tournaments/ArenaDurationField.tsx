"use client";

import { DateTimeField } from "@/components/ui/date-time-field";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARENA_DURATION_UNITS,
  type ArenaDurationMode,
  type ArenaDurationUnit,
  localDateTimeFromMinutesAhead,
  minutesFromAmountUnit,
  minutesUntilLocalDateTime,
  splitMinutesToAmountUnit,
} from "@/lib/arena-duration";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export type ArenaDurationFieldChrome = {
  arena_duration_label: string;
  arena_duration_required: string;
  arena_duration_length_placeholder: string;
  arena_duration_unit_label: string;
  arena_duration_unit_minutes: string;
  arena_duration_unit_hours: string;
  arena_duration_unit_days: string;
  arena_duration_unit_weeks: string;
  arena_duration_unit_months: string;
  arena_duration_mode_length: string;
  arena_duration_mode_ends_at: string;
  arena_duration_ends_at_label: string;
  arena_duration_ends_at_placeholder: string;
  arena_duration_ends_at_past: string;
  arena_duration_blurb: string;
};

function unitLabel(chrome: ArenaDurationFieldChrome, unit: ArenaDurationUnit): string {
  switch (unit) {
    case "minutes":
      return (chrome.arena_duration_unit_minutes || "").trim();
    case "hours":
      return (chrome.arena_duration_unit_hours || "").trim();
    case "days":
      return (chrome.arena_duration_unit_days || "").trim();
    case "weeks":
      return (chrome.arena_duration_unit_weeks || "").trim();
    case "months":
      return (chrome.arena_duration_unit_months || "").trim();
  }
}

function parseMinutesValue(raw: string): number | null {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Arena duration: shadcn DateTimeField (date + time) primary - same pattern as ads Ends at.
 * Optional Length (amount × unit) remains as a secondary mode. Emits arena_duration_minutes.
 */
export function ArenaDurationField({
  idPrefix,
  chrome,
  minutesValue,
  onMinutesChange,
  error,
  disabled,
  labelOverride,
  className,
}: {
  idPrefix: string;
  chrome: ArenaDurationFieldChrome;
  minutesValue: string;
  onMinutesChange: (minutes: string) => void;
  error?: string;
  disabled?: boolean;
  /** Settings card may use arena_settings_label_default_duration. */
  labelOverride?: string;
  className?: string;
}) {
  const label = (labelOverride || chrome.arena_duration_label || "").trim();
  const required = (chrome.arena_duration_required || "").trim();
  const lengthPlaceholder = (chrome.arena_duration_length_placeholder || "").trim();
  const unitLabelText = (chrome.arena_duration_unit_label || "").trim();
  const modeLength = (chrome.arena_duration_mode_length || "").trim();
  const modeEnds = (chrome.arena_duration_mode_ends_at || "").trim();
  const endsLabel = (chrome.arena_duration_ends_at_label || "").trim();
  const endsPlaceholder = (chrome.arena_duration_ends_at_placeholder || "").trim();
  const blurb = (chrome.arena_duration_blurb || "").trim();
  const pastErr = (chrome.arena_duration_ends_at_past || "").trim();

  const unitsReady = ARENA_DURATION_UNITS.every((u) => unitLabel(chrome, u));
  const chromeReady =
    Boolean(label) &&
    Boolean(required) &&
    Boolean(lengthPlaceholder) &&
    Boolean(unitLabelText) &&
    Boolean(modeLength) &&
    Boolean(modeEnds) &&
    Boolean(endsLabel) &&
    Boolean(endsPlaceholder) &&
    Boolean(pastErr) &&
    Boolean(blurb) &&
    unitsReady;

  // biome-ignore lint/correctness/useExhaustiveDependencies: seed once from mount minutesValue
  const initial = useMemo(() => {
    const mins = parseMinutesValue(minutesValue);
    if (mins == null) return { amount: "", unit: "hours" as ArenaDurationUnit, ends: "" };
    const split = splitMinutesToAmountUnit(mins);
    return {
      amount: split.amount,
      unit: split.unit,
      ends: localDateTimeFromMinutesAhead(mins),
    };
  }, []);

  // Calendar-first (ads Ends-at parity); Length is secondary.
  const [mode, setMode] = useState<ArenaDurationMode>("ends_at");
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState<ArenaDurationUnit>(initial.unit);
  const [endsAt, setEndsAt] = useState(initial.ends);
  const [endsPast, setEndsPast] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync from minutesValue prop only
  useEffect(() => {
    const mins = parseMinutesValue(minutesValue);
    if (mins == null) {
      if (mode === "length") setAmount("");
      return;
    }
    const split = splitMinutesToAmountUnit(mins);
    const nextMins = minutesFromAmountUnit(amount, unit);
    if (mode === "length" && nextMins !== mins) {
      setAmount(split.amount);
      setUnit(split.unit);
    }
    if (mode === "ends_at") {
      const fromEnds = minutesUntilLocalDateTime(endsAt);
      if (fromEnds !== mins) {
        setEndsAt(localDateTimeFromMinutesAhead(mins));
        setEndsPast(false);
      }
    }
  }, [minutesValue]);

  if (!chromeReady) return null;

  function emitFromLength(nextAmount: string, nextUnit: ArenaDurationUnit) {
    const mins = minutesFromAmountUnit(nextAmount, nextUnit);
    onMinutesChange(mins != null ? String(mins) : "");
  }

  function emitFromEnds(local: string) {
    const mins = minutesUntilLocalDateTime(local);
    if (mins == null) {
      setEndsPast(Boolean(local.trim()) && Boolean(pastErr));
      onMinutesChange("");
      return;
    }
    setEndsPast(false);
    onMinutesChange(String(mins));
  }

  function switchMode(next: ArenaDurationMode) {
    setMode(next);
    const mins = parseMinutesValue(minutesValue);
    if (next === "ends_at") {
      setEndsAt(mins != null ? localDateTimeFromMinutesAhead(mins) : "");
      setEndsPast(false);
    } else if (mins != null) {
      const split = splitMinutesToAmountUnit(mins);
      setAmount(split.amount);
      setUnit(split.unit);
    }
  }

  const showError = (error || "").trim() || (endsPast ? pastErr : "");
  const fieldId =
    mode === "ends_at" ? `${idPrefix}-arena-duration-ends` : `${idPrefix}-arena-duration-amount`;
  const fieldLabel = mode === "ends_at" ? endsLabel || label : label;

  return (
    <Field
      id={fieldId}
      label={fieldLabel}
      description={blurb}
      error={showError || undefined}
      className={className}
    >
      <div className="space-y-2">
        <fieldset className="m-0 inline-flex rounded-md border border-[var(--dama-border)] p-0.5">
          <legend className="sr-only">{label}</legend>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "ends_at"
                ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
            )}
            aria-pressed={mode === "ends_at"}
            onClick={() => switchMode("ends_at")}
          >
            {modeEnds}
          </button>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "length"
                ? "bg-[var(--dama-surface)] text-[var(--dama-text)]"
                : "text-[var(--dama-muted)] hover:text-[var(--dama-text)]",
            )}
            aria-pressed={mode === "length"}
            onClick={() => switchMode("length")}
          >
            {modeLength}
          </button>
        </fieldset>

        {mode === "ends_at" ? (
          <DateTimeField
            id={fieldId}
            value={endsAt}
            placeholder={endsPlaceholder}
            disabled={disabled}
            onChange={(local) => {
              setEndsAt(local);
              emitFromEnds(local);
            }}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
            <Input
              id={fieldId}
              type="number"
              min={1}
              step="any"
              inputMode="decimal"
              value={amount}
              placeholder={lengthPlaceholder}
              disabled={disabled}
              aria-invalid={showError ? true : undefined}
              onChange={(e) => {
                const next = e.target.value;
                setAmount(next);
                emitFromLength(next, unit);
              }}
            />
            <div>
              <label htmlFor={`${idPrefix}-arena-duration-unit`} className="sr-only">
                {unitLabelText}
              </label>
              <Select
                value={unit}
                onValueChange={(v) => {
                  if (!ARENA_DURATION_UNITS.includes(v as ArenaDurationUnit)) return;
                  const next = v as ArenaDurationUnit;
                  setUnit(next);
                  emitFromLength(amount, next);
                }}
                disabled={disabled}
              >
                <SelectTrigger id={`${idPrefix}-arena-duration-unit`} aria-label={unitLabelText}>
                  <SelectValue placeholder={unitLabelText} />
                </SelectTrigger>
                <SelectContent>
                  {ARENA_DURATION_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {unitLabel(chrome, u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
