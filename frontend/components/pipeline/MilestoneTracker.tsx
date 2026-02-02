/**
 * MilestoneTracker Component - DocFusion Capture Pipeline
 *
 * Visual milestone tracker with progress indicators, status badges,
 * and deadline management. Supports creating, completing, and
 * tracking milestones through the capture lifecycle.
 *
 * Accessibility: Progress indicators with ARIA, keyboard navigation.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition, useMemo } from "react";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Milestone,
	Calendar,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Clock,
	Plus,
	ChevronRight,
	Target,
	Flag,
	FileText,
	Users,
	Award,
	Send,
	HelpCircle,
	Timer,
	Loader2,
} from "lucide-react";
import { createMilestone, completeMilestone, updateMilestone } from "@/lib/actions/pipeline";
import type { PipelineMilestone, MilestoneStatus, MilestoneType, CreateMilestoneInput } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface MilestoneTrackerProps {
	/** List of milestones */
	milestones: PipelineMilestone[];
	/** Pipeline ID for creating new milestones */
	pipelineId: string;
	/** Callback when a milestone is updated */
	onMilestoneUpdated?: (milestone: PipelineMilestone) => void;
	/** Callback when a milestone is created */
	onMilestoneCreated?: (milestone: PipelineMilestone) => void;
	/** Show as compact view */
	compact?: boolean;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Milestone Type Configuration
// ============================================================================

const MILESTONE_TYPES: {
	value: MilestoneType;
	label: string;
	icon: React.ReactNode;
	color: string;
}[] = [
	{
		value: "rfp_release",
		label: "RFP Release",
		icon: <FileText className="h-4 w-4" />,
		color: "bg-blue-500",
	},
	{
		value: "questions_due",
		label: "Questions Due",
		icon: <HelpCircle className="h-4 w-4" />,
		color: "bg-purple-500",
	},
	{
		value: "answers_released",
		label: "Answers Released",
		icon: <FileText className="h-4 w-4" />,
		color: "bg-indigo-500",
	},
	{
		value: "proposal_due",
		label: "Proposal Due",
		icon: <Send className="h-4 w-4" />,
		color: "bg-red-500",
	},
	{
		value: "orals",
		label: "Orals Presentation",
		icon: <Users className="h-4 w-4" />,
		color: "bg-orange-500",
	},
	{
		value: "award_expected",
		label: "Award Expected",
		icon: <Award className="h-4 w-4" />,
		color: "bg-green-500",
	},
	{
		value: "contract_start",
		label: "Contract Start",
		icon: <Flag className="h-4 w-4" />,
		color: "bg-emerald-500",
	},
	{
		value: "gate_review",
		label: "Gate Review",
		icon: <Target className="h-4 w-4" />,
		color: "bg-amber-500",
	},
	{
		value: "custom",
		label: "Custom",
		icon: <Milestone className="h-4 w-4" />,
		color: "bg-slate-500",
	},
];

