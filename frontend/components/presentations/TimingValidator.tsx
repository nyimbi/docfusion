"use client";

/**
 * TimingValidator Component - DocFusion
 *
 * Validate presentation timing against time limits, showing per-slide
 * analysis and recommendations for adjustments.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Clock,
	CheckCircle,
	AlertTriangle,
	XCircle,
	ChevronDown,
	ChevronRight,
	RefreshCw,
	TrendingDown,
	TrendingUp,
	Minus,
	BarChart2,
	Lightbulb,
	Timer,
	Gauge,
} from "lucide-react";
import type { PresentationSlide, TimingAnalysis } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface TimingValidatorProps {
	/** Presentation ID */
	presentationId: string;
	/** All slides */
	slides: PresentationSlide[];
	/** Time limit in minutes */
	timeLimit: number;
	/** Pre-computed timing analysis (optional) */
	analysis?: TimingAnalysis | null;
	/** Callback to trigger validation */
	onValidate: () => void;
	/** Additional class names */
	className?: string;
}

type TimingStatus = "under" | "on_target" | "over";

interface SlideTimingInfo {
	id: string;
	number: number;
	title: string;
	estimated: number;
	recommended: number;
	variance: number;
	status: TimingStatus;
}

// ============================================================================
// Component
// ============================================================================

