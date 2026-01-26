/**
 * AI inline loader component for DocFusion.
 *
 * Displays a loading indicator inline in the editor while
 * AI is processing a command. Shows progress and allows cancellation.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCurrentOperation, useHasActiveOperation } from "@/lib/stores/ai-store";
import { useCancelAIOperation } from "@/lib/query/mutations/useAIMutation";
import { Loader2, X, Sparkles, Wand2 } from "lucide-react";

/**
 * Props for AIInlineLoader.
 */
export interface AIInlineLoaderProps {
	/** Additional CSS classes */
	className?: string;
	/** Whether to show in a compact format */
	compact?: boolean;
}

/**
 * Inline loading indicator for AI operations.
 */
export function AIInlineLoader({ className, compact = false }: AIInlineLoaderProps) {
	const operation = useCurrentOperation();
	const hasActive = useHasActiveOperation();
	const cancelOperation = useCancelAIOperation();

	if (!hasActive || !operation) {
		return null;
	}

	const isStreaming = operation.status === "streaming";
	const progress = operation.progress ?? 0;

	if (compact) {
		return (
			<div
				className={cn(
					"inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400",
					className
				)}
			>
				<Loader2 className="h-3 w-3 animate-spin" />
				<span className="text-xs">AI thinking...</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-950",
				className
			)}
		>
			{/* Icon */}
			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
				{isStreaming ? (
					<Wand2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
				) : (
					<Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
				)}
			</div>

			{/* Status */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium text-blue-900 dark:text-blue-100">
						{isStreaming ? "Generating..." : "Processing..."}
					</span>
					<span className="text-xs text-blue-600 dark:text-blue-400">
						/{operation.command}
					</span>
				</div>

				{/* Progress bar */}
				{progress > 0 && (
					<div className="mt-1 h-1 w-full rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
						<div
							className="h-full bg-blue-500 transition-all duration-300"
							style={{ width: `${progress}%` }}
						/>
					</div>
				)}

				{/* Streaming preview */}
				{isStreaming && operation.result && (
					<p className="mt-1 text-xs text-blue-700 dark:text-blue-300 truncate max-w-xs">
						{operation.result.slice(-50)}...
					</p>
				)}
			</div>

			{/* Spinner */}
			<Loader2 className="h-5 w-5 text-blue-500 animate-spin" />

			{/* Cancel button */}
			<button
				type="button"
				onClick={cancelOperation}
				className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
				aria-label="Cancel"
			>
				<X className="h-4 w-4 text-blue-500" />
			</button>
		</div>
	);
}

/**
 * Inline shimmer effect for indicating AI processing in text.
 */
export function AIShimmer({
	children,
	isActive,
	className,
}: {
	children: React.ReactNode;
	isActive: boolean;
	className?: string;
}) {
	if (!isActive) {
		return <>{children}</>;
	}

	return (
		<span
			className={cn(
				"relative inline-block",
				"before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-blue-200/50 before:to-transparent",
				"before:animate-shimmer",
				className
			)}
		>
			{children}
		</span>
	);
}

/**
 * Floating AI loading indicator positioned near cursor.
 */
export function AIFloatingLoader({
	position,
	command,
	onCancel,
	className,
}: {
	position: { x: number; y: number };
	command: string;
	onCancel: () => void;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"fixed z-50 flex items-center gap-2 rounded-lg bg-white shadow-lg border border-gray-200 px-3 py-2 dark:bg-gray-900 dark:border-gray-700",
				"animate-in fade-in slide-in-from-top-2 duration-200",
				className
			)}
			style={{
				left: position.x,
				top: position.y + 8,
			}}
		>
			<Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
			<span className="text-sm text-gray-600 dark:text-gray-300">
				Running /{command}...
			</span>
			<button
				type="button"
				onClick={onCancel}
				className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
				aria-label="Cancel"
			>
				<X className="h-3 w-3 text-gray-400" />
			</button>
		</div>
	);
}

/**
 * Loading overlay for full-block AI operations.
 */
export function AIBlockLoader({
	className,
}: {
	className?: string;
}) {
	const operation = useCurrentOperation();

	if (!operation) return null;

	return (
		<div
			className={cn(
				"absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg",
				className
			)}
		>
			<div className="flex flex-col items-center gap-3">
				<div className="relative">
					<div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
					<div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
						<Sparkles className="h-6 w-6 text-blue-500" />
					</div>
				</div>
				<div className="text-center">
					<p className="text-sm font-medium text-gray-900 dark:text-white">
						AI is working...
					</p>
					<p className="text-xs text-gray-500 dark:text-gray-400">
						/{operation.command}
					</p>
				</div>
			</div>
		</div>
	);
}

/**
 * Hook to manage floating loader position.
 */
export function useFloatingLoaderPosition(
	editorRef: React.RefObject<HTMLElement>,
	cursorPosition: number | null,
	coordsAtPos?: (pos: number) => { top: number; left: number } | null
) {
	const [position, setPosition] = React.useState<{ x: number; y: number } | null>(
		null
	);

	React.useEffect(() => {
		if (!editorRef.current || cursorPosition === null || !coordsAtPos) {
			setPosition(null);
			return;
		}

		const coords = coordsAtPos(cursorPosition);
		if (coords) {
			const editorRect = editorRef.current.getBoundingClientRect();
			setPosition({
				x: coords.left - editorRect.left,
				y: coords.top - editorRect.top,
			});
		}
	}, [cursorPosition, coordsAtPos, editorRef]);

	return position;
}

// Add shimmer animation to global styles
if (typeof document !== "undefined") {
	const style = document.createElement("style");
	style.textContent = `
		@keyframes shimmer {
			0% {
				transform: translateX(-100%);
			}
			100% {
				transform: translateX(100%);
			}
		}
		.animate-shimmer {
			animation: shimmer 1.5s infinite;
		}
	`;
	document.head.appendChild(style);
}
