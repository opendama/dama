"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sanitizeIntegerInput } from "@/lib/sanitize-integer-input";
import { cn } from "@/lib/utils";
import * as React from "react";

export type PauseDurationUnit = "seconds" | "minutes";

function unitFromSeconds(sec: number): PauseDurationUnit {
  const n = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  if (n > 0 && n % 60 === 0) return "minutes";
  return "seconds";
}

function amountFromSeconds(sec: number, unit: PauseDurationUnit): string {
  const n = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  if (unit === "minutes") {
    const mins = Math.floor(n / 60);
    return mins > 0 ? String(mins) : "";
  }
  return n > 0 ? String(n) : "";
}

function toSeconds(amount: number, unit: PauseDurationUnit): number {
  if (!(amount > 0)) return 0;
  return unit === "minutes" ? amount * 60 : amount;
}

/**
 * Simple pause max duration: number + Seconds/Minutes unit.
 * Always persisted as total seconds (`match_clock.pause_duration_seconds`).
 */
export function PauseDurationField({
  id,
  valueSeconds,
  onChange,
  disabled,
  placeholder,
  unitAria,
  secondsLabel,
  minutesLabel,
  className,
}: {
  id?: string;
  /** Total pause length in seconds (DB). */
  valueSeconds: number;
  onChange: (totalSeconds: number) => void;
  disabled?: boolean;
  placeholder?: string;
  unitAria?: string;
  secondsLabel: string;
  minutesLabel: string;
  className?: string;
}) {
  const [unit, setUnit] = React.useState<PauseDurationUnit>(() => unitFromSeconds(valueSeconds));
  const [amount, setAmount] = React.useState(() =>
    amountFromSeconds(valueSeconds, unitFromSeconds(valueSeconds)),
  );
  const unitRef = React.useRef(unit);
  unitRef.current = unit;

  // Sync display from parent seconds without stealing the admin's Seconds/Minutes choice.
  // (e.g. typing 60s must stay "60" + Seconds - not flip to "1" + Minutes.)
  React.useEffect(() => {
    setAmount(amountFromSeconds(valueSeconds, unitRef.current));
  }, [valueSeconds]);

  const secLabel = (secondsLabel || "").trim();
  const minLabel = (minutesLabel || "").trim();

  return (
    <div className={cn("flex min-w-0 items-stretch gap-2", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={amount}
        placeholder={(placeholder || "").trim() || undefined}
        disabled={disabled}
        className="min-w-0 flex-1"
        onChange={(e) => {
          const next = sanitizeIntegerInput(e.target.value);
          setAmount(next);
          const n = Number(next);
          if (!next.trim() || !Number.isFinite(n) || n <= 0) {
            onChange(0);
            return;
          }
          onChange(toSeconds(Math.floor(n), unit));
        }}
      />
      <Select
        value={unit}
        disabled={disabled || !secLabel || !minLabel}
        onValueChange={(v) => {
          const nextUnit = v === "minutes" ? "minutes" : "seconds";
          const n = Number(amount);
          setUnit(nextUnit);
          if (!amount.trim() || !Number.isFinite(n) || n <= 0) {
            onChange(0);
            return;
          }
          onChange(toSeconds(Math.floor(n), nextUnit));
        }}
      >
        <SelectTrigger
          className="w-[7.5rem] shrink-0"
          aria-label={(unitAria || "").trim() || undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {secLabel ? <SelectItem value="seconds">{secLabel}</SelectItem> : null}
          {minLabel ? <SelectItem value="minutes">{minLabel}</SelectItem> : null}
        </SelectContent>
      </Select>
    </div>
  );
}
