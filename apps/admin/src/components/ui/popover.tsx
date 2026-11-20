"use client";

import {
  isRadixSelectPortalTarget,
  releaseBodyPointerEvents,
} from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

/**
 * Default modal={false} for lightweight panels.
 * DateField / DateRangePicker pass modal explicitly for Dialog nesting.
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
          collisionPadding={12}
          className={cn(
            // Above Dialog (220/221). pointer-events-auto for nested calendar in modals.
            "pointer-events-auto z-[240] w-72 rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] p-4 text-[var(--dama-text)] shadow-md outline-none",
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
