/**
 * ScoringRubric - Evaluation Scoring Interface
 *
 * Provides interface for reviewers to score proposals against
 * evaluation criteria with detailed rationale capture.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
	BarChart3,
	Star,
	Info,
	Save,
	ChevronDown,
	ChevronUp,
	AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export type RatingCategory =
	| "outstanding"
	| "good"
	| "acceptable"
	| "marginal"
	| "unacceptable";

export interface EvaluationCriteria {
	id: string;
	reference: string;
	name: string;
	description: string;
	maxScore: number;
	weight: number;
	category: string;
	subcriteria?: {
		id: string;
		name: string;
		description: string;
		maxScore: number;
	}[];
}

export interface CriteriaScore {
	criteriaId: string;
	score: number | null;
	maxScore: number;
	ratingCategory?: RatingCategory;
	rationale?: string;
	strengths?: string[];
	weaknesses?: string[];
	subcriteriaScores?: {
		subcriteriaId: string;
		score: number | null;
	}[];
}

export interface ScoringRubricProps {
	criteria: EvaluationCriteria[];
	scores: CriteriaScore[];
	onUpdateScore?: (
		criteriaId: string,
		score: Partial<CriteriaScore>
	) => void;
	onSaveAll?: () => Promise<void>;
	isReadOnly?: boolean;
	showWeights?: boolean;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RATING_CATEGORIES: {
	value: RatingCategory;
	label: string;
	description: string;
	color: string;
	range: [number, number];
}[] = [
	{
		value: "outstanding",
		label: "Outstanding",
		description: "Exceeds requirements in a way beneficial to the government",
		color: "text-green-600 bg-green-100 dark:bg-green-900/30",
		range: [90, 100],
	},
	{
		value: "good",
		label: "Good",
		description: "Meets requirements with no weaknesses",
		color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
		range: [75, 89],
	},
	{
		value: "acceptable",
		label: "Acceptable",
		description: "Meets minimum requirements with minor weaknesses",
		color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
		range: [60, 74],
	},
	{
		value: "marginal",
		label: "Marginal",
		description: "Does not clearly meet minimum requirements",
		color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
		range: [40, 59],
	},
	{
		value: "unacceptable",
		label: "Unacceptable",
		description: "Fails to meet minimum requirements",
		color: "text-red-600 bg-red-100 dark:bg-red-900/30",
		range: [0, 39],
	},
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ScoringRubric({
	criteria,
	scores,
	onUpdateScore,
	onSaveAll,
	isReadOnly = false,
	showWeights = true,
	className,
}: ScoringRubricProps) {
	const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(
		new Set()
	);
	const [isSaving, setIsSaving] = useState(false);

	// Get score for a criteria
	const getScore = useCallback(
		(criteriaId: string): CriteriaScore | undefined => {
			return scores.find((s) => s.criteriaId === criteriaId);
		},
		[scores]
	);

	// Calculate rating category from score
	const calculateRating = useCallback((score: number, maxScore: number): RatingCategory => {
		const percentage = (score / maxScore) * 100;
		const rating = RATING_CATEGORIES.find(
			(r) => percentage >= r.range[0] && percentage <= r.range[1]
		);
		return rating?.value || "unacceptable";
	}, []);

	// Toggle criteria expansion
	const toggleExpanded = useCallback((criteriaId: string) => {
		setExpandedCriteria((prev) => {
			const next = new Set(prev);
			if (next.has(criteriaId)) {
				next.delete(criteriaId);
			} else {
				next.add(criteriaId);
			}
			return next;
		});
	}, []);

	// Handle score change
	const handleScoreChange = useCallback(
		(criteriaId: string, score: number, maxScore: number) => {
			const ratingCategory = calculateRating(score, maxScore);
			onUpdateScore?.(criteriaId, { score, ratingCategory });
		},
		[onUpdateScore, calculateRating]
	);

	// Handle rating category selection
	const handleRatingChange = useCallback(
		(criteriaId: string, rating: RatingCategory, maxScore: number) => {
			const ratingConfig = RATING_CATEGORIES.find((r) => r.value === rating);
			if (ratingConfig) {
				const midpoint = Math.round(
					((ratingConfig.range[0] + ratingConfig.range[1]) / 2 / 100) * maxScore
				);
				onUpdateScore?.(criteriaId, { score: midpoint, ratingCategory: rating });
			}
		},
		[onUpdateScore]
	);

	// Handle save all
	const handleSaveAll = useCallback(async () => {
		setIsSaving(true);
		try {
			await onSaveAll?.();
		} finally {
			setIsSaving(false);
		}
	}, [onSaveAll]);

	// Calculate overall progress
	const progress = useMemo(() => {
		const scored = scores.filter((s) => s.score !== null).length;
		return {
			scored,
			total: criteria.length,
			percentage: criteria.length > 0 ? (scored / criteria.length) * 100 : 0,
		};
	}, [scores, criteria]);

	// Calculate weighted score
	const weightedScore = useMemo(() => {
		let totalWeightedScore = 0;
		let totalWeight = 0;

		criteria.forEach((c) => {
			const score = getScore(c.id);
			if (score?.score !== null && score?.score !== undefined) {
				const normalizedScore = (score.score / c.maxScore) * 100;
				totalWeightedScore += normalizedScore * c.weight;
				totalWeight += c.weight;
			}
		});

		return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
	}, [criteria, getScore]);

	// Group criteria by category
	const criteriaByCategory = useMemo(() => {
		const grouped: Record<string, EvaluationCriteria[]> = {};
		criteria.forEach((c) => {
			if (!grouped[c.category]) {
				grouped[c.category] = [];
			}
			grouped[c.category].push(c);
		});
		return grouped;
	}, [criteria]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Scoring Rubric
					</h3>
					<p className="text-sm text-muted-foreground">
						{progress.scored} of {progress.total} criteria scored
					</p>
				</div>

				{!isReadOnly && (
					<Button onClick={handleSaveAll} disabled={isSaving}>
						<Save className="h-4 w-4 mr-2" />
						{isSaving ? "Saving..." : "Save All Scores"}
					</Button>
				)}
			</div>

			{/* Progress */}
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">Scoring Progress</span>
						<span className="text-sm text-muted-foreground">
							{progress.percentage.toFixed(0)}% complete
						</span>
					</div>
					<Progress value={progress.percentage} className="h-2 mb-4" />

					{progress.percentage === 100 && (
						<div className="flex items-center justify-between p-3 bg-muted rounded-lg">
							<div>
								<span className="text-sm font-medium">Weighted Score</span>
								<p className="text-2xl font-bold">{weightedScore.toFixed(1)}</p>
							</div>
							<Badge
								className={cn(
									RATING_CATEGORIES.find(
										(r) =>
											weightedScore >= r.range[0] && weightedScore <= r.range[1]
									)?.color
								)}
							>
								{
									RATING_CATEGORIES.find(
										(r) =>
											weightedScore >= r.range[0] && weightedScore <= r.range[1]
									)?.label
								}
							</Badge>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Rating Legend */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">Rating Scale</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="grid grid-cols-5 gap-2">
						{RATING_CATEGORIES.map((rating) => (
							<TooltipProvider key={rating.value}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div
											className={cn(
												"p-2 rounded text-center cursor-help",
												rating.color
											)}
										>
											<p className="text-xs font-medium">{rating.label}</p>
											<p className="text-[10px] opacity-75">
												{rating.range[0]}-{rating.range[1]}%
											</p>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										<p className="max-w-[200px]">{rating.description}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Criteria by Category */}
			{Object.entries(criteriaByCategory).map(([category, categoryCriteria]) => (
				<div key={category} className="space-y-3">
					<h4 className="font-medium text-muted-foreground uppercase text-sm tracking-wide">
						{category}
					</h4>

					{categoryCriteria.map((criterion) => {
						const score = getScore(criterion.id);
						const isExpanded = expandedCriteria.has(criterion.id);
						const currentRating = score?.ratingCategory;
						const ratingConfig = RATING_CATEGORIES.find(
							(r) => r.value === currentRating
						);

						return (
							<Card key={criterion.id}>
								<Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(criterion.id)}>
									<div className="p-4">
										{/* Criteria Header */}
										<div className="flex items-start gap-4">
											<CollapsibleTrigger asChild>
												<Button variant="ghost" size="icon" className="shrink-0 mt-0.5" aria-label={isExpanded ? "Collapse criteria" : "Expand criteria"}>
													{isExpanded ? (
														<ChevronUp className="h-4 w-4" />
													) : (
														<ChevronDown className="h-4 w-4" />
													)}
												</Button>
											</CollapsibleTrigger>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<Badge variant="outline">{criterion.reference}</Badge>
													<h5 className="font-medium">{criterion.name}</h5>
													{showWeights && (
														<Badge variant="secondary" className="ml-auto">
															Weight: {(criterion.weight * 100).toFixed(0)}%
														</Badge>
													)}
												</div>
												<p className="text-sm text-muted-foreground line-clamp-2">
													{criterion.description}
												</p>
											</div>

											{/* Score Display */}
											<div className="text-right shrink-0">
												{score?.score !== null && score?.score !== undefined ? (
													<>
														<p className="text-2xl font-bold">
															{score.score}
															<span className="text-base font-normal text-muted-foreground">
																/{criterion.maxScore}
															</span>
														</p>
														{ratingConfig && (
															<Badge className={cn("mt-1", ratingConfig.color)}>
																{ratingConfig.label}
															</Badge>
														)}
													</>
												) : (
													<Badge variant="outline" className="text-muted-foreground">
														Not scored
													</Badge>
												)}
											</div>
										</div>

										{/* Scoring Controls (always visible) */}
										{!isReadOnly && (
											<div className="mt-4 pt-4 border-t">
												<div className="flex items-center gap-4">
													<div className="flex-1">
														<Slider
															value={[score?.score ?? 0]}
															max={criterion.maxScore}
															step={1}
															onValueChange={([value]) =>
																handleScoreChange(
																	criterion.id,
																	value,
																	criterion.maxScore
																)
															}
														/>
														<div className="flex justify-between text-xs text-muted-foreground mt-1">
															<span>0</span>
															<span>{criterion.maxScore}</span>
														</div>
													</div>

													<Select
														value={currentRating || ""}
														onValueChange={(v) =>
															handleRatingChange(
																criterion.id,
																v as RatingCategory,
																criterion.maxScore
															)
														}
													>
														<SelectTrigger className="w-[150px]">
															<SelectValue placeholder="Select rating" />
														</SelectTrigger>
														<SelectContent>
															{RATING_CATEGORIES.map((rating) => (
																<SelectItem key={rating.value} value={rating.value}>
																	<span className={cn(rating.color.split(" ")[0])}>
																		{rating.label}
																	</span>
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											</div>
										)}
									</div>

									{/* Expanded Content */}
									<CollapsibleContent>
										<div className="px-4 pb-4 space-y-4">
											{/* Rationale */}
											<div className="space-y-2">
												<Label>Rationale</Label>
												<Textarea
													placeholder="Explain the score..."
													value={score?.rationale || ""}
													onChange={(e) =>
														onUpdateScore?.(criterion.id, {
															rationale: e.target.value,
														})
													}
													disabled={isReadOnly}
													rows={3}
												/>
											</div>

											{/* Strengths & Weaknesses */}
											<div className="grid grid-cols-2 gap-4">
												<div className="space-y-2">
													<Label className="text-green-600">Strengths</Label>
													<Textarea
														placeholder="List strengths..."
														value={score?.strengths?.join("\n") || ""}
														onChange={(e) =>
															onUpdateScore?.(criterion.id, {
																strengths: e.target.value
																	.split("\n")
																	.filter((s) => s.trim()),
															})
														}
														disabled={isReadOnly}
														rows={3}
													/>
												</div>
												<div className="space-y-2">
													<Label className="text-red-600">Weaknesses</Label>
													<Textarea
														placeholder="List weaknesses..."
														value={score?.weaknesses?.join("\n") || ""}
														onChange={(e) =>
															onUpdateScore?.(criterion.id, {
																weaknesses: e.target.value
																	.split("\n")
																	.filter((s) => s.trim()),
															})
														}
														disabled={isReadOnly}
														rows={3}
													/>
												</div>
											</div>

											{/* Subcriteria */}
											{criterion.subcriteria && criterion.subcriteria.length > 0 && (
												<div className="space-y-3">
													<Label>Subcriteria Scores</Label>
													{criterion.subcriteria.map((sub) => {
														const subScore = score?.subcriteriaScores?.find(
															(s) => s.subcriteriaId === sub.id
														);
														return (
															<div
																key={sub.id}
																className="flex items-center gap-4 p-3 bg-muted rounded-lg"
															>
																<div className="flex-1">
																	<p className="text-sm font-medium">{sub.name}</p>
																	<p className="text-xs text-muted-foreground">
																		{sub.description}
																	</p>
																</div>
																<div className="w-24">
																	<Slider
																		value={[subScore?.score ?? 0]}
																		max={sub.maxScore}
																		step={1}
																		disabled={isReadOnly}
																	/>
																</div>
																<span className="text-sm w-16 text-right">
																	{subScore?.score ?? 0}/{sub.maxScore}
																</span>
															</div>
														);
													})}
												</div>
											)}
										</div>
									</CollapsibleContent>
								</Collapsible>
							</Card>
						);
					})}
				</div>
			))}

			{/* Missing Scores Warning */}
			{progress.percentage < 100 && (
				<Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
					<CardContent className="p-4 flex items-center gap-3">
						<AlertCircle className="h-5 w-5 text-amber-600" />
						<div>
							<p className="font-medium text-amber-800 dark:text-amber-400">
								{progress.total - progress.scored} criteria not yet scored
							</p>
							<p className="text-sm text-amber-700 dark:text-amber-500">
								Complete all scores before submitting your review.
							</p>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default ScoringRubric;
