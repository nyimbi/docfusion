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

export default function AnalyticsPage() {
	const [activeTab, setActiveTab] = React.useState("overview");
	const [showDebriefForm, setShowDebriefForm] = React.useState(false);
	const [selectedDebriefId, setSelectedDebriefId] = React.useState<string | null>(null);

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

				{/* Quick Stats */}
				<div className="grid grid-cols-4 gap-4">
					<QuickStat
						icon={TrendingUp}
						label="Win Rate (12mo)"
						value="67%"
						change="+5%"
						positive
					/>
					<QuickStat
						icon={Target}
						label="Avg Pwin Score"
						value="0.58"
						change="+0.03"
						positive
					/>
					<QuickStat
						icon={DollarSign}
						label="Proposal ROI"
						value="4.2x"
						change="+0.8x"
						positive
					/>
					<QuickStat
						icon={FileText}
						label="Active Pursuits"
						value="12"
						change="-2"
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
				<div className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 overflow-y-auto">
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
					<p className="font-medium">DoD IDIQ Cloud Services</p>
				</div>
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">Outcome</h3>
					<span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">Loss</span>
				</div>
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">Technical Score</h3>
					<p>85/100 (Ranked #2)</p>
				</div>
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">Evaluator Feedback</h3>
					<ul className="list-disc list-inside text-sm space-y-1 mt-1">
						<li>Strong technical approach</li>
						<li>Past performance section lacked recent examples</li>
						<li>Price was 15% higher than winner</li>
					</ul>
				</div>
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">Lessons Learned</h3>
					<ul className="list-disc list-inside text-sm space-y-1 mt-1">
						<li>Need more recent cloud migration examples</li>
						<li>Price competitiveness requires further analysis</li>
						<li>Consider teaming for large IDIQ vehicles</li>
					</ul>
				</div>
			</div>
		</div>
	);
}

// Placeholder Components - keeping only those still in use

function ImprovementAreasPlaceholder() {
	const areas = [
		{ area: "Price Competitiveness", impact: "high", trend: "improving" },
		{ area: "Past Performance Recency", impact: "medium", trend: "stable" },
		{ area: "Technical Writing Quality", impact: "low", trend: "improving" },
	];

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
						<div key={item.area} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
							<div className="flex items-center gap-3">
								<AlertTriangle className={`h-4 w-4 ${item.impact === "high" ? "text-red-500" : item.impact === "medium" ? "text-yellow-500" : "text-blue-500"}`} />
								<span className="font-medium">{item.area}</span>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant="outline">{item.impact} impact</Badge>
								<Badge variant={item.trend === "improving" ? "default" : "secondary"}>
									{item.trend}
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
	const debriefs = [
		{ id: "1", opportunity: "DoD Cloud IDIQ", outcome: "loss", date: "2024-01-15" },
		{ id: "2", opportunity: "VA Health Portal", outcome: "win", date: "2024-01-28" },
		{ id: "3", opportunity: "DHS Analytics", outcome: "loss", date: "2024-02-05" },
	];

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
						>
							<div className="flex items-center justify-between mb-1">
								<span className="text-sm font-medium">{debrief.opportunity}</span>
								<Badge variant={debrief.outcome === "win" ? "default" : "destructive"}>
									{debrief.outcome}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">{debrief.date}</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function PortfolioOptimizerPlaceholder() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Portfolio Optimizer</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="text-center p-3 bg-muted/50 rounded-lg">
							<div className="text-xl font-bold">$64M</div>
							<div className="text-xs text-muted-foreground">Pipeline Value</div>
						</div>
						<div className="text-center p-3 bg-muted/50 rounded-lg">
							<div className="text-xl font-bold text-green-600">$38M</div>
							<div className="text-xs text-muted-foreground">Expected Value</div>
						</div>
					</div>
					<div>
						<h4 className="text-sm font-medium mb-2">Recommended Actions</h4>
						<ul className="space-y-2 text-sm">
							<li className="flex items-start gap-2">
								<CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
								Prioritize DHS Analytics pursuit
							</li>
							<li className="flex items-start gap-2">
								<CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
								Consider no-bid on low Pwin opportunities
							</li>
						</ul>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ModelPerformancePlaceholder() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Model Performance</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm">Prediction Accuracy</span>
						<span className="text-sm font-bold text-green-600">78%</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm">Calibration Score</span>
						<span className="text-sm font-bold">0.92</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm">Training Data Points</span>
						<span className="text-sm font-bold">156</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function PatternAnalysisPlaceholder() {
	const patterns = [
		{ pattern: "Wins more likely with incumbent status", confidence: 85 },
		{ pattern: "Price >10% above competitor = 40% lower win rate", confidence: 78 },
		{ pattern: "Strong customer relationships improve Pwin by 25%", confidence: 72 },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Pattern Analysis</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{patterns.map((item, idx) => (
						<div key={idx} className="p-3 bg-muted/50 rounded-lg">
							<p className="text-sm mb-2">{item.pattern}</p>
							<div className="flex items-center gap-2">
								<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
									<div className="h-full bg-primary" style={{ width: `${item.confidence}%` }} />
								</div>
								<span className="text-xs text-muted-foreground">{item.confidence}% confidence</span>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function LessonsLearnedPlaceholder() {
	const lessons = [
		{ lesson: "Always include recent (within 3 years) past performance", source: "DoD Cloud Loss Debrief" },
		{ lesson: "Conduct competitive pricing analysis before final submission", source: "VA Portal Win" },
		{ lesson: "Start capture activities 18+ months before RFP", source: "Multiple debriefs" },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Lessons Learned</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{lessons.map((item, idx) => (
						<div key={idx} className="p-3 bg-muted/50 rounded-lg">
							<p className="text-sm font-medium mb-1">{item.lesson}</p>
							<p className="text-xs text-muted-foreground">Source: {item.source}</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ROICalculatorPlaceholder() {
	return (
		<div className="space-y-6">
			<div className="grid md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">$2.4M</div>
						<div className="text-sm text-muted-foreground">BD Investment (12mo)</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-green-600">$156M</div>
						<div className="text-sm text-muted-foreground">Contract Value Won</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-blue-600">65x</div>
						<div className="text-sm text-muted-foreground">ROI Multiple</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">$134K</div>
						<div className="text-sm text-muted-foreground">Avg Cost per Win</div>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Investment Breakdown</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[
							{ category: "Capture Activities", amount: "$850K", percent: 35 },
							{ category: "Proposal Development", amount: "$720K", percent: 30 },
							{ category: "Color Team Reviews", amount: "$360K", percent: 15 },
							{ category: "Tools & Technology", amount: "$240K", percent: 10 },
							{ category: "Training & Development", amount: "$230K", percent: 10 },
						].map((item) => (
							<div key={item.category} className="flex items-center justify-between">
								<span className="text-sm">{item.category}</span>
								<div className="flex items-center gap-4">
									<span className="text-sm text-muted-foreground">{item.amount}</span>
									<div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
										<div className="h-full bg-primary" style={{ width: `${item.percent}%` }} />
									</div>
									<span className="text-sm font-medium w-10 text-right">{item.percent}%</span>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
