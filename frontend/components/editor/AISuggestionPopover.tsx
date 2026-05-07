/**
 * AI suggestion popover component for DocFusion.
 *
 * Displays AI-generated suggestions with options to accept,
 * reject, or select alternatives.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCurrentSuggestion, useAIStore } from "@/lib/stores/ai-store";
import {
	useApplyAISuggestion,
	useRejectAISuggestion,
} from "@/lib/query/mutations/useAIMutation";
import { Button } from "@/components/ui/Button";
import {
	Check,
	X,
	RefreshCw,
	ChevronDown,
	Copy,
	Sparkles,
	ThumbsUp,
	ThumbsDown,
} from "lucide-react";

/**
 * Props for AISuggestionPopover.
 */
export interface AISuggestionPopoverProps {
	/** Editor instance for applying changes */
	editor: {
		commands: {
			insertContentAt: (
				pos: { from: number; to: number },
				content: string
			) => boolean;
		};
	} | null;
	/** Container ref for positioning */
	containerRef?: React.RefObject<HTMLElement>;
	/** Additional CSS classes */
	className?: string;
	/** Callback when suggestion is applied */
	onApply?: () => void;
	/** Callback when suggestion is rejected */
	onReject?: () => void;
	/** Callback to retry the command */
	onRetry?: () => void;
}

/**
 * AI suggestion popover component.
 */
