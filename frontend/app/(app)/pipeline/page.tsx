/**
 * Pipeline Page
 *
 * Capture-to-Proposal Pipeline Manager with gate reviews, Pwin tracking,
 * and activity management across the opportunity lifecycle.
 */

"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import {
	Kanban,
	BarChart2,
	Calendar,
	Filter,
	Plus,
	Download,
	Target,
} from "lucide-react";
import { PipelineAnalytics } from "@/components/pipeline/PipelineAnalytics";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { GateReviewPanel } from "@/components/pipeline/GateReviewPanel";
import { PWinCalculator } from "@/components/pipeline/PWinCalculator";
import { ActivityTimeline } from "@/components/pipeline/ActivityTimeline";
import {
	listPipelines,
	getPipelineAnalytics,
	listGateReviews,
	listActivities,
	updatePipelineStage,
	updatePwin,
	recordActivity,
	updateActivity,
	scheduleGateReview,
	updateGateReview,
	type PipelineAnalytics as PipelineAnalyticsType,
} from "@/lib/actions/pipeline";
import type { CapturePipeline, CaptureActivity, GateReview } from "@/lib/db/schema-pipeline";
import type { PipelineStage } from "@/lib/types/pipeline";

export default function PipelinePage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = React.useState("board");
	const [selectedPipeline, setSelectedPipeline] = useState<CapturePipeline | null>(null);
	const [pipelines, setPipelines] = useState<CapturePipeline[]>([]);
	const [opportunitiesMap, setOpportunitiesMap] = useState<Map<string, { title: string; organization: string; budgetNumeric: number | null; deadline: Date | null }>>(new Map());
	const [analytics, setAnalytics] = useState<PipelineAnalyticsType | null>(null);
	const [gateReviews, setGateReviews] = useState<GateReview[]>([]);
	const [activities, setActivities] = useState<CaptureActivity[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingDetail, setIsLoadingDetail] = useState(false);

	// Fetch pipelines and analytics
	const fetchPipelines = useCallback(async () => {
		setIsLoading(true);
		try {
			const [pipelinesResult, analyticsResult] = await Promise.all([
				listPipelines(),
				getPipelineAnalytics(),
			]);

			if (pipelinesResult.success && pipelinesResult.data) {
				setPipelines(pipelinesResult.data.pipelines);
				setOpportunitiesMap(new Map(Object.entries(pipelinesResult.data.opportunities)));
			}

			if (analyticsResult.success && analyticsResult.data) {
				setAnalytics(analyticsResult.data);
			}
		} catch (error) {
			console.error("Failed to fetch pipelines:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Fetch detail data for selected pipeline
	const fetchPipelineDetail = useCallback(async (pipelineId: string) => {
		setIsLoadingDetail(true);
		try {
			const [gatesResult, activitiesResult] = await Promise.all([
				listGateReviews(pipelineId),
				listActivities(pipelineId),
			]);

			if (gatesResult.success && gatesResult.data) {
				setGateReviews(gatesResult.data);
			}

			if (activitiesResult.success && activitiesResult.data) {
				setActivities(activitiesResult.data);
			}
		} catch (error) {
			console.error("Failed to fetch pipeline detail:", error);
		} finally {
			setIsLoadingDetail(false);
		}
	}, []);

	useEffect(() => {
		fetchPipelines();
	}, [fetchPipelines]);

	useEffect(() => {
		if (selectedPipeline) {
			fetchPipelineDetail(selectedPipeline.id);
		} else {
			setGateReviews([]);
			setActivities([]);
		}
	}, [selectedPipeline, fetchPipelineDetail]);

	// Handle pipeline card click
	const handlePipelineClick = (pipeline: CapturePipeline) => {
		setSelectedPipeline(pipeline);
	};

	// Handle stage change
	const handleStageChange = async (pipelineId: string, newStage: PipelineStage) => {
		const result = await updatePipelineStage(pipelineId, newStage);
		if (result.success) {
			// Update local state
			setPipelines(prev => prev.map(p =>
				p.id === pipelineId ? { ...p, currentStage: newStage } : p
			));
			// If the selected pipeline was changed, update it too
			if (selectedPipeline?.id === pipelineId) {
				setSelectedPipeline(prev => prev ? { ...prev, currentStage: newStage } : null);
			}
		}
	};

	// Handle gate review created/updated
	const handleGateCreated = (gate: GateReview) => {
		setGateReviews(prev => [...prev, gate]);
	};

	const handleGateUpdated = (gate: GateReview) => {
		setGateReviews(prev => prev.map(g => g.id === gate.id ? gate : g));
	};

	// Handle activity added/updated
	const handleActivityAdded = (activity: CaptureActivity) => {
		setActivities(prev => [...prev, activity]);
	};

	const handleActivityUpdated = (activity: CaptureActivity) => {
		setActivities(prev => prev.map(a => a.id === activity.id ? activity : a));
	};

	// Handle PWin updated
	const handlePwinUpdated = (pipelineId: string, newPwin: number) => {
		setPipelines(prev => prev.map(p =>
			p.id === pipelineId ? { ...p, pwinCurrent: newPwin } : p
		));
		if (selectedPipeline?.id === pipelineId) {
			setSelectedPipeline(prev => prev ? { ...prev, pwinCurrent: newPwin } : null);
		}
	};

	// Get stage counts from analytics
	const getStageCount = (stage: string) => {
		if (!analytics) return 0;
		const stageData = analytics.byStage.find(s => s.stage === stage);
		return stageData?.count ?? 0;
	};

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
						<Button onClick={() => router.push("/opportunities")}>
							<Plus className="h-4 w-4 mr-2" />
							New Opportunity
						</Button>
					</div>
				</div>

				{/* Quick Stats */}
				<div className="grid grid-cols-5 gap-4">
					<QuickStat label="Discovery" count={getStageCount("discovery")} color="bg-slate-500" />
					<QuickStat label="Qualification" count={getStageCount("qualification")} color="bg-blue-500" />
					<QuickStat label="Capture" count={getStageCount("capture")} color="bg-indigo-500" />
					<QuickStat label="Proposal" count={getStageCount("proposal")} color="bg-purple-500" />
					<QuickStat label="Submitted" count={getStageCount("submitted")} color="bg-cyan-500" />
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
							{isLoading ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : pipelines.length > 0 ? (
								<PipelineBoard
									pipelines={pipelines}
									opportunities={opportunitiesMap}
									onCardClick={handlePipelineClick}
									onStageChange={handleStageChange}
									onAddCapture={() => router.push("/opportunities")}
									isLoading={isLoading}
								/>
							) : (
								<EmptyPipelineState />
							)}
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0 p-6">
							<PipelineAnalytics />
						</TabsContent>
						<TabsContent value="gates" className="h-full m-0 p-6">
							{selectedPipeline ? (
								<GateReviewPanel
									gateReviews={gateReviews}
									pipelineId={selectedPipeline.id}
									onGateCreated={handleGateCreated}
									onGateUpdated={handleGateUpdated}
								/>
							) : (
								<div className="flex flex-col items-center justify-center h-64 text-center">
									<Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
									<h3 className="text-lg font-medium mb-2">No opportunity selected</h3>
									<p className="text-sm text-muted-foreground max-w-md mb-4">
										Select an opportunity from the Pipeline Board to view and manage its gate reviews.
									</p>
									<Button variant="outline" onClick={() => setActiveTab("board")}>
										<Kanban className="h-4 w-4 mr-2" />
										Go to Pipeline Board
									</Button>
								</div>
							)}
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Side Panel for Selected Pipeline */}
			{selectedPipeline && (
				<div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-[450px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<CaptureDetailPanel
						pipeline={selectedPipeline}
						opportunityInfo={opportunitiesMap.get(selectedPipeline.id)}
						activities={activities}
						isLoading={isLoadingDetail}
						onClose={() => setSelectedPipeline(null)}
						onPwinUpdated={handlePwinUpdated}
						onActivityAdded={handleActivityAdded}
						onActivityUpdated={handleActivityUpdated}
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

function EmptyPipelineState() {
	const router = useRouter();
	return (
		<div className="flex flex-col items-center justify-center h-64 text-center">
			<Kanban className="h-12 w-12 text-muted-foreground/30 mb-4" />
			<h3 className="text-lg font-medium mb-2">No Pipeline Items</h3>
			<p className="text-sm text-muted-foreground max-w-md mb-4">
				Go to Opportunities to qualify an RFP for your pipeline.
			</p>
			<Button onClick={() => router.push("/opportunities")}>
				<Plus className="h-4 w-4 mr-2" />
				Go to Opportunities
			</Button>
		</div>
	);
}

function CaptureDetailPanel({
	pipeline,
	opportunityInfo,
	activities,
	isLoading,
	onClose,
	onPwinUpdated,
	onActivityAdded,
	onActivityUpdated,
}: {
	pipeline: CapturePipeline;
	opportunityInfo?: { title: string; organization: string; budgetNumeric: number | null; deadline: Date | null };
	activities: CaptureActivity[];
	isLoading: boolean;
	onClose: () => void;
	onPwinUpdated: (pipelineId: string, newPwin: number) => void;
	onActivityAdded: (activity: CaptureActivity) => void;
	onActivityUpdated: (activity: CaptureActivity) => void;
}) {
	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-lg font-semibold">{opportunityInfo?.title ?? "Opportunity Details"}</h2>
					{opportunityInfo?.organization && (
						<p className="text-sm text-muted-foreground">{opportunityInfo.organization}</p>
					)}
				</div>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Pipeline Stage Badge */}
			<div className="mb-6">
				<Badge variant="outline" className="text-sm">
					Stage: {pipeline.currentStage.charAt(0).toUpperCase() + pipeline.currentStage.slice(1)}
				</Badge>
				{opportunityInfo?.budgetNumeric && (
					<Badge variant="secondary" className="ml-2 text-sm">
						${(opportunityInfo.budgetNumeric / 1000000).toFixed(1)}M
					</Badge>
				)}
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					{/* PWin Calculator */}
					<PWinCalculator
						pipelineId={pipeline.id}
						opportunityId={pipeline.opportunityId ?? undefined}
						currentPwin={pipeline.pwinCurrent ?? 0}
						pwinHistory={(pipeline.pwinHistory as Array<{ date: string; value: number; reason: string }> | null) ?? []}
						onPwinUpdated={(newPwin) => onPwinUpdated(pipeline.id, newPwin)}
						className="mb-6"
					/>

					{/* Activity Timeline */}
					<div className="mt-6">
						<h3 className="text-sm font-medium mb-3 flex items-center gap-2">
							<Target className="h-4 w-4" />
							Activity Timeline
						</h3>
						<ActivityTimeline
							activities={activities}
							pipelineId={pipeline.id}
							onActivityAdded={onActivityAdded}
							onActivityUpdated={onActivityUpdated}
						/>
					</div>
				</>
			)}
		</div>
	);
}
