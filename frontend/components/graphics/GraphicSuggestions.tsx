"use client";

/**
 * GraphicSuggestions Component - DocFusion
 *
 * Shows AI-powered graphic suggestions for a document section.
 * Analyzes section content and recommends appropriate visualizations.
 *
 * Features:
 * - Calls suggestGraphics action for AI analysis
 * - Shows suggestions with confidence scores
 * - Accept/reject buttons for each suggestion
 * - Creates graphic from accepted suggestion
 * - Loading and empty states
 *
 * @module components/graphics/GraphicSuggestions
 */

import * as React from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Button,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	suggestGraphics,
	createGraphic,
	type GraphicSuggestion,
} from "@/lib/actions/graphics";
import { GraphicPreview } from "./GraphicPreview";
import {
	Sparkles,
	Check,
	X,
	RefreshCw,
	Lightbulb,
	BarChart3,
	GitBranch,
	Calendar,
	PieChart,
	Box,
	Layers,
	AlertCircle,
	ThumbsUp,
	ThumbsDown,
	Plus,
} from "lucide-react";

// Map graphic types to icons
const TYPE_ICONS: Record<string, React.ElementType> = {
	org_chart: GitBranch,
	process_flow: BarChart3,
	schedule: Calendar,
	infographic: PieChart,
	diagram: Box,
	chart: Layers,
};

// Confidence level display
function ConfidenceBadge({ confidence }: { confidence: number }) {
	const level = confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";
	const colors = {
		high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
		low: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
	};

	return (
		<Badge variant="outline" className={cn("text-xs", colors[level])}>
			{Math.round(confidence * 100)}% match
		</Badge>
	);
}

interface SuggestionCardProps {
	suggestion: GraphicSuggestion;
	onAccept: () => void;
	onReject: () => void;
	isAccepting: boolean;
}

/**
 * Individual suggestion card with preview and actions
 */
