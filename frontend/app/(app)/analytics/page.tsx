/**
 * Analytics Page
 *
 * Win/Loss Intelligence Platform and Predictive Win Probability Engine.
 * Provides debriefs, pattern analysis, ROI tracking, and Pwin assessment.
 */

"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	BarChart3,
	Plus,
	TrendingUp,
	TrendingDown,
	Target,
	Lightbulb,
	DollarSign,
	FileText,
	X,
	CheckCircle,
	AlertTriangle,
} from "lucide-react";
import { WinLossDashboard } from "@/components/winloss/WinLossDashboard";
import { PwinDashboard } from "@/components/pwin/PwinDashboard";
import {
	listDebriefs,
	getDebrief,
	identifyImprovementAreas,
	getDashboardMetrics,
	analyzeWinLossPatterns,
	generateLessonsLearnedReport,
	calculateProposalROI,
} from "@/lib/actions/winloss";
import { evaluateModelPerformance } from "@/lib/actions/pwin";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsPage() {
	const [activeTab, setActiveTab] = React.useState("overview");
	const [showDebriefForm, setShowDebriefForm] = React.useState(false);
	const [selectedDebriefId, setSelectedDebriefId] = React.useState<string | null>(null);
	const [headerMetrics, setHeaderMetrics] = React.useState<{
		recentWinRate?: number;
		averagePwin?: number | null;
		totalDebriefs?: number;
		pendingActionItems?: number;
		trendDirection?: string;
	} | null>(null);
	const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(true);

	React.useEffect(() => {
		getDashboardMetrics()
			.then((result) => {
				if (result.success && result.data) setHeaderMetrics(result.data);
			})
			.finally(() => setIsLoadingMetrics(false));
	}, []);

	const winRateValue = isLoadingMetrics
		? "…"
		: headerMetrics?.recentWinRate != null
			? `${headerMetrics.recentWinRate.toFixed(0)}%`
			: "—";

	const totalDebriefsValue = isLoadingMetrics
		? "…"
		: headerMetrics?.totalDebriefs != null
			? String(headerMetrics.totalDebriefs)
			: "—";

	const avgPwinValue = isLoadingMetrics
		? "…"
		: headerMetrics?.averagePwin != null
			? `${headerMetrics.averagePwin.toFixed(1)}%`
			: "—";

	const pendingActionsValue = isLoadingMetrics
		? "…"
		: headerMetrics?.pendingActionItems != null
			? String(headerMetrics.pendingActionItems)
			: "—";

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<BarChart3 className="h-6 w-6 text-primary" />
							Analytics & Intelligence
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Win/Loss analysis, Pwin predictions, and continuous improvement
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button onClick={() => setShowDebriefForm(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Record Debrief
						</Button>
					</div>
				</div>

				{/* Quick Stats — sourced from real getDashboardMetrics data */}
				<div className="grid grid-cols-4 gap-4">
					<QuickStat
						icon={TrendingUp}
						label="Win Rate (12mo)"
						value={winRateValue}
						change={headerMetrics?.trendDirection === "up" ? "↑" : headerMetrics?.trendDirection === "down" ? "↓" : "—"}
						positive={headerMetrics?.trendDirection !== "down"}
					/>
					<QuickStat
						icon={Target}
						label="Avg Pwin Score"
						value={avgPwinValue}
						change="—"
						positive={true}
					/>
					<QuickStat
						icon={FileText}
						label="Total Debriefs"
						value={totalDebriefsValue}
						change="—"
						positive={true}
					/>
					<QuickStat
						icon={CheckCircle}
						label="Pending Actions"
						value={pendingActionsValue}
						change="—"
						positive={false}
					/>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="h-full flex flex-col"
				>
					<div className="flex-shrink-0 border-b px-6">
						<TabsList className="h-12 bg-transparent border-b-0">
							<TabsTrigger
								value="overview"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<BarChart3 className="h-4 w-4 mr-2" />
								Overview
							</TabsTrigger>
							<TabsTrigger
								value="winloss"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<TrendingUp className="h-4 w-4 mr-2" />
								Win/Loss
							</TabsTrigger>
							<TabsTrigger
								value="pwin"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Target className="h-4 w-4 mr-2" />
								Pwin Predictions
							</TabsTrigger>
							<TabsTrigger
								value="patterns"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Lightbulb className="h-4 w-4 mr-2" />
								Patterns & Insights
							</TabsTrigger>
							<TabsTrigger
								value="roi"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<DollarSign className="h-4 w-4 mr-2" />
								ROI Analysis
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="overview" className="h-full m-0 p-6">
							<div className="grid grid-cols-2 gap-6">
								<WinLossDashboard
									onCreateDebrief={() => setShowDebriefForm(true)}
									onViewDebriefs={() => setActiveTab("winloss")}
								/>
								<PwinDashboard />
							</div>
							<div className="mt-6">
								<ImprovementAreasPlaceholder />
							</div>
						</TabsContent>
						<TabsContent value="winloss" className="h-full m-0 p-6">
							<div className="grid grid-cols-3 gap-6">
								<div className="col-span-2">
									<WinLossDashboard
										onCreateDebrief={() => setShowDebriefForm(true)}
									/>
								</div>
								<div>
									<DebriefListPlaceholder
										onSelect={(id) => setSelectedDebriefId(id)}
									/>
								</div>
							</div>
						</TabsContent>
						<TabsContent value="pwin" className="h-full m-0 p-6">
							<div className="grid grid-cols-2 gap-6">
								<PwinDashboard />
								<div className="space-y-6">
									<PortfolioOptimizerPlaceholder />
									<ModelPerformancePlaceholder />
								</div>
							</div>
						</TabsContent>
						<TabsContent value="patterns" className="h-full m-0 p-6">
							<div className="grid grid-cols-2 gap-6">
								<PatternAnalysisPlaceholder />
								<LessonsLearnedPlaceholder />
							</div>
						</TabsContent>
						<TabsContent value="roi" className="h-full m-0 p-6">
							<ROICalculatorPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Debrief Form Modal - requires opportunity selection first */}
			{showDebriefForm && (
				<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
					<div className="bg-background rounded-lg p-6 max-w-md">
						<h2 className="text-lg font-semibold mb-4">Record Debrief</h2>
						<p className="text-muted-foreground mb-4">
							To record a debrief, go to the specific opportunity page and select "Record Debrief" from the actions menu.
						</p>
						<Button onClick={() => setShowDebriefForm(false)}>Close</Button>
					</div>
				</div>
			)}

			{/* Debrief Detail Side Panel */}
			{selectedDebriefId && (
				<div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-[600px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<DebriefDetail
						debriefId={selectedDebriefId}
						onClose={() => setSelectedDebriefId(null)}
					/>
				</div>
			)}
		</div>
	);
}

function QuickStat({
	icon: Icon,
	label,
	value,
	change,
	positive
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	change: string;
	positive: boolean;
}) {
	return (
		<div className="bg-card rounded-lg p-4 border">
			<div className="flex items-center gap-2 mb-2">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-xs text-muted-foreground">{label}</span>
			</div>
			<div className="flex items-end justify-between">
				<div className="text-2xl font-semibold">{value}</div>
				<div className={`text-sm flex items-center ${positive ? "text-green-600" : "text-red-600"}`}>
					{positive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
					{change}
				</div>
			</div>
		</div>
	);
}

function DebriefDetail({ debriefId, onClose }: { debriefId: string; onClose: () => void }) {
	const [debrief, setDebrief] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		async function fetchDebrief() {
			setIsLoading(true);
			setError(null);
			try {
				const result = await getDebrief(debriefId);
				if (result.success) {
					setDebrief(result.data);
				} else {
					setError(result.error);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load debrief");
			} finally {
				setIsLoading(false);
			}
		}
		fetchDebrief();
	}, [debriefId]);

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between mb-6">
					<Skeleton className="h-6 w-32" />
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="space-y-4">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-5 w-48" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error || !debrief) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-semibold">Debrief Details</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="text-destructive text-sm">{error ?? "Debrief not found"}</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">Debrief Details</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="space-y-6">
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">Opportunity</h3>
					<p className="font-medium">{debrief.opportunityName ?? "Unknown Opportunity"}</p>
				</div>
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">Outcome</h3>
					<span className={`px-2 py-1 rounded text-sm ${
						debrief.outcome === "win" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
					}`}>
						{debrief.outcome === "win" ? "Win" : "Loss"}
					</span>
				</div>
				{debrief.technicalScore && (
					<div>
						<h3 className="text-sm font-medium text-muted-foreground">Technical Score</h3>
						<p>{debrief.technicalScore}/100 {debrief.technicalRank && `(Ranked #${debrief.technicalRank})`}</p>
					</div>
				)}
				{debrief.evaluatorFeedback && debrief.evaluatorFeedback.length > 0 && (
					<div>
						<h3 className="text-sm font-medium text-muted-foreground">Evaluator Feedback</h3>
						<ul className="list-disc list-inside text-sm space-y-1 mt-1">
							{debrief.evaluatorFeedback.map((item: string, i: number) => (
								<li key={i}>{item}</li>
							))}
						</ul>
					</div>
				)}
				{debrief.lessonsLearned && debrief.lessonsLearned.length > 0 && (
					<div>
						<h3 className="text-sm font-medium text-muted-foreground">Lessons Learned</h3>
						<ul className="list-disc list-inside text-sm space-y-1 mt-1">
							{debrief.lessonsLearned.map((item: string, i: number) => (
								<li key={i}>{item}</li>
							))}
						</ul>
					</div>
				)}
				{debrief.competitorAnalysis && (
					<div>
						<h3 className="text-sm font-medium text-muted-foreground">Competitor Analysis</h3>
						<p className="text-sm mt-1">{debrief.competitorAnalysis}</p>
					</div>
				)}
			</div>
		</div>
	);
}

