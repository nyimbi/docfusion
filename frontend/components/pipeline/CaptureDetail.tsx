/**
 * CaptureDetail Component - DocFusion Capture Pipeline
 *
 * Comprehensive detailed view of a capture with all fields,
 * activities, milestones, gate reviews, and analytics.
 * Provides editing capabilities and stage management.
 *
 * Accessibility: Proper heading hierarchy, form labels, and navigation.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition, useEffect } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
	Building2,
	Calendar,
	DollarSign,
	User,
	Users,
	Target,
	FileText,
	Activity,
	Flag,
	CheckCircle,
	AlertTriangle,
	Clock,
	TrendingUp,
	Edit,
	Save,
	X,
	ChevronRight,
	BarChart3,
	Milestone,
	Shield,
	Briefcase,
	RefreshCw,
	Loader2,
} from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline";
import { MilestoneTracker } from "./MilestoneTracker";
import { GateReviewPanel } from "./GateReviewPanel";
import { PWinCalculator } from "./PWinCalculator";
import {
	getPipeline,
	updatePipeline,
	listActivities,
	listMilestones,
	listGateReviews,
	getPipelineSummary,
} from "@/lib/actions/pipeline";
import type {
	CapturePipeline,
	CaptureActivity,
	PipelineMilestone,
	GateReview,
	PipelineStage,
	HealthStatus,
	PipelinePriority,
	PipelineSummary,
	UpdatePipelineInput,
} from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface CaptureDetailProps {
	/** Pipeline ID to load */
	pipelineId: string;
	/** Opportunity data for display */
	opportunity?: {
		id: string;
		title: string;
		organization: string | null;
		budgetNumeric: number | null;
		deadline: Date | null;
	};
	/** Callback when capture is updated */
	onUpdate?: (pipeline: CapturePipeline) => void;
	/** Callback to navigate to opportunity */
	onViewOpportunity?: (opportunityId: string) => void;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Stage Configuration
// ============================================================================

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
	{ value: "discovery", label: "Discovery" },
	{ value: "qualification", label: "Qualification" },
	{ value: "capture", label: "Capture" },
	{ value: "proposal", label: "Proposal" },
	{ value: "submitted", label: "Submitted" },
	{ value: "evaluation", label: "Evaluation" },
	{ value: "awarded", label: "Awarded" },
	{ value: "lost", label: "Lost" },
	{ value: "no_bid", label: "No Bid" },
];

const HEALTH_OPTIONS: { value: HealthStatus; label: string; color: string }[] = [
	{ value: "on_track", label: "On Track", color: "text-green-600" },
	{ value: "at_risk", label: "At Risk", color: "text-yellow-600" },
	{ value: "critical", label: "Critical", color: "text-red-600" },
];

