"use client";

/**
 * Recommendation List Component
 *
 * Displays AI-generated and heuristic recommendations for improving
 * PWin scores. Shows priority, expected impact, effort level, and
 * timeframe for each recommendation.
 *
 * Features:
 * - Priority-based sorting and filtering
 * - Impact/effort matrix visualization
 * - Related factor linking
 * - Expandable recommendation details
 * - Actionable next steps
 *
 * @example
 * ```tsx
 * <RecommendationList
 *   opportunityId="opp-123"
 *   onRecommendationAction={(rec) => openActionDialog(rec)}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
	Lightbulb,
	TrendingUp,
	Clock,
	Zap,
	Target,
	Loader2,
	AlertCircle,
	RefreshCw,
	ChevronRight,
	Filter,
	Sparkles,
	CheckCircle2,
	Circle,
	ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getRecommendationsToImprovePwin } from "@/lib/actions/pwin";
import type { PwinRecommendation, Priority, Effort, Timeframe } from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface RecommendationListProps {
	opportunityId: string;
	initialData?: PwinRecommendation[];
	onRecommendationAction?: (recommendation: PwinRecommendation) => void;
	onFactorSelect?: (factorId: string) => void;
	className?: string;
}

interface RecommendationWithStatus extends PwinRecommendation {
	isCompleted?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
	high: {
		label: "High",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		icon: Zap,
	},
	medium: {
		label: "Medium",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
		icon: Target,
	},
	low: {
		label: "Low",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		icon: Circle,
	},
};

const EFFORT_CONFIG: Record<Effort, { label: string; color: string }> = {
	low: { label: "Low Effort", color: "text-green-600" },
	medium: { label: "Medium Effort", color: "text-amber-600" },
	high: { label: "High Effort", color: "text-red-600" },
};

const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; color: string }> = {
	immediate: { label: "Immediate", color: "text-green-600" },
	short_term: { label: "Short Term", color: "text-blue-600" },
	long_term: { label: "Long Term", color: "text-purple-600" },
};

// ============================================================================
// Helper Functions
// ============================================================================

function sortRecommendations(recommendations: RecommendationWithStatus[]): RecommendationWithStatus[] {
	const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
	const effortOrder: Record<Effort, number> = { low: 0, medium: 1, high: 2 };

	return [...recommendations].sort((a, b) => {
		// Completed items go to the bottom
		if (a.isCompleted !== b.isCompleted) {
			return a.isCompleted ? 1 : -1;
		}
		// Then sort by priority
		const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
		if (priorityDiff !== 0) return priorityDiff;
		// Then by effort (prefer low effort)
		return effortOrder[a.effort] - effortOrder[b.effort];
	});
}

function getImpactLabel(impact: number): string {
	if (impact >= 15) return "Major Impact";
	if (impact >= 8) return "Moderate Impact";
	if (impact >= 3) return "Minor Impact";
	return "Minimal Impact";
}

// ============================================================================
// Component
// ============================================================================

export function RecommendationList({
	opportunityId,
	initialData,
	onRecommendationAction,
	onFactorSelect,
	className,
}: RecommendationListProps) {
	// State
	const [recommendations, setRecommendations] = useState<RecommendationWithStatus[]>(
		(initialData ?? []).map(r => ({ ...r, isCompleted: false }))
	);
	const [isLoading, setIsLoading] = useState(!initialData);
	const [error, setError] = useState<string | null>(null);

	// Filters
	const [showCompleted, setShowCompleted] = useState(true);
	const [priorityFilter, setPriorityFilter] = useState<Set<Priority>>(
		new Set(["high", "medium", "low"])
	);
	const [effortFilter, setEffortFilter] = useState<Set<Effort>>(
		new Set(["low", "medium", "high"])
	);

	// Load recommendations
	const loadRecommendations = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await getRecommendationsToImprovePwin(opportunityId);

		if (result.success) {
			setRecommendations(result.data.map(r => ({ ...r, isCompleted: false })));
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityId]);

	// Load on mount if no initial data
	useEffect(() => {
		if (!initialData) {
			loadRecommendations();
		}
	}, [initialData, loadRecommendations]);

	// Toggle completion
	const toggleCompletion = useCallback((index: number) => {
		setRecommendations(prev =>
			prev.map((r, i) =>
				i === index ? { ...r, isCompleted: !r.isCompleted } : r
			)
		);
	}, []);

	// Toggle priority filter
	const togglePriorityFilter = useCallback((priority: Priority) => {
		setPriorityFilter(prev => {
			const newSet = new Set(prev);
			if (newSet.has(priority)) {
				newSet.delete(priority);
			} else {
				newSet.add(priority);
			}
			return newSet;
		});
	}, []);

	// Toggle effort filter
	const toggleEffortFilter = useCallback((effort: Effort) => {
		setEffortFilter(prev => {
			const newSet = new Set(prev);
			if (newSet.has(effort)) {
				newSet.delete(effort);
			} else {
				newSet.add(effort);
			}
			return newSet;
		});
	}, []);

	// Filtered and sorted recommendations
	const filteredRecommendations = useMemo(() => {
		let filtered = recommendations.filter(r => {
			if (!showCompleted && r.isCompleted) return false;
			if (!priorityFilter.has(r.priority)) return false;
			if (!effortFilter.has(r.effort)) return false;
			return true;
		});
		return sortRecommendations(filtered);
	}, [recommendations, showCompleted, priorityFilter, effortFilter]);

	// Summary stats
	const stats = useMemo(() => {
		const total = recommendations.length;
		const completed = recommendations.filter(r => r.isCompleted).length;
		const highPriority = recommendations.filter(r => r.priority === "high" && !r.isCompleted).length;
		const quickWins = recommendations.filter(
			r => r.effort === "low" && r.priority !== "low" && !r.isCompleted
		).length;
		return { total, completed, highPriority, quickWins };
	}, [recommendations]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-primary" />
						Recommendations
					</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-primary" />
						Recommendations
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertCircle className="h-10 w-10 text-destructive mb-3" />
					<p className="text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={loadRecommendations}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Lightbulb className="h-5 w-5 text-primary" />
							Recommendations
							<Badge variant="secondary" className="ml-2">
								{filteredRecommendations.length}
							</Badge>
						</CardTitle>
						<CardDescription className="mt-1">
							AI-generated actions to improve PWin
						</CardDescription>
					</div>

					<div className="flex items-center gap-2">
						{/* Filter Dropdown */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Filter className="h-4 w-4 mr-2" />
									Filter
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuLabel>Priority</DropdownMenuLabel>
								{(["high", "medium", "low"] as Priority[]).map((priority) => (
									<DropdownMenuCheckboxItem
										key={priority}
										checked={priorityFilter.has(priority)}
										onCheckedChange={() => togglePriorityFilter(priority)}
									>
										{PRIORITY_CONFIG[priority].label}
									</DropdownMenuCheckboxItem>
								))}

								<DropdownMenuSeparator />
								<DropdownMenuLabel>Effort</DropdownMenuLabel>
								{(["low", "medium", "high"] as Effort[]).map((effort) => (
									<DropdownMenuCheckboxItem
										key={effort}
										checked={effortFilter.has(effort)}
										onCheckedChange={() => toggleEffortFilter(effort)}
									>
										{EFFORT_CONFIG[effort].label}
									</DropdownMenuCheckboxItem>
								))}

								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={showCompleted}
									onCheckedChange={setShowCompleted}
								>
									Show Completed
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button variant="outline" size="icon" onClick={loadRecommendations}>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Summary Stats */}
				<div className="grid grid-cols-4 gap-3 pb-4 border-b">
					<div className="text-center">
						<div className="text-lg font-bold">{stats.total}</div>
						<div className="text-xs text-muted-foreground">Total</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold text-red-600">{stats.highPriority}</div>
						<div className="text-xs text-muted-foreground">High Priority</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold text-green-600">{stats.quickWins}</div>
						<div className="text-xs text-muted-foreground">Quick Wins</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold text-blue-600">{stats.completed}</div>
						<div className="text-xs text-muted-foreground">Completed</div>
					</div>
				</div>

				{/* Recommendations List */}
				{filteredRecommendations.length > 0 ? (
					<div className="space-y-3">
						{filteredRecommendations.map((rec, idx) => (
							<RecommendationCard
								key={idx}
								recommendation={rec}
								originalIndex={recommendations.indexOf(rec)}
								onToggleCompletion={toggleCompletion}
								onAction={onRecommendationAction}
								onFactorSelect={onFactorSelect}
							/>
						))}
					</div>
				) : (
					<div className="text-center py-8">
						<Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
						<p className="text-muted-foreground">
							{recommendations.length === 0
								? "No recommendations available yet"
								: "No recommendations match current filters"}
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Recommendation Card Sub-Component
// ============================================================================

interface RecommendationCardProps {
	recommendation: RecommendationWithStatus;
	originalIndex: number;
	onToggleCompletion: (index: number) => void;
	onAction?: (recommendation: PwinRecommendation) => void;
	onFactorSelect?: (factorId: string) => void;
}

function RecommendationCard({
	recommendation,
	originalIndex,
	onToggleCompletion,
	onAction,
	onFactorSelect,
}: RecommendationCardProps) {
	const priorityConfig = PRIORITY_CONFIG[recommendation.priority];
	const effortConfig = EFFORT_CONFIG[recommendation.effort];
	const timeframeConfig = TIMEFRAME_CONFIG[recommendation.timeframe];
	const PriorityIcon = priorityConfig.icon;

	return (
		<div
			className={cn(
				"p-4 rounded-lg border transition-all",
				recommendation.isCompleted
					? "bg-muted/30 border-muted opacity-60"
					: priorityConfig.bgColor
			)}
		>
			<div className="flex items-start gap-3">
				{/* Checkbox */}
				<Checkbox
					checked={recommendation.isCompleted}
					onCheckedChange={() => onToggleCompletion(originalIndex)}
					className="mt-1"
				/>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<p
							className={cn(
								"font-medium",
								recommendation.isCompleted && "line-through text-muted-foreground"
							)}
						>
							{recommendation.recommendation}
						</p>
						<Badge
							variant="outline"
							className={cn("flex-shrink-0", priorityConfig.color)}
						>
							<PriorityIcon className="h-3 w-3 mr-1" />
							{priorityConfig.label}
						</Badge>
					</div>

					{/* Meta information */}
					<div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
						{/* Impact */}
						<div className="flex items-center gap-1">
							<TrendingUp className="h-3.5 w-3.5 text-green-600" />
							<span>+{recommendation.expectedImpact}% PWin</span>
							<span className="text-muted-foreground">
								({getImpactLabel(recommendation.expectedImpact)})
							</span>
						</div>

						{/* Effort */}
						<div className={cn("flex items-center gap-1", effortConfig.color)}>
							<Zap className="h-3.5 w-3.5" />
							<span>{effortConfig.label}</span>
						</div>

						{/* Timeframe */}
						<div className={cn("flex items-center gap-1", timeframeConfig.color)}>
							<Clock className="h-3.5 w-3.5" />
							<span>{timeframeConfig.label}</span>
						</div>
					</div>

					{/* Related Factor */}
					{recommendation.factorName && (
						<div className="mt-2">
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={() => recommendation.factorId && onFactorSelect?.(recommendation.factorId)}
								disabled={!recommendation.factorId}
							>
								<Target className="h-3 w-3 mr-1" />
								{recommendation.factorName}
								{recommendation.factorId && <ChevronRight className="h-3 w-3 ml-1" />}
							</Button>
						</div>
					)}
				</div>

				{/* Action Button */}
				{onAction && !recommendation.isCompleted && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onAction(recommendation)}
						className="flex-shrink-0"
					>
						<ArrowRight className="h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	);
}

export default RecommendationList;
