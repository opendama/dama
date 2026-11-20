import { cn } from "@/lib/utils";
import * as React from "react";

/** Trim-parity text control: muted placeholders, focus ring, dama tokens. */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--dama-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)] disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-[var(--dama-danger)] aria-[invalid=true]:focus-visible:ring-[var(--dama-danger)]",
          // Native date/time controls default to browser blue - pin to brand.
          "accent-[var(--dama-brand)] scheme-light dark:scheme-dark",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
