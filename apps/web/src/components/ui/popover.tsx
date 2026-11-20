"use client";

import {
  isRadixSelectPortalTarget,
  releaseBodyPointerEvents,
} from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

/**
 * Default modal={false} for lightweight hover/profile cards.
 * DateField / DateTimeField / DateRangePicker pass modal explicitly so calendars
 * remain interactive inside Dialog (Radix dismissable-layer nesting).
 */
function Popover({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root modal={modal} {...props} />;
}
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

type PopoverContentProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
  /**
   * When true (default), ignore outside clicks on portaled Select/Menu/Popover layers
   * so nested pickers stay open. Nested time popovers set false so calendar clicks dismiss them.
   */
  guardPortaledDismiss?: boolean;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(
  (
    {
      className,
      align = "center",
      sideOffset = 4,
      collisionPadding = 16,
      guardPortaledDismiss = true,
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

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          data-slot="popover-content"
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(
            // Above Dialog overlay/content (220/221). pointer-events-auto so the calendar
            // stays clickable while Dialog sets body { pointer-events: none }.
            "dama-float pointer-events-auto z-[240] w-[min(calc(100vw-1.5rem),22rem)] overflow-visible rounded-md border border-[var(--dama-border-strong)] bg-[var(--dama-panel)] p-4 text-[var(--dama-text)] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
          {...props}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            releaseBodyPointerEvents();
            onCloseAutoFocus?.(e);
          }}
          onPointerDownOutside={(e) => {
            if (guardPortaledDismiss && isRadixSelectPortalTarget(e.target)) {
              e.preventDefault();
            }
            onPointerDownOutside?.(e);
          }}
          onInteractOutside={(e) => {
            if (guardPortaledDismiss && isRadixSelectPortalTarget(e.target)) {
              e.preventDefault();
            }
            onInteractOutside?.(e);
          }}
        />
      </PopoverPrimitive.Portal>
    );
  },
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