const STATUS_CONFIG: Record<MilestoneStatus, {
	label: string;
	icon: React.ReactNode;
	color: string;
	bgColor: string;
}> = {
	pending: {
		label: "Pending",
		icon: <Clock className="h-3.5 w-3.5" />,
		color: "text-blue-600",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	completed: {
		label: "Completed",
		icon: <CheckCircle className="h-3.5 w-3.5" />,
		color: "text-green-600",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	missed: {
		label: "Missed",
		icon: <XCircle className="h-3.5 w-3.5" />,
		color: "text-red-600",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
	cancelled: {
		label: "Cancelled",
		icon: <XCircle className="h-3.5 w-3.5" />,
		color: "text-gray-600",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
};

// ============================================================================
// Helper Functions
// ============================================================================

function getMilestoneTypeConfig(type: string | null) {
	return MILESTONE_TYPES.find((t) => t.value === type) || {
		value: "custom",
		label: "Custom",
		icon: <Milestone className="h-4 w-4" />,
		color: "bg-slate-500",
	};
}

function getDaysUntil(date: Date | null): number | null {
	if (!date) return null;
	const now = new Date();
	const diffTime = new Date(date).getTime() - now.getTime();
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getDeadlineStatus(date: Date | null, status: MilestoneStatus): {
	urgent: boolean;
	overdue: boolean;
	text: string;
	color: string;
} {
	if (status === "completed") {
		return { urgent: false, overdue: false, text: "Completed", color: "text-green-600" };
	}

	if (!date) {
		return { urgent: false, overdue: false, text: "No date", color: "text-muted-foreground" };
	}

	const daysUntil = getDaysUntil(date)!;

	if (daysUntil < 0) {
		return {
			urgent: true,
			overdue: true,
			text: `${Math.abs(daysUntil)} days overdue`,
			color: "text-red-600",
		};
	}

	if (daysUntil === 0) {
		return {
			urgent: true,
			overdue: false,
			text: "Due today",
			color: "text-orange-600",
		};
	}

	if (daysUntil <= 3) {
		return {
			urgent: true,
			overdue: false,
			text: `${daysUntil} days left`,
			color: "text-orange-600",
		};
	}

	if (daysUntil <= 7) {
		return {
			urgent: false,
			overdue: false,
			text: `${daysUntil} days left`,
			color: "text-yellow-600",
		};
	}

	return {
		urgent: false,
		overdue: false,
		text: formatDate(date),
		color: "text-muted-foreground",
	};
}

// ============================================================================
// Milestone Item Component
// ============================================================================

interface MilestoneItemProps {
	milestone: PipelineMilestone;
	onComplete: (id: string) => void;
	isLast: boolean;
	isPending: boolean;
}

function MilestoneItem({ milestone, onComplete, isLast, isPending }: MilestoneItemProps) {
	const typeConfig = getMilestoneTypeConfig(milestone.milestoneType);
	const statusConfig = STATUS_CONFIG[milestone.status as MilestoneStatus] || STATUS_CONFIG.pending;
	const deadlineStatus = getDeadlineStatus(milestone.targetDate, milestone.status as MilestoneStatus);
	const isCompleted = milestone.status === "completed";

	return (
		<div className="relative flex gap-4">
			{/* Timeline */}
			<div className="flex flex-col items-center">
				<div
					className={cn(
						"flex items-center justify-center w-8 h-8 rounded-full text-white transition-all",
						isCompleted ? "bg-green-500" : typeConfig.color,
						isCompleted && "ring-2 ring-green-200 ring-offset-2"
					)}
				>
					{isCompleted ? <CheckCircle className="h-4 w-4" /> : typeConfig.icon}
				</div>
				{!isLast && (
					<div
						className={cn(
							"flex-1 w-0.5 mt-2",
							isCompleted ? "bg-green-500" : "bg-border"
						)}
					/>
				)}
			</div>

			{/* Content */}
			<div className={cn("flex-1 pb-6", isLast && "pb-0")}>
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<h4 className={cn(
								"font-medium text-sm",
								isCompleted && "line-through text-muted-foreground"
							)}>
								{milestone.name}
							</h4>
							<Badge className={cn("text-xs", statusConfig.bgColor, statusConfig.color)}>
								{statusConfig.icon}
								<span className="ml-1">{statusConfig.label}</span>
							</Badge>
						</div>
						{milestone.description && (
							<p className="text-xs text-muted-foreground mt-0.5">
								{milestone.description}
							</p>
						)}
						<div className="flex items-center gap-3 mt-1 text-xs">
							<span className={deadlineStatus.color}>
								{milestone.targetDate ? (
									<span className="flex items-center gap-1">
										<Calendar className="h-3 w-3" />
										{deadlineStatus.text}
									</span>
								) : (
									"No target date"
								)}
							</span>
							{milestone.owner && (
								<span className="flex items-center gap-1 text-muted-foreground">
									<Users className="h-3 w-3" />
									{milestone.owner}
								</span>
							)}
						</div>
					</div>

					{/* Complete button */}
					{!isCompleted && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => onComplete(milestone.id)}
										disabled={isPending}
									>
										{isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<CheckCircle className="h-4 w-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>Mark as complete</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>

				{/* Completed info */}
				{isCompleted && milestone.actualDate && (
					<div className="mt-1 text-xs text-muted-foreground">
						Completed on {formatDate(milestone.actualDate)}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function MilestoneTracker({
	milestones,
	pipelineId,
	onMilestoneUpdated,
	onMilestoneCreated,
	compact = false,
	className,
}: MilestoneTrackerProps) {
	const [isPending, startTransition] = useTransition();
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [newMilestone, setNewMilestone] = useState<Partial<CreateMilestoneInput>>({
		name: "",
		description: "",
		milestoneType: "custom",
		targetDate: undefined,
		owner: "",
	});

	// Sort milestones by target date
	const sortedMilestones = useMemo(() => {
		return [...milestones].sort((a, b) => {
			if (!a.targetDate && !b.targetDate) return 0;
			if (!a.targetDate) return 1;
			if (!b.targetDate) return -1;
			return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
		});
	}, [milestones]);

	// Calculate progress
	const progress = useMemo(() => {
		if (milestones.length === 0) return 0;
		const completed = milestones.filter((m) => m.status === "completed").length;
		return Math.round((completed / milestones.length) * 100);
	}, [milestones]);

	// Get stats
	const stats = useMemo(() => {
		const now = new Date();
		return {
			total: milestones.length,
			completed: milestones.filter((m) => m.status === "completed").length,
			pending: milestones.filter((m) => m.status === "pending").length,
			missed: milestones.filter(
				(m) => m.status === "pending" && m.targetDate && new Date(m.targetDate) < now
			).length,
			upcoming: milestones.filter(
				(m) => m.status === "pending" && m.targetDate && new Date(m.targetDate) >= now
			).length,
		};
	}, [milestones]);

	// Handle create milestone
	const handleCreateMilestone = useCallback(async () => {
		if (!newMilestone.name) return;

		startTransition(async () => {
			const result = await createMilestone(pipelineId, {
				name: newMilestone.name!,
				description: newMilestone.description,
				milestoneType: newMilestone.milestoneType as MilestoneType,
				targetDate: newMilestone.targetDate,
				owner: newMilestone.owner,
			});

			if (result.success) {
				onMilestoneCreated?.(result.data);
				setAddDialogOpen(false);
				setNewMilestone({
					name: "",
					description: "",
					milestoneType: "custom",
					targetDate: undefined,
					owner: "",
				});
			}
		});
	}, [pipelineId, newMilestone, onMilestoneCreated]);

	// Handle complete milestone
	const handleCompleteMilestone = useCallback(
		async (milestoneId: string) => {
			startTransition(async () => {
				const result = await completeMilestone(milestoneId);
				if (result.success) {
					onMilestoneUpdated?.(result.data);
				}
			});
		},
		[onMilestoneUpdated]
	);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg flex items-center gap-2">
						<Milestone className="h-5 w-5" />
						Milestones
					</h3>
					<p className="text-sm text-muted-foreground">
						{stats.completed} of {stats.total} completed
					</p>
				</div>
				<Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
					<DialogTrigger asChild>
						<Button variant="outline" size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Add Milestone
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add Milestone</DialogTitle>
							<DialogDescription>
								Create a new milestone to track progress
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="milestoneType">Type</Label>
								<Select
									value={newMilestone.milestoneType}
									onValueChange={(value) =>
										setNewMilestone({ ...newMilestone, milestoneType: value as MilestoneType })
									}
								>
									<SelectTrigger id="milestoneType">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{MILESTONE_TYPES.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												<div className="flex items-center gap-2">
													{type.icon}
													{type.label}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={newMilestone.name || ""}
									onChange={(e) =>
										setNewMilestone({ ...newMilestone, name: e.target.value })
									}
									placeholder="e.g., Draft Review Complete"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">Description (optional)</Label>
								<Textarea
									id="description"
									value={newMilestone.description || ""}
									onChange={(e) =>
										setNewMilestone({ ...newMilestone, description: e.target.value })
									}
									placeholder="Brief description..."
									rows={2}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="targetDate">Target Date</Label>
									<Input
										id="targetDate"
										type="date"
										onChange={(e) =>
											setNewMilestone({
												...newMilestone,
												targetDate: e.target.value ? new Date(e.target.value) : undefined,
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="owner">Owner (optional)</Label>
									<Input
										id="owner"
										value={newMilestone.owner || ""}
										onChange={(e) =>
											setNewMilestone({ ...newMilestone, owner: e.target.value })
										}
										placeholder="Responsible person"
									/>
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={handleCreateMilestone}
								disabled={!newMilestone.name || isPending}
								isLoading={isPending}
							>
								Add Milestone
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Progress */}
			<Card>
				<CardContent className="pt-4">
					<div className="flex items-center gap-4 mb-3">
						<Progress value={progress} className="flex-1 h-2" aria-label="Milestone progress" />
						<span className="text-sm font-medium">{progress}%</span>
					</div>
					<div className="flex items-center gap-4 text-sm">
						<div className="flex items-center gap-1">
							<CheckCircle className="h-4 w-4 text-green-500" />
							<span>{stats.completed} complete</span>
						</div>
						<div className="flex items-center gap-1">
							<Clock className="h-4 w-4 text-blue-500" />
							<span>{stats.upcoming} upcoming</span>
						</div>
						{stats.missed > 0 && (
							<div className="flex items-center gap-1">
								<AlertTriangle className="h-4 w-4 text-red-500" />
								<span className="text-red-600">{stats.missed} overdue</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Milestone List */}
			{sortedMilestones.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<Milestone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h4 className="font-semibold mb-2">No Milestones</h4>
						<p className="text-sm text-muted-foreground mb-4">
							Add milestones to track key dates and deliverables
						</p>
						<Button variant="outline" onClick={() => setAddDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add First Milestone
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="pt-6">
						{sortedMilestones.map((milestone, idx) => (
							<MilestoneItem
								key={milestone.id}
								milestone={milestone}
								onComplete={handleCompleteMilestone}
								isLast={idx === sortedMilestones.length - 1}
								isPending={isPending}
							/>
						))}
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default MilestoneTracker;