export function TimingValidator({
	presentationId,
	slides,
	timeLimit,
	analysis,
	onValidate,
	className,
}: TimingValidatorProps) {
	// State
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["overview"]));
	const [isValidating, setIsValidating] = useState(false);

	// Calculations
	const timeLimitSeconds = timeLimit * 60;

	const slideTimings: SlideTimingInfo[] = useMemo(() => {
		// Distribute time proportionally based on content complexity
		const totalEstimated = slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0);
		const ratio = timeLimitSeconds / totalEstimated;

		return slides.map((slide, index) => {
			const estimated = slide.estimatedDuration ?? 60;
			const recommended = Math.round(estimated * ratio);
			const variance = estimated - recommended;

			let status: TimingStatus = "on_target";
			if (variance > 15) status = "over";
			else if (variance < -15) status = "under";

			return {
				id: slide.id,
				number: index + 1,
				title: slide.title ?? `Slide ${index + 1}`,
				estimated,
				recommended,
				variance,
				status,
			};
		});
	}, [slides, timeLimitSeconds]);

	const totalEstimated = useMemo(
		() => slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0),
		[slides]
	);

	const totalVariance = totalEstimated - timeLimitSeconds;
	const varianceMinutes = Math.abs(Math.round(totalVariance / 60));
	const varianceSeconds = Math.abs(totalVariance % 60);

	const overallStatus: TimingStatus = useMemo(() => {
		if (Math.abs(totalVariance) <= 60) return "on_target"; // Within 1 minute
		return totalVariance > 0 ? "over" : "under";
	}, [totalVariance]);

	const overrunSlides = slideTimings.filter((s) => s.status === "over");
	const underrunSlides = slideTimings.filter((s) => s.status === "under");

	const statusConfig: Record<TimingStatus, { label: string; color: string; icon: typeof CheckCircle; bgColor: string }> = {
		under: {
			label: "Under Time",
			color: "text-yellow-600",
			icon: TrendingDown,
			bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
		},
		on_target: {
			label: "On Target",
			color: "text-green-600",
			icon: CheckCircle,
			bgColor: "bg-green-100 dark:bg-green-900/30",
		},
		over: {
			label: "Over Time",
			color: "text-destructive",
			icon: AlertTriangle,
			bgColor: "bg-red-100 dark:bg-red-900/30",
		},
	};

	const currentStatusConfig = statusConfig[overallStatus];

	// Handlers
	const handleToggleSection = (section: string) => {
		setExpandedSections((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(section)) {
				newSet.delete(section);
			} else {
				newSet.add(section);
			}
			return newSet;
		});
	};

	const handleValidate = async () => {
		setIsValidating(true);
		try {
			await onValidate();
		} finally {
			setIsValidating(false);
		}
	};

	// Format duration
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(Math.abs(seconds) / 60);
		const secs = Math.abs(seconds) % 60;
		const sign = seconds < 0 ? "-" : "";
		return `${sign}${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Progress percentage (capped at 150%)
	const progressPercent = Math.min((totalEstimated / timeLimitSeconds) * 100, 150);

	return (
		<TooltipProvider>
			<ScrollArea className={cn("h-full", className)}>
				<div className="p-3 space-y-4">
					{/* Header */}
					<div className="flex items-center justify-between">
						<h3 className="font-medium flex items-center gap-2">
							<Clock className="h-4 w-4" />
							Timing Validator
						</h3>

						<Button
							variant="outline"
							size="sm"
							onClick={handleValidate}
							disabled={isValidating}
						>
							{isValidating ? (
								<RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
							) : (
								<RefreshCw className="h-3.5 w-3.5 mr-1" />
							)}
							Validate
						</Button>
					</div>

					{/* Overview Card */}
					<Card className={cn("border-2", currentStatusConfig.bgColor)}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-2">
									<currentStatusConfig.icon className={cn("h-5 w-5", currentStatusConfig.color)} />
									<span className={cn("font-medium", currentStatusConfig.color)}>
										{currentStatusConfig.label}
									</span>
								</div>
								<Badge variant="outline" className={currentStatusConfig.color}>
									{overallStatus === "on_target"
										? "Within Target"
										: `${varianceMinutes}m ${varianceSeconds}s ${overallStatus === "over" ? "over" : "under"}`
									}
								</Badge>
							</div>

							{/* Time Progress */}
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Estimated Duration</span>
									<span className="font-medium">{formatDuration(totalEstimated)}</span>
								</div>

								<Progress
									value={Math.min(progressPercent, 100)}
									className={cn(
										"h-2",
										overallStatus === "over" && "[&>div]:bg-destructive",
										overallStatus === "under" && "[&>div]:bg-yellow-500"
									)}
								/>

								<div className="flex items-center justify-between text-xs text-muted-foreground">
									<span>0:00</span>
									<span className="flex items-center gap-1">
										<Timer className="h-3 w-3" />
										Target: {timeLimit}:00
									</span>
									<span>{Math.round(timeLimit * 1.5)}:00</span>
								</div>
							</div>

							{/* Quick Stats */}
							<div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
								<div className="text-center">
									<p className="text-2xl font-bold">{slides.length}</p>
									<p className="text-xs text-muted-foreground">Slides</p>
								</div>
								<div className="text-center">
									<p className="text-2xl font-bold">{Math.round(totalEstimated / slides.length)}s</p>
									<p className="text-xs text-muted-foreground">Avg/Slide</p>
								</div>
								<div className="text-center">
									<p className={cn("text-2xl font-bold", currentStatusConfig.color)}>
										{formatDuration(totalVariance)}
									</p>
									<p className="text-xs text-muted-foreground">Variance</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Problem Slides */}
					{(overrunSlides.length > 0 || underrunSlides.length > 0) && (
						<Collapsible
							open={expandedSections.has("problems")}
							onOpenChange={() => handleToggleSection("problems")}
						>
							<CollapsibleTrigger asChild>
								<Card className="cursor-pointer hover:bg-muted/50 transition-colors">
									<CardHeader className="p-3">
										<CardTitle className="text-sm flex items-center justify-between">
											<span className="flex items-center gap-2">
												<AlertTriangle className="h-4 w-4 text-destructive" />
												Timing Issues ({overrunSlides.length + underrunSlides.length})
											</span>
											{expandedSections.has("problems") ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
										</CardTitle>
									</CardHeader>
								</Card>
							</CollapsibleTrigger>

							<CollapsibleContent>
								<Card className="mt-1 border-t-0 rounded-t-none">
									<CardContent className="p-3 space-y-2">
										{overrunSlides.map((slide) => (
											<div
												key={slide.id}
												className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-sm"
											>
												<div className="flex items-center gap-2">
													<TrendingUp className="h-4 w-4 text-destructive" />
													<span>Slide {slide.number}: {slide.title}</span>
												</div>
												<Badge variant="outline" className="text-destructive">
													+{formatDuration(slide.variance)}
												</Badge>
											</div>
										))}

										{underrunSlides.map((slide) => (
											<div
												key={slide.id}
												className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-sm"
											>
												<div className="flex items-center gap-2">
													<TrendingDown className="h-4 w-4 text-yellow-600" />
													<span>Slide {slide.number}: {slide.title}</span>
												</div>
												<Badge variant="outline" className="text-yellow-600">
													{formatDuration(slide.variance)}
												</Badge>
											</div>
										))}
									</CardContent>
								</Card>
							</CollapsibleContent>
						</Collapsible>
					)}

					{/* All Slides Timing */}
					<Collapsible
						open={expandedSections.has("all")}
						onOpenChange={() => handleToggleSection("all")}
					>
						<CollapsibleTrigger asChild>
							<Card className="cursor-pointer hover:bg-muted/50 transition-colors">
								<CardHeader className="p-3">
									<CardTitle className="text-sm flex items-center justify-between">
										<span className="flex items-center gap-2">
											<BarChart2 className="h-4 w-4" />
											All Slides Timing
										</span>
										{expandedSections.has("all") ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</CardTitle>
								</CardHeader>
							</Card>
						</CollapsibleTrigger>

						<CollapsibleContent>
							<Card className="mt-1 border-t-0 rounded-t-none">
								<CardContent className="p-3 space-y-1">
									{slideTimings.map((slide) => {
										const config = statusConfig[slide.status];
										return (
											<div
												key={slide.id}
												className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
											>
												<Badge variant="outline" className="w-8 justify-center">
													{slide.number}
												</Badge>

												<div className="flex-1 min-w-0">
													<p className="text-sm truncate">{slide.title}</p>
												</div>

												<div className="flex items-center gap-3 text-sm">
													<div className="flex items-center gap-1">
														<Clock className="h-3 w-3 text-muted-foreground" />
														<span>{formatDuration(slide.estimated)}</span>
													</div>

													{slide.status !== "on_target" && (
														<Badge
															variant="outline"
															className={cn("text-[10px]", config.color)}
														>
															{slide.variance > 0 ? "+" : ""}
															{formatDuration(slide.variance)}
														</Badge>
													)}

													<config.icon className={cn("h-4 w-4", config.color)} />
												</div>
											</div>
										);
									})}
								</CardContent>
							</Card>
						</CollapsibleContent>
					</Collapsible>

					{/* Recommendations */}
					{overallStatus !== "on_target" && (
						<Card className="bg-primary/5 border-primary/20">
							<CardHeader className="p-3 pb-2">
								<CardTitle className="text-sm flex items-center gap-2">
									<Lightbulb className="h-4 w-4 text-primary" />
									Recommendations
								</CardTitle>
							</CardHeader>
							<CardContent className="p-3 pt-0">
								<ul className="text-sm space-y-2">
									{overallStatus === "over" && (
										<>
											<li className="flex items-start gap-2">
												<Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
												<span>
													Reduce content on slides{" "}
													{overrunSlides.map((s) => s.number).join(", ")} to save{" "}
													{formatDuration(overrunSlides.reduce((sum, s) => sum + s.variance, 0))}
												</span>
											</li>
											<li className="flex items-start gap-2">
												<Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
												<span>
													Consider combining similar slides or moving detail to backup slides
												</span>
											</li>
											<li className="flex items-start gap-2">
												<Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
												<span>
													Practice delivery to identify areas for streamlining
												</span>
											</li>
										</>
									)}
									{overallStatus === "under" && (
										<>
											<li className="flex items-start gap-2">
												<Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
												<span>
													Add more detail or talking points to underutilized slides
												</span>
											</li>
											<li className="flex items-start gap-2">
												<Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
												<span>
													Include additional examples or case studies
												</span>
											</li>
											<li className="flex items-start gap-2">
												<Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
												<span>
													Plan for audience questions or discussion time
												</span>
											</li>
										</>
									)}
								</ul>
							</CardContent>
						</Card>
					)}

					{/* API Analysis Results */}
					{analysis && (
						<Card>
							<CardHeader className="p-3 pb-2">
								<CardTitle className="text-sm flex items-center gap-2">
									<Gauge className="h-4 w-4" />
									Detailed Analysis
								</CardTitle>
							</CardHeader>
							<CardContent className="p-3 pt-0">
								<div className="space-y-2 text-sm">
									{analysis.recommendations?.map((rec, i) => (
										<div key={i} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
											<Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
											<span>{rec}</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</ScrollArea>
		</TooltipProvider>
	);
}
