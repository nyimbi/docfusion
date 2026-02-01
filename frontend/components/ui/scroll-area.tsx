/**
 * Scroll Area Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * Customizable scrolling container with styled scrollbars
 * and smooth scrolling behavior.
 */

"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps
	extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
	/** Additional classes for the viewport */
	className?: string;
	/** Additional classes for the scrollbar */
	scrollbarClassName?: string;
	/** Content to be rendered inside the scrollable area */
	children: React.ReactNode;
}

/**
 * ScrollArea component providing custom styled scrollbars.
 *
 * Uses Radix UI ScrollArea primitives for accessibility and customization.
 *
 * @example
 * <ScrollArea className="h-[300px] w-[400px] rounded-md border p-4">
 *   <div className="space-y-4">
 *     <p>Scrollable content here...</p>
 *     <p>More content...</p>
 *   </div>
 * </ScrollArea>
 */
const ScrollArea = React.forwardRef<
	React.ElementRef<typeof ScrollAreaPrimitive.Root>,
	ScrollAreaProps
>(
	function ScrollArea(
		{ className, scrollbarClassName, children, ...props },
		ref
	) {
		return (
			<ScrollAreaPrimitive.Root
				ref={ref}
				className={cn("relative overflow-hidden", className)}
				{...props}
			>
				<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
					{children}
				</ScrollAreaPrimitive.Viewport>
				<ScrollBar className={scrollbarClassName} />
				<ScrollAreaPrimitive.Corner />
			</ScrollAreaPrimitive.Root>
		);
	}
);

ScrollArea.displayName = "ScrollArea";

const ScrollBar = React.forwardRef<
	React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
	React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(
	function ScrollBar(
		{ className, orientation = "vertical", ...props },
		ref
	) {
		return (
			<ScrollAreaPrimitive.ScrollAreaScrollbar
				ref={ref}
				orientation={orientation}
				className={cn(
					"flex touch-none select-none transition-colors",
					orientation === "vertical" &&
						"h-full w-2.5 border-l border-l-transparent p-[1px]",
					orientation === "horizontal" &&
						"h-2.5 flex-col border-t border-t-transparent p-[1px]",
					className
				)}
				{...props}
			>
				<ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-border-strong" />
			</ScrollAreaPrimitive.ScrollAreaScrollbar>
		);
	}
);

ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
