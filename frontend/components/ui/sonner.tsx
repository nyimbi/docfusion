"use client";

/**
 * Sonner Toast Component - DocFusion Design System
 *
 * Elegant toast notifications using the sonner library.
 * Clean, minimal design with smooth animations.
 */

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Props for the Toaster component.
 */
interface ToasterProps {
  /** Additional class names */
  className?: string;
  /** Position of the toasts */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  /** Gap between toasts */
  gap?: number;
  /** Offset from edges */
  offset?: string;
  /** Duration to show toast in milliseconds */
  duration?: number;
  /** Rich colors for different toast types */
  richColors?: boolean;
  /** Show close button */
  closeButton?: boolean;
}

/**
 * Toast notification provider using Sonner.
 *
 * Place this component at the root of your app to enable toast notifications.
 *
 * @example
 * // In layout.tsx:
 * <Toaster position="bottom-right" />
 *
 * // Usage anywhere:
 * toast.success("Document saved!");
 * toast.error("Failed to save");
 * toast.info("New version available");
 */
function Toaster({
  className,
  position = "bottom-right",
  gap = 16,
  offset = "32px",
  duration = 4000,
  richColors = true,
  closeButton = true,
  ...props
}: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      className={cn("toaster group", className)}
      gap={gap}
      offset={offset}
      position={position}
      duration={duration}
      richColors={richColors}
      closeButton={closeButton}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast",
            "flex w-full items-center gap-3 rounded-lg border p-4 pr-8 shadow-lg",
            "bg-white dark:bg-gray-950",
            "border-gray-200 dark:border-gray-800",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[swipe=end]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
            "data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-left-full"
          ),
          title: cn("text-sm font-medium text-gray-900 dark:text-gray-100"),
          description: cn("text-sm text-gray-500 dark:text-gray-400"),
          actionButton: cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium",
            "h-8 px-3 bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors"
          ),
          cancelButton: cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium",
            "h-8 px-3 bg-gray-100 text-gray-700",
            "hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300",
            "transition-colors"
          ),
          closeButton: cn(
            "absolute right-2 top-2 rounded-md p-1",
            "text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          ),
          error: cn(
            "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
            "[&>svg]:text-red-600 dark:[&>svg]:text-red-400"
          ),
          success: cn(
            "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
            "[&>svg]:text-green-600 dark:[&>svg]:text-green-400"
          ),
          warning: cn(
            "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
            "[&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400"
          ),
          info: cn(
            "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
            "[&>svg]:text-blue-600 dark:[&>svg]:text-blue-400"
          ),
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
