"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/stores/editor-store";

/**
 * SplitPane component for side-by-side editor and markdown preview.
 *
 * Features:
 * - Draggable divider for resizing
 * - Keyboard accessible (arrow keys adjust size)
 * - Minimum pane widths enforced
 * - Persists ratio to store
 *
 * @example
 * <SplitPane
 *   leftPane={<TiptapEditor />}
 *   rightPane={<MarkdownPane />}
 * />
 */

interface SplitPaneProps {
	/** Content for the left pane (editor) */
	leftPane: React.ReactNode;
	/** Content for the right pane (markdown preview) */
	rightPane: React.ReactNode;
	/** Initial split ratio (0-1), defaults to store value */
	defaultRatio?: number;
	/** Minimum pane width in pixels */
	minWidth?: number;
	/** Custom class for container */
	className?: string;
	/** Called when ratio changes */
	onRatioChange?: (ratio: number) => void;
}

export function SplitPane({
	leftPane,
	rightPane,
	defaultRatio,
	minWidth = 300,
	className,
	onRatioChange,
}: SplitPaneProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const isDragging = React.useRef(false);

	// Get ratio from store or use default
	const storeRatio = useEditorStore((s) => s.splitRatio);
	const setSplitRatio = useEditorStore((s) => s.setSplitRatio);
	const activePanel = useEditorStore((s) => s.activePanel);

	const ratio = defaultRatio ?? storeRatio;

	// Handle mouse down on divider
	const handleMouseDown = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDragging.current = true;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const handleMouseMove = (moveEvent: MouseEvent) => {
				if (!isDragging.current || !containerRef.current) return;

				const container = containerRef.current;
				const containerRect = container.getBoundingClientRect();
				const containerWidth = containerRect.width;
				const newX = moveEvent.clientX - containerRect.left;

				// Calculate new ratio with constraints
				let newRatio = newX / containerWidth;

				// Enforce minimum widths
				const minRatio = minWidth / containerWidth;
				const maxRatio = 1 - minRatio;

				newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

				setSplitRatio(newRatio);
				onRatioChange?.(newRatio);
			};

			const handleMouseUp = () => {
				isDragging.current = false;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[minWidth, setSplitRatio, onRatioChange]
	);

	// Handle keyboard navigation for accessibility
	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent) => {
			const step = e.shiftKey ? 0.1 : 0.02;

			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					setSplitRatio(Math.max(0.2, ratio - step));
					break;
				case "ArrowRight":
					e.preventDefault();
					setSplitRatio(Math.min(0.8, ratio + step));
					break;
				case "Home":
					e.preventDefault();
					setSplitRatio(0.5);
					break;
			}
		},
		[ratio, setSplitRatio]
	);

	// Handle double-click to reset to 50%
	const handleDoubleClick = React.useCallback(() => {
		setSplitRatio(0.5);
		onRatioChange?.(0.5);
	}, [setSplitRatio, onRatioChange]);

	// If only one panel is active, show it full width
	if (activePanel === "editor") {
		return (
			<div className={cn("flex h-full", className)}>
				<div className="flex-1 overflow-hidden">{leftPane}</div>
			</div>
		);
	}

	if (activePanel === "markdown") {
		return (
			<div className={cn("flex h-full", className)}>
				<div className="flex-1 overflow-hidden">{rightPane}</div>
			</div>
		);
	}

	return (
		<div ref={containerRef} className={cn("flex h-full", className)}>
			{/* Left pane (editor) */}
			<div
				className="h-full overflow-hidden"
				style={{ width: `${ratio * 100}%` }}
			>
				{leftPane}
			</div>

			{/* Divider */}
			<div
				role="separator"
				aria-orientation="vertical"
				aria-valuenow={Math.round(ratio * 100)}
				aria-valuemin={20}
				aria-valuemax={80}
				aria-label="Resize panes"
				tabIndex={0}
				className={cn(
					"relative flex-shrink-0 w-1 cursor-col-resize",
					"bg-gray-200 hover:bg-blue-400 active:bg-blue-500",
					"dark:bg-gray-800 dark:hover:bg-blue-600",
					"transition-colors duration-150",
					"focus:outline-none focus:bg-blue-400 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				)}
				onMouseDown={handleMouseDown}
				onKeyDown={handleKeyDown}
				onDoubleClick={handleDoubleClick}
			>
				{/* Drag handle indicator */}
				<div className="absolute inset-y-0 -left-1 -right-1" />

				{/* Visual grip */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
					<div className="flex flex-col gap-0.5 opacity-50">
						<div className="w-1 h-1 rounded-full bg-current" />
						<div className="w-1 h-1 rounded-full bg-current" />
						<div className="w-1 h-1 rounded-full bg-current" />
					</div>
				</div>
			</div>

			{/* Right pane (markdown preview) */}
			<div
				className="h-full overflow-hidden"
				style={{ width: `${(1 - ratio) * 100}%` }}
			>
				{rightPane}
			</div>
		</div>
	);
}

/**
 * Hook to get the current split ratio.
 */
export function useSplitRatio() {
	return useEditorStore((s) => s.splitRatio);
}

/**
 * Hook to set the split ratio.
 */
export function useSetSplitRatio() {
	return useEditorStore((s) => s.setSplitRatio);
}
