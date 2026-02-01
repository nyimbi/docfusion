/**
 * Button Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * A refined, accessible button with tactile micro-interactions
 * and warm vermillion accents.
 */

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button variants using class-variance-authority for compatibility
 * with shadcn/ui component patterns.
 */
export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground shadow hover:bg-primary/90",
				destructive:
					"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
				outline:
					"border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
				secondary:
					"bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 rounded-md px-3 text-xs",
				lg: "h-10 rounded-md px-8",
				icon: "h-9 w-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Visual style variant - affects color scheme */
	variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "link";
	/** Size preset - affects padding and font size */
	size?: "sm" | "md" | "lg" | "icon";
	/**
	 * When true, button renders as a Slot, passing props to child element.
	 * Useful for wrapping Link or other components with button styling.
	 */
	asChild?: boolean;
	/** Show loading spinner and disable interaction */
	isLoading?: boolean;
	/** Only shows icon spinner when loading (no text) */
	loadingText?: string;
	/** Active/pressed state styling */
	active?: boolean;
}

/**
 * Button component with variant styling and polymorphic rendering.
 *
 * Uses compound composition for maximum flexibility while maintaining
 * consistent styling across the application.
 *
 * @example
 * // Primary action button
 * <Button variant="primary" size="lg">
 *   Save Document
 * </Button>
 *
 * // Button as Link with ghost styling
 * <Button asChild variant="ghost">
 *   <Link href="/documents">View All</Link>
 * </Button>
 *
 * // Loading state with custom text
 * <Button isLoading loadingText="Saving...">
 *   Save Changes
 * </Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{
			variant = "primary",
			size = "md",
			asChild = false,
			isLoading = false,
			active = false,
		loadingText,
			className,
			children,
			disabled,
			...props
		},
		ref
	) {
	const Comp = asChild ? Slot : "button";

	// Memoize classes to prevent re-computation on renders
	const buttonClasses = React.useMemo(
		() =>
			cn(
				// Base styles - consistent with .btn-base
				"inline-flex items-center justify-center gap-2",
				"font-medium whitespace-nowrap",
				"transition-all duration-150 ease-out",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				"disabled:pointer-events-none disabled:opacity-50",
				"active:scale-[0.98]",

				// Variant styles - mapped to design system
				variant === "primary" && [
					"bg-primary text-primary-foreground",
					"shadow-sm hover:shadow-md",
					"hover:bg-primary-hover",
				],
				variant === "secondary" && [
					"bg-secondary text-secondary-foreground",
					"border border-border",
					"shadow-sm hover:shadow-md",
					"hover:bg-secondary/80",
				],
				variant === "ghost" && [
					"text-foreground",
					"hover:bg-accent hover:text-accent-foreground",
					active && "bg-accent text-accent-foreground",
				],
				variant === "outline" && [
					"border border-border bg-transparent",
					"text-foreground shadow-sm",
					"hover:bg-accent hover:text-accent-foreground",
					active && "bg-accent text-accent-foreground",
					"hover:border-border-strong",
				],
				variant === "danger" && [
					"bg-destructive text-destructive-foreground",
					"shadow-sm hover:shadow-md",
					"hover:bg-destructive/90",
				],
				variant === "link" && [
					"text-primary underline-offset-4",
					"hover:underline",
					"h-auto p-1",
				],

				// Size styles
				size === "sm" && "h-8 px-3 text-sm rounded-md gap-1.5",
				size === "md" && "h-10 px-4 py-2 text-sm rounded-lg gap-2",
				size === "lg" && "h-12 px-6 text-base rounded-lg gap-2.5",
				size === "icon" && "h-10 w-10 rounded-lg",

				className
			),
		[variant, size, className]
	);

	// Loading spinner component
	const LoadingSpinner = React.useMemo(
		() => (
			<svg
				className="h-4 w-4 animate-spin"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle
					className="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="4"
				/>
				<path
					className="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		),
		[]
	);

	return (
		<Comp
			ref={ref}
			className={buttonClasses}
			disabled={disabled || isLoading}
			aria-disabled={disabled || isLoading}
			aria-busy={isLoading}
			{...props}
		>
			{asChild ? (
				children
			) : (
				<>
					{isLoading && LoadingSpinner}
					<span className={cn(isLoading && "invisible")}>
						{children}
					</span>
					{isLoading && loadingText && (
						<span className="sr-only">{loadingText}</span>
					)}
				</>
			)}
		</Comp>
	);
}
);

Button.displayName = "Button";

/**
 * Icon-only button wrapper for consistent icon button styling.
 *
 * @example
 * <IconButton
 *   onClick={handleClick}
 *   aria-label="Add item"
 * >
 *   <Plus className="h-5 w-5" />
 * </IconButton>
 */
export const IconButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "size">>(
	function IconButton({ className, children, ...props }, ref) {
	return (
		<Button
			ref={ref}
			size="icon"
			variant="ghost"
			className={cn(
				"text-muted-foreground hover:text-foreground",
				className
			)}
			{...props}
		>
			{children}
		</Button>
	);
}
);

IconButton.displayName = "IconButton";

/**
 * Button group for arranging related buttons together.
 *
 * @example
 * <ButtonGroup>
 *   <Button variant="primary">Save</Button>
 *   <Button variant="secondary">Cancel</Button>
 * </ButtonGroup>
 */
export function ButtonGroup({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"inline-flex items-center gap-2",
				className
			)}
		>
			{children}
		</div>
	);
}
