"use client";

import { Input } from "@/components/ui/input";
import { sanitizeDecimalInput } from "@/lib/sanitize-decimal-input";
import * as React from "react";

type AmountInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string;
  onValueChange: (next: string) => void;
  /** Max digits after the decimal point (money default 2). */
  maxDecimals?: number;
};

const NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/**
 * Trim-parity money field: digits + one decimal only.
 * Blocks letters at keydown/beforeinput/paste; state is always sanitized.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onValueChange, maxDecimals = 2, onKeyDown, onPaste, onBeforeInput, ...props }, ref) => {
    const apply = (raw: string) => onValueChange(sanitizeDecimalInput(raw, maxDecimals));

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => apply(e.target.value)}
        onBeforeInput={(e) => {
          onBeforeInput?.(e);
          if (e.defaultPrevented) return;
          const data = (e.nativeEvent as InputEvent).data;
          if (data && /[^\d.]/.test(data)) e.preventDefault();
        }}
        onPaste={(e) => {
          onPaste?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          apply(e.clipboardData.getData("text"));
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (NAV_KEYS.has(e.key)) return;
          if (e.key === "." || e.key === ",") {
            if (value.includes(".")) e.preventDefault();
            return;
          }
          if (!/^\d$/.test(e.key)) e.preventDefault();
        }}
        {...props}
      />
    );
  },
);
AmountInput.displayName = "AmountInput";
