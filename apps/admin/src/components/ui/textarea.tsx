import { cn } from "@/lib/utils";
import * as React from "react";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)] px-3 py-2 text-sm text-[var(--dama-text)] placeholder:text-[var(--dama-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
