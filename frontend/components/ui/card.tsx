/**
 * Card Component - DocFusion Design System
 *
 * An elegant card surface with subtle depth and
 * refined hover interactions following Neo-Editorial aesthetic.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Add hover lift effect */
	interactive?: boolean;
	/** Padding size preset */
	padding?: "none" | "sm" | "md" | "lg";
}

/**
 * Card component providing a contained surface for grouping related content.
 * Follows the compound component pattern for maximum flexibility.
 *
 * @example
 * <Card interactive>
 *   <CardHeader>
 *     <CardTitle>Document</CardTitle>
 *     <CardDescription>Last edited 2 hours ago</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Document content preview...</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Open</Button>
 *   </CardFooter>
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
	({ className, interactive = false, padding, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				// Base styles
				"rounded-[var(--radius-lg)] border border-[var(--border)]",
				"bg-[var(--background)] text-[var(--foreground)]",
				"shadow-[var(--shadow-xs)]",
				"transition-all duration-[var(--transition-base)]",

				// Interactive hover state
				interactive && [
					"cursor-pointer",
					"hover:shadow-[var(--shadow-md)]",
					"hover:border-[var(--border-strong)]",
					"hover:-translate-y-0.5",
				],

				className
			)}
			{...props}
		/>
	)
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col gap-1.5 p-5 pb-0", className)}
		{...props}
	/>
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn(
			"font-semibold leading-tight tracking-tight text-[var(--foreground)]",
			className
		)}
		{...props}
	/>
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn("text-sm text-[var(--foreground-muted)]", className)}
		{...props}
	/>
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("p-5 pt-3", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex items-center px-5 pb-5 pt-0",
			"border-t border-[var(--border)] mt-auto",
			className
		)}
		{...props}
	/>
));
CardFooter.displayName = "CardFooter";

/**
 * A simple horizontal divider for card content.
 */
const CardDivider = React.forwardRef<
	HTMLHRElement,
	React.HTMLAttributes<HTMLHRElement>
>(({ className, ...props }, ref) => (
	<hr
		ref={ref}
		className={cn("border-t border-[var(--border)] mx-5 my-0", className)}
		{...props}
	/>
));
CardDivider.displayName = "CardDivider";

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
	CardDivider,
};
