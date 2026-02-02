"use client";

/**
 * Improvement Areas Component
 *
 * Displays improvement opportunities with prioritization based on
 * impact and effort, with actionable suggestions derived from debriefs.
 */

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
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
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Target,
	Zap,
	AlertTriangle,
	TrendingUp,
	CheckCircle,
	RefreshCw,
	Loader2,
	Filter,
	ArrowUp,
	ArrowRight,
	ChevronRight,
	Lightbulb,
	BarChart3,
} from "lucide-react";
import { identifyImprovementAreas } from "@/lib/actions/winloss";
import type { ImprovementArea, Priority, Effort } from "@/lib/types/winloss";

interface ImprovementAreasProps {
	initialAreas?: ImprovementArea[];
	onActionClick?: (area: ImprovementArea, action: string) => void;
	className?: string;
}

type ImpactFilter = "all" | Priority;
type EffortFilter = "all" | Effort;

const IMPACT_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
	high: { label: "High Impact", color: "text-red-700", bgColor: "bg-red-100" },
	medium: { label: "Medium Impact", color: "text-amber-700", bgColor: "bg-amber-100" },
	low: { label: "Low Impact", color: "text-blue-700", bgColor: "bg-blue-100" },
};

const EFFORT_CONFIG: Record<Effort, { label: string; color: string; bgColor: string }> = {
	low: { label: "Low Effort", color: "text-green-700", bgColor: "bg-green-100" },
	medium: { label: "Medium Effort", color: "text-amber-700", bgColor: "bg-amber-100" },
	high: { label: "High Effort", color: "text-red-700", bgColor: "bg-red-100" },
};

// Calculate priority score (higher = should address first)
const getPriorityScore = (area: ImprovementArea): number => {
	const impactScore = { high: 3, medium: 2, low: 1 }[area.impact] ?? 1;
	const effortScore = { low: 3, medium: 2, high: 1 }[area.effort] ?? 1;
	return impactScore * 2 + effortScore;
};

