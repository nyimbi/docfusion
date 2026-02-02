"use client";

/**
 * PracticeAnalysis Component - DocFusion
 *
 * Analyze practice recording with detailed feedback on timing,
 * pacing, content coverage, and improvement recommendations.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
	BarChart3,
	TrendingUp,
	TrendingDown,
	Clock,
	CheckCircle,
	AlertTriangle,
	XCircle,
	ChevronDown,
	ChevronRight,
	Play,
	Target,
	Zap,
	MessageSquare,
	Award,
	ArrowUp,
	ArrowDown,
	Minus,
	Lightbulb,
	Volume2,
	Gauge,
	FileText,
	RefreshCw,
} from "lucide-react";
import type {
	PracticeRecording,
	PracticeAnalysis as PracticeAnalysisType,
	PresentationSlide,
	PacingAnalysis,
	ContentCoverage,
} from "@/lib/types/presentations";
import { analyzePracticeRecording } from "@/lib/actions/presentations";

// ============================================================================
// Types
// ============================================================================

interface PracticeAnalysisProps {
	/** The recording to analyze */
	recording: PracticeRecording;
	/** Pre-computed analysis (optional) */
	analysis?: PracticeAnalysisType | null;
	/** All slides for reference */
	slides: PresentationSlide[];
	/** Callback when analysis is refreshed */
	onRefresh?: () => void;
	/** Additional class names */
	className?: string;
}

// ============================================================================
// Score Gauge Component
// ============================================================================

