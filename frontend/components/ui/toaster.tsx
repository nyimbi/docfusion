"use client";

/**
 * Toast Toaster Component - DocFusion Design System
 *
 * Re-exports sonner Toaster for backward compatibility.
 * This allows imports from "@/components/ui/toaster" to work.
 */

export { Toaster } from "./sonner";

/**
 * Toast type for compatibility.
 */
export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
}
