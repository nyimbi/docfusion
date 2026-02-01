/**
 * Toast hook for displaying notifications.
 *
 * Wraps sonner toast functionality with a simpler API
 * consistent with other project hooks.
 */

import { toast as sonnerToast } from "sonner";

/**
 * Options for toast notifications.
 */
export interface ToastOptions {
  /** Duration in milliseconds (default: 4000) */
  duration?: number;
  /** Toast variant/type */
  variant?: "default" | "success" | "error" | "warning" | "info";
  /** Custom action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
}

/**
 * Hook for displaying toast notifications.
 *
 * @returns Object with toast function
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 *
 * toast.success("Item saved");
 * toast.error("Something went wrong");
 * toast("Default message");
 * ```
 */
export function useToast() {
  const toast = (message: string, options?: ToastOptions) => {
    const { variant = "default", duration, action, onDismiss } = options || {};

    const toastOptions = {
      duration,
      action,
      onDismiss,
    };

    switch (variant) {
      case "success":
        return sonnerToast.success(message, toastOptions);
      case "error":
        return sonnerToast.error(message, toastOptions);
      case "warning":
        return sonnerToast.warning(message, toastOptions);
      case "info":
        return sonnerToast.info(message, toastOptions);
      default:
        return sonnerToast(message, toastOptions);
    }
  };

  return { toast };
}

/**
 * Direct toast functions for use outside of components.
 */
export const toast = {
  success: (message: string, options?: Omit<ToastOptions, "variant">) =>
    sonnerToast.success(message, options),
  error: (message: string, options?: Omit<ToastOptions, "variant">) =>
    sonnerToast.error(message, options),
  warning: (message: string, options?: Omit<ToastOptions, "variant">) =>
    sonnerToast.warning(message, options),
  info: (message: string, options?: Omit<ToastOptions, "variant">) =>
    sonnerToast.info(message, options),
  default: (message: string, options?: Omit<ToastOptions, "variant">) =>
    sonnerToast(message, options),
};
