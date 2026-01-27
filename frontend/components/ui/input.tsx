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
					"flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",

					// Size
					sizeStyles[inputSize],

					// Icon padding
					startIcon && "pl-10",
					endIcon && "pr-10",

					error && "border-destructive focus-visible:ring-destructive",

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
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
						{startIcon}
					</div>
				)}
				{inputElement}
				{endIcon && (
					<div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
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
					"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
					error && "border-destructive focus-visible:ring-destructive",
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
					"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
					className
				)}
				{...props}
			>
				{children}
				{required && (
					<span className="ml-0.5 text-destructive" aria-hidden="true">
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
			className={cn("text-xs text-muted-foreground mt-1.5", className)}
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
				"text-xs text-destructive mt-1.5",
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
