/**
 * Pipeline Page
 *
 * Capture-to-Proposal Pipeline Manager with gate reviews, Pwin tracking,
 * and activity management across the opportunity lifecycle.
 */

"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Kanban,
	BarChart2,
	Calendar,
	Filter,
	Plus,
	Download,
	DollarSign,
	TrendingUp,
	Target,
	Shield,
	Clock,
} from "lucide-react";
import { PipelineAnalytics } from "@/components/pipeline/PipelineAnalytics";

export default function PipelinePage() {
	const [activeTab, setActiveTab] = React.useState("board");
	const [selectedOpportunityId, setSelectedOpportunityId] = React.useState<string | null>(null);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<Kanban className="h-6 w-6 text-primary" />
							Capture Pipeline
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Track opportunities from discovery through submission with gate reviews
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline">
							<Filter className="h-4 w-4 mr-2" />
							Filters
						</Button>
						<Button variant="outline">
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							New Opportunity
						</Button>
					</div>
				</div>

				{/* Quick Stats */}
				<div className="grid grid-cols-5 gap-4">
					<QuickStat label="Discovery" count={12} color="bg-slate-500" />
					<QuickStat label="Qualification" count={8} color="bg-blue-500" />
					<QuickStat label="Capture" count={5} color="bg-amber-500" />
					<QuickStat label="Proposal" count={3} color="bg-purple-500" />
					<QuickStat label="Submitted" count={2} color="bg-green-500" />
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
								value="board"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Kanban className="h-4 w-4 mr-2" />
								Pipeline Board
							</TabsTrigger>
							<TabsTrigger
								value="analytics"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<BarChart2 className="h-4 w-4 mr-2" />
								Analytics
							</TabsTrigger>
							<TabsTrigger
								value="gates"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Calendar className="h-4 w-4 mr-2" />
								Gate Reviews
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="board" className="h-full m-0 p-6">
							<PipelineBoardPlaceholder
								onSelectOpportunity={setSelectedOpportunityId}
							/>
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0 p-6">
							<PipelineAnalytics />
						</TabsContent>
						<TabsContent value="gates" className="h-full m-0 p-6">
							<GateReviewPanelPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Side Panel for Selected Opportunity */}
			{selectedOpportunityId && (
				<div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-xl z-50 overflow-y-auto">
					<CaptureDetailPanel
						opportunityId={selectedOpportunityId}
						onClose={() => setSelectedOpportunityId(null)}
					/>
				</div>
			)}
		</div>
	);
}

function QuickStat({ label, count, color }: { label: string; count: number; color: string }) {
	return (
		<div className="bg-card rounded-lg p-3 border">
			<div className="flex items-center gap-2 mb-1">
				<div className={`w-2 h-2 rounded-full ${color}`} />
				<span className="text-xs text-muted-foreground">{label}</span>
			</div>
			<div className="text-2xl font-semibold">{count}</div>
		</div>
	);
}

function CaptureDetailPanel({ opportunityId, onClose }: { opportunityId: string; onClose: () => void }) {
	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">Opportunity Details</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>×</Button>
			</div>
			<PWinCalculatorPlaceholder opportunityId={opportunityId} />
			<div className="mt-6">
				<h3 className="text-sm font-medium mb-3">Activity Timeline</h3>
				<ActivityTimelinePlaceholder opportunityId={opportunityId} />
			</div>
		</div>
	);
}

// Placeholder Components with Mock Data

