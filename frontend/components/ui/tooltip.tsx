/**
 * Tooltip Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * Custom tooltip implementation with smooth animations
 * and consistent styling following the design system.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tooltip context for managing open state and positioning.
 */
interface TooltipContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	triggerRef: React.RefObject<HTMLElement | null>;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
	const context = React.useContext(TooltipContext);
	if (!context) {
		throw new Error("Tooltip components must be used within a TooltipProvider");
	}
	return context;
}

/**
 * Tooltip root component that provides context for children.
 *
 * @example
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button variant="ghost">Hover me</Button>
 *   </TooltipTrigger>
 *   <TooltipContent>
 *     <p>This is a tooltip</p>
 *   </TooltipContent>
 * </Tooltip>
 */
interface TooltipProps {
	children: React.ReactNode;
	/** Delay in ms before showing tooltip */
	delayDuration?: number;
	/** Whether tooltip is open (controlled) */
	open?: boolean;
	/** Callback when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Disable the tooltip */
	disabled?: boolean;
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
	function Tooltip(
		{
			children,
			delayDuration = 200,
			open: controlledOpen,
			onOpenChange,
			disabled = false,
		},
		ref
	) {
		const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
		const triggerRef = React.useRef<HTMLElement | null>(null);
		const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

		const isControlled = controlledOpen !== undefined;
		const open = isControlled ? controlledOpen : uncontrolledOpen;

		const setOpen = React.useCallback(
			(newOpen: boolean) => {
				if (disabled) return;

				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}

				if (newOpen) {
					timeoutRef.current = setTimeout(() => {
						if (isControlled) {
							onOpenChange?.(true);
						} else {
							setUncontrolledOpen(true);
						}
					}, delayDuration);
				} else {
					if (isControlled) {
						onOpenChange?.(false);
					} else {
						setUncontrolledOpen(false);
					}
				}
			},
			[isControlled, onOpenChange, delayDuration, disabled]
		);

		// Cleanup timeout on unmount
		React.useEffect(() => {
			return () => {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}
			};
		}, []);

		return (
			<TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
				<div ref={ref} className="relative inline-block">
					{children}
				</div>
			</TooltipContext.Provider>
		);
	}
);

Tooltip.displayName = "Tooltip";

/**
 * Element that triggers the tooltip on hover/focus.
 */
