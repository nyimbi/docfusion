/**
 * EvidenceDistributionChart - Visual Distribution
 *
 * Displays evidence distribution with pie/donut charts by type,
 * bar charts by strength, coverage gauge, and gaps list.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import {
	PieChart,
	BarChart3,
	Target,
	AlertTriangle,
	Loader2,
	AlertCircle,
	TrendingUp,
	FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type { EvidenceDistribution, EvidenceType, EvidenceStrengthTier, EvidenceCategory } from "@/lib/types/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceDistributionChartProps {
	/** Document ID to analyze distribution for */
	documentId?: string;
	/** Opportunity ID to analyze distribution for */
	opportunityId?: string;
	/** Pre-loaded distribution data (skips fetch) */
	distribution?: EvidenceDistribution;
	/** Compact display mode */
	compact?: boolean;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TYPE_COLORS: Record<string, string> = {
	metric: "bg-blue-500",
	testimonial: "bg-green-500",
	case_study: "bg-purple-500",
	certification: "bg-yellow-500",
	capability: "bg-indigo-500",
	past_performance: "bg-orange-500",
	reference: "bg-pink-500",
	award: "bg-amber-500",
	publication: "bg-teal-500",
};

const TYPE_LABELS: Record<string, string> = {
	metric: "Metrics",
	testimonial: "Testimonials",
	case_study: "Case Studies",
	certification: "Certifications",
	capability: "Capabilities",
	past_performance: "Past Performance",
	reference: "References",
	award: "Awards",
	publication: "Publications",
};

const TIER_COLORS: Record<EvidenceStrengthTier, { bg: string; text: string }> = {
	gold: { bg: "bg-yellow-500", text: "text-yellow-700" },
	silver: { bg: "bg-gray-400", text: "text-gray-600" },
	bronze: { bg: "bg-orange-500", text: "text-orange-700" },
};

const CATEGORY_LABELS: Record<string, string> = {
	technical: "Technical",
	management: "Management",
	past_performance: "Past Performance",
	cost_efficiency: "Cost Efficiency",
	corporate: "Corporate",
	staffing: "Staffing",
	cost: "Cost",
	risk: "Risk",
	innovation: "Innovation",
};

// =============================================================================
// Donut Chart Component
// =============================================================================

interface DonutChartProps {
	data: { label: string; value: number; color: string }[];
	size?: number;
	strokeWidth?: number;
	centerLabel?: string;
	centerValue?: string | number;
}

