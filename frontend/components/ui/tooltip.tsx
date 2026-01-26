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
 *     <Button variant="secondary">Hover me</Button>
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
}

function Tooltip({
	children,
	delayDuration = 200,
	open: controlledOpen,
	onOpenChange,
}: TooltipProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
	const triggerRef = React.useRef<HTMLElement | null>(null);
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : uncontrolledOpen;

	const setOpen = React.useCallback(
		(newOpen: boolean) => {
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
		[isControlled, onOpenChange, delayDuration]
	);

	React.useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return (
		<TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
			{children}
		</TooltipContext.Provider>
	);
}

/**
 * Element that triggers the tooltip on hover/focus.
 */
interface TooltipTriggerProps {
	children: React.ReactNode;
	/** Merge trigger props into child element */
	asChild?: boolean;
}

function TooltipTrigger({ children, asChild }: TooltipTriggerProps) {
	const { setOpen, triggerRef } = useTooltipContext();

	const handleMouseEnter = () => setOpen(true);
	const handleMouseLeave = () => setOpen(false);
	const handleFocus = () => setOpen(true);
	const handleBlur = () => setOpen(false);

	const setRef = React.useCallback(
		(node: HTMLElement | null) => {
			(triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
		},
		[triggerRef]
	);

	if (asChild && React.isValidElement(children)) {
		const childProps = {
			ref: setRef,
			onMouseEnter: handleMouseEnter,
			onMouseLeave: handleMouseLeave,
			onFocus: handleFocus,
			onBlur: handleBlur,
		};
		return React.cloneElement(children, childProps as React.Attributes);
	}

	return (
		<span
			ref={setRef as (node: HTMLSpanElement | null) => void}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			{children}
		</span>
	);
}

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
}

function TooltipContent({
	className,
	side = "top",
	align = "center",
	sideOffset = 4,
	children,
	...props
}: TooltipContentProps) {
	const { open, triggerRef } = useTooltipContext();
	const [position, setPosition] = React.useState({ top: 0, left: 0 });
	const contentRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (open && triggerRef.current && contentRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect();
			const contentRect = contentRef.current.getBoundingClientRect();

			let top = 0;
			let left = 0;

			// Calculate position based on side
			switch (side) {
				case "top":
					top = triggerRect.top - contentRect.height - sideOffset;
					break;
				case "bottom":
					top = triggerRect.bottom + sideOffset;
					break;
				case "left":
					left = triggerRect.left - contentRect.width - sideOffset;
					break;
				case "right":
					left = triggerRect.right + sideOffset;
					break;
			}

			// Calculate alignment
			if (side === "top" || side === "bottom") {
				switch (align) {
					case "start":
						left = triggerRect.left;
						break;
					case "center":
						left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
						break;
					case "end":
						left = triggerRect.right - contentRect.width;
						break;
				}
			} else {
				switch (align) {
					case "start":
						top = triggerRect.top;
						break;
					case "center":
						top = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
						break;
					case "end":
						top = triggerRect.bottom - contentRect.height;
						break;
				}
			}

			setPosition({ top, left });
		}
	}, [open, side, align, sideOffset, triggerRef]);

	if (!open) return null;

	return (
		<div
			ref={contentRef}
			role="tooltip"
			className={cn(
				"fixed z-50 overflow-hidden rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-950 shadow-md",
				"animate-in fade-in-0 zoom-in-95",
				"dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
				className
			)}
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}
			{...props}
		>
			{children}
		</div>
	);
}

/**
 * Global provider for tooltip styling and configuration.
 * Optional - tooltips work without it but this enables global configuration.
 */
function TooltipProvider({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
