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
 *
 * @example
 * <Input
 *   error={!!errors.email}
 *   placeholder="Email"
 *   aria-invalid={!!errors.email}
 * />
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, error, startIcon, endIcon, ...props }, ref) => {
		const hasIcon = startIcon || endIcon;

		const inputElement = (
			<input
				type={type}
				className={cn(
					"flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm",
					"transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
					"placeholder:text-gray-500",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"dark:bg-gray-950 dark:placeholder:text-gray-400",
					error
						? "border-red-500 focus-visible:ring-red-500 dark:border-red-500"
						: "border-gray-200 focus-visible:ring-blue-500 dark:border-gray-800",
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
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">
						{startIcon}
					</div>
				)}
				{inputElement}
				{endIcon && (
					<div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400">
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
					"flex min-h-[80px] w-full rounded-lg border bg-white px-3 py-2 text-sm",
					"transition-colors placeholder:text-gray-500",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"dark:bg-gray-950 dark:placeholder:text-gray-400",
					error
						? "border-red-500 focus-visible:ring-red-500 dark:border-red-500"
						: "border-gray-200 focus-visible:ring-blue-500 dark:border-gray-800",
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
					"text-sm font-medium leading-none",
					"peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
					className
				)}
				{...props}
			>
				{children}
				{required && (
					<span className="ml-1 text-red-500" aria-hidden="true">
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
			className={cn(
				"text-xs text-gray-500 dark:text-gray-400",
				className
			)}
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
				"text-xs text-red-500 dark:text-red-400 mt-1",
				className
			)}
			role="alert"
			{...props}
		>
			{children}
		</p>
	);
}

export { Input, Textarea, Label, InputDescription, InputError };
