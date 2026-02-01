/**
 * ThemeSuggestions - AI-Generated Theme Suggestions
 *
 * Displays AI-suggested win themes with confidence scores, rationales,
 * and actions to accept, dismiss, or edit before accepting.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Sparkles,
	Check,
	X,
	Edit2,
	RefreshCw,
	Target,
	Zap,
	Award,
	Shield,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronUp,
	FileText,
	Percent,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type {
	ThemeSuggestion,
	WinThemeType,
	WinTheme,
} from "@/lib/types/win-themes";
import {
	getThemeSuggestions,
	generateThemeSuggestions,
	acceptThemeSuggestion,
	dismissThemeSuggestion,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeSuggestionsProps {
	/** Opportunity ID to generate suggestions for */
	opportunityId: string;
	/** Callback when a suggestion is accepted */
	onAccept?: (suggestion: ThemeSuggestion) => void;
	/** Callback to edit a suggestion before accepting */
	onEditAndAccept?: (suggestion: ThemeSuggestion) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const THEME_TYPE_CONFIG: Record<
	WinThemeType,
	{ label: string; icon: typeof Target; color: string }
> = {
	value_prop: {
		label: "Value Proposition",
		icon: Target,
		color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
	},
	differentiator: {
		label: "Differentiator",
		icon: Zap,
		color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
	},
	proof_point: {
		label: "Proof Point",
		icon: Award,
		color: "text-green-600 bg-green-100 dark:bg-green-900/30",
	},
	risk_mitigation: {
		label: "Risk Mitigation",
		icon: Shield,
		color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
	},
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function SuggestionsSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-36" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="p-4 border rounded-lg space-y-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-24" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
						<div className="flex gap-2">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-28" />
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Confidence Badge
// =============================================================================

interface ConfidenceBadgeProps {
	confidence: number;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
	const percentage = Math.round(confidence * 100);
	const color =
		percentage >= 80
			? "text-green-600 bg-green-100 dark:bg-green-900/30"
			: percentage >= 60
				? "text-amber-600 bg-amber-100 dark:bg-amber-900/30"
				: "text-red-600 bg-red-100 dark:bg-red-900/30";

	return (
		<Badge variant="secondary" className={cn("gap-1", color)}>
			<Percent className="h-3 w-3" />
			{percentage}%
		</Badge>
	);
}

// =============================================================================
// Suggestion Card
// =============================================================================

interface SuggestionCardProps {
	suggestion: ThemeSuggestion;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onAccept: () => void;
	onDismiss: () => void;
	onEditAndAccept: () => void;
	isProcessing: boolean;
}

function SuggestionCard({
	suggestion,
	isExpanded,
	onToggleExpand,
	onAccept,
	onDismiss,
	onEditAndAccept,
	isProcessing,
}: SuggestionCardProps) {
	const typeConfig = THEME_TYPE_CONFIG[suggestion.type];
	const TypeIcon = typeConfig.icon;

	return (
		<div
			className={cn(
				"border rounded-lg transition-all",
				suggestion.status === "pending"
					? "border-border"
					: suggestion.status === "accepted"
						? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
						: "border-muted bg-muted/30 opacity-60"
			)}
		>
			<Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
				<div className="p-4">
					{/* Header */}
					<div className="flex items-start gap-3">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5">
								{isExpanded ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>

						<div className="flex-1 min-w-0">
							{/* Type and Confidence */}
							<div className="flex items-center gap-2 mb-2">
								<Badge variant="secondary" className={cn("gap-1", typeConfig.color)}>
									<TypeIcon className="h-3 w-3" />
									{typeConfig.label}
								</Badge>
								<ConfidenceBadge confidence={suggestion.confidence} />
								{suggestion.status !== "pending" && (
									<Badge
										variant={suggestion.status === "accepted" ? "default" : "outline"}
									>
										{suggestion.status === "accepted" ? "Accepted" : "Dismissed"}
									</Badge>
								)}
							</div>

							{/* Statement */}
							<p className="text-sm font-medium">{suggestion.shortVersion}</p>

							{/* Rationale Preview */}
							{!isExpanded && suggestion.rationale && (
								<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
									{suggestion.rationale}
								</p>
							)}
						</div>
					</div>

					{/* Actions (only for pending) */}
					{suggestion.status === "pending" && (
						<div className="flex items-center gap-2 mt-3 ml-9">
							<Button
								size="sm"
								onClick={onAccept}
								disabled={isProcessing}
								className="gap-1"
							>
								{isProcessing ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<Check className="h-3 w-3" />
								)}
								Accept
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={onDismiss}
								disabled={isProcessing}
								className="gap-1"
							>
								<X className="h-3 w-3" />
								Dismiss
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={onEditAndAccept}
								disabled={isProcessing}
								className="gap-1"
							>
								<Edit2 className="h-3 w-3" />
								Edit & Accept
							</Button>
						</div>
					)}
				</div>

				{/* Expanded Content */}
				<CollapsibleContent>
					<div className="px-4 pb-4 space-y-4 border-t pt-4 ml-9">
						{/* Full Statement */}
						<div>
							<label className="text-xs font-medium text-muted-foreground">
								Full Statement
							</label>
							<p className="text-sm mt-1">{suggestion.statement}</p>
						</div>

						{/* Rationale */}
						<div>
							<label className="text-xs font-medium text-muted-foreground">
								Rationale
							</label>
							<p className="text-sm mt-1 text-muted-foreground">
								{suggestion.rationale}
							</p>
						</div>

						{/* Sources */}
						{suggestion.sources.length > 0 && (
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									Sources
								</label>
								<div className="space-y-2 mt-1">
									{suggestion.sources.map((source, idx) => (
										<div
											key={idx}
											className="text-sm p-2 bg-muted/50 rounded flex items-start gap-2"
										>
											<FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
											<div>
												{source.excerpt && (
													<p className="italic">"{source.excerpt}"</p>
												)}
												{source.sectionId && (
													<p className="text-xs text-muted-foreground mt-1">
														Section: {source.sectionId}
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Suggested Keywords */}
						{suggestion.suggestedKeywords.length > 0 && (
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									Suggested Keywords
								</label>
								<div className="flex flex-wrap gap-1 mt-1">
									{suggestion.suggestedKeywords.map((keyword, idx) => (
										<Badge key={idx} variant="outline" className="text-xs">
											{keyword}
										</Badge>
									))}
								</div>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeSuggestions({
	opportunityId,
	onAccept,
	onEditAndAccept,
	className,
}: ThemeSuggestionsProps) {
	// State
	const [suggestions, setSuggestions] = useState<ThemeSuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(
		new Set()
	);
	const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
	const [generationProgress, setGenerationProgress] = useState(0);

	// Load existing suggestions
	useEffect(() => {
		async function loadSuggestions() {
			setIsLoading(true);
			setError(null);
			const result = await getThemeSuggestions(opportunityId);
			if (result.success && result.data) {
				setSuggestions(result.data);
			} else {
				setError(result.error || "Failed to load suggestions");
			}
			setIsLoading(false);
		}
		loadSuggestions();
	}, [opportunityId]);

	// Toggle suggestion expansion
	const toggleExpanded = useCallback((suggestionId: string) => {
		setExpandedSuggestions((prev) => {
			const next = new Set(prev);
			if (next.has(suggestionId)) {
				next.delete(suggestionId);
			} else {
				next.add(suggestionId);
			}
			return next;
		});
	}, []);

	// Generate new suggestions
	const handleGenerate = useCallback(async () => {
		setIsGenerating(true);
		setError(null);
		setGenerationProgress(0);

		// Simulate progress (would be replaced with real progress from backend)
		const progressInterval = setInterval(() => {
			setGenerationProgress((prev) => Math.min(prev + 10, 90));
		}, 500);

		try {
			const result = await generateThemeSuggestions({ opportunityId, count: 5 });
			clearInterval(progressInterval);
			setGenerationProgress(100);

			if (result.success && result.data) {
				setSuggestions((prev) => [...result.data!, ...prev]);
			} else {
				setError(result.error || "Failed to generate suggestions");
			}
		} catch (err) {
			clearInterval(progressInterval);
			setError(`An error occurred: ${err}`);
		} finally {
			setIsGenerating(false);
			setTimeout(() => setGenerationProgress(0), 1000);
		}
	}, [opportunityId]);

	// Accept suggestion
	const handleAccept = useCallback(
		async (suggestion: ThemeSuggestion) => {
			setProcessingIds((prev) => new Set(prev).add(suggestion.id));

			try {
				const result = await acceptThemeSuggestion(suggestion.id);
				if (result.success) {
					setSuggestions((prev) =>
						prev.map((s) =>
							s.id === suggestion.id ? { ...s, status: "accepted" as const } : s
						)
					);
					onAccept?.(suggestion);
				} else {
					setError(result.error || "Failed to accept suggestion");
				}
			} catch (err) {
				setError(`An error occurred: ${err}`);
			} finally {
				setProcessingIds((prev) => {
					const next = new Set(prev);
					next.delete(suggestion.id);
					return next;
				});
			}
		},
		[onAccept]
	);

	// Dismiss suggestion
	const handleDismiss = useCallback(async (suggestionId: string) => {
		setProcessingIds((prev) => new Set(prev).add(suggestionId));

		try {
			const result = await dismissThemeSuggestion(suggestionId);
			if (result.success) {
				setSuggestions((prev) =>
					prev.map((s) =>
						s.id === suggestionId ? { ...s, status: "dismissed" as const } : s
					)
				);
			} else {
				setError(result.error || "Failed to dismiss suggestion");
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setProcessingIds((prev) => {
				const next = new Set(prev);
				next.delete(suggestionId);
				return next;
			});
		}
	}, []);

	// Edit and accept
	const handleEditAndAccept = useCallback(
		(suggestion: ThemeSuggestion) => {
			onEditAndAccept?.(suggestion);
		},
		[onEditAndAccept]
	);

	// Pending suggestions count
	const pendingCount = suggestions.filter((s) => s.status === "pending").length;

	// Loading state
	if (isLoading) {
		return <SuggestionsSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-amber-500" />
						AI Suggestions
						{pendingCount > 0 && (
							<Badge variant="secondary">{pendingCount} pending</Badge>
						)}
					</CardTitle>
					<Button
						onClick={handleGenerate}
						disabled={isGenerating}
						variant="outline"
						size="sm"
					>
						{isGenerating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Generate Suggestions
							</>
						)}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Generation Progress */}
				{isGenerating && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Analyzing opportunity...</span>
							<span>{generationProgress}%</span>
						</div>
						<Progress value={generationProgress} className="h-2" />
					</div>
				)}

				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Empty State */}
				{suggestions.length === 0 && !error && (
					<div className="text-center py-8">
						<Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No suggestions yet</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Generate AI-powered theme suggestions based on your opportunity
						</p>
						<Button onClick={handleGenerate} className="mt-4" disabled={isGenerating}>
							<Sparkles className="h-4 w-4 mr-2" />
							Generate Suggestions
						</Button>
					</div>
				)}

				{/* Suggestions List */}
				{suggestions.length > 0 && (
					<div className="space-y-3">
						{/* Pending suggestions first */}
						{suggestions
							.filter((s) => s.status === "pending")
							.map((suggestion) => (
								<SuggestionCard
									key={suggestion.id}
									suggestion={suggestion}
									isExpanded={expandedSuggestions.has(suggestion.id)}
									onToggleExpand={() => toggleExpanded(suggestion.id)}
									onAccept={() => handleAccept(suggestion)}
									onDismiss={() => handleDismiss(suggestion.id)}
									onEditAndAccept={() => handleEditAndAccept(suggestion)}
									isProcessing={processingIds.has(suggestion.id)}
								/>
							))}

						{/* Processed suggestions */}
						{suggestions.filter((s) => s.status !== "pending").length > 0 && (
							<Collapsible>
								<CollapsibleTrigger asChild>
									<Button variant="ghost" className="w-full justify-start text-muted-foreground">
										<ChevronDown className="h-4 w-4 mr-2" />
										Processed suggestions (
										{suggestions.filter((s) => s.status !== "pending").length})
									</Button>
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-3 mt-2">
									{suggestions
										.filter((s) => s.status !== "pending")
										.map((suggestion) => (
											<SuggestionCard
												key={suggestion.id}
												suggestion={suggestion}
												isExpanded={expandedSuggestions.has(suggestion.id)}
												onToggleExpand={() => toggleExpanded(suggestion.id)}
												onAccept={() => handleAccept(suggestion)}
												onDismiss={() => handleDismiss(suggestion.id)}
												onEditAndAccept={() => handleEditAndAccept(suggestion)}
												isProcessing={processingIds.has(suggestion.id)}
											/>
										))}
								</CollapsibleContent>
							</Collapsible>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default ThemeSuggestions;
