import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--dama-cta-bg)] text-[var(--dama-cta-fg)] hover:bg-[var(--dama-cta-bg-hover)]",
        gold: "bg-[var(--dama-cta-bg)] text-[var(--dama-cta-fg)] hover:bg-[var(--dama-cta-bg-hover)] font-semibold",
        play: "bg-[var(--dama-brand)] text-white hover:bg-[var(--dama-brand-end)] font-semibold",
        brand:
          "bg-[image:var(--dama-brand-gradient)] text-white hover:brightness-110 font-semibold",
        outline:
          "border border-[var(--dama-border)] bg-transparent text-[var(--dama-text)] hover:bg-[var(--dama-card)]",
        destructive: "bg-[var(--dama-danger)] text-white hover:opacity-90",
        ghost: "hover:bg-[var(--dama-card)] text-[var(--dama-text)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** When true, disables the control and shows pendingLabel with spinner (Trim). */
  isLoading?: boolean;
  /**
   * Action-aware pending copy from API chrome (e.g. Saving… / Updating… / Deleting…).
   * Required when isLoading is true - never invent from idle children.
   */
  pendingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      pendingLabel,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const pendingText = pendingLabel?.trim() || "";
    const showPending = isLoading && !asChild;

    if (process.env.NODE_ENV !== "production" && isLoading && !asChild && !pendingText) {
      console.error(
        "Button: isLoading requires pendingLabel from the API (never invent idle children).",
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {showPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {pendingText || null}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
