/** Reusable Button component with polymorphic rendering support */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
	size?: "sm" | "md" | "lg" | "icon";
	/**
	 * When true, button renders as a Slot, passing props to child element.
	 * Useful for wrapping Link or other components with button styling.
	 */
	asChild?: boolean;
}

/**
 * Button component with variant styling and polymorphic rendering.
 *
 * @example
 * // Standard button
 * <Button variant="primary">Click me</Button>
 *
 * @example
 * // Button as Link
 * <Button asChild variant="ghost">
 *   <Link href="/page">Navigate</Link>
 * </Button>
 */
export function Button({
	variant = "primary",
	size = "md",
	asChild = false,
	className = "",
	children,
	disabled,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";

	const baseStyles =
		"inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

	const variants = {
		primary:
			"bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700",
		secondary:
			"bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
		danger:
			"bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700",
		ghost:
			"bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800",
		outline:
			"border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800",
	};

	const sizes = {
		sm: "px-3 py-1.5 text-sm",
		md: "px-4 py-2",
		lg: "px-6 py-3 text-lg",
		icon: "h-9 w-9 p-0",
	};

	return (
		<Comp
			className={cn(baseStyles, variants[variant], sizes[size], className)}
			disabled={disabled}
			{...props}
		>
			{children}
		</Comp>
	);
}