export const AISuggestionPopover = React.memo(function AISuggestionPopover({
	editor,
	containerRef,
	className,
	onApply,
	onReject,
	onRetry,
}: AISuggestionPopoverProps) {
	const { show, position, suggestion } = useCurrentSuggestion();
	const { selectAlternative, hideSuggestionUI } = useAIStore();
	const applyMutation = useApplyAISuggestion();
	const rejectMutation = useRejectAISuggestion();
	const [showAlternatives, setShowAlternatives] = React.useState(false);
	const [copied, setCopied] = React.useState(false);

	// Calculate adjusted position
	const adjustedPosition = React.useMemo(() => {
		if (!position) return null;
		if (!containerRef?.current) return position;

		const containerRect = containerRef.current.getBoundingClientRect();
		return {
			x: position.x - containerRect.left,
			y: position.y - containerRect.top,
		};
	}, [position, containerRef]);

	// Handle accept
	const handleAccept = React.useCallback(async () => {
		if (!suggestion || !editor) return;

		await applyMutation.mutateAsync({
			requestId: suggestion.requestId,
			text: suggestion.result,
			position: suggestion.insertPosition,
			editor,
		});
		onApply?.();
	}, [applyMutation, editor, onApply, suggestion]);

	// Handle reject
	const handleReject = React.useCallback(async () => {
		if (!suggestion) return;

		await rejectMutation.mutateAsync({
			requestId: suggestion.requestId,
		});
		onReject?.();
	}, [onReject, rejectMutation, suggestion]);

	// Handle copy
	const handleCopy = async () => {
		if (!suggestion) return;

		await navigator.clipboard.writeText(suggestion.result);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Handle retry
	const handleRetry = () => {
		hideSuggestionUI();
		onRetry?.();
	};

	// Handle alternative selection
	const handleSelectAlternative = (index: number) => {
		selectAlternative(index);
		setShowAlternatives(false);
	};

	// Keyboard shortcuts
	React.useEffect(() => {
		if (!show) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleAccept();
			} else if (e.key === "Escape") {
				e.preventDefault();
				handleReject();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [show, handleAccept, handleReject]);

	if (!show || !suggestion || !adjustedPosition) {
		return null;
	}

	const hasAlternatives = suggestion.alternatives.length > 0;

	return (
		<div
			className={cn(
				"absolute z-50 w-96 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900",
				"animate-in fade-in slide-in-from-top-2 duration-200",
				className
			)}
			style={{
				left: Math.max(16, adjustedPosition.x),
				top: adjustedPosition.y + 24,
			}}
		>
			{/* Header */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
				<div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
					<Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
				</div>
				<span className="text-sm font-medium text-gray-900 dark:text-white">
					AI Suggestion
				</span>
				<span className="ml-auto text-xs text-gray-400">
					Press Enter to accept
				</span>
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Suggestion text */}
				<div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto">
					{suggestion.result}
				</div>

				{/* Alternatives */}
				{hasAlternatives && (
					<div className="mt-3">
						<button
							type="button"
							onClick={() => setShowAlternatives(!showAlternatives)}
							className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							<ChevronDown
								className={cn(
									"h-3 w-3 transition-transform",
									showAlternatives && "rotate-180"
								)}
							/>
							{suggestion.alternatives.length} alternative
							{suggestion.alternatives.length > 1 ? "s" : ""}
						</button>

						{showAlternatives && (
							<div className="mt-2 space-y-2">
								{suggestion.alternatives.map((alt, index) => (
									<button
										key={index}
										type="button"
										onClick={() => handleSelectAlternative(index)}
										className="w-full text-left rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									>
										<span className="line-clamp-2">{alt.text}</span>
										<span className="text-[10px] text-gray-400 mt-1 block">
											Confidence: {Math.round(alt.confidence * 100)}%
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
				{/* Secondary actions */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={handleCopy}
						className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
						title="Copy to clipboard"
					>
						{copied ? (
							<Check className="h-4 w-4 text-green-500" />
						) : (
							<Copy className="h-4 w-4" />
						)}
					</button>
					<button
						type="button"
						onClick={handleRetry}
						className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
						title="Regenerate"
					>
						<RefreshCw className="h-4 w-4" />
					</button>
				</div>

				{/* Primary actions */}
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleReject}
						disabled={rejectMutation.isPending}
					>
						<X className="h-4 w-4 mr-1" />
						Reject
					</Button>
					<Button
						size="sm"
						onClick={handleAccept}
						disabled={applyMutation.isPending}
					>
						<Check className="h-4 w-4 mr-1" />
						Accept
					</Button>
				</div>
			</div>
		</div>
	);
});

AISuggestionPopover.displayName = "AISuggestionPopover";

/**
 * Compact inline suggestion preview.
 */
export function AIInlineSuggestion({
	text,
	onAccept,
	onReject,
	className,
}: {
	text: string;
	onAccept: () => void;
	onReject: () => void;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm",
				className
			)}
		>
			<span className="italic">{text}</span>
			<button
				type="button"
				onClick={onAccept}
				className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
				title="Accept"
			>
				<Check className="h-3 w-3" />
			</button>
			<button
				type="button"
				onClick={onReject}
				className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
				title="Reject"
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}

/**
 * Feedback buttons for suggestion quality.
 */
export function AISuggestionFeedback({
	requestId,
	onFeedback,
	className,
}: {
	requestId: string;
	onFeedback?: (positive: boolean) => void;
	className?: string;
}) {
	const [submitted, setSubmitted] = React.useState<boolean | null>(null);

	const handleFeedback = (positive: boolean) => {
		setSubmitted(positive);
		onFeedback?.(positive);
	};

	if (submitted !== null) {
		return (
			<span
				className={cn("text-xs text-gray-400 dark:text-gray-500", className)}
			>
				{submitted ? "Thanks for the feedback!" : "Thanks, we'll improve."}
			</span>
		);
	}

	return (
		<div className={cn("flex items-center gap-1", className)}>
			<span className="text-xs text-gray-400 dark:text-gray-500 mr-1">
				Was this helpful?
			</span>
			<button
				type="button"
				onClick={() => handleFeedback(true)}
				className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-500"
				title="Yes"
			>
				<ThumbsUp className="h-3 w-3" />
			</button>
			<button
				type="button"
				onClick={() => handleFeedback(false)}
				className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500"
				title="No"
			>
				<ThumbsDown className="h-3 w-3" />
			</button>
		</div>
	);
}

/**
 * Diff view showing original and suggested text.
 */
export function AISuggestionDiff({
	original,
	suggested,
	className,
}: {
	original: string;
	suggested: string;
	className?: string;
}) {
	return (
		<div className={cn("space-y-2 text-sm", className)}>
			<div>
				<span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
					Original
				</span>
				<div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through">
					{original}
				</div>
			</div>
			<div>
				<span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
					Suggested
				</span>
				<div className="p-2 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
					{suggested}
				</div>
			</div>
		</div>
	);
}

/**
 * Hook to position the popover near the selection.
 */
export function useSuggestionPosition(
	editor: { view: { coordsAtPos: (pos: number) => { top: number; left: number } } } | null,
	insertPosition: { from: number; to: number } | null
): { x: number; y: number } | null {
	const [position, setPosition] = React.useState<{ x: number; y: number } | null>(
		null
	);

	React.useEffect(() => {
		if (!editor || !insertPosition) {
			setPosition(null);
			return;
		}

		try {
			const coords = editor.view.coordsAtPos(insertPosition.from);
			setPosition({
				x: coords.left,
				y: coords.top,
			});
		} catch {
			setPosition(null);
		}
	}, [editor, insertPosition]);

	return position;
}
