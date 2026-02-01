"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Input Component
// ============================================================================

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

// ============================================================================
// Label Component
// ============================================================================

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  )
);
Label.displayName = "Label";

// ============================================================================
// Textarea Component
// ============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// ============================================================================
// Input Description Component
// ============================================================================

export interface InputDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const InputDescription = React.forwardRef<HTMLParagraphElement, InputDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
);
InputDescription.displayName = "InputDescription";

// ============================================================================
// Input Error Component
// ============================================================================

export interface InputErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const InputError = React.forwardRef<HTMLParagraphElement, InputErrorProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-destructive flex items-center gap-1", className)}
      {...props}
    >
      {children}
    </p>
  )
);
InputError.displayName = "InputError";

type InputErrorType = typeof InputError;
