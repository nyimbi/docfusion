/**
 * Button Component - DocFusion Design System
 *
 * A refined, accessible button with tactile micro-interactions
 * and the Neo-Editorial aesthetic.
 */

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Visual style variant */
	variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "accent";
	/** Size preset */
	size?: "sm" | "md" | "lg" | "icon";
	/**
	 * When true, button renders as a Slot, passing props to child element.
	 * Useful for wrapping Link or other components with button styling.
	 */
	asChild?: boolean;
	/** Show loading spinner */
	isLoading?: boolean;
}

/**
 * Button component with variant styling and polymorphic rendering.
 *
 * @example
 * // Primary action button
 * <Button variant="primary">Save Document</Button>
 *
 * @example
 * // Button as Link with ghost styling
 * <Button asChild variant="ghost">
 *   <Link href="/documents">View All</Link>
 * </Button>
 *
 * @example
 * // Loading state
 * <Button isLoading>Saving...</Button>
 */
export function Button({
	variant = "primary",
	size = "md",
	asChild = false,
	isLoading = false,
	className,
	children,
	disabled,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			className={cn(
				// Base styles
				"relative inline-flex items-center justify-center font-medium",
				"transition-all duration-[var(--transition-base)]",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
				// Active state press effect
				"active:scale-[0.98]",

				// Variant styles
				variant === "primary" && [
					"bg-[var(--ink-900)] text-[var(--paper-white)]",
					"hover:bg-[var(--ink-800)]",
					"shadow-[var(--shadow-sm)]",
					"hover:shadow-[var(--shadow-md)]",
					"dark:bg-[var(--ink-100)] dark:text-[var(--ink-900)]",
					"dark:hover:bg-[var(--ink-200)]",
				],
				variant === "secondary" && [
					"bg-[var(--background-muted)] text-[var(--foreground)]",
					"hover:bg-[var(--ink-100)]",
					"dark:hover:bg-[var(--ink-700)]",
				],
				variant === "ghost" && [
					"bg-transparent text-[var(--foreground)]",
					"hover:bg-[var(--background-muted)]",
				],
				variant === "outline" && [
					"bg-transparent text-[var(--foreground)]",
					"border border-[var(--border-strong)]",
					"hover:bg-[var(--background-subtle)]",
					"hover:border-[var(--ink-300)]",
				],
				variant === "danger" && [
					"bg-[var(--error-500)] text-white",
					"hover:bg-[#8a3f3f]",
					"shadow-[var(--shadow-sm)]",
				],
				variant === "accent" && [
					"bg-[var(--accent-500)] text-white",
					"hover:bg-[var(--accent-600)]",
					"shadow-[var(--shadow-sm)]",
					"hover:shadow-[var(--shadow-md)]",
				],

				// Size styles
				size === "sm" && "h-8 px-3 text-sm rounded-[var(--radius-md)] gap-1.5",
				size === "md" && "h-10 px-4 text-sm rounded-[var(--radius-md)] gap-2",
				size === "lg" && "h-12 px-6 text-base rounded-[var(--radius-lg)] gap-2.5",
				size === "icon" && "h-9 w-9 rounded-[var(--radius-md)]",

				className
			)}
			disabled={disabled || isLoading}
			{...props}
		>
			{/* When asChild is true, pass children directly - Slot expects a single child */}
			{asChild ? (
				children
			) : (
				<>
					{isLoading && (
						<svg
							className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
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
					)}
					<span className={cn(isLoading && "invisible")}>{children}</span>
				</>
			)}
		</Comp>
	);
}

/**
 * Icon-only button wrapper for consistent icon button styling.
 */
export function IconButton({
	className,
	children,
	...props
}: Omit<ButtonProps, "size">) {
	return (
		<Button
			size="icon"
			variant="ghost"
			className={cn(
				"text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
				className
			)}
			{...props}
		>
			{children}
		</Button>
	);
}