function SuggestionCard({
	suggestion,
	onAccept,
	onReject,
	isAccepting,
}: SuggestionCardProps) {
	const [showPreview, setShowPreview] = useState(false);
	const TypeIcon = TYPE_ICONS[suggestion.graphicType] || Box;

	return (
		<Card className={cn("overflow-hidden", isAccepting && "opacity-70")}>
			<CardHeader className="p-3 pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-start gap-2 flex-1 min-w-0">
						<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
							<TypeIcon className="h-4 w-4 text-primary" />
						</div>
						<div className="flex-1 min-w-0">
							<CardTitle className="text-sm line-clamp-1">
								{suggestion.title}
							</CardTitle>
							<CardDescription className="text-xs mt-0.5 capitalize">
								{suggestion.graphicType.replace("_", " ")}
							</CardDescription>
						</div>
					</div>
					<ConfidenceBadge confidence={suggestion.confidence} />
				</div>
			</CardHeader>

			<CardContent className="p-3 pt-0 space-y-3">
				{/* Rationale */}
				<p className="text-xs text-muted-foreground">
					{suggestion.rationale}
				</p>

				{/* Preview toggle */}
				{suggestion.suggestedDiagramCode && (
					<div>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs w-full"
							onClick={() => setShowPreview(!showPreview)}
						>
							{showPreview ? "Hide Preview" : "Show Preview"}
						</Button>

						{showPreview && (
							<div className="mt-2 border rounded-lg overflow-hidden h-[150px]">
								<GraphicPreview
									code={suggestion.suggestedDiagramCode}
									format="mermaid"
									showControls={false}
									className="h-full"
								/>
							</div>
						)}
					</div>
				)}

				{/* Actions */}
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="flex-1 h-8"
						onClick={onReject}
						disabled={isAccepting}
					>
						<ThumbsDown className="h-3 w-3 mr-1" />
						Not Useful
					</Button>
					<Button
						size="sm"
						className="flex-1 h-8"
						onClick={onAccept}
						disabled={isAccepting}
						isLoading={isAccepting}
					>
						<ThumbsUp className="h-3 w-3 mr-1" />
						Create
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Loading skeleton for suggestions
 */
function SuggestionsSkeleton() {
	return (
		<div className="space-y-3">
			{[1, 2, 3].map((i) => (
				<Card key={i}>
					<CardHeader className="p-3 pb-2">
						<div className="flex items-start gap-2">
							<Skeleton className="h-8 w-8 rounded-lg" />
							<div className="flex-1 space-y-1">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-1/3" />
							</div>
							<Skeleton className="h-5 w-16" />
						</div>
					</CardHeader>
					<CardContent className="p-3 pt-0">
						<Skeleton className="h-10 w-full" />
						<div className="flex gap-2 mt-3">
							<Skeleton className="h-8 flex-1" />
							<Skeleton className="h-8 flex-1" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

/**
 * Empty state when no suggestions are available
 */
function EmptyState({ onRefresh }: { onRefresh: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<Lightbulb className="h-10 w-10 text-muted-foreground/40 mb-3" />
			<h3 className="text-sm font-medium mb-1">No Suggestions Available</h3>
			<p className="text-xs text-muted-foreground max-w-xs mb-4">
				Add more content to your section, or try refreshing to get graphic recommendations.
			</p>
			<Button variant="outline" size="sm" onClick={onRefresh}>
				<RefreshCw className="h-4 w-4 mr-1" />
				Try Again
			</Button>
		</div>
	);
}

interface GraphicSuggestionsProps {
	/** Section ID to analyze for suggestions */
	sectionId: string;
	/** Opportunity ID for creating graphics */
	opportunityId?: string;
	/** Callback when a suggestion is accepted and graphic created */
	onAcceptSuggestion?: (suggestion: GraphicSuggestion, graphicId: string) => void;
	/** Additional CSS class names */
	className?: string;
}

/**
 * GraphicSuggestions - Shows AI suggestions for graphics in a section.
 *
 * @example
 * ```tsx
 * <GraphicSuggestions
 *   sectionId={sectionId}
 *   opportunityId={opportunityId}
 *   onAcceptSuggestion={(suggestion, graphicId) => {
 *     console.log("Created graphic:", graphicId);
 *   }}
 * />
 * ```
 */
export function GraphicSuggestions({
	sectionId,
	opportunityId,
	onAcceptSuggestion,
	className,
}: GraphicSuggestionsProps) {
	// State
	const [suggestions, setSuggestions] = useState<GraphicSuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
	const [isPending, startTransition] = useTransition();

	// Load suggestions
	const loadSuggestions = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await suggestGraphics(sectionId);

		if (result.success) {
			setSuggestions(result.data);
			setRejectedIds(new Set()); // Reset rejected on refresh
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [sectionId]);

	// Initial load
	useEffect(() => {
		loadSuggestions();
	}, [loadSuggestions]);

	// Handle accept suggestion
	const handleAccept = useCallback(
		(suggestion: GraphicSuggestion) => {
			setAcceptingId(suggestion.title);

			startTransition(async () => {
				// Create the graphic from the suggestion
				const result = await createGraphic({
					opportunityId,
					sectionId,
					title: suggestion.title,
					graphicType: suggestion.graphicType as any,
					format: "mermaid",
					diagramCode: suggestion.suggestedDiagramCode,
					generatedBy: "ai",
				});

				if (result.success) {
					// Remove from suggestions list
					setSuggestions((prev) =>
						prev.filter((s) => s.title !== suggestion.title)
					);
					onAcceptSuggestion?.(suggestion, result.data.id);
				} else {
					setError(result.error);
				}

				setAcceptingId(null);
			});
		},
		[opportunityId, sectionId, onAcceptSuggestion]
	);

	// Handle reject suggestion
	const handleReject = useCallback((suggestion: GraphicSuggestion) => {
		setRejectedIds((prev) => new Set(prev).add(suggestion.title));
	}, []);

	// Filter out rejected suggestions
	const visibleSuggestions = suggestions.filter(
		(s) => !rejectedIds.has(s.title)
	);

	return (
		<Card className={cn("flex flex-col", className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<CardTitle className="text-sm">AI Suggestions</CardTitle>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={loadSuggestions}
						disabled={isLoading}
						className="h-7"
					>
						<RefreshCw
							className={cn("h-4 w-4", isLoading && "animate-spin")}
						/>
					</Button>
				</div>
				<CardDescription className="text-xs">
					Recommended graphics based on your section content
				</CardDescription>
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden pt-0">
				{/* Error state */}
				{error && (
					<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm mb-3">
						<AlertCircle className="h-4 w-4 flex-shrink-0" />
						<span className="text-xs">{error}</span>
					</div>
				)}

				{/* Content */}
				<ScrollArea className="h-full pr-4">
					{isLoading ? (
						<SuggestionsSkeleton />
					) : visibleSuggestions.length === 0 ? (
						<EmptyState onRefresh={loadSuggestions} />
					) : (
						<div className="space-y-3">
							{visibleSuggestions.map((suggestion) => (
								<SuggestionCard
									key={suggestion.title}
									suggestion={suggestion}
									onAccept={() => handleAccept(suggestion)}
									onReject={() => handleReject(suggestion)}
									isAccepting={acceptingId === suggestion.title}
								/>
							))}

							{/* Dismissed count */}
							{rejectedIds.size > 0 && (
								<p className="text-xs text-muted-foreground text-center py-2">
									{rejectedIds.size} suggestion{rejectedIds.size > 1 ? "s" : ""}{" "}
									dismissed
								</p>
							)}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
