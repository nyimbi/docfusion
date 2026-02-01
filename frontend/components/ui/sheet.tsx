"use client";

/**
 * Sheet Component - DocFusion Design System
 *
 * Side panel that slides in from the edge of the screen.
 * Built on top of Radix UI Dialog primitives.
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Sheet variants for different slide-in positions.
 */
const sheetVariants = cva(
  cn(
    "fixed z-50 gap-4 bg-white p-6 shadow-lg transition ease-in-out",
    "dark:bg-gray-950",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:duration-300 data-[state=open]:duration-500"
  ),
  {
    variants: {
      side: {
        top: cn(
          "inset-x-0 top-0 border-b border-gray-200 dark:border-gray-800",
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top"
        ),
        bottom: cn(
          "inset-x-0 bottom-0 border-t border-gray-200 dark:border-gray-800",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        ),
        left: cn(
          "inset-y-0 left-0 h-full w-3/4 border-r border-gray-200 dark:border-gray-800",
          "sm:max-w-sm",
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
        ),
        right: cn(
          "inset-y-0 right-0 h-full w-3/4 border-l border-gray-200 dark:border-gray-800",
          "sm:max-w-sm",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        ),
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

/**
 * Sheet overlay/backdrop component.
 */
const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 transition-all duration-100",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Sheet content container.
 */
interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Whether to show the close button */
  showClose?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, showClose = true, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className={cn(
            "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity",
            "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2",
            "disabled:pointer-events-none",
            "dark:ring-offset-gray-950 dark:focus:ring-gray-300",
            "data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-gray-800"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Sheet header section.
 */
const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

/**
 * Sheet footer section.
 */
const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

/**
 * Sheet title element.
 */
const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold text-gray-900 dark:text-gray-100",
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * Sheet description element.
 */
const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

// Re-export Radix primitives with renamed aliases
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
