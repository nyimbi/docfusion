/**
 * Separator Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * Visual divider for separating content horizontally or vertically.
 */

"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export interface SeparatorProps
	extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
	/** Orientation of the separator */
	orientation?: "horizontal" | "vertical";
	/** Decorative separator (no semantic meaning) */
	decorative?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Separator component for visual content division.
 *
 * Uses Radix UI Separator for accessibility and semantic correctness.
 *
 * @example
 * // Horizontal separator (default)
 * <div className="space-y-4">
 *   <p>Content above</p>
 *   <Separator />
 *   <p>Content below</p>
 * </div>
 *
 * // Vertical separator
 * <div className="flex h-5 items-center space-x-4">
 *   <p>Left content</p>
 *   <Separator orientation="vertical" />
 *   <p>Right content</p>
 * </div>
 */
const Separator = React.forwardRef<
	React.ElementRef<typeof SeparatorPrimitive.Root>,
	SeparatorProps
>(
	function Separator(
		{
			className,
			orientation = "horizontal",
			decorative = true,
			...props
		},
		ref
	) {
		return (
			<SeparatorPrimitive.Root
				ref={ref}
				decorative={decorative}
				orientation={orientation}
				className={cn(
					"shrink-0 bg-border",
					orientation === "horizontal"
						? "h-[1px] w-full"
						: "h-full w-[1px]",
					className
				)}
				{...props}
			/>
		);
	}
);

Separator.displayName = "Separator";

export { Separator };
