"use client";

/**
 * Pattern Analysis Component
 *
 * Displays and manages identified win/loss patterns with AI-powered
 * insights and actionable recommendations.
 */

import { useState, useEffect, useTransition, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	TrendingUp,
	TrendingDown,
	Lightbulb,
	AlertTriangle,
	Target,
	DollarSign,
	Users,
	Zap,
	RefreshCw,
	CheckCircle,
	Eye,
	Filter,
	Loader2,
	ChevronRight,
	ArrowUp,
	ArrowDown,
} from "lucide-react";
import { analyzeWinLossPatterns, getPatterns, acknowledgePattern } from "@/lib/actions/winloss";
import type {
	WinLossPattern,
	PatternAnalysis as PatternAnalysisType,
	PatternType,
	PatternInsight,
	PatternRecommendation,
} from "@/lib/types/winloss";

interface PatternAnalysisProps {
	initialPatterns?: WinLossPattern[];
	initialAnalysis?: PatternAnalysisType;
	onPatternSelect?: (pattern: WinLossPattern) => void;
	className?: string;
}

const PATTERN_TYPE_CONFIG: Record<
	PatternType,
	{ label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
	strength: {
		label: "Strength",
		color: "text-green-700",
		bgColor: "bg-green-100",
		icon: <TrendingUp className="h-4 w-4" />,
	},
	weakness: {
		label: "Weakness",
		color: "text-red-700",
		bgColor: "bg-red-100",
		icon: <TrendingDown className="h-4 w-4" />,
	},
	process: {
		label: "Process",
		color: "text-blue-700",
		bgColor: "bg-blue-100",
		icon: <Target className="h-4 w-4" />,
	},
	competitor: {
		label: "Competitor",
		color: "text-purple-700",
		bgColor: "bg-purple-100",
		icon: <Users className="h-4 w-4" />,
	},
	pricing: {
		label: "Pricing",
		color: "text-amber-700",
		bgColor: "bg-amber-100",
		icon: <DollarSign className="h-4 w-4" />,
	},
	team: {
		label: "Team",
		color: "text-cyan-700",
		bgColor: "bg-cyan-100",
		icon: <Users className="h-4 w-4" />,
	},
};