function ScoreGauge({
	score,
	label,
	size = "medium",
}: {
	score: number;
	label: string;
	size?: "small" | "medium" | "large";
}) {
	const getScoreColor = (s: number) => {
		if (s >= 80) return "text-green-600 dark:text-green-400";
		if (s >= 60) return "text-yellow-600 dark:text-yellow-400";
		return "text-red-600 dark:text-red-400";
	};

	const getBgColor = (s: number) => {
		if (s >= 80) return "bg-green-100 dark:bg-green-900/30";
		if (s >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
		return "bg-red-100 dark:bg-red-900/30";
	};

	const sizes = {
		small: { container: "w-16 h-16", text: "text-lg", label: "text-[10px]" },
		medium: { container: "w-24 h-24", text: "text-2xl", label: "text-xs" },
		large: { container: "w-32 h-32", text: "text-4xl", label: "text-sm" },
	};

	const sizeConfig = sizes[size];

	return (
		<div className="flex flex-col items-center">
			<div
				className={cn(
					"rounded-full flex items-center justify-center",
					sizeConfig.container,
					getBgColor(score)
				)}
			>
				<span className={cn("font-bold", sizeConfig.text, getScoreColor(score))}>
					{Math.round(score)}
				</span>
			</div>
			<span className={cn("text-muted-foreground mt-1", sizeConfig.label)}>
				{label}
			</span>
		</div>
	);
}

// ============================================================================
// Component
// ============================================================================

export function PracticeAnalysis({
	recording,
	analysis: preloadedAnalysis,
	slides,
	onRefresh,
	className,
}: PracticeAnalysisProps) {
	// State
	const [analysis, setAnalysis] = useState<PracticeAnalysisType | null>(
		preloadedAnalysis ?? null
	);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [activeTab, setActiveTab] = useState("overview");
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["summary"]));

	// Parse recording data - use contentCoverage as it contains slide timing info
	const slideTiming = useMemo(() => {
		if (!recording.contentCoverage) return [];
		if (Array.isArray(recording.contentCoverage)) {
			// Map contentCoverage to slide timing format
			let cumulativeTime = 0;
			return recording.contentCoverage.map((coverage) => {
				const startTime = cumulativeTime;
				cumulativeTime += coverage.duration || 0;
				return {
					slideId: coverage.slideId,
					slideNumber: coverage.slideNumber,
					startTime,
					endTime: cumulativeTime,
					duration: coverage.duration,
				};
			});
		}
		return [];
	}, [recording.contentCoverage]);

	const pacingAnalysis: PacingAnalysis | null = useMemo(() => {
		if (!analysis) return null;
		return analysis.pacing as PacingAnalysis;
	}, [analysis]);

	const contentCoverage: ContentCoverage[] = useMemo(() => {
		if (!analysis) return [];
		return (analysis.contentCoverage ?? []) as ContentCoverage[];
	}, [analysis]);

	// Handlers
	const handleAnalyze = async () => {
		setIsAnalyzing(true);
		try {
			const result = await analyzePracticeRecording(recording.id);
			if (result.success && result.data) {
				// Map function response to PracticeAnalysisType
				const mappedAnalysis: PracticeAnalysisType = {
					recordingId: recording.id,
					duration: recording.duration ?? 0,
					overallScore: result.data.overallScore,
					pacing: result.data.pacingAnalysis,
					contentCoverage: result.data.contentCoverage,
					fillerWords: result.data.fillerWordAnalysis,
					feedback: result.data.recommendations.join(" "),
					recommendations: result.data.recommendations,
				};
				setAnalysis(mappedAnalysis);
			}
		} finally {
			setIsAnalyzing(false);
		}
	};

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

	// Format time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(Math.abs(seconds) / 60);
		const secs = Math.abs(seconds) % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Get status icon
	const getStatusIcon = (status: string) => {
		switch (status) {
			case "ok":
				return <CheckCircle className="h-4 w-4 text-green-600" />;
			case "too_short":
				return <TrendingDown className="h-4 w-4 text-yellow-600" />;
			case "too_long":
				return <TrendingUp className="h-4 w-4 text-red-600" />;
			default:
				return <Minus className="h-4 w-4 text-muted-foreground" />;
		}
	};

	if (!analysis) {
		return (
			<div className={cn("flex flex-col items-center justify-center h-full p-8", className)}>
				<BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
				<h2 className="text-xl font-semibold mb-2">Analyze Your Practice</h2>
				<p className="text-muted-foreground text-center max-w-md mb-6">
					Get detailed feedback on your timing, pacing, content coverage,
					and personalized recommendations for improvement.
				</p>
				<Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg">
					{isAnalyzing ? (
						<RefreshCw className="h-5 w-5 mr-2 animate-spin" />
					) : (
						<Zap className="h-5 w-5 mr-2" />
					)}
					{isAnalyzing ? "Analyzing..." : "Start Analysis"}
				</Button>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full", className)}>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b bg-card">
					<div>
						<h2 className="font-semibold flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-primary" />
							Practice Analysis
						</h2>
						<p className="text-sm text-muted-foreground">
							{recording.recordingType ?? "Recording"} - {formatTime(recording.duration ?? 0)}
						</p>
					</div>

					<Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
						{isAnalyzing ? (
							<RefreshCw className="h-4 w-4 mr-1 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4 mr-1" />
						)}
						Re-analyze
					</Button>
				</div>

				{/* Score Summary */}
				<div className="p-4 border-b bg-muted/30">
					<div className="flex items-center justify-around">
						<ScoreGauge score={analysis.overallScore} label="Overall" size="large" />
						<div className="flex gap-4">
							<ScoreGauge
								score={pacingAnalysis?.variationScore ?? 75}
								label="Pacing"
								size="small"
							/>
							<ScoreGauge
								score={(contentCoverage.reduce((sum, c) => sum + c.coverageScore, 0) / Math.max(contentCoverage.length, 1)) || 75}
								label="Coverage"
								size="small"
							/>
							<ScoreGauge
								score={analysis.overallScore >= 80 ? 85 : analysis.overallScore >= 60 ? 70 : 55}
								label="Timing"
								size="small"
							/>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
					<TabsList className="mx-4 mt-2 grid grid-cols-4">
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="timing">Timing</TabsTrigger>
						<TabsTrigger value="pacing">Pacing</TabsTrigger>
						<TabsTrigger value="feedback">Feedback</TabsTrigger>
					</TabsList>

					<ScrollArea className="flex-1">
						{/* Overview Tab */}
						<TabsContent value="overview" className="p-4 space-y-4 m-0">
							{/* Key Metrics */}
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<Gauge className="h-4 w-4" />
										Key Metrics
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-4">
										<div className="p-3 bg-muted/50 rounded-lg">
											<p className="text-xs text-muted-foreground">Duration</p>
											<p className="text-lg font-medium">
												{formatTime(recording.duration ?? 0)}
											</p>
										</div>
										<div className="p-3 bg-muted/50 rounded-lg">
											<p className="text-xs text-muted-foreground">Avg WPM</p>
											<p className="text-lg font-medium">
												{pacingAnalysis?.averageWPM ?? "--"}
											</p>
										</div>
										<div className="p-3 bg-muted/50 rounded-lg">
											<p className="text-xs text-muted-foreground">Slides Covered</p>
											<p className="text-lg font-medium">
												{slideTiming.length} / {slides.length}
											</p>
										</div>
										<div className="p-3 bg-muted/50 rounded-lg">
											<p className="text-xs text-muted-foreground">Pause Score</p>
											<p className="text-lg font-medium">
												{pacingAnalysis?.pauseScore ?? "--"}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Strengths */}
							{analysis.recommendations && analysis.recommendations.length > 0 && (
								<Card className="border-green-200 dark:border-green-800">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm flex items-center gap-2 text-green-600">
											<Award className="h-4 w-4" />
											Strengths
										</CardTitle>
									</CardHeader>
									<CardContent>
										<ul className="space-y-2">
											{(analysis.recommendations.slice(0, 3) ?? []).map((item, i) => (
												<li key={i} className="flex items-start gap-2 text-sm">
													<CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
													<span>{item}</span>
												</li>
											))}
										</ul>
									</CardContent>
								</Card>
							)}

							{/* Areas for Improvement */}
							{analysis.recommendations && analysis.recommendations.length > 3 && (
								<Card className="border-yellow-200 dark:border-yellow-800">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm flex items-center gap-2 text-yellow-600">
											<Target className="h-4 w-4" />
											Areas for Improvement
										</CardTitle>
									</CardHeader>
									<CardContent>
										<ul className="space-y-2">
											{(analysis.recommendations.slice(3) ?? []).map((item, i) => (
												<li key={i} className="flex items-start gap-2 text-sm">
													<AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
													<span>{item}</span>
												</li>
											))}
										</ul>
									</CardContent>
								</Card>
							)}

							{/* Comparison to Previous */}
							{analysis.comparisonToPrevious && (
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm flex items-center gap-2">
											<TrendingUp className="h-4 w-4" />
											Compared to Previous
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-center gap-4">
											<div className={cn(
												"flex items-center gap-1",
												analysis.comparisonToPrevious.scoreChange >= 0
													? "text-green-600"
													: "text-red-600"
											)}>
												{analysis.comparisonToPrevious.scoreChange >= 0 ? (
													<ArrowUp className="h-4 w-4" />
												) : (
													<ArrowDown className="h-4 w-4" />
												)}
												<span className="font-medium">
													{Math.abs(analysis.comparisonToPrevious.scoreChange)} points
												</span>
											</div>
											<Badge variant="outline">
												{analysis.comparisonToPrevious.scoreChange >= 0 ? "Improved" : "Declined"}
											</Badge>
										</div>

										{analysis.comparisonToPrevious.improvementAreas && analysis.comparisonToPrevious.improvementAreas.length > 0 && (
											<div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
												<p className="text-xs font-medium text-green-600 mb-1">Improvements</p>
												<ul className="text-xs space-y-0.5">
													{analysis.comparisonToPrevious.improvementAreas.map((area, i) => (
														<li key={i}>{area}</li>
													))}
												</ul>
											</div>
										)}
									</CardContent>
								</Card>
							)}
						</TabsContent>

						{/* Timing Tab */}
						<TabsContent value="timing" className="p-4 space-y-4 m-0">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<Clock className="h-4 w-4" />
										Slide-by-Slide Timing
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									{slideTiming.map((timing, index) => {
										const slide = slides.find((s) => s.id === timing.slideId);
										const target = slide?.estimatedDuration ?? 60;
										const actual = timing.duration ?? 0;
										const variance = actual - target;
										const status = Math.abs(variance) <= 10
											? "ok"
											: variance > 0
												? "too_long"
												: "too_short";

										return (
											<div
												key={timing.slideId}
												className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
											>
												<Badge variant="outline" className="w-8 justify-center">
													{timing.slideNumber}
												</Badge>

												<div className="flex-1 min-w-0">
													<p className="text-sm truncate">
														{slide?.title ?? `Slide ${timing.slideNumber}`}
													</p>
													<div className="flex items-center gap-2 mt-1">
														<Progress
															value={Math.min((actual / target) * 100, 150)}
															className="h-1.5 flex-1"
														/>
														<span className="text-xs text-muted-foreground">
															{formatTime(actual)} / {formatTime(target)}
														</span>
													</div>
												</div>

												{getStatusIcon(status)}

												{variance !== 0 && (
													<Badge
														variant="outline"
														className={cn(
															"text-[10px]",
															status === "too_long" && "text-red-600",
															status === "too_short" && "text-yellow-600"
														)}
													>
														{variance > 0 ? "+" : ""}
														{formatTime(variance)}
													</Badge>
												)}
											</div>
										);
									})}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Pacing Tab */}
						<TabsContent value="pacing" className="p-4 space-y-4 m-0">
							{pacingAnalysis && (
								<>
									<Card>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm flex items-center gap-2">
												<Volume2 className="h-4 w-4" />
												Speaking Pace
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="flex items-center justify-between mb-4">
												<div>
													<p className="text-3xl font-bold">
														{pacingAnalysis.averageWPM}
													</p>
													<p className="text-sm text-muted-foreground">
														words per minute
													</p>
												</div>
												<Badge
													variant="outline"
													className={cn(
														pacingAnalysis.averageWPM >= 120 &&
															pacingAnalysis.averageWPM <= 150
															? "text-green-600"
															: "text-yellow-600"
													)}
												>
													{pacingAnalysis.averageWPM < 120
														? "Too Slow"
														: pacingAnalysis.averageWPM > 150
															? "Too Fast"
															: "Good Pace"}
												</Badge>
											</div>

											<div className="space-y-1">
												<div className="flex justify-between text-xs text-muted-foreground">
													<span>Slow (100)</span>
													<span>Ideal (135)</span>
													<span>Fast (170)</span>
												</div>
												<div className="relative h-2 bg-muted rounded-full">
													<div
														className="absolute h-2 w-1 bg-primary rounded-full"
														style={{
															left: `${Math.min(Math.max((pacingAnalysis.averageWPM - 100) / 70, 0), 1) * 100}%`,
														}}
													/>
												</div>
											</div>
										</CardContent>
									</Card>

									{/* Pacing Issues */}
									{(pacingAnalysis.tooFastSegments?.length > 0 ||
										pacingAnalysis.tooSlowSegments?.length > 0) && (
										<Card>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm flex items-center gap-2">
													<AlertTriangle className="h-4 w-4 text-yellow-600" />
													Pacing Issues
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-2">
												{pacingAnalysis.tooFastSegments?.map((segment, i) => (
													<div
														key={`fast-${i}`}
														className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-sm"
													>
														<TrendingUp className="h-4 w-4 text-red-600" />
														<span>
															Too fast at {formatTime(segment.startTime)} -{" "}
															{formatTime(segment.endTime)}
														</span>
													</div>
												))}
												{pacingAnalysis.tooSlowSegments?.map((segment, i) => (
													<div
														key={`slow-${i}`}
														className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-sm"
													>
														<TrendingDown className="h-4 w-4 text-yellow-600" />
														<span>
															Too slow at {formatTime(segment.startTime)} -{" "}
															{formatTime(segment.endTime)}
														</span>
													</div>
												))}
											</CardContent>
										</Card>
									)}
								</>
							)}
						</TabsContent>

						{/* Feedback Tab */}
						<TabsContent value="feedback" className="p-4 space-y-4 m-0">
							{/* Overall Feedback */}
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<MessageSquare className="h-4 w-4" />
										Summary Feedback
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm">{analysis.feedback ?? "No feedback available."}</p>
								</CardContent>
							</Card>

							{/* Recommendations */}
							<Card className="bg-primary/5 border-primary/20">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<Lightbulb className="h-4 w-4 text-primary" />
										Recommendations
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{(analysis.recommendations ?? []).map((rec, i) => (
											<li key={i} className="flex items-start gap-2 text-sm">
												<span className="text-primary font-medium">{i + 1}.</span>
												<span>{rec}</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>

							{/* Action Items */}
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm flex items-center gap-2">
										<Target className="h-4 w-4" />
										Next Practice Focus
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-1">
										<li className="flex items-center gap-2 text-sm">
											<div className="h-1.5 w-1.5 rounded-full bg-primary" />
											Focus on slides that went over time
										</li>
										<li className="flex items-center gap-2 text-sm">
											<div className="h-1.5 w-1.5 rounded-full bg-primary" />
											Practice transitions between sections
										</li>
										<li className="flex items-center gap-2 text-sm">
											<div className="h-1.5 w-1.5 rounded-full bg-primary" />
											Reduce filler words in key moments
										</li>
									</ul>
								</CardContent>
							</Card>
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</div>
		</TooltipProvider>
	);
}
