/**
 * PipelineAnalytics Component - DocFusion Capture Pipeline
 *
 * Analytics dashboard with pipeline metrics, charts, conversion rates,
 * and forecasting. Provides visual insights into pipeline health
 * and performance trends.
 *
 * Accessibility: Chart alternatives with data tables, descriptive labels.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	BarChart3,
	TrendingUp,
	TrendingDown,
	DollarSign,
	Target,
	Calendar,
	Clock,
	AlertTriangle,
	CheckCircle,
	ArrowRight,
	Briefcase,
	Award,
	XCircle,
	RefreshCw,
	Download,
	Loader2,
	PieChart,
	Activity,
} from "lucide-react";
import { getPipelineAnalytics, forecastPipeline, identifyAtRiskOpportunities } from "@/lib/actions/pipeline";
import type { PipelineAnalytics as PipelineAnalyticsType, PipelineForecast, AtRiskOpportunity } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface PipelineAnalyticsProps {
	/** Organization ID for filtering */
	organizationId?: string;
	/** Time range for analytics */
	timeRange?: "30d" | "90d" | "1y" | "all";
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number | null): string {
	if (value === null || value === undefined) return "$0";
	if (value >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(1)}M`;
	}
	if (value >= 1_000) {
		return `$${(value / 1_000).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

function getStageColor(stage: string): string {
	const colors: Record<string, string> = {
		discovery: "bg-slate-500",
		qualification: "bg-blue-500",
		capture: "bg-indigo-500",
		proposal: "bg-purple-500",
		submitted: "bg-cyan-500",
		evaluation: "bg-yellow-500",
		awarded: "bg-green-500",
		lost: "bg-red-500",
		no_bid: "bg-gray-500",
	};
	return colors[stage] || "bg-gray-500";
}

function getRiskColor(level: string): string {
	switch (level) {
		case "high":
			return "text-red-600 bg-red-100 dark:bg-red-900/30";
		case "medium":
			return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
		case "low":
			return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
		default:
			return "text-gray-600 bg-gray-100";
	}
}

// ============================================================================
// Stage Funnel Component
// ============================================================================

interface StageFunnelProps {
	data: Array<{ stage: string; count: number; totalValue: number; avgPwin: number }>;
}

function StageFunnel({ data }: StageFunnelProps) {
	const maxCount = Math.max(...data.map((d) => d.count), 1);
	const stageOrder = ["discovery", "qualification", "capture", "proposal", "submitted", "evaluation"];
	const sortedData = [...data].sort(
		(a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
	);

	return (
		<div className="space-y-3">
			{sortedData.map((item, idx) => {
				const widthPercent = (item.count / maxCount) * 100;
				return (
					<div key={item.stage} className="space-y-1">
						<div className="flex items-center justify-between text-sm">
							<span className="capitalize font-medium">{item.stage.replace("_", " ")}</span>
							<span className="text-muted-foreground">
								{item.count} opportunities | {formatCurrency(item.totalValue)} | {item.avgPwin}% avg PWin
							</span>
						</div>
						<div className="relative h-8 rounded-lg overflow-hidden bg-muted">
							<div
								className={cn("h-full transition-all duration-500", getStageColor(item.stage))}
								style={{ width: `${widthPercent}%` }}
							/>
							<span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white mix-blend-difference">
								{item.count}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ============================================================================
// Conversion Rates Component
// ============================================================================

interface ConversionRatesProps {
	data: Array<{ from: string; to: string; rate: number }>;
}

function ConversionRates({ data }: ConversionRatesProps) {
	return (
		<div className="space-y-3">
			{data.map((conversion, idx) => (
				<div key={idx} className="flex items-center gap-3">
					<Badge variant="secondary" className="capitalize">
						{conversion.from.replace("_", " ")}
					</Badge>
					<ArrowRight className="h-4 w-4 text-muted-foreground" />
					<Badge variant="secondary" className="capitalize">
						{conversion.to.replace("_", " ")}
					</Badge>
					<div className="flex-1" />
					<div className="flex items-center gap-2">
						<Progress value={conversion.rate} className="w-24 h-2" />
						<span
							className={cn(
								"text-sm font-medium w-12 text-right",
								conversion.rate >= 70 ? "text-green-600" : conversion.rate >= 40 ? "text-yellow-600" : "text-red-600"
							)}
						>
							{conversion.rate}%
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

// ============================================================================
// Forecast Component
// ============================================================================

interface ForecastDisplayProps {
	forecast: PipelineForecast;
}

function ForecastDisplay({ forecast }: ForecastDisplayProps) {
	return (
		<div className="space-y-4">
			{/* Summary */}
			<div className="grid grid-cols-3 gap-4">
				<div className="text-center p-4 bg-muted rounded-lg">
					<div className="text-2xl font-bold text-green-600">
						{formatCurrency(forecast.totalForecastedValue)}
					</div>
					<div className="text-sm text-muted-foreground">Forecasted Value</div>
				</div>
				<div className="text-center p-4 bg-muted rounded-lg">
					<div className="text-2xl font-bold">
						{formatCurrency(forecast.confidenceInterval.low)}
					</div>
					<div className="text-sm text-muted-foreground">Low Estimate</div>
				</div>
				<div className="text-center p-4 bg-muted rounded-lg">
					<div className="text-2xl font-bold">
						{formatCurrency(forecast.confidenceInterval.high)}
					</div>
					<div className="text-sm text-muted-foreground">High Estimate</div>
				</div>
			</div>

			{/* Quarterly breakdown */}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Quarter</TableHead>
						<TableHead className="text-right">Pipeline Value</TableHead>
						<TableHead className="text-right">Expected Value</TableHead>
						<TableHead className="text-right">Expected Wins</TableHead>
						<TableHead className="text-right">Confidence</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{forecast.quarters.map((quarter) => (
						<TableRow key={quarter.quarter}>
							<TableCell className="font-medium">{quarter.quarter}</TableCell>
							<TableCell className="text-right">{formatCurrency(quarter.pipelineValue)}</TableCell>
							<TableCell className="text-right font-medium text-green-600">
								{formatCurrency(quarter.expectedValue)}
							</TableCell>
							<TableCell className="text-right">{quarter.expectedWins}</TableCell>
							<TableCell className="text-right">
								<Badge
									variant="secondary"
									className={cn(
										quarter.confidence >= 0.7 ? "bg-green-100 text-green-700" :
										quarter.confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" :
										"bg-red-100 text-red-700"
									)}
								>
									{Math.round(quarter.confidence * 100)}%
								</Badge>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

// ============================================================================
// At Risk Opportunities Component
// ============================================================================

interface AtRiskListProps {
	opportunities: AtRiskOpportunity[];
	onViewOpportunity?: (opportunityId: string) => void;
}

function AtRiskList({ opportunities, onViewOpportunity }: AtRiskListProps) {
	if (opportunities.length === 0) {
		return (
			<div className="text-center py-8">
				<CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
				<h4 className="font-semibold mb-2">All Clear</h4>
				<p className="text-sm text-muted-foreground">
					No opportunities currently at risk
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{opportunities.map((opp) => (
				<Card key={opp.pipelineId} className="hover:shadow-md transition-shadow">
					<CardContent className="p-4">
						<div className="flex items-start justify-between gap-4">
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-1">
									<h4 className="font-medium text-sm">{opp.opportunityName}</h4>
									<Badge className={cn("text-xs", getRiskColor(opp.riskLevel))}>
										{opp.riskLevel} risk
									</Badge>
								</div>
								<div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
									<span>{formatCurrency(opp.contractValue)}</span>
									<span>{opp.pwin}% PWin</span>
								</div>
								<div className="space-y-1">
									<p className="text-xs font-medium text-red-600">Risk Factors:</p>
									<ul className="text-xs text-muted-foreground space-y-0.5">
										{opp.riskFactors.slice(0, 3).map((factor, idx) => (
											<li key={idx} className="flex items-start gap-1">
												<AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-500" />
												{factor}
											</li>
										))}
									</ul>
								</div>
								{opp.recommendations.length > 0 && (
									<div className="mt-2 space-y-1">
										<p className="text-xs font-medium text-green-600">Recommendations:</p>
										<ul className="text-xs text-muted-foreground space-y-0.5">
											{opp.recommendations.slice(0, 2).map((rec, idx) => (
												<li key={idx} className="flex items-start gap-1">
													<CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-500" />
													{rec}
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
							{onViewOpportunity && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onViewOpportunity(opp.opportunityId)}
								>
									View
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function PipelineAnalytics({
	organizationId,
	timeRange = "all",
	className,
}: PipelineAnalyticsProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [analytics, setAnalytics] = useState<PipelineAnalyticsType | null>(null);
	const [forecast, setForecast] = useState<PipelineForecast | null>(null);
	const [atRiskOpportunities, setAtRiskOpportunities] = useState<AtRiskOpportunity[]>([]);
	const [activeTab, setActiveTab] = useState("overview");
	const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

	// Load analytics data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			try {
				const [analyticsRes, forecastRes, atRiskRes] = await Promise.all([
					getPipelineAnalytics(organizationId),
					forecastPipeline(organizationId),
					identifyAtRiskOpportunities(),
				]);

				if (analyticsRes.success) {
					setAnalytics(analyticsRes.data);
				}

				if (forecastRes.success) {
					setForecast(forecastRes.data);
				}

				if (atRiskRes.success) {
					setAtRiskOpportunities(atRiskRes.data);
				}
			} catch (error) {
				console.error("Failed to load analytics:", error);
			} finally {
				setIsLoading(false);
			}
		}

		loadData();
	}, [organizationId, selectedTimeRange]);

	// Refresh data
	const handleRefresh = useCallback(() => {
		setIsLoading(true);
		// Trigger re-fetch
		setSelectedTimeRange((prev) => prev);
	}, []);

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center p-8", className)}>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<BarChart3 className="h-6 w-6" />
						Pipeline Analytics
					</h2>
					<p className="text-muted-foreground">
						Track pipeline performance and forecast outcomes
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Select value={selectedTimeRange} onValueChange={(v) => setSelectedTimeRange(v as typeof selectedTimeRange)}>
						<SelectTrigger className="w-[120px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="30d">Last 30 days</SelectItem>
							<SelectItem value="90d">Last 90 days</SelectItem>
							<SelectItem value="1y">Last year</SelectItem>
							<SelectItem value="all">All time</SelectItem>
						</SelectContent>
					</Select>
					<Button variant="outline" size="icon" onClick={handleRefresh} aria-label="Refresh analytics">
						<RefreshCw className="h-4 w-4" />
					</Button>
					<Button variant="outline">
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			{analytics && (
				<div className="grid md:grid-cols-4 gap-4">
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
								<Briefcase className="h-4 w-4" />
								Total Opportunities
							</div>
							<div className="text-3xl font-bold">{analytics.totalOpportunities}</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
								<DollarSign className="h-4 w-4" />
								Pipeline Value
							</div>
							<div className="text-3xl font-bold text-blue-600">
								{formatCurrency(analytics.totalPipelineValue)}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
								<Target className="h-4 w-4" />
								Weighted Value
							</div>
							<div className="text-3xl font-bold text-green-600">
								{formatCurrency(analytics.weightedPipelineValue)}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
								<AlertTriangle className="h-4 w-4" />
								At Risk
							</div>
							<div className="flex items-center gap-2">
								<span className={cn(
									"text-3xl font-bold",
									atRiskOpportunities.filter((o) => o.riskLevel === "high").length > 0
										? "text-red-600"
										: "text-green-600"
								)}>
									{atRiskOpportunities.filter((o) => o.riskLevel === "high").length}
								</span>
								<span className="text-sm text-muted-foreground">high risk</span>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="overview">
						<PieChart className="h-4 w-4 mr-2" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="funnel">
						<BarChart3 className="h-4 w-4 mr-2" />
						Pipeline Funnel
					</TabsTrigger>
					<TabsTrigger value="forecast">
						<TrendingUp className="h-4 w-4 mr-2" />
						Forecast
					</TabsTrigger>
					<TabsTrigger value="at-risk">
						<AlertTriangle className="h-4 w-4 mr-2" />
						At Risk ({atRiskOpportunities.length})
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<div className="grid md:grid-cols-2 gap-6">
						{/* Stage Distribution */}
						{analytics && (
							<Card>
								<CardHeader>
									<CardTitle className="text-base">Opportunities by Stage</CardTitle>
								</CardHeader>
								<CardContent>
									<StageFunnel data={analytics.byStage} />
								</CardContent>
							</Card>
						)}

						{/* Conversion Rates */}
						{analytics && analytics.conversionRates.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="text-base">Stage Conversion Rates</CardTitle>
								</CardHeader>
								<CardContent>
									<ConversionRates data={analytics.conversionRates} />
								</CardContent>
							</Card>
						)}
					</div>

					{/* Average Time in Stage */}
					{analytics && analytics.averageTimeInStage.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<Clock className="h-4 w-4" />
									Average Time in Stage
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
									{analytics.averageTimeInStage.map((item) => (
										<div key={item.stage} className="text-center p-3 bg-muted rounded-lg">
											<div className="text-2xl font-bold">{item.avgDays}</div>
											<div className="text-xs text-muted-foreground capitalize">
												{item.stage.replace("_", " ")}
											</div>
											<div className="text-xs text-muted-foreground">days</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Funnel Tab */}
				<TabsContent value="funnel">
					{analytics && (
						<Card>
							<CardHeader>
								<CardTitle>Pipeline Funnel</CardTitle>
								<CardDescription>
									Visual representation of opportunities through the pipeline stages
								</CardDescription>
							</CardHeader>
							<CardContent>
								<StageFunnel data={analytics.byStage} />
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Forecast Tab */}
				<TabsContent value="forecast">
					{forecast ? (
						<Card>
							<CardHeader>
								<CardTitle>Revenue Forecast</CardTitle>
								<CardDescription>
									Projected outcomes based on current pipeline and historical data
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ForecastDisplay forecast={forecast} />
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardContent className="p-8 text-center">
								<Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
								<h4 className="font-semibold mb-2">Insufficient Data</h4>
								<p className="text-sm text-muted-foreground">
									More pipeline data is needed to generate a forecast
								</p>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* At Risk Tab */}
				<TabsContent value="at-risk">
					<Card>
						<CardHeader>
							<CardTitle>At-Risk Opportunities</CardTitle>
							<CardDescription>
								Opportunities that need immediate attention based on risk indicators
							</CardDescription>
						</CardHeader>
						<CardContent>
							<AtRiskList opportunities={atRiskOpportunities} />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default PipelineAnalytics;