const PRIORITY_OPTIONS: { value: PipelinePriority; label: string }[] = [
	{ value: "high", label: "High Priority" },
	{ value: "medium", label: "Medium Priority" },
	{ value: "low", label: "Low Priority" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number | null): string {
	if (value === null) return "Not set";
	if (value >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(1)}M`;
	}
	if (value >= 1_000) {
		return `$${(value / 1_000).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

function getHealthIcon(status: HealthStatus | null): React.ReactNode {
	switch (status) {
		case "on_track":
			return <CheckCircle className="h-4 w-4 text-green-500" />;
		case "at_risk":
			return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
		case "critical":
			return <AlertTriangle className="h-4 w-4 text-red-500" />;
		default:
			return <Clock className="h-4 w-4 text-muted-foreground" />;
	}
}

// ============================================================================
// Component
// ============================================================================

export function CaptureDetail({
	pipelineId,
	opportunity,
	onUpdate,
	onViewOpportunity,
	className,
}: CaptureDetailProps) {
	const [isPending, startTransition] = useTransition();
	const [isEditing, setIsEditing] = useState(false);
	const [activeTab, setActiveTab] = useState("overview");

	// Data state
	const [pipeline, setPipeline] = useState<CapturePipeline | null>(null);
	const [summary, setSummary] = useState<PipelineSummary | null>(null);
	const [activities, setActivities] = useState<CaptureActivity[]>([]);
	const [milestones, setMilestones] = useState<PipelineMilestone[]>([]);
	const [gateReviews, setGateReviews] = useState<GateReview[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Edit form state
	const [editForm, setEditForm] = useState<Partial<UpdatePipelineInput>>({});

	// Load data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			try {
				const [pipelineRes, summaryRes, activitiesRes, milestonesRes, gatesRes] = await Promise.all([
					getPipeline(pipelineId),
					getPipelineSummary(pipelineId),
					listActivities(pipelineId),
					listMilestones(pipelineId),
					listGateReviews(pipelineId),
				]);

				if (pipelineRes.success && pipelineRes.data) {
					setPipeline(pipelineRes.data);
					setEditForm({
						currentStage: pipelineRes.data.currentStage as PipelineStage,
						healthStatus: pipelineRes.data.healthStatus as HealthStatus,
						priority: pipelineRes.data.priority as PipelinePriority,
						captureManager: pipelineRes.data.captureManager || undefined,
						proposalManager: pipelineRes.data.proposalManager || undefined,
						notes: pipelineRes.data.notes || undefined,
					});
				}

				if (summaryRes.success) {
					setSummary(summaryRes.data);
				}

				if (activitiesRes.success) {
					setActivities(activitiesRes.data);
				}

				if (milestonesRes.success) {
					setMilestones(milestonesRes.data);
				}

				if (gatesRes.success) {
					setGateReviews(gatesRes.data);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load capture data");
			} finally {
				setIsLoading(false);
			}
		}

		loadData();
	}, [pipelineId]);

	// Handle save
	const handleSave = useCallback(async () => {
		if (!pipeline) return;

		startTransition(async () => {
			const result = await updatePipeline(pipeline.id, editForm);
			if (result.success) {
				setPipeline(result.data);
				setIsEditing(false);
				onUpdate?.(result.data);
			} else {
				setError(result.error || "Failed to update capture");
			}
		});
	}, [pipeline, editForm, onUpdate]);

	// Handle cancel edit
	const handleCancelEdit = useCallback(() => {
		if (pipeline) {
			setEditForm({
				currentStage: pipeline.currentStage as PipelineStage,
				healthStatus: pipeline.healthStatus as HealthStatus,
				priority: pipeline.priority as PipelinePriority,
				captureManager: pipeline.captureManager || undefined,
				proposalManager: pipeline.proposalManager || undefined,
				notes: pipeline.notes || undefined,
			});
		}
		setIsEditing(false);
	}, [pipeline]);

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center p-8", className)}>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Error state
	if (error || !pipeline) {
		return (
			<Card className={className}>
				<CardContent className="p-8 text-center">
					<AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
					<h3 className="font-semibold text-lg mb-2">Failed to Load Capture</h3>
					<p className="text-muted-foreground">{error || "Capture not found"}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						<h1 className="text-2xl font-bold">
							{opportunity?.title || "Untitled Capture"}
						</h1>
						{getHealthIcon(pipeline.healthStatus as HealthStatus)}
					</div>
					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						{opportunity?.organization && (
							<span className="flex items-center gap-1">
								<Building2 className="h-4 w-4" />
								{opportunity.organization}
							</span>
						)}
						<span className="flex items-center gap-1">
							<DollarSign className="h-4 w-4" />
							{formatCurrency(opportunity?.budgetNumeric || null)}
						</span>
						{opportunity?.deadline && (
							<span className="flex items-center gap-1">
								<Calendar className="h-4 w-4" />
								{formatDate(opportunity.deadline)}
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					{isEditing ? (
						<>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleCancelEdit}
								disabled={isPending}
							>
								<X className="h-4 w-4 mr-2" />
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={handleSave}
								isLoading={isPending}
							>
								<Save className="h-4 w-4 mr-2" />
								Save
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsEditing(true)}
						>
							<Edit className="h-4 w-4 mr-2" />
							Edit
						</Button>
					)}
				</div>
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<Target className="h-4 w-4" />
							PWin
						</div>
						<div className="flex items-center gap-2">
							<span className="text-2xl font-bold">
								{pipeline.pwinCurrent || 0}%
							</span>
							<Progress
								value={pipeline.pwinCurrent || 0}
								className="flex-1 h-2"
							/>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<Flag className="h-4 w-4" />
							Stage
						</div>
						<div className="text-lg font-semibold capitalize">
							{pipeline.currentStage.replace("_", " ")}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<Clock className="h-4 w-4" />
							Days in Stage
						</div>
						<div className="text-lg font-semibold">
							{summary?.daysInCurrentStage || 0}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<Milestone className="h-4 w-4" />
							Milestones
						</div>
						<div className="text-lg font-semibold">
							{summary?.milestoneStatus.completed || 0}/
							{summary?.milestoneStatus.total || 0}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="overview">
						<FileText className="h-4 w-4 mr-2" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="activities">
						<Activity className="h-4 w-4 mr-2" />
						Activities
					</TabsTrigger>
					<TabsTrigger value="milestones">
						<Milestone className="h-4 w-4 mr-2" />
						Milestones
					</TabsTrigger>
					<TabsTrigger value="gates">
						<Shield className="h-4 w-4 mr-2" />
						Gate Reviews
					</TabsTrigger>
					<TabsTrigger value="pwin">
						<TrendingUp className="h-4 w-4 mr-2" />
						PWin Analysis
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<div className="grid md:grid-cols-2 gap-6">
						{/* Status & Priority */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Status & Priority</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="stage">Current Stage</Label>
										{isEditing ? (
											<Select
												value={editForm.currentStage}
												onValueChange={(value) =>
													setEditForm({ ...editForm, currentStage: value as PipelineStage })
												}
											>
												<SelectTrigger id="stage">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{STAGE_OPTIONS.map((opt) => (
														<SelectItem key={opt.value} value={opt.value}>
															{opt.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<div className="text-sm font-medium capitalize p-2 bg-muted rounded">
												{pipeline.currentStage.replace("_", " ")}
											</div>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="health">Health Status</Label>
										{isEditing ? (
											<Select
												value={editForm.healthStatus}
												onValueChange={(value) =>
													setEditForm({ ...editForm, healthStatus: value as HealthStatus })
												}
											>
												<SelectTrigger id="health">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{HEALTH_OPTIONS.map((opt) => (
														<SelectItem key={opt.value} value={opt.value}>
															{opt.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<div className="flex items-center gap-2 text-sm font-medium p-2 bg-muted rounded">
												{getHealthIcon(pipeline.healthStatus as HealthStatus)}
												{HEALTH_OPTIONS.find((o) => o.value === pipeline.healthStatus)?.label || "Not set"}
											</div>
										)}
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="priority">Priority</Label>
									{isEditing ? (
										<Select
											value={editForm.priority}
											onValueChange={(value) =>
												setEditForm({ ...editForm, priority: value as PipelinePriority })
											}
										>
											<SelectTrigger id="priority">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PRIORITY_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Badge variant={pipeline.priority === "high" ? "default" : "secondary"}>
											{pipeline.priority?.replace("_", " ") || "Not set"}
										</Badge>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Team */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Team Assignment</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="captureManager">Capture Manager</Label>
									{isEditing ? (
										<Input
											id="captureManager"
											value={editForm.captureManager || ""}
											onChange={(e) =>
												setEditForm({ ...editForm, captureManager: e.target.value })
											}
											placeholder="Enter capture manager name"
										/>
									) : (
										<div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
											<User className="h-4 w-4 text-muted-foreground" />
											{pipeline.captureManager || "Not assigned"}
										</div>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="proposalManager">Proposal Manager</Label>
									{isEditing ? (
										<Input
											id="proposalManager"
											value={editForm.proposalManager || ""}
											onChange={(e) =>
												setEditForm({ ...editForm, proposalManager: e.target.value })
											}
											placeholder="Enter proposal manager name"
										/>
									) : (
										<div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
											<User className="h-4 w-4 text-muted-foreground" />
											{pipeline.proposalManager || "Not assigned"}
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Health Indicators */}
					{summary?.healthIndicators && summary.healthIndicators.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Health Indicators</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
									{summary.healthIndicators.map((indicator, idx) => (
										<div
											key={idx}
											className={cn(
												"p-3 rounded-lg border",
												indicator.status === "good" && "bg-green-50 dark:bg-green-900/20 border-green-200",
												indicator.status === "warning" && "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200",
												indicator.status === "critical" && "bg-red-50 dark:bg-red-900/20 border-red-200"
											)}
										>
											<div className="text-sm font-medium">{indicator.indicator}</div>
											<div className="text-xs text-muted-foreground mt-1">
												{indicator.message}
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Notes */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Notes</CardTitle>
						</CardHeader>
						<CardContent>
							{isEditing ? (
								<Textarea
									value={editForm.notes || ""}
									onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
									placeholder="Add notes about this capture..."
									rows={4}
								/>
							) : (
								<div className="text-sm whitespace-pre-wrap">
									{pipeline.notes || "No notes added."}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Activities Tab */}
				<TabsContent value="activities">
					<ActivityTimeline
						activities={activities}
						pipelineId={pipelineId}
						onActivityAdded={(activity) => setActivities([activity, ...activities])}
					/>
				</TabsContent>

				{/* Milestones Tab */}
				<TabsContent value="milestones">
					<MilestoneTracker
						milestones={milestones}
						pipelineId={pipelineId}
						onMilestoneUpdated={(updated) =>
							setMilestones(milestones.map((m) => (m.id === updated.id ? updated : m)))
						}
					/>
				</TabsContent>

				{/* Gate Reviews Tab */}
				<TabsContent value="gates">
					<GateReviewPanel
						gateReviews={gateReviews}
						pipelineId={pipelineId}
						onGateUpdated={(updated) =>
							setGateReviews(gateReviews.map((g) => (g.id === updated.id ? updated : g)))
						}
					/>
				</TabsContent>

				{/* PWin Analysis Tab */}
				<TabsContent value="pwin">
					<PWinCalculator
						pipelineId={pipelineId}
						opportunityId={pipeline.opportunityId || undefined}
						currentPwin={pipeline.pwinCurrent || 0}
						pwinHistory={pipeline.pwinHistory as Array<{ date: string; value: number; reason?: string }> | undefined}
						onPwinUpdated={(newPwin) => {
							setPipeline({ ...pipeline, pwinCurrent: newPwin });
						}}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default CaptureDetail;