// Placeholder Components - keeping only those still in use

function ImprovementAreasPlaceholder() {
	const [areas, setAreas] = React.useState<any[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchAreas() {
			setIsLoading(true);
			try {
				const result = await identifyImprovementAreas();
				if (result.success && result.data) {
					setAreas(result.data);
				}
			} catch (err) {
				console.error("Failed to fetch improvement areas:", err);
			} finally {
				setIsLoading(false);
			}
		}
		fetchAreas();
	}, []);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Lightbulb className="h-4 w-4" />
						Key Improvement Areas
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-14 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (areas.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Lightbulb className="h-4 w-4" />
						Key Improvement Areas
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No improvement areas identified yet. Complete more debriefs to generate insights.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base flex items-center gap-2">
					<Lightbulb className="h-4 w-4" />
					Key Improvement Areas
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{areas.map((item) => (
						<div key={item.area ?? item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
							<div className="flex items-center gap-3">
								<AlertTriangle className={`h-4 w-4 ${item.impact === "high" ? "text-red-500" : item.impact === "medium" ? "text-yellow-500" : "text-blue-500"}`} />
								<span className="font-medium">{item.area ?? item.name}</span>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant="outline">{item.impact ?? "medium"} impact</Badge>
								<Badge variant={item.trend === "improving" ? "default" : "secondary"}>
									{item.trend ?? "stable"}
								</Badge>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function DebriefListPlaceholder({ onSelect }: { onSelect: (id: string) => void }) {
	const [debriefs, setDebriefs] = React.useState<any[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchDebriefs() {
			setIsLoading(true);
			try {
				const result = await listDebriefs();
				if (result.success && result.data) {
					setDebriefs(result.data.slice(0, 10)); // Show last 10
				}
			} catch (err) {
				console.error("Failed to fetch debriefs:", err);
			} finally {
				setIsLoading(false);
			}
		}
		fetchDebriefs();
	}, []);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent Debriefs</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (debriefs.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent Debriefs</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No debriefs recorded yet. Complete proposals and record debriefs to see them here.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Recent Debriefs</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{debriefs.map((debrief) => (
						<div
							key={debrief.id}
							className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
							onClick={() => onSelect(debrief.id)}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
							<div className="flex items-center justify-between mb-1">
								<span className="text-sm font-medium">{debrief.opportunityTitle ?? "Unknown Opportunity"}</span>
								<Badge variant={debrief.outcome === "win" ? "default" : "destructive"}>
									{debrief.outcome}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{debrief.debriefDate
									? new Date(debrief.debriefDate).toLocaleDateString()
									: debrief.createdAt
									? new Date(debrief.createdAt).toLocaleDateString()
									: "Date unknown"}
							</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function PortfolioOptimizerPlaceholder() {
	const [metrics, setMetrics] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchMetrics() {
			setIsLoading(true);
			try {
				const result = await getDashboardMetrics();
				if (result.success && result.data) {
					setMetrics(result.data);
				}
			} catch (err) {
				console.error("Failed to fetch dashboard metrics:", err);
			} finally {
				setIsLoading(false);
			}
		}
		fetchMetrics();
	}, []);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Portfolio Optimizer</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
						<Skeleton className="h-24 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	const pipelineValue = metrics?.totalContractValueWon ?? 0;
	const expectedValue = pipelineValue * (metrics?.recentWinRate ?? 0) / 100;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Portfolio Optimizer</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="text-center p-3 bg-muted/50 rounded-lg">
							<div className="text-xl font-bold">
								${(pipelineValue / 1000000).toFixed(1)}M
							</div>
							<div className="text-xs text-muted-foreground">Total Value Won</div>
						</div>
						<div className="text-center p-3 bg-muted/50 rounded-lg">
							<div className="text-xl font-bold text-green-600">
								{metrics?.recentWinRate?.toFixed(0) ?? 0}%
							</div>
							<div className="text-xs text-muted-foreground">Win Rate (12mo)</div>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="text-center p-3 bg-muted/50 rounded-lg">
							<div className="text-xl font-bold">{metrics?.totalDebriefs ?? 0}</div>
							<div className="text-xs text-muted-foreground">Total Debriefs</div>
						</div>
						<div className="text-center p-3 bg-muted/50 rounded-lg">
							<div className="text-xl font-bold">{metrics?.pendingActionItems ?? 0}</div>
							<div className="text-xs text-muted-foreground">Pending Actions</div>
						</div>
					</div>
					<div>
						<h4 className="text-sm font-medium mb-2">Trend</h4>
						<div className="flex items-center gap-2">
							{metrics?.trendDirection === "up" ? (
								<>
									<TrendingUp className="h-4 w-4 text-green-500" />
									<span className="text-sm text-green-600">Improving performance</span>
								</>
							) : metrics?.trendDirection === "down" ? (
								<>
									<TrendingDown className="h-4 w-4 text-red-500" />
									<span className="text-sm text-red-600">Declining performance</span>
								</>
							) : (
								<span className="text-sm text-muted-foreground">Stable performance</span>
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ModelPerformancePlaceholder() {
	const [performance, setPerformance] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchPerformance() {
			setIsLoading(true);
			try {
				const result = await evaluateModelPerformance();
				if (result.success && result.data) {
					setPerformance(result.data);
				}
			} catch (err) {
				console.error("Failed to fetch model performance:", err);
			} finally {
				setIsLoading(false);
			}
		}
		fetchPerformance();
	}, []);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Model Performance</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex items-center justify-between">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-4 w-16" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!performance) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Model Performance</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No model performance data available. Train the model with more historical data.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Model Performance</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm">Prediction Accuracy</span>
						<span className={`text-sm font-bold ${(performance.accuracy ?? 0) >= 70 ? "text-green-600" : "text-yellow-600"}`}>
							{((performance.accuracy ?? 0) * 100).toFixed(0)}%
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm">Precision</span>
						<span className="text-sm font-bold">
							{((performance.precision ?? 0) * 100).toFixed(0)}%
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm">Recall</span>
						<span className="text-sm font-bold">
							{((performance.recall ?? 0) * 100).toFixed(0)}%
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm">Training Data Points</span>
						<span className="text-sm font-bold">{performance.sampleSize ?? 0}</span>
					</div>
					{performance.recommendations && performance.recommendations.length > 0 && (
						<div className="pt-2 border-t">
							<p className="text-xs text-muted-foreground mb-1">Recommendations:</p>
							<p className="text-xs">{performance.recommendations[0]}</p>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function PatternAnalysisPlaceholder() {
	const [analysis, setAnalysis] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		async function fetchPatterns() {
			setIsLoading(true);
			setError(null);
			try {
				const result = await analyzeWinLossPatterns();
				if (result.success) {
					setAnalysis(result.data);
				} else {
					setError(result.error);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to analyze patterns");
			} finally {
				setIsLoading(false);
			}
		}
		fetchPatterns();
	}, []);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Pattern Analysis</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-20 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Pattern Analysis</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">{error}</p>
				</CardContent>
			</Card>
		);
	}

	const patterns = analysis?.patterns ?? [];
	const insights = analysis?.insights ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base flex items-center justify-between">
					<span>Pattern Analysis</span>
					{analysis?.confidence && (
						<Badge variant="outline" className="ml-2">
							{(analysis.confidence * 100).toFixed(0)}% confidence
						</Badge>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{patterns.length > 0 ? (
						<div className="space-y-3">
							{patterns.slice(0, 5).map((item: any, idx: number) => (
								<div key={item.id ?? idx} className="p-3 bg-muted/50 rounded-lg">
									<div className="flex items-center gap-2 mb-1">
										<Badge variant="secondary" className="text-xs">{item.patternType}</Badge>
										<span className="text-sm font-medium">{item.patternName}</span>
									</div>
									<p className="text-sm text-muted-foreground mb-2">{item.description}</p>
									<div className="flex items-center gap-2">
										<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
											<div
												className={`h-full ${(item.winCorrelation ?? 0) > 0 ? "bg-green-500" : "bg-red-500"}`}
												style={{ width: `${Math.abs(item.winCorrelation ?? 0) * 100}%` }}
											/>
										</div>
										<span className="text-xs text-muted-foreground">
											{((item.confidence ?? 0) * 100).toFixed(0)}% confidence
										</span>
									</div>
								</div>
							))}
						</div>
					) : insights.length > 0 ? (
						<div className="space-y-2">
							{insights.map((insight: string, idx: number) => (
								<p key={idx} className="text-sm">{insight}</p>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No patterns identified yet. Record more debriefs for pattern analysis.
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function LessonsLearnedPlaceholder() {
	const [report, setReport] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchLessons() {
			setIsLoading(true);
			try {
				const result = await generateLessonsLearnedReport();
				if (result.success && result.data) {
					setReport(result.data);
				}
			} catch (err) {
				console.error("Failed to fetch lessons learned:", err);
			} finally {
				setIsLoading(false);
			}
		}
		fetchLessons();
	}, []);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Lessons Learned</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	const lessons = report?.lessonsLearned ?? [];
	const strengths = report?.topStrengths ?? [];
	const weaknesses = report?.topWeaknesses ?? [];

	if (lessons.length === 0 && strengths.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Lessons Learned</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No lessons identified yet. Complete more debriefs to generate lessons learned.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Lessons Learned</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{lessons.length > 0 && (
						<div className="space-y-3">
							{lessons.slice(0, 5).map((item: any, idx: number) => (
								<div key={idx} className="p-3 bg-muted/50 rounded-lg">
									<div className="flex items-center gap-2 mb-1">
										<Badge
											variant={item.relatedOutcome === "win" ? "default" : "destructive"}
											className="text-xs"
										>
											{item.relatedOutcome}
										</Badge>
										<span className="text-xs text-muted-foreground">{item.category}</span>
									</div>
									<p className="text-sm font-medium">{item.lesson}</p>
									<p className="text-xs text-muted-foreground mt-1">
										Frequency: {item.frequency} occurrence{item.frequency !== 1 ? "s" : ""}
									</p>
								</div>
							))}
						</div>
					)}
					{strengths.length > 0 && (
						<div>
							<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-green-500" />
								Top Strengths
							</h4>
							<ul className="space-y-1 text-sm text-muted-foreground">
								{strengths.slice(0, 3).map((s: string, idx: number) => (
									<li key={idx}>• {s}</li>
								))}
							</ul>
						</div>
					)}
					{weaknesses.length > 0 && (
						<div>
							<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
								<AlertTriangle className="h-4 w-4 text-yellow-500" />
								Areas for Improvement
							</h4>
							<ul className="space-y-1 text-sm text-muted-foreground">
								{weaknesses.slice(0, 3).map((w: string, idx: number) => (
									<li key={idx}>• {w}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function ROICalculatorPlaceholder() {
	const [roi, setRoi] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchROI() {
			setIsLoading(true);
			try {
				const result = await calculateProposalROI();
				if (result.success && result.data) {
					setRoi(result.data);
				}
			} catch (err) {
				console.error("Failed to fetch ROI data:", err);
			} finally {
				setIsLoading(false);
			}
		}
		fetchROI();
	}, []);

	const formatCurrency = (value: number, scale: "K" | "M" = "K") => {
		if (scale === "M") {
			return `$${(value / 1000000).toFixed(1)}M`;
		}
		return `$${(value / 1000).toFixed(0)}K`;
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid md:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardContent className="p-4 text-center">
								<Skeleton className="h-9 w-24 mx-auto mb-2" />
								<Skeleton className="h-4 w-32 mx-auto" />
							</CardContent>
						</Card>
					))}
				</div>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">ROI Analysis</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-8 w-full" />
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!roi) {
		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">ROI Analysis</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							No ROI data available. Record debriefs with proposal investment and contract values to see ROI analysis.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">
							{formatCurrency(roi.averageProposalCost ?? 0)}
						</div>
						<div className="text-sm text-muted-foreground">Avg Proposal Cost</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-green-600">
							{formatCurrency(roi.averageContractValue ?? 0, "M")}
						</div>
						<div className="text-sm text-muted-foreground">Avg Contract Value</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-blue-600">
							{(roi.overallROI ?? 0).toFixed(1)}x
						</div>
						<div className="text-sm text-muted-foreground">ROI Multiple</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">
							{formatCurrency(roi.costPerWin ?? 0)}
						</div>
						<div className="text-sm text-muted-foreground">Cost per Win</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							ROI Trend
							{roi.trend === "improving" ? (
								<Badge variant="default" className="text-xs">
									<TrendingUp className="h-3 w-3 mr-1" />
									Improving
								</Badge>
							) : roi.trend === "declining" ? (
								<Badge variant="destructive" className="text-xs">
									<TrendingDown className="h-3 w-3 mr-1" />
									Declining
								</Badge>
							) : (
								<Badge variant="secondary" className="text-xs">Stable</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm">Projected Annual Return</span>
								<span className="text-sm font-bold text-green-600">
									{formatCurrency(roi.projectedAnnualReturn ?? 0, "M")}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm">Break-even Point</span>
								<span className="text-sm font-bold">
									{roi.costPerWin > 0 ? `${Math.ceil((roi.averageContractValue ?? 0) / (roi.costPerWin ?? 1))} wins` : "N/A"}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{roi.recommendations && roi.recommendations.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<Lightbulb className="h-4 w-4" />
								Recommendations
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2 text-sm">
								{roi.recommendations.slice(0, 4).map((rec: string, idx: number) => (
									<li key={idx} className="flex items-start gap-2">
										<CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
										{rec}
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