function PipelineBoardPlaceholder({ onSelectOpportunity }: { onSelectOpportunity: (id: string) => void }) {
	const stages = [
		{ name: "Discovery", color: "bg-slate-500", items: [
			{ id: "1", title: "DOD Cloud Services", customer: "Dept of Defense", value: "$5.2M", pwin: 65 },
			{ id: "2", title: "Healthcare IT Modernization", customer: "HHS", value: "$3.8M", pwin: 45 },
		]},
		{ name: "Qualification", color: "bg-blue-500", items: [
			{ id: "3", title: "VA Telehealth Platform", customer: "Veterans Affairs", value: "$12.5M", pwin: 55 },
		]},
		{ name: "Capture", color: "bg-indigo-500", items: [
			{ id: "4", title: "DHS Border Security", customer: "Homeland Security", value: "$8.1M", pwin: 70 },
			{ id: "5", title: "NASA Mission Support", customer: "NASA", value: "$15.3M", pwin: 60 },
		]},
		{ name: "Proposal", color: "bg-purple-500", items: [
			{ id: "6", title: "USAF Cyber Defense", customer: "Air Force", value: "$22.0M", pwin: 75 },
		]},
		{ name: "Submitted", color: "bg-cyan-500", items: [
			{ id: "7", title: "Army Logistics System", customer: "US Army", value: "$9.4M", pwin: 80 },
		]},
	];

	return (
		<div className="flex gap-4 overflow-x-auto pb-4">
			{stages.map((stage) => (
				<div key={stage.name} className="flex-shrink-0 w-72 rounded-lg border bg-card">
					<div className={`p-3 rounded-t-lg border-b ${stage.color}/10`}>
						<div className="flex items-center justify-between mb-1">
							<h3 className="font-semibold text-sm">{stage.name}</h3>
							<Badge variant="secondary" className="text-xs">{stage.items.length}</Badge>
						</div>
					</div>
					<div className="p-2 space-y-2">
						{stage.items.map((item) => (
							<Card
								key={item.id}
								className="cursor-pointer hover:shadow-md transition-shadow"
								onClick={() => onSelectOpportunity(item.id)}
							>
								<CardContent className="p-3">
									<h4 className="font-medium text-sm mb-1">{item.title}</h4>
									<p className="text-xs text-muted-foreground mb-2">{item.customer}</p>
									<div className="flex items-center justify-between text-xs">
										<span className="flex items-center gap-1">
											<DollarSign className="h-3 w-3" />
											{item.value}
										</span>
										<span className="flex items-center gap-1">
											<TrendingUp className="h-3 w-3" />
											{item.pwin}% PWin
										</span>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// Remaining placeholder components for features still using mock data

function GateReviewPanelPlaceholder() {
	const gates = [
		{ id: "1", name: "Pink Team Review", type: "pink_team", date: "2024-02-15", status: "completed", decision: "pass" },
		{ id: "2", name: "Red Team Review", type: "red_team", date: "2024-02-22", status: "in_progress", decision: null },
		{ id: "3", name: "Gold Team Review", type: "gold_team", date: "2024-03-01", status: "scheduled", decision: null },
	];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Gate Reviews
					</h3>
					<p className="text-sm text-muted-foreground">1 of 3 completed</p>
				</div>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Schedule Gate
				</Button>
			</div>
			<div className="space-y-3">
				{gates.map((gate) => (
					<Card key={gate.id}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-medium">{gate.name}</h4>
									<p className="text-sm text-muted-foreground flex items-center gap-2">
										<Calendar className="h-3 w-3" />
										{gate.date}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant={
										gate.status === "completed" ? "default" :
										gate.status === "in_progress" ? "secondary" : "outline"
									}>
										{gate.status.replace("_", " ")}
									</Badge>
									{gate.decision && (
										<Badge variant="default" className="bg-green-500">
											{gate.decision}
										</Badge>
									)}
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function PWinCalculatorPlaceholder({ opportunityId }: { opportunityId: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Target className="h-4 w-4" />
					PWin Calculator
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="text-center mb-4">
					<div className="text-4xl font-bold text-green-600">72%</div>
					<div className="text-sm text-muted-foreground">Probability of Win</div>
				</div>
				<div className="space-y-2 text-sm">
					{[
						{ factor: "Customer Relationship", score: 80 },
						{ factor: "Solution Fit", score: 75 },
						{ factor: "Past Performance", score: 70 },
						{ factor: "Price Competitiveness", score: 65 },
					].map((item) => (
						<div key={item.factor} className="flex items-center justify-between">
							<span className="text-muted-foreground">{item.factor}</span>
							<span className="font-medium">{item.score}%</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ActivityTimelinePlaceholder({ opportunityId }: { opportunityId: string }) {
	const activities = [
		{ id: "1", type: "Meeting", title: "Customer kickoff", date: "2 days ago", status: "completed" },
		{ id: "2", type: "Call", title: "Technical deep dive", date: "Yesterday", status: "completed" },
		{ id: "3", type: "Email", title: "Follow-up questions", date: "Today", status: "scheduled" },
	];

	return (
		<div className="space-y-3">
			{activities.map((activity, idx) => (
				<div key={activity.id} className="flex gap-3">
					<div className="flex flex-col items-center">
						<div className="w-2 h-2 rounded-full bg-primary" />
						{idx < activities.length - 1 && <div className="flex-1 w-px bg-border mt-1" />}
					</div>
					<div className="flex-1 pb-3">
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">{activity.type}</span>
							<Badge variant="outline" className="text-xs">{activity.status}</Badge>
						</div>
						<p className="text-sm font-medium">{activity.title}</p>
						<p className="text-xs text-muted-foreground flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{activity.date}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}
