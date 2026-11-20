"use client";

import {
  isRadixSelectPortalTarget,
  releaseBodyPointerEvents,
} from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[var(--dama-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "left" | "right";
    /** DB chrome close aria; omit X when blank (fail closed). */
    closeLabel?: string;
  }
>(
  (
    {
      side = "left",
      className,
      children,
      closeLabel,
      onCloseAutoFocus,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    React.useEffect(() => {
      return () => {
        releaseBodyPointerEvents();
      };
    }, []);

    const closeAria = (closeLabel || "").trim();

    return (
      <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed z-50 flex h-full w-[min(100%,20rem)] flex-col border-[var(--dama-border)] bg-[var(--dama-panel)] shadow-[var(--dama-float-shadow)] outline-none transition ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
            side === "left" &&
              "inset-y-0 left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            side === "right" &&
              "inset-y-0 right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            className,
          )}
          {...props}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            releaseBodyPointerEvents();
            onCloseAutoFocus?.(e);
          }}
          onPointerDownOutside={(e) => {
            if (isRadixSelectPortalTarget(e.target)) {
              e.preventDefault();
              return;
            }
            onPointerDownOutside?.(e);
          }}
          onInteractOutside={(e) => {
            if (isRadixSelectPortalTarget(e.target)) {
              e.preventDefault();
              return;
            }
            onInteractOutside?.(e);
          }}
        >
          {children}
          <DialogPrimitive.Close
            className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-md p-1.5 text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
            {...(closeAria
              ? { "aria-label": closeAria }
              : { "aria-hidden": true as const, tabIndex: -1 })}
          >
            <X className="h-4 w-4" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-[var(--dama-border)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("pr-8 font-display text-lg font-bold text-[var(--dama-text)]", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
};