export function ImprovementAreas({
	initialAreas,
	onActionClick,
	className,
}: ImprovementAreasProps) {
	const [isPending, startTransition] = useTransition();
	const [areas, setAreas] = useState<ImprovementArea[]>(initialAreas ?? []);
	const [isLoading, setIsLoading] = useState(!initialAreas);
	const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
	const [effortFilter, setEffortFilter] = useState<EffortFilter>("all");
	const [expandedArea, setExpandedArea] = useState<string | undefined>();

	// Fetch improvement areas
	const fetchAreas = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const result = await identifyImprovementAreas();

				if (result.success && result.data) {
					setAreas(result.data as unknown as ImprovementArea[]);
				}
			} catch (error) {
				console.error("Failed to fetch improvement areas:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, []);

	useEffect(() => {
		if (!initialAreas) {
			fetchAreas();
		}
	}, [initialAreas, fetchAreas]);

	// Filter and sort areas
	const filteredAreas = useMemo(() => {
		let result = [...areas];

		// Apply filters
		if (impactFilter !== "all") {
			result = result.filter((a) => a.impact === impactFilter);
		}
		if (effortFilter !== "all") {
			result = result.filter((a) => a.effort === effortFilter);
		}

		// Sort by priority score (descending)
		result.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

		return result;
	}, [areas, impactFilter, effortFilter]);

	// Calculate quick wins (high impact, low effort)
	const quickWins = useMemo(() => {
		return areas.filter((a) => a.impact === "high" && a.effort === "low");
	}, [areas]);

	// Calculate stats
	const stats = useMemo(() => {
		return {
			total: areas.length,
			highImpact: areas.filter((a) => a.impact === "high").length,
			quickWins: quickWins.length,
		};
	}, [areas, quickWins]);

	if (isLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardContent className="pt-6">
								<Skeleton className="h-6 w-3/4 mb-2" />
								<Skeleton className="h-8 w-16" />
							</CardContent>
						</Card>
					))}
				</div>
				<Card>
					<CardContent className="pt-6">
						<Skeleton className="h-48 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (areas.length === 0) {
		return (
			<div className={cn("text-center py-12", className)}>
				<Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<p className="text-muted-foreground">No improvement areas identified</p>
				<p className="text-sm text-muted-foreground mt-1">
					Add more debriefs with weaknesses to identify improvement opportunities
				</p>
				<Button onClick={fetchAreas} className="mt-4">
					Refresh
				</Button>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">Improvement Areas</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
					<Badge variant="outline">{stats.total} areas identified</Badge>
				</div>
				<Button variant="outline" onClick={fetchAreas} disabled={isPending}>
					<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
					Refresh
				</Button>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-3 gap-4">
				{/* Total Areas */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Areas</p>
								<p className="text-3xl font-bold mt-1">{stats.total}</p>
							</div>
							<div className="p-3 rounded-full bg-blue-100">
								<Target className="h-6 w-6 text-blue-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* High Impact */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">High Impact</p>
								<p className="text-3xl font-bold mt-1">{stats.highImpact}</p>
							</div>
							<div className="p-3 rounded-full bg-red-100">
								<AlertTriangle className="h-6 w-6 text-red-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Quick Wins */}
				<Card className="border-green-200 bg-green-50">
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-green-700">Quick Wins</p>
								<p className="text-3xl font-bold mt-1 text-green-700">
									{stats.quickWins}
								</p>
								<p className="text-xs text-green-600 mt-1">
									High impact, low effort
								</p>
							</div>
							<div className="p-3 rounded-full bg-green-200">
								<Zap className="h-6 w-6 text-green-700" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Priority Matrix */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Priority Matrix
					</CardTitle>
					<CardDescription>
						Focus on high-impact, low-effort improvements first
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-3 gap-2">
						{/* Header row */}
						<div />
						<div className="text-center text-sm font-medium text-muted-foreground py-2">
							Low Effort
						</div>
						<div className="text-center text-sm font-medium text-muted-foreground py-2">
							High Effort
						</div>

						{/* High Impact row */}
						<div className="flex items-center justify-end text-sm font-medium text-muted-foreground pr-2">
							High Impact
						</div>
						<div
							className={cn(
								"p-4 rounded-lg border-2 border-dashed text-center min-h-[80px] flex flex-col justify-center",
								quickWins.length > 0
									? "bg-green-100 border-green-300"
									: "bg-muted border-muted-foreground/20"
							)}
						>
							<Zap className="h-5 w-5 mx-auto text-green-600 mb-1" />
							<span className="text-sm font-medium text-green-700">
								Quick Wins ({quickWins.length})
							</span>
						</div>
						<div className="p-4 rounded-lg bg-amber-50 border-2 border-dashed border-amber-200 text-center min-h-[80px] flex flex-col justify-center">
							<TrendingUp className="h-5 w-5 mx-auto text-amber-600 mb-1" />
							<span className="text-sm font-medium text-amber-700">
								Strategic ({areas.filter((a) => a.impact === "high" && a.effort === "high").length})
							</span>
						</div>

						{/* Low Impact row */}
						<div className="flex items-center justify-end text-sm font-medium text-muted-foreground pr-2">
							Low Impact
						</div>
						<div className="p-4 rounded-lg bg-blue-50 border-2 border-dashed border-blue-200 text-center min-h-[80px] flex flex-col justify-center">
							<CheckCircle className="h-5 w-5 mx-auto text-blue-600 mb-1" />
							<span className="text-sm font-medium text-blue-700">
								Nice to Have ({areas.filter((a) => a.impact === "low" && a.effort === "low").length})
							</span>
						</div>
						<div className="p-4 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 text-center min-h-[80px] flex flex-col justify-center">
							<ArrowRight className="h-5 w-5 mx-auto text-gray-500 mb-1" />
							<span className="text-sm font-medium text-gray-600">
								Defer ({areas.filter((a) => a.impact === "low" && a.effort === "high").length})
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<Select
					value={impactFilter}
					onValueChange={(value) => setImpactFilter(value as ImpactFilter)}
				>
					<SelectTrigger className="w-[160px]">
						<Filter className="h-4 w-4 mr-2" />
						<SelectValue placeholder="All Impact" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Impact</SelectItem>
						<SelectItem value="high">High Impact</SelectItem>
						<SelectItem value="medium">Medium Impact</SelectItem>
						<SelectItem value="low">Low Impact</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={effortFilter}
					onValueChange={(value) => setEffortFilter(value as EffortFilter)}
				>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="All Effort" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Effort</SelectItem>
						<SelectItem value="low">Low Effort</SelectItem>
						<SelectItem value="medium">Medium Effort</SelectItem>
						<SelectItem value="high">High Effort</SelectItem>
					</SelectContent>
				</Select>

				{(impactFilter !== "all" || effortFilter !== "all") && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setImpactFilter("all");
							setEffortFilter("all");
						}}
					>
						Clear Filters
					</Button>
				)}
			</div>

			{/* Areas List */}
			<Accordion
				type="single"
				collapsible
				value={expandedArea}
				onValueChange={setExpandedArea}
			>
				{filteredAreas.map((area) => {
					const impactConfig = IMPACT_CONFIG[area.impact];
					const effortConfig = EFFORT_CONFIG[area.effort];
					const isQuickWin = area.impact === "high" && area.effort === "low";
					const priorityScore = getPriorityScore(area);

					return (
						<AccordionItem key={area.id} value={area.id}>
							<AccordionTrigger className="hover:no-underline">
								<div className="flex items-center gap-4 flex-1 text-left">
									{/* Quick win indicator */}
									{isQuickWin && (
										<div className="flex-shrink-0">
											<Zap className="h-5 w-5 text-green-600" />
										</div>
									)}

									{/* Area name */}
									<div className="flex-1 min-w-0">
										<p className="font-medium capitalize">{area.area}</p>
										<p className="text-sm text-muted-foreground line-clamp-1">
											{area.description}
										</p>
									</div>

									{/* Badges */}
									<div className="flex items-center gap-2 flex-shrink-0">
										<Badge
											variant="secondary"
											className={cn(impactConfig.bgColor, impactConfig.color)}
										>
											{impactConfig.label}
										</Badge>
										<Badge
											variant="secondary"
											className={cn(effortConfig.bgColor, effortConfig.color)}
										>
											{effortConfig.label}
										</Badge>
									</div>

									{/* Priority indicator */}
									<div
										className={cn(
											"flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold flex-shrink-0",
											priorityScore >= 8
												? "bg-green-100 text-green-700"
												: priorityScore >= 6
												? "bg-amber-100 text-amber-700"
												: "bg-gray-100 text-gray-600"
										)}
									>
										{priorityScore}
									</div>
								</div>
							</AccordionTrigger>

							<AccordionContent>
								<div className="pl-4 space-y-4 pt-2">
									{/* Description */}
									<p className="text-sm text-muted-foreground">
										{area.description}
									</p>

									{/* Evidence */}
									{area.evidence && area.evidence.length > 0 && (
										<div>
											<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
												<AlertTriangle className="h-4 w-4 text-amber-500" />
												Evidence from Debriefs
											</h4>
											<ul className="space-y-1 pl-6">
												{area.evidence.slice(0, 3).map((e, index) => (
													<li
														key={index}
														className="text-sm text-muted-foreground list-disc"
													>
														{e}
													</li>
												))}
												{area.evidence.length > 3 && (
													<li className="text-sm text-muted-foreground italic">
														... and {area.evidence.length - 3} more
													</li>
												)}
											</ul>
										</div>
									)}

									{/* Suggested Actions */}
									{area.suggestedActions && area.suggestedActions.length > 0 && (
										<div>
											<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
												<Lightbulb className="h-4 w-4 text-blue-500" />
												Suggested Actions
											</h4>
											<ul className="space-y-2">
												{area.suggestedActions.map((action, index) => (
													<li
														key={index}
														className="flex items-start gap-2"
													>
														<ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
														<span className="text-sm">{action}</span>
														{onActionClick && (
															<Button
																variant="ghost"
																size="sm"
																className="ml-auto"
																onClick={() => onActionClick(area, action)}
															>
																Create Task
															</Button>
														)}
													</li>
												))}
											</ul>
										</div>
									)}

									{/* ROI Impact */}
									{area.estimatedROIImpact !== undefined && (
										<div className="p-3 bg-muted rounded-lg">
											<div className="flex items-center justify-between">
												<span className="text-sm text-muted-foreground">
													Estimated ROI Impact
												</span>
												<span className="font-medium text-green-600">
													+{area.estimatedROIImpact}%
												</span>
											</div>
										</div>
									)}

									{/* Related Patterns */}
									{area.relatedPatterns && area.relatedPatterns.length > 0 && (
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-sm text-muted-foreground">
												Related patterns:
											</span>
											{area.relatedPatterns.map((pattern, index) => (
												<Badge key={index} variant="outline">
													{pattern}
												</Badge>
											))}
										</div>
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>

			{filteredAreas.length === 0 && (
				<Card>
					<CardContent className="py-12 text-center">
						<Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">No areas match your filters</p>
						<Button
							variant="ghost"
							onClick={() => {
								setImpactFilter("all");
								setEffortFilter("all");
							}}
							className="mt-2"
						>
							Clear Filters
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Results count */}
			{filteredAreas.length > 0 && (
				<p className="text-sm text-muted-foreground text-center">
					Showing {filteredAreas.length} of {areas.length} improvement areas
				</p>
			)}
		</div>
	);
}

export default ImprovementAreas;