function DonutChart({
	data,
	size = 160,
	strokeWidth = 24,
	centerLabel,
	centerValue,
}: DonutChartProps) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const total = data.reduce((sum, item) => sum + item.value, 0);

	// Calculate segments
	const segments = useMemo(() => {
		let currentOffset = 0;
		return data.map((item) => {
			const percentage = total > 0 ? item.value / total : 0;
			const dashLength = percentage * circumference;
			const segment = {
				...item,
				percentage,
				dashArray: `${dashLength} ${circumference - dashLength}`,
				dashOffset: -currentOffset,
			};
			currentOffset += dashLength;
			return segment;
		});
	}, [data, total, circumference]);

	return (
		<div className="relative inline-flex items-center justify-center">
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-muted"
				/>
				{/* Segments */}
				{segments.map((segment, idx) => (
					<circle
						key={idx}
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={strokeWidth}
						strokeDasharray={segment.dashArray}
						strokeDashoffset={segment.dashOffset}
						strokeLinecap="butt"
						className={cn("transform -rotate-90 origin-center", segment.color.replace("bg-", "text-"))}
						style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
					/>
				))}
			</svg>
			{/* Center content */}
			{(centerLabel || centerValue) && (
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					{centerValue !== undefined && (
						<span className="text-2xl font-bold">{centerValue}</span>
					)}
					{centerLabel && (
						<span className="text-xs text-muted-foreground">{centerLabel}</span>
					)}
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Bar Chart Component
// =============================================================================

interface BarChartProps {
	data: { label: string; value: number; color: string }[];
	maxValue?: number;
	showPercentage?: boolean;
}

function BarChart({ data, maxValue: providedMax, showPercentage }: BarChartProps) {
	const maxValue = providedMax || Math.max(...data.map((d) => d.value), 1);

	return (
		<div className="space-y-3">
			{data.map((item, idx) => (
				<div key={idx} className="space-y-1">
					<div className="flex items-center justify-between text-sm">
						<span>{item.label}</span>
						<span className="font-medium">
							{item.value}
							{showPercentage && ` (${Math.round((item.value / maxValue) * 100)}%)`}
						</span>
					</div>
					<div className="h-3 rounded-full bg-muted overflow-hidden">
						<div
							className={cn("h-full rounded-full transition-all duration-500", item.color)}
							style={{ width: `${(item.value / maxValue) * 100}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// Coverage Gauge Component
// =============================================================================

interface CoverageGaugeProps {
	score: number;
	label?: string;
}

function CoverageGauge({ score, label = "Coverage" }: CoverageGaugeProps) {
	const getColor = () => {
		if (score >= 80) return "text-green-500";
		if (score >= 60) return "text-yellow-500";
		return "text-red-500";
	};

	return (
		<div className="flex flex-col items-center gap-2">
			<div className="relative w-32 h-16 overflow-hidden">
				{/* Semi-circle background */}
				<div className="absolute w-32 h-32 border-[12px] border-muted rounded-full" />
				{/* Semi-circle progress */}
				<div
					className={cn(
						"absolute w-32 h-32 border-[12px] rounded-full transition-all duration-700",
						getColor().replace("text-", "border-")
					)}
					style={{
						clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)",
						transform: `rotate(${(score / 100) * 180 - 180}deg)`,
						transformOrigin: "center center",
					}}
				/>
			</div>
			<div className="text-center -mt-4">
				<span className={cn("text-3xl font-bold", getColor())}>{score}%</span>
				<p className="text-xs text-muted-foreground">{label}</p>
			</div>
		</div>
	);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function DistributionSkeleton({ compact }: { compact?: boolean }) {
	if (compact) {
		return (
			<div className="flex items-center gap-4 p-4 border rounded-lg">
				<Skeleton className="h-16 w-16 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-2 w-full" />
					<Skeleton className="h-2 w-3/4" />
				</div>
			</div>
		);
	}

	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex justify-center">
					<Skeleton className="h-40 w-40 rounded-full" />
				</div>
				<div className="space-y-3">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-8 w-full" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceDistributionChart({
	documentId,
	opportunityId,
	distribution: preloadedDistribution,
	compact = false,
	className,
}: EvidenceDistributionChartProps) {
	// State
	const [distribution, setDistribution] = useState<EvidenceDistribution | null>(
		preloadedDistribution || null
	);
	const [isLoading, setIsLoading] = useState(!preloadedDistribution);
	const [error, setError] = useState<string | null>(null);

	// Load distribution data
	useEffect(() => {
		if (preloadedDistribution) {
			setDistribution(preloadedDistribution);
			return;
		}

		async function loadDistribution() {
			if (!documentId && !opportunityId) {
				setError("Either documentId or opportunityId is required");
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				// Dynamic import to avoid server action issues
				const { calculateEvidenceDistribution, calculateEvidenceCoverage } = await import(
					"@/lib/actions/evidence"
				);

				if (documentId) {
					const actionResult = await calculateEvidenceDistribution(documentId);
					if (!actionResult.success || !actionResult.data) {
						setError(actionResult.success === false ? actionResult.error : "Failed to load distribution");
						setIsLoading(false);
						return;
					}
					const result = actionResult.data;
					// Transform the result to match EvidenceDistribution type
					setDistribution({
						byType: Object.entries(result.byType || {}).map(([type, data]) => ({
							type: type as EvidenceType,
							count: (data as { count: number; percentage: number }).count,
							percentage: (data as { count: number; percentage: number }).percentage,
						})),
						byStrength: Object.entries(result.byStrength || {}).map(([tier, data]) => ({
							tier: tier as EvidenceStrengthTier,
							count: (data as { count: number; percentage: number }).count,
							percentage: (data as { count: number; percentage: number }).percentage,
						})),
						byCategory: [],
						coverage: {
							score: result.coverageScore || 0,
							gaps: result.gaps?.map((g) => g.category) || [],
						},
						totalCount: result.totalEvidence || 0,
					});
				} else if (opportunityId) {
					const actionResult = await calculateEvidenceCoverage(opportunityId);
					if (!actionResult.success || !actionResult.data) {
						setError(actionResult.success === false ? actionResult.error : "Failed to load coverage");
						setIsLoading(false);
						return;
					}
					const result = actionResult.data;
					// Transform coverage analysis to distribution format
					setDistribution({
						byType: [],
						byStrength: [],
						byCategory: [],
						coverage: {
							score: result.coveragePercentage || 0,
							gaps: result.gapsBySection?.flatMap((s) => s.missingEvidence) || [],
						},
						totalCount: result.coveredRequirements || 0,
					});
				}
			} catch (err) {
				console.error("Failed to load distribution:", err);
				setError("Failed to load evidence distribution");
			}

			setIsLoading(false);
		}

		loadDistribution();
	}, [documentId, opportunityId, preloadedDistribution]);

	// Prepare chart data
	const typeChartData = useMemo(() => {
		if (!distribution) return [];
		return distribution.byType.map((item) => ({
			label: TYPE_LABELS[item.type] || item.type,
			value: item.count,
			color: TYPE_COLORS[item.type] || "bg-gray-500",
		}));
	}, [distribution]);

	const strengthChartData = useMemo(() => {
		if (!distribution) return [];
		return distribution.byStrength.map((item) => ({
			label: `${item.tier.charAt(0).toUpperCase()}${item.tier.slice(1)} Tier`,
			value: item.count,
			color: TIER_COLORS[item.tier]?.bg || "bg-gray-500",
		}));
	}, [distribution]);

	const categoryChartData = useMemo(() => {
		if (!distribution) return [];
		return distribution.byCategory.map((item) => ({
			label: CATEGORY_LABELS[item.category] || item.category,
			value: item.count,
			color: "bg-primary",
		}));
	}, [distribution]);

	if (isLoading) {
		return <DistributionSkeleton compact={compact} />;
	}

	if (error) {
		return (
			<Alert variant="destructive" className={className}>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	if (!distribution) {
		return (
			<Card className={cn("w-full", className)}>
				<CardContent className="py-8 text-center text-muted-foreground">
					<PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
					<p className="text-sm">No distribution data available</p>
				</CardContent>
			</Card>
		);
	}

	// Compact view
	if (compact) {
		return (
			<div className={cn("flex items-center gap-4 p-4 border rounded-lg", className)}>
				<DonutChart
					data={strengthChartData}
					size={80}
					strokeWidth={12}
					centerValue={distribution.totalCount}
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-sm font-medium">Evidence Distribution</span>
						<Badge variant="outline" className="text-xs">
							{Math.round(distribution.coverage.score)}% coverage
						</Badge>
					</div>
					<div className="flex gap-3 text-xs text-muted-foreground">
						{distribution.byStrength.map((item) => (
							<div key={item.tier} className="flex items-center gap-1">
								<div
									className={cn(
										"h-2 w-2 rounded-full",
										TIER_COLORS[item.tier]?.bg
									)}
								/>
								<span>
									{item.count} {item.tier}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	// Full view
	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<PieChart className="h-5 w-5" />
					Evidence Distribution
					<Badge variant="secondary" className="ml-auto">
						{distribution.totalCount} items
					</Badge>
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-6">
				<Tabs defaultValue="type">
					<TabsList className="w-full justify-start">
						<TabsTrigger value="type">By Type</TabsTrigger>
						<TabsTrigger value="strength">By Strength</TabsTrigger>
						{categoryChartData.length > 0 && (
							<TabsTrigger value="category">By Category</TabsTrigger>
						)}
						<TabsTrigger value="coverage">Coverage</TabsTrigger>
					</TabsList>

					{/* By Type Tab */}
					<TabsContent value="type" className="mt-4">
						{typeChartData.length > 0 ? (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="flex justify-center">
									<DonutChart
										data={typeChartData}
										centerValue={distribution.totalCount}
										centerLabel="Total"
									/>
								</div>
								<div className="space-y-2">
									{typeChartData.map((item, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
										>
											<div className="flex items-center gap-2">
												<div
													className={cn("h-3 w-3 rounded-full", item.color)}
												/>
												<span className="text-sm">{item.label}</span>
											</div>
											<div className="text-sm">
												<span className="font-medium">{item.value}</span>
												<span className="text-muted-foreground ml-1">
													({Math.round((item.value / distribution.totalCount) * 100)}%)
												</span>
											</div>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No type data available</p>
							</div>
						)}
					</TabsContent>

					{/* By Strength Tab */}
					<TabsContent value="strength" className="mt-4">
						{strengthChartData.length > 0 ? (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="flex justify-center">
									<DonutChart
										data={strengthChartData}
										centerValue={distribution.totalCount}
										centerLabel="Total"
									/>
								</div>
								<div>
									<BarChart data={strengthChartData} showPercentage />
								</div>
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No strength data available</p>
							</div>
						)}
					</TabsContent>

					{/* By Category Tab */}
					{categoryChartData.length > 0 && (
						<TabsContent value="category" className="mt-4">
							<BarChart data={categoryChartData} showPercentage />
						</TabsContent>
					)}

					{/* Coverage Tab */}
					<TabsContent value="coverage" className="mt-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="flex justify-center pt-4">
								<CoverageGauge score={Math.round(distribution.coverage.score)} />
							</div>
							<div className="space-y-4">
								{/* Coverage Progress */}
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span>Overall Coverage</span>
										<span className="font-medium">
											{Math.round(distribution.coverage.score)}%
										</span>
									</div>
									<Progress
										value={distribution.coverage.score}
										className={cn(
											"h-3",
											distribution.coverage.score >= 80 && "[&>div]:bg-green-500",
											distribution.coverage.score >= 60 &&
												distribution.coverage.score < 80 &&
												"[&>div]:bg-yellow-500",
											distribution.coverage.score < 60 && "[&>div]:bg-red-500"
										)}
									/>
								</div>

								{/* Gaps List */}
								{distribution.coverage.gaps.length > 0 && (
									<div className="space-y-2">
										<h4 className="text-sm font-medium flex items-center gap-2">
											<AlertTriangle className="h-4 w-4 text-yellow-500" />
											Coverage Gaps ({distribution.coverage.gaps.length})
										</h4>
										<ul className="space-y-1">
											{distribution.coverage.gaps.slice(0, 5).map((gap, idx) => (
												<li
													key={idx}
													className="text-sm text-muted-foreground flex items-start gap-2 p-2 bg-muted/50 rounded"
												>
													<span className="text-yellow-500 font-medium">{idx + 1}.</span>
													{gap}
												</li>
											))}
											{distribution.coverage.gaps.length > 5 && (
												<li className="text-sm text-muted-foreground pl-6">
													... and {distribution.coverage.gaps.length - 5} more gaps
												</li>
											)}
										</ul>
									</div>
								)}

								{distribution.coverage.gaps.length === 0 && (
									<Alert>
										<TrendingUp className="h-4 w-4" />
										<AlertDescription>
											Great! No significant coverage gaps identified.
										</AlertDescription>
									</Alert>
								)}
							</div>
						</div>
					</TabsContent>
				</Tabs>

				{/* Summary Stats */}
				<div className="grid grid-cols-3 gap-4 pt-4 border-t">
					<div className="text-center">
						<div className="text-2xl font-bold">
							{distribution.byStrength.find((s) => s.tier === "gold")?.count || 0}
						</div>
						<div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
							<div className="h-2 w-2 rounded-full bg-yellow-500" />
							Gold Tier
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold">
							{distribution.byStrength.find((s) => s.tier === "silver")?.count || 0}
						</div>
						<div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
							<div className="h-2 w-2 rounded-full bg-gray-400" />
							Silver Tier
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold">
							{distribution.byStrength.find((s) => s.tier === "bronze")?.count || 0}
						</div>
						<div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
							<div className="h-2 w-2 rounded-full bg-orange-500" />
							Bronze Tier
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default EvidenceDistributionChart;
