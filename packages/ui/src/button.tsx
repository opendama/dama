import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand,#a31d38)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--dama-cta-bg)] text-[var(--dama-cta-fg)] hover:bg-[var(--dama-cta-bg-hover)]",
        gold: "bg-[var(--dama-cta-bg,#a31d38)] text-[var(--dama-cta-fg,#ffffff)] hover:bg-[var(--dama-cta-bg-hover,#800020)] font-semibold",
        outline:
          "border border-[var(--dama-border)] bg-transparent text-[var(--dama-text)] hover:bg-[var(--dama-card)]",
        ghost: "hover:bg-[var(--dama-card)] text-[var(--dama-text)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