export function PatternAnalysis({
	initialPatterns,
	initialAnalysis,
	onPatternSelect,
	className,
}: PatternAnalysisProps) {
	const [isPending, startTransition] = useTransition();
	const [patterns, setPatterns] = useState<WinLossPattern[]>(initialPatterns ?? []);
	const [analysis, setAnalysis] = useState<PatternAnalysisType | null>(initialAnalysis ?? null);
	const [isLoading, setIsLoading] = useState(!initialPatterns);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [filterType, setFilterType] = useState<PatternType | "all">("all");
	const [selectedPattern, setSelectedPattern] = useState<WinLossPattern | null>(null);

	// Fetch patterns
	const fetchPatterns = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const filters = filterType !== "all" ? { patternType: filterType } : undefined;
				const result = await getPatterns(filters);

				if (result.success) {
					setPatterns(result.data);
				}
			} catch (error) {
				console.error("Failed to fetch patterns:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, [filterType]);

	// Run new analysis
	const runAnalysis = useCallback(async () => {
		setIsAnalyzing(true);
		try {
			const result = await analyzeWinLossPatterns();

			if (result.success && result.data) {
				setAnalysis(result.data as unknown as PatternAnalysisType);
				setPatterns((result.data as unknown as PatternAnalysisType).patterns ?? []);
			}
		} catch (error) {
			console.error("Failed to run analysis:", error);
		} finally {
			setIsAnalyzing(false);
		}
	}, []);

	// Acknowledge pattern
	const handleAcknowledge = useCallback(
		async (patternId: string) => {
			startTransition(async () => {
				try {
					const result = await acknowledgePattern(patternId);

					if (result.success) {
						// Update pattern in list
						setPatterns((prev) =>
							prev.map((p) =>
								p.id === patternId
									? { ...p, lastAnalyzedAt: new Date() }
									: p
							)
						);
					}
				} catch (error) {
					console.error("Failed to acknowledge pattern:", error);
				}
			});
		},
		[]
	);

	useEffect(() => {
		if (!initialPatterns) {
			fetchPatterns();
		}
	}, [initialPatterns, fetchPatterns, filterType]);

	// Filter patterns
	const filteredPatterns = patterns.filter(
		(p) => filterType === "all" || p.patternType === filterType
	);

	// Get correlation indicator
	const getCorrelationIndicator = (correlation: number | null) => {
		if (correlation === null || correlation === undefined) return null;

		if (correlation > 0.3) {
			return (
				<span className="flex items-center gap-1 text-green-600">
					<ArrowUp className="h-3 w-3" />
					Positive
				</span>
			);
		}
		if (correlation < -0.3) {
			return (
				<span className="flex items-center gap-1 text-red-600">
					<ArrowDown className="h-3 w-3" />
					Negative
				</span>
			);
		}
		return <span className="text-muted-foreground">Neutral</span>;
	};

	if (isLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid grid-cols-2 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardContent className="pt-6">
								<Skeleton className="h-6 w-3/4 mb-2" />
								<Skeleton className="h-4 w-full mb-4" />
								<Skeleton className="h-20 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">Pattern Analysis</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={filterType}
						onValueChange={(value) => setFilterType(value as PatternType | "all")}
					>
						<SelectTrigger className="w-[160px]">
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="All Types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							<SelectItem value="strength">Strengths</SelectItem>
							<SelectItem value="weakness">Weaknesses</SelectItem>
							<SelectItem value="process">Process</SelectItem>
							<SelectItem value="competitor">Competitor</SelectItem>
							<SelectItem value="pricing">Pricing</SelectItem>
							<SelectItem value="team">Team</SelectItem>
						</SelectContent>
					</Select>

					<Button onClick={runAnalysis} disabled={isAnalyzing}>
						{isAnalyzing ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Run Analysis
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Analysis Summary (if available) */}
			{analysis && (
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-primary" />
							AI Analysis Summary
						</CardTitle>
						<CardDescription>
							Confidence: {Math.round(analysis.confidence * 100)}%
							{analysis.analyzedAt && (
								<span className="ml-2">
									| Last analyzed:{" "}
									{new Date(analysis.analyzedAt).toLocaleDateString()}
								</span>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Insights */}
						{analysis.insights && analysis.insights.length > 0 && (
							<div>
								<h4 className="font-medium mb-2 flex items-center gap-2">
									<Lightbulb className="h-4 w-4 text-amber-500" />
									Key Insights
								</h4>
								<ul className="space-y-1">
									{analysis.insights.slice(0, 3).map((insight, index) => (
										<li
											key={index}
											className="text-sm text-muted-foreground flex items-start gap-2"
										>
											<span className="text-primary">-</span>
											{typeof insight === "string" ? insight : insight.insight}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Recommendations */}
						{analysis.recommendations && analysis.recommendations.length > 0 && (
							<div>
								<h4 className="font-medium mb-2 flex items-center gap-2">
									<Target className="h-4 w-4 text-blue-500" />
									Recommendations
								</h4>
								<ul className="space-y-1">
									{analysis.recommendations.slice(0, 3).map((rec, index) => (
										<li
											key={index}
											className="text-sm text-muted-foreground flex items-start gap-2"
										>
											<span className="text-primary">-</span>
											{typeof rec === "string" ? rec : rec.recommendation}
										</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Patterns Grid */}
			{filteredPatterns.length > 0 ? (
				<div className="grid grid-cols-2 gap-4">
					{filteredPatterns.map((pattern) => {
						const typeConfig =
							PATTERN_TYPE_CONFIG[pattern.patternType as PatternType] ??
							PATTERN_TYPE_CONFIG.process;

						return (
							<Card
								key={pattern.id}
								className={cn(
									"cursor-pointer hover:border-primary/50 transition-colors",
									selectedPattern?.id === pattern.id && "border-primary"
								)}
								onClick={() => {
									setSelectedPattern(pattern);
									onPatternSelect?.(pattern);
								}}
							>
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-2">
											<Badge
												variant="secondary"
												className={cn(typeConfig.bgColor, typeConfig.color)}
											>
												{typeConfig.icon}
												<span className="ml-1">{typeConfig.label}</span>
											</Badge>
											{pattern.isActive && (
												<Badge variant="outline" className="text-green-600 border-green-200">
													Active
												</Badge>
											)}
										</div>
										<div className="text-right text-sm text-muted-foreground">
											{getCorrelationIndicator(pattern.winCorrelation)}
										</div>
									</div>
									<CardTitle className="text-lg mt-2">
										{pattern.patternName}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<p className="text-sm text-muted-foreground line-clamp-2">
										{pattern.description}
									</p>

									{/* Confidence */}
									<div className="space-y-1">
										<div className="flex justify-between text-sm">
											<span>Confidence</span>
											<span className="font-medium">
												{Math.round((pattern.confidence ?? 0) * 100)}%
											</span>
										</div>
										<Progress
											value={(pattern.confidence ?? 0) * 100}
											className="h-1.5"
										/>
									</div>

									{/* Stats */}
									<div className="flex items-center justify-between text-sm text-muted-foreground">
										<span>{pattern.occurrenceCount ?? 0} occurrences</span>
										{pattern.lastAnalyzedAt && (
											<span className="flex items-center gap-1">
												<CheckCircle className="h-3 w-3" />
												Reviewed
											</span>
										)}
									</div>

									{/* Actions */}
									<div className="flex gap-2 pt-2 border-t">
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={(e) => {
												e.stopPropagation();
												setSelectedPattern(pattern);
											}}
										>
											<Eye className="h-4 w-4 mr-1" />
											Details
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={(e) => {
												e.stopPropagation();
												handleAcknowledge(pattern.id);
											}}
											disabled={isPending}
										>
											<CheckCircle className="h-4 w-4 mr-1" />
											Acknowledge
										</Button>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<Card>
					<CardContent className="py-12 text-center">
						<AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">No patterns found</p>
						<p className="text-sm text-muted-foreground mt-1">
							Run an analysis to identify patterns from your debriefs
						</p>
						<Button onClick={runAnalysis} className="mt-4" disabled={isAnalyzing}>
							{isAnalyzing ? "Analyzing..." : "Run Analysis"}
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Pattern Detail Dialog */}
			<Dialog
				open={!!selectedPattern}
				onOpenChange={(open) => !open && setSelectedPattern(null)}
			>
				<DialogContent className="max-w-2xl">
					{selectedPattern && (
						<>
							<DialogHeader>
								<div className="flex items-center gap-2 mb-2">
									{(() => {
										const config =
											PATTERN_TYPE_CONFIG[selectedPattern.patternType as PatternType] ??
											PATTERN_TYPE_CONFIG.process;
										return (
											<Badge
												variant="secondary"
												className={cn(config.bgColor, config.color)}
											>
												{config.icon}
												<span className="ml-1">{config.label}</span>
											</Badge>
										);
									})()}
								</div>
								<DialogTitle>{selectedPattern.patternName}</DialogTitle>
								<DialogDescription>
									{selectedPattern.description}
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								{/* Metrics */}
								<div className="grid grid-cols-3 gap-4">
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-sm text-muted-foreground">Win Correlation</p>
										<p className="text-lg font-semibold">
											{selectedPattern.winCorrelation !== null
												? `${(selectedPattern.winCorrelation * 100).toFixed(0)}%`
												: "-"}
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-sm text-muted-foreground">Confidence</p>
										<p className="text-lg font-semibold">
											{Math.round((selectedPattern.confidence ?? 0) * 100)}%
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-sm text-muted-foreground">Occurrences</p>
										<p className="text-lg font-semibold">
											{selectedPattern.occurrenceCount ?? 0}
										</p>
									</div>
								</div>

								{/* Recommendations */}
								{selectedPattern.recommendations &&
									Array.isArray(selectedPattern.recommendations) &&
									selectedPattern.recommendations.length > 0 && (
										<div>
											<h4 className="font-medium mb-2">Recommendations</h4>
											<ul className="space-y-2">
												{(selectedPattern.recommendations as PatternRecommendation[]).map(
													(rec, index) => (
														<li
															key={index}
															className="flex items-start gap-2 p-3 bg-muted rounded-lg"
														>
															<ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
															<div className="flex-1">
																<p className="text-sm">
																	{typeof rec === "string"
																		? rec
																		: rec.recommendation}
																</p>
																{typeof rec !== "string" && (
																	<div className="flex gap-2 mt-1">
																		<Badge variant="outline" className="text-xs">
																			{rec.priority} priority
																		</Badge>
																		<Badge variant="outline" className="text-xs">
																			{rec.effort} effort
																		</Badge>
																	</div>
																)}
															</div>
														</li>
													)
												)}
											</ul>
										</div>
									)}

								{/* Related Debriefs */}
								{selectedPattern.relatedDebriefs &&
									Array.isArray(selectedPattern.relatedDebriefs) &&
									selectedPattern.relatedDebriefs.length > 0 && (
										<div>
											<h4 className="font-medium mb-2">Related Debriefs</h4>
											<p className="text-sm text-muted-foreground">
												This pattern was identified in{" "}
												{selectedPattern.relatedDebriefs.length} debriefs
											</p>
										</div>
									)}
							</div>

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setSelectedPattern(null)}
								>
									Close
								</Button>
								<Button
									onClick={() => {
										handleAcknowledge(selectedPattern.id);
										setSelectedPattern(null);
									}}
									disabled={isPending}
								>
									<CheckCircle className="h-4 w-4 mr-2" />
									Acknowledge
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default PatternAnalysis;
