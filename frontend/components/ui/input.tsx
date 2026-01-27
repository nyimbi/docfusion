/**
 * Input Components - DocFusion Design System
 *
 * Form input elements with refined aesthetics and
 * thoughtful micro-interactions following Neo-Editorial style.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {
	/** Error state styling */
	error?: boolean;
	/** Left-side icon or element */
	startIcon?: React.ReactNode;
	/** Right-side icon or element */
	endIcon?: React.ReactNode;
	/** Size variant */
	inputSize?: "sm" | "md" | "lg";
}

/**
 * Input component with support for icons and error states.
 *
 * @example
 * <Input placeholder="Enter your email" type="email" />
 *
 * @example
 * <Input
 *   placeholder="Search..."
 *   startIcon={<SearchIcon className="h-4 w-4" />}
 * />
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
	(
		{
			className,
			type,
			error,
			startIcon,
			endIcon,
			inputSize = "md",
			...props
		},
		ref
	) => {
		const hasIcon = startIcon || endIcon;

		const sizeStyles = {
			sm: "h-8 text-sm px-2.5",
			md: "h-10 text-sm px-3",
			lg: "h-12 text-base px-4",
		};

		const inputElement = (
			<input
				type={type}
				className={cn(
					// Base styles
					"flex w-full rounded-[var(--radius-md)]",
					"border bg-[var(--background)]",
					"text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]",
					"transition-all duration-[var(--transition-fast)]",

					// Focus states
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1",
					"focus-visible:border-[var(--accent-400)]",

					// Disabled state
					"disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--background-muted)]",

					// File input styles
					"file:border-0 file:bg-transparent file:text-sm file:font-medium",
					"file:text-[var(--foreground-muted)]",

					// Error state
					error
						? "border-[var(--error-500)] focus-visible:ring-[var(--error-500)]"
						: "border-[var(--border-strong)] hover:border-[var(--ink-300)]",

					// Size
					sizeStyles[inputSize],

					// Icon padding
					startIcon && "pl-10",
					endIcon && "pr-10",

					className
				)}
				ref={ref}
				aria-invalid={error || undefined}
				{...props}
			/>
		);

		if (!hasIcon) {
			return inputElement;
		}

		return (
			<div className="relative">
				{startIcon && (
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--foreground-subtle)]">
						{startIcon}
					</div>
				)}
				{inputElement}
				{endIcon && (
					<div className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--foreground-subtle)]">
						{endIcon}
					</div>
				)}
			</div>
		);
	}
);
Input.displayName = "Input";

/**
 * Textarea component with consistent styling.
 */
export interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, error, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					// Base styles
					"flex min-h-[120px] w-full rounded-[var(--radius-md)]",
					"border bg-[var(--background)] px-3 py-2.5 text-sm",
					"text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]",
					"transition-all duration-[var(--transition-fast)]",

					// Focus states
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1",
					"focus-visible:border-[var(--accent-400)]",

					// Disabled state
					"disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--background-muted)]",

					// Resize behavior
					"resize-y",

					// Error state
					error
						? "border-[var(--error-500)] focus-visible:ring-[var(--error-500)]"
						: "border-[var(--border-strong)] hover:border-[var(--ink-300)]",

					className
				)}
				ref={ref}
				aria-invalid={error || undefined}
				{...props}
			/>
		);
	}
);
Textarea.displayName = "Textarea";

/**
 * Label component for form fields.
 */
export interface LabelProps
	extends React.LabelHTMLAttributes<HTMLLabelElement> {
	required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
	({ className, required, children, ...props }, ref) => {
		return (
			<label
				ref={ref}
				className={cn(
					"text-sm font-medium text-[var(--foreground)]",
					"peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
					className
				)}
				{...props}
			>
				{children}
				{required && (
					<span className="ml-0.5 text-[var(--error-500)]" aria-hidden="true">
						*
					</span>
				)}
			</label>
		);
	}
);
Label.displayName = "Label";

/**
 * Input description/help text component.
 */
function InputDescription({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-xs text-[var(--foreground-muted)] mt-1.5", className)}
			{...props}
		>
			{children}
		</p>
	);
}

/**
 * Input error message component.
 */
function InputError({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn(
				"text-xs text-[var(--error-500)] mt-1.5",
				"flex items-center gap-1",
				className
			)}
			role="alert"
			{...props}
		>
			<svg
				className="h-3 w-3 flex-shrink-0"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				<path
					fillRule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
					clipRule="evenodd"
				/>
			</svg>
			{children}
		</p>
	);
}

/**
 * Field group wrapper for consistent form field layouts.
 */
function FormField({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("space-y-2", className)} {...props}>
			{children}
		</div>
	);
}

export {
	Input,
	Textarea,
	Label,
	InputDescription,
	InputError,
	FormField,
};
