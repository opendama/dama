"use client";

import {
  isRadixSelectPortalTarget,
  releaseBodyPointerEvents,
} from "@/hooks/use-deferred-dialog-selection";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[220] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** Boolean prop marker so DialogContent can pin footers when Next client proxies break type ===. */
export const DIALOG_FOOTER_PROP = "damaDialogFooter" as const;

type DialogFooterProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Always pass true from call sites that need sticky pin extraction. */
  damaDialogFooter?: boolean;
};

function DialogFooter({ className, damaDialogFooter: _pin, ...props }: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // sticky bottom-0 = Smart Menu safety net if footer lands inside the scroll body;
        // also fine when pinned outside scroll.
        "sticky bottom-0 z-[5] flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--dama-border)] bg-[var(--dama-card)] px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

function isDialogFooterElement(
  node: React.ReactNode,
): node is React.ReactElement<DialogFooterProps> {
  if (!React.isValidElement(node)) return false;
  if (node.type === DialogFooter) return true;
  const props = node.props as DialogFooterProps;
  // Explicit boolean marker from call sites (survives client-proxy type identity loss).
  if (props?.damaDialogFooter === true) return true;
  if ((props as Record<string, unknown>)?.["data-dama-dialog-footer"] !== undefined) return true;
  const t = node.type as { displayName?: string };
  return t?.displayName === "DialogFooter";
}

const REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");

function isReactFragmentElement(node: React.ReactElement): boolean {
  // Runtime may be Symbol.for("react.fragment"); cast avoids TS unique-symbol overlap error.
  const t = node.type as unknown;
  return t === React.Fragment || t === REACT_FRAGMENT_TYPE;
}

/**
 * Flatten fragments (and arrays) so DialogFooter nested in <>...</> is still extractable.
 * Path-based keys are required: React.Children.toArray() assigns ".0"/".1" per fragment,
 * so splicing multiple fragments into one list collides on the same key (duplicate ".0").
 */
function flattenDialogChildren(nodes: React.ReactNode, path = "dlg"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  React.Children.forEach(nodes, (node, index) => {
    if (node == null || typeof node === "boolean") return;
    const childPath = `${path}.${index}`;
    if (Array.isArray(node)) {
      out.push(...flattenDialogChildren(node, childPath));
      return;
    }
    if (React.isValidElement(node) && isReactFragmentElement(node)) {
      out.push(
        ...flattenDialogChildren(
          (node.props as { children?: React.ReactNode }).children,
          childPath,
        ),
      );
      return;
    }
    if (React.isValidElement(node)) {
      out.push(React.cloneElement(node, { key: childPath }));
      return;
    }
    out.push(node);
  });
  return out;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Accessible label for the close control (Sheet pattern). */
    closeLabel?: string;
  }
>(
  (
    {
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
    const childList = flattenDialogChildren(React.Children.toArray(children));
    const footers = childList.filter(isDialogFooterElement);
    const body = childList.filter((child) => !isDialogFooterElement(child));

    React.useEffect(() => {
      return () => {
        releaseBodyPointerEvents();
      };
    }, []);

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            // Cap height; scroll body; pin footers. Slide-from-* keeps translate while zoom runs
            // (plain -translate-x/y is overwritten by zoom transform - modal stuck in a corner).
            "fixed left-[50%] top-[50%] z-[221] flex w-full max-w-lg max-h-[min(90dvh,56rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-0 text-[var(--dama-text)] shadow-[var(--dama-float-shadow)] outline-none duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
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
            // Keep Dialog open when interacting with portaled calendar/Select layers.
            if (isRadixSelectPortalTarget(e.target)) {
              e.preventDefault();
              return;
            }
            onInteractOutside?.(e);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pr-12">
              <div className="grid gap-4">{body}</div>
            </div>
            {footers}
          </div>
          <DialogPrimitive.Close
            className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-[var(--dama-muted)] transition-colors hover:bg-[var(--dama-hover)] hover:text-[var(--dama-text)]"
            {...((closeLabel || "").trim()
              ? { "aria-label": (closeLabel || "").trim() }
              : { "aria-hidden": true as const, tabIndex: -1 })}
          >
            <X className="h-4 w-4" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "font-display text-xl font-bold tracking-tight text-[var(--dama-text)]",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-[var(--dama-muted)]", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
