"use client";

/**
 * PWin History Chart Component
 *
 * Displays historical PWin trends over time for an opportunity with
 * visual trend indicators, assessment markers, and confidence bands.
 *
 * Features:
 * - Time-series visualization of PWin changes
 * - Assessment type markers (initial, mid-capture, final, gate review)
 * - Confidence interval bands
 * - Trend indicators (improving, declining, stable)
 * - Interactive data points with tooltips
 *
 * @example
 * ```tsx
 * <PwinHistoryChart
 *   opportunityId="opp-123"
 *   targetPwin={70}
 *   onDataPointClick={(assessment) => openAssessmentDetail(assessment)}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
	TrendingUp,
	TrendingDown,
	Minus,
	Loader2,
	AlertCircle,
	RefreshCw,
	Calendar,
	Target,
	ChevronRight,
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getPwinHistory, listPwinAssessments } from "@/lib/actions/pwin";
import type { PwinAssessment, AssessmentType } from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface PwinHistoryChartProps {
	opportunityId: string;
	targetPwin?: number;
	initialData?: Array<{ date: string; pwin: number; assessmentType: string }>;
	onDataPointClick?: (assessment: PwinAssessment) => void;
	className?: string;
}

interface HistoryDataPoint {
	date: Date;
	pwin: number;
	assessmentType: AssessmentType;
	assessmentId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ASSESSMENT_TYPE_CONFIG: Record<AssessmentType, {
	label: string;
	color: string;
	bgColor: string;
}> = {
	initial: {
		label: "Initial",
		color: "text-blue-600",
		bgColor: "bg-blue-500",
	},
	mid_capture: {
		label: "Mid-Capture",
		color: "text-amber-600",
		bgColor: "bg-amber-500",
	},
	final: {
		label: "Final",
		color: "text-green-600",
		bgColor: "bg-green-500",
	},
	gate_review: {
		label: "Gate Review",
		color: "text-purple-600",
		bgColor: "bg-purple-500",
	},
};

const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 20, right: 20, bottom: 40, left: 40 };

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(date);
}

function formatFullDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function calculateTrend(data: HistoryDataPoint[]): "improving" | "declining" | "stable" {
	if (data.length < 2) return "stable";

	const firstHalf = data.slice(0, Math.ceil(data.length / 2));
	const secondHalf = data.slice(Math.ceil(data.length / 2));

	const avgFirst = firstHalf.reduce((sum, d) => sum + d.pwin, 0) / firstHalf.length;
	const avgSecond = secondHalf.reduce((sum, d) => sum + d.pwin, 0) / secondHalf.length;

	const diff = avgSecond - avgFirst;

	if (diff > 5) return "improving";
	if (diff < -5) return "declining";
	return "stable";
}

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "#22c55e"; // green-500
	if (pwin >= 50) return "#f59e0b"; // amber-500
	if (pwin >= 30) return "#f97316"; // orange-500
	return "#ef4444"; // red-500
}

// ============================================================================
// Component
// ============================================================================

export function PwinHistoryChart({
	opportunityId,
	targetPwin = 70,
	initialData,
	onDataPointClick,
	className,
}: PwinHistoryChartProps) {
	// State
	const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
	const [assessments, setAssessments] = useState<PwinAssessment[]>([]);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(!initialData);
	const [error, setError] = useState<string | null>(null);

	// Load history data
	const loadHistory = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [historyResult, assessmentsResult] = await Promise.all([
				getPwinHistory(opportunityId),
				listPwinAssessments(opportunityId),
			]);

			if (historyResult.success) {
				setHistoryData(
					historyResult.data.map(d => ({
						date: new Date(d.date),
						pwin: d.pwin,
						assessmentType: d.assessmentType as AssessmentType,
					}))
				);
			} else {
				setError(historyResult.error);
			}

			if (assessmentsResult.success) {
				setAssessments(assessmentsResult.data);
			}
		} catch (err) {
			setError("Failed to load history data");
		}

		setIsLoading(false);
	}, [opportunityId]);

	// Initialize from props or load
	useEffect(() => {
		if (initialData) {
			setHistoryData(
				initialData.map(d => ({
					date: new Date(d.date),
					pwin: d.pwin,
					assessmentType: d.assessmentType as AssessmentType,
				}))
			);
		} else {
			loadHistory();
		}
	}, [initialData, loadHistory]);

	// Compute chart data
	const chartData = useMemo(() => {
		if (historyData.length === 0) {
			return { points: [], xScale: () => 0, yScale: () => 0, pathD: "", width: 400, height: CHART_HEIGHT };
		}

		const width = 400; // We'll use viewBox for responsive
		const height = CHART_HEIGHT;

		const sortedData = [...historyData].sort(
			(a, b) => a.date.getTime() - b.date.getTime()
		);

		const minDate = sortedData[0].date.getTime();
		const maxDate = sortedData[sortedData.length - 1].date.getTime();
		const dateRange = maxDate - minDate || 1;

		const xScale = (date: Date) =>
			CHART_PADDING.left +
			((date.getTime() - minDate) / dateRange) *
				(width - CHART_PADDING.left - CHART_PADDING.right);

		const yScale = (pwin: number) =>
			CHART_PADDING.top +
			(1 - pwin / 100) * (height - CHART_PADDING.top - CHART_PADDING.bottom);

		const points = sortedData.map((d, i) => ({
			...d,
			x: xScale(d.date),
			y: yScale(d.pwin),
			index: i,
		}));

		// Create path string
		const pathD = points
			.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
			.join(" ");

		return { points, xScale, yScale, pathD, width, height };
	}, [historyData]);

	// Calculate trend
	const trend = useMemo(() => calculateTrend(historyData), [historyData]);

	// Current and change stats
	const stats = useMemo(() => {
		if (historyData.length === 0) {
			return { current: 0, change: 0, min: 0, max: 0 };
		}

		const sorted = [...historyData].sort(
			(a, b) => a.date.getTime() - b.date.getTime()
		);
		const current = sorted[sorted.length - 1].pwin;
		const first = sorted[0].pwin;
		const change = current - first;
		const min = Math.min(...sorted.map(d => d.pwin));
		const max = Math.max(...sorted.map(d => d.pwin));

		return { current, change, min, max };
	}, [historyData]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5 text-primary" />
						PWin History
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
						<Calendar className="h-5 w-5 text-primary" />
						PWin History
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertCircle className="h-10 w-10 text-destructive mb-3" />
					<p className="text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={loadHistory}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	// Empty state
	if (historyData.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5 text-primary" />
						PWin History
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<Calendar className="h-10 w-10 text-muted-foreground mb-3" />
					<p className="text-muted-foreground">
						No historical data available yet
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<TooltipProvider>
			<Card className={className}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Calendar className="h-5 w-5 text-primary" />
								PWin History
							</CardTitle>
							<CardDescription className="mt-1">
								{historyData.length} assessments over time
							</CardDescription>
						</div>

						<div className="flex items-center gap-4">
							{/* Trend Badge */}
							<Badge
								variant="outline"
								className={cn(
									"flex items-center gap-1",
									trend === "improving" && "text-green-600 border-green-600",
									trend === "declining" && "text-red-600 border-red-600",
									trend === "stable" && "text-blue-600 border-blue-600"
								)}
							>
								{trend === "improving" && <TrendingUp className="h-3.5 w-3.5" />}
								{trend === "declining" && <TrendingDown className="h-3.5 w-3.5" />}
								{trend === "stable" && <Minus className="h-3.5 w-3.5" />}
								{trend.charAt(0).toUpperCase() + trend.slice(1)}
							</Badge>

							<Button variant="outline" size="icon" onClick={loadHistory} aria-label="Refresh history">
								<RefreshCw className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Stats Summary */}
					<div className="grid grid-cols-4 gap-4 pb-4 border-b">
						<div className="text-center">
							<div className={cn("text-2xl font-bold", stats.current >= 50 ? "text-green-600" : "text-amber-600")}>
								{stats.current}%
							</div>
							<div className="text-xs text-muted-foreground">Current</div>
						</div>
						<div className="text-center">
							<div className={cn(
								"text-2xl font-bold",
								stats.change > 0 ? "text-green-600" : stats.change < 0 ? "text-red-600" : "text-muted-foreground"
							)}>
								{stats.change > 0 ? "+" : ""}{stats.change}%
							</div>
							<div className="text-xs text-muted-foreground">Change</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-muted-foreground">{stats.min}%</div>
							<div className="text-xs text-muted-foreground">Min</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-muted-foreground">{stats.max}%</div>
							<div className="text-xs text-muted-foreground">Max</div>
						</div>
					</div>

					{/* SVG Chart */}
					<div className="relative">
						<svg
							viewBox={`0 0 ${chartData.width} ${chartData.height}`}
							className="w-full"
							style={{ height: CHART_HEIGHT }}
						>
							{/* Grid Lines */}
							{[0, 25, 50, 75, 100].map((value) => {
								const y = CHART_PADDING.top +
									(1 - value / 100) *
									(CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);
								return (
									<g key={value}>
										<line
											x1={CHART_PADDING.left}
											y1={y}
											x2={chartData.width - CHART_PADDING.right}
											y2={y}
											stroke="currentColor"
											strokeOpacity={0.1}
											strokeDasharray={value === targetPwin ? "4 4" : undefined}
										/>
										<text
											x={CHART_PADDING.left - 8}
											y={y + 4}
											textAnchor="end"
											className="text-[10px] fill-muted-foreground"
										>
											{value}%
										</text>
									</g>
								);
							})}

							{/* Target Line */}
							{targetPwin && (
								<line
									x1={CHART_PADDING.left}
									y1={CHART_PADDING.top +
										(1 - targetPwin / 100) *
										(CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)}
									x2={chartData.width - CHART_PADDING.right}
									y2={CHART_PADDING.top +
										(1 - targetPwin / 100) *
										(CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)}
									stroke="#22c55e"
									strokeOpacity={0.5}
									strokeDasharray="4 4"
								/>
							)}

							{/* Area under curve */}
							{chartData.pathD && (
								<path
									d={`${chartData.pathD} L ${chartData.points[chartData.points.length - 1]?.x} ${CHART_HEIGHT - CHART_PADDING.bottom} L ${chartData.points[0]?.x} ${CHART_HEIGHT - CHART_PADDING.bottom} Z`}
									fill="url(#gradient)"
									opacity={0.2}
								/>
							)}

							{/* Gradient Definition */}
							<defs>
								<linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" stopColor="#3b82f6" />
									<stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
								</linearGradient>
							</defs>

							{/* Line */}
							{chartData.pathD && (
								<path
									d={chartData.pathD}
									fill="none"
									stroke="#3b82f6"
									strokeWidth={2}
								/>
							)}

							{/* Data Points */}
							{chartData.points.map((point, idx) => {
								const config = ASSESSMENT_TYPE_CONFIG[point.assessmentType];
								return (
									<g
										key={idx}
										onMouseEnter={() => setHoveredIndex(idx)}
										onMouseLeave={() => setHoveredIndex(null)}
										onClick={() => {
											const assessment = assessments.find(
												a => a.assessedAt?.toISOString().slice(0, 10) ===
													point.date.toISOString().slice(0, 10)
											);
											if (assessment) {
												onDataPointClick?.(assessment);
											}
										}}
										className="cursor-pointer"
									>
										<circle
											cx={point.x}
											cy={point.y}
											r={hoveredIndex === idx ? 8 : 6}
											fill={getPwinColor(point.pwin)}
											stroke="white"
											strokeWidth={2}
											className="transition-all"
										/>
									</g>
								);
							})}

							{/* X-axis labels */}
							{chartData.points
								.filter((_, i, arr) =>
									i === 0 || i === arr.length - 1 || arr.length <= 5
								)
								.map((point, idx) => (
									<text
										key={idx}
										x={point.x}
										y={CHART_HEIGHT - 10}
										textAnchor="middle"
										className="text-[10px] fill-muted-foreground"
									>
										{formatDate(point.date)}
									</text>
								))}
						</svg>

						{/* Hover Tooltip */}
						{hoveredIndex !== null && chartData.points[hoveredIndex] && (
							<div
								className="absolute bg-popover border rounded-lg shadow-lg p-3 pointer-events-none z-10"
								style={{
									left: `${(chartData.points[hoveredIndex].x / chartData.width) * 100}%`,
									top: `${(chartData.points[hoveredIndex].y / CHART_HEIGHT) * 100}%`,
									transform: "translate(-50%, -120%)",
								}}
							>
								<div className="text-xs text-muted-foreground">
									{formatFullDate(chartData.points[hoveredIndex].date)}
								</div>
								<div className="text-lg font-bold">
									{chartData.points[hoveredIndex].pwin}%
								</div>
								<Badge variant="outline" className="text-xs mt-1">
									{ASSESSMENT_TYPE_CONFIG[chartData.points[hoveredIndex].assessmentType].label}
								</Badge>
							</div>
						)}
					</div>

					{/* Legend */}
					<div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t text-xs">
						{Object.entries(ASSESSMENT_TYPE_CONFIG).map(([type, config]) => (
							<div key={type} className="flex items-center gap-1">
								<div className={cn("w-3 h-3 rounded-full", config.bgColor)} />
								<span className="text-muted-foreground">{config.label}</span>
							</div>
						))}
						{targetPwin && (
							<div className="flex items-center gap-1">
								<div className="w-3 h-0.5 bg-green-500 border-dashed border-b-2 border-green-500" />
								<span className="text-muted-foreground">Target ({targetPwin}%)</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</TooltipProvider>
	);
}

export default PwinHistoryChart;
