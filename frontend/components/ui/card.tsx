/**
 * Card Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * An elegant card surface with warm paper tones, subtle depth,
 * and refined hover interactions. Follows compound component pattern
 * for maximum flexibility.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Visual variant style */
	variant?: "default" | "elevated" | "outlined" | "ghost";
	/** Enable hover lift effect and cursor pointer */
	interactive?: boolean;
	/** Disable hover effects */
	noHover?: boolean;
}

/**
 * Card component providing a contained surface for grouping related content.
 * 
 * Uses compound component pattern:
 * - Card (container)
 * - CardHeader (header section)
 * - CardTitle (title text)
 * - CardDescription (subtitle/description)
 * - CardContent (main content)
 * - CardFooter (footer section)
 * - CardDivider (horizontal divider)
 *
 * @example
 * <Card interactive variant="elevated">
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
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
	function Card(
		{ className, interactive = false, variant = "default", noHover = false, ...props },
		ref
	) {
	// Memoize classes to prevent re-computation
	const cardClasses = React.useMemo(
		() =>
			cn(
				// Base styles - consistent with .card-base
				"rounded-xl text-card-foreground",
				"transition-all duration-200 ease-out",
				"border",

				// Variant styles
				variant === "default" && [
					"bg-card border-border shadow-sm",
					!noHover && "hover:shadow-md",
				],
				variant === "elevated" && [
					"bg-card border-border shadow-md",
					!noHover && "hover:shadow-lg",
				],
				variant === "outlined" && [
					"bg-transparent border-border",
				],
				variant === "ghost" && [
					"bg-transparent border-transparent",
				],

				// Interactive hover effects
				interactive && !noHover && [
					"cursor-pointer",
					"hover:border-border-strong",
					"hover:-translate-y-0.5",
					"active:translate-y-0",
					"active:shadow-md",
				],

				className
			),
		[variant, interactive, noHover, className]
	);

	return <div ref={ref} className={cardClasses} {...props} />;
}
);

Card.displayName = "Card";

/**
 * Card header section containing title and description.
 * Typically the first child of a Card.
 */
export const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, ...props }, ref) {
	return (
		<div
			ref={ref}
			className={cn("flex flex-col gap-1.5 p-6 pb-0", className)}
			{...props}
		/>
	);
});

CardHeader.displayName = "CardHeader";

/**
 * Card title - displays the main heading.
 * Typically placed inside CardHeader.
 */
export const CardTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, children, ...props }, ref) {
	return (
		<h3
			ref={ref}
			className={cn(
				"font-display font-semibold leading-tight tracking-tight",
				"text-foreground text-lg",
				className
			)}
			{...props}
		>
			{children}
		</h3>
	);
});

CardTitle.displayName = "CardTitle";

/**
 * Card description - displays subtitle or metadata.
 * Typically placed inside CardHeader below CardTitle.
 */
export const CardDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, children, ...props }, ref) {
	return (
		<p
			ref={ref}
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		>
			{children}
		</p>
	);
});

CardDescription.displayName = "CardDescription";

/**
 * Card content - main content area.
 * Typically placed after CardHeader.
 */
export const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(function CardContent({ className, children, ...props }, ref) {
	return (
		<div
			ref={ref}
			className={cn("p-6 pt-4", className)}
			{...props}
		>
			{children}
		</div>
	);
});

CardContent.displayName = "CardContent";

/**
 * Card footer - contains actions or supplementary content.
 * Typically placed at the end of a Card.
 */
export const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(function CardFooter({ className, children, ...props }, ref) {
	return (
		<div
			ref={ref}
			className={cn(
				"flex items-center gap-3 px-6 pb-6",
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
});

CardFooter.displayName = "CardFooter";

/**
 * Horizontal divider for separating card content sections.
 * Typically placed between CardContent and CardFooter.
 */
export const CardDivider = React.forwardRef<
	HTMLHRElement,
	React.HTMLAttributes<HTMLHRElement>
>(function CardDivider({ className, ...props }, ref) {
	return (
		<hr
			ref={ref}
			className={cn("border-t border-border mx-6 my-0", className)}
			{...props}
		/>
	);
});

CardDivider.displayName = "CardDivider";