interface TooltipTriggerProps {
	children: React.ReactElement;
	/** Merge trigger props into child element */
	asChild?: boolean;
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
	function TooltipTrigger({ children, asChild = true }, forwardedRef) {
		const { setOpen, triggerRef } = useTooltipContext();

		const handleMouseEnter = React.useCallback(() => {
			setOpen(true);
		}, [setOpen]);

		const handleMouseLeave = React.useCallback(() => {
			setOpen(false);
		}, [setOpen]);

		const handleFocus = React.useCallback(() => {
			setOpen(true);
		}, [setOpen]);

		const handleBlur = React.useCallback(() => {
			setOpen(false);
		}, [setOpen]);

		const combineRef = (node: HTMLElement | null) => {
			(triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
			if (typeof forwardedRef === "function") {
				forwardedRef(node);
			} else if (forwardedRef) {
				forwardedRef.current = node;
			}
		};

		if (asChild && React.isValidElement(children)) {
			return React.cloneElement(children, {
				ref: combineRef,
				onMouseEnter: handleMouseEnter,
				onMouseLeave: handleMouseLeave,
				onFocus: handleFocus,
				onBlur: handleBlur,
			} as React.Attributes);
		}

		return (
			<span
				ref={combineRef as (node: HTMLSpanElement | null) => void}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onFocus={handleFocus}
				onBlur={handleBlur}
			>
				{children}
			</span>
		);
	}
);

TooltipTrigger.displayName = "TooltipTrigger";

/**
 * The actual tooltip content shown on hover.
 */
interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Position relative to trigger */
	side?: "top" | "right" | "bottom" | "left";
	/** Alignment relative to trigger */
	align?: "start" | "center" | "end";
	/** Offset from trigger in pixels */
	sideOffset?: number;
	/** Whether to show arrow */
	showArrow?: boolean;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
	function TooltipContent(
		{
			className,
			side = "top",
			align = "center",
			sideOffset = 8,
			showArrow = true,
			children,
			...props
		},
		ref
	) {
		const { open, triggerRef } = useTooltipContext();
		const [position, setPosition] = React.useState({ top: 0, left: 0 });
		const contentRef = React.useRef<HTMLDivElement>(null);

		// Calculate position when tooltip opens
		React.useLayoutEffect(() => {
			if (!open || !triggerRef.current || !contentRef.current) return;

			const triggerRect = triggerRef.current.getBoundingClientRect();
			const contentRect = contentRef.current.getBoundingClientRect();
			const scrollX = window.scrollX || window.pageXOffset;
			const scrollY = window.scrollY || window.pageYOffset;

			// Viewport boundaries
			const viewport = {
				width: window.innerWidth,
				height: window.innerHeight,
			};

			// Default position
			let newPosition = { top: 0, left: 0 };

			// Calculate initial position
			switch (side) {
				case "top":
					newPosition = {
						top: triggerRect.top - contentRect.height - sideOffset + scrollY,
						left: calculateHorizontalPosition(triggerRect, contentRect, align) + scrollX,
					};
					break;
				case "bottom":
					newPosition = {
						top: triggerRect.bottom + sideOffset + scrollY,
						left: calculateHorizontalPosition(triggerRect, contentRect, align) + scrollX,
					};
					break;
				case "left":
					newPosition = {
						top: calculateVerticalPosition(triggerRect, contentRect, align) + scrollY,
						left: triggerRect.left - contentRect.width - sideOffset + scrollX,
					};
					break;
				case "right":
					newPosition = {
						top: calculateVerticalPosition(triggerRect, contentRect, align) + scrollY,
						left: triggerRect.right + sideOffset + scrollX,
					};
					break;
			}

			// Adjust for viewport boundaries
			const adjustedPosition = adjustForViewport(
				newPosition,
				contentRect,
				viewport,
				scrollX,
				scrollY
			);

			setPosition(adjustedPosition);
		}, [open, side, align, sideOffset, triggerRef]);

		if (!open) return null;

		return (
			<div
				ref={(node) => {
					(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
					if (typeof ref === "function") {
						ref(node);
					} else if (ref) {
						ref.current = node;
					}
				}}
				role="tooltip"
				className={cn(
					// Base styles - design system
					"absolute z-50 px-3 py-2",
					"rounded-lg border border-border bg-popover",
					"text-sm text-popover-foreground shadow-lg",

					// Animation
					"animate-fade-up transition-all duration-150 ease-out",

					className
				)}
				style={{
					top: `${position.top}px`,
					left: `${position.left}px`,
					animationDelay: "0ms",
				}}
				{...props}
			>
				{children}
				{showArrow && (
					<TooltipArrow side={side} />
				)}
			</div>
		);
	}
);

TooltipContent.displayName = "TooltipContent";

/**
 * Tooltip arrow indicator
 */
interface TooltipArrowProps {
	side: "top" | "right" | "bottom" | "left";
}

function TooltipArrow({ side }: TooltipArrowProps) {
	const arrowStyles = {
		top: "-4px left-1/2 -translate-x-1/2 rotate-180",
		bottom: "-4px left-1/2 -translate-x-1/2",
		left: "-4px top-1/2 -translate-y-1/2 rotate-90",
		right: "-4px top-1/2 -translate-y-1/2 -rotate-90",
	};

	return (
		<div
			className={cn(
				"absolute w-2 h-2 bg-popover border-l border-t border-border",
				"rotate-45 transform",
				arrowStyles[side]
			)}
		/>
	);
}

/**
 * Helper function to calculate horizontal position
 */
function calculateHorizontalPosition(
	triggerRect: DOMRect,
	contentRect: DOMRect,
	align: "start" | "center" | "end"
): number {
	switch (align) {
		case "start":
			return triggerRect.left;
		case "center":
			return triggerRect.left + (triggerRect.width - contentRect.width) / 2;
		case "end":
			return triggerRect.right - contentRect.width;
		default:
			return triggerRect.left + (triggerRect.width - contentRect.width) / 2;
	}
}

/**
 * Helper function to calculate vertical position
 */
function calculateVerticalPosition(
	triggerRect: DOMRect,
	contentRect: DOMRect,
	align: "start" | "center" | "end"
): number {
	switch (align) {
		case "start":
			return triggerRect.top;
		case "center":
			return triggerRect.top + (triggerRect.height - contentRect.height) / 2;
		case "end":
			return triggerRect.bottom - contentRect.height;
		default:
			return triggerRect.top + (triggerRect.height - contentRect.height) / 2;
	}
}

/**
 * Helper function to adjust position for viewport boundaries
 */
function adjustForViewport(
	position: { top: number; left: number },
	contentRect: DOMRect,
	viewport: { width: number; height: number },
	scrollX: number,
	scrollY: number
): { top: number; left: number } {
	let { top, left } = position;

	// Adjust if tooltip goes off-screen horizontally
	if (left + contentRect.width > viewport.width + scrollX) {
		left = viewport.width + scrollX - contentRect.width - 8;
	}
	if (left < scrollX) {
		left = scrollX + 8;
	}

	// Adjust if tooltip goes off-screen vertically
	if (top + contentRect.height > viewport.height + scrollY) {
		top = viewport.height + scrollY - contentRect.height - 8;
	}
	if (top < scrollY) {
		top = scrollY + 8;
	}

	return { top, left };
}

/**
 * Global provider for tooltip styling and configuration.
 * Optional - tooltips work without it but this enables global configuration.
 */
function TooltipProvider({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}

export {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
	useTooltipContext,
};
export type {
	TooltipProps,
	TooltipTriggerProps,
	TooltipContentProps,
};
