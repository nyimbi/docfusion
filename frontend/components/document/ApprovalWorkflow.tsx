"use client";

/**
 * Approval Workflow Component - DocFusion
 *
 * Visualizes review workflow status with:
 * - Stage progress indicators
 * - User assignments and completion status
 * - Due date tracking with visual indicators
 * - Stage-by-stage status
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type {
	WorkflowStatus,
	StageStatus,
	WorkflowStage,
	ApprovalStatus,
	WorkflowDeadline,
	DeadlineUrgency,
} from "@/lib/types/comments-workflow";
import {
	getWorkflowStatus,
	getUpcomingDeadlines,
	getPendingApprovalsForUser,
} from "@/lib/actions/approvals";
import { getWorkflowAssignments } from "@/lib/actions/workflows";
import { Button } from "@/components/ui/Button";
import {
	Circle,
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
	ArrowRight,
	Users,
	Calendar,
	User,
	Play,
	AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface ApprovalWorkflowProps {
	documentId: string;
	proposalDocumentId?: string;
	/** Current user ID */
	currentUserId: string;
	/** Whether current user can modify workflow assignments */
	canEdit?: boolean;
	/** Callback when workflow status changes */
	onStatusChange?: () => void;
	/** Optional className */
	className?: string;
	/** Compact mode for sidebars */
	compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STAGE_CONFIG: Record<
	WorkflowStage,
	{ icon: React.ReactNode; label: string; description: string; color: string }
> = {
	writer: {
		icon: <Play className="h-4 w-4" />,
		label: "Writing",
		description: "Drafting and editing",
		color: "blue",
	},
	reviewer: {
		icon: <Users className="h-4 w-4" />,
		label: "Review",
		description: "Technical and content review",
		color: "purple",
	},
	approver: {
		icon: <CheckCircle2 className="h-4 w-4" />,
		label: "Approval",
		description: "Final sign-off",
		color: "green",
	},
};

const STATUS_CONFIG: Record<
	ApprovalStatus,
	{ icon: React.ReactNode; label: string; bg: string; text: string; border: string }
> = {
	pending: {
		icon: <Circle className="h-4 w-4" />,
		label: "Pending",
		bg: "bg-gray-100",
		text: "text-gray-600",
		border: "border-gray-200",
	},
	in_review: {
		icon: <Clock className="h-4 w-4" />,
		label: "In Review",
		bg: "bg-blue-50",
		text: "text-blue-600",
		border: "border-blue-200",
	},
	approved: {
		icon: <CheckCircle2 className="h-4 w-4" />,
		label: "Approved",
		bg: "bg-green-50",
		text: "text-green-600",
		border: "border-green-200",
	},
	rejected: {
		icon: <XCircle className="h-4 w-4" />,
		label: "Rejected",
		bg: "bg-red-50",
		text: "text-red-600",
		border: "border-red-200",
	},
	changes_requested: {
		icon: <AlertTriangle className="h-4 w-4" />,
		label: "Changes Requested",
		bg: "bg-orange-50",
		text: "text-orange-600",
		border: "border-orange-200",
	},
};

// ============================================================================
// Helper Functions
// ============================================================================

function getUrgencyClass(urgency: DeadlineUrgency): string {
	switch (urgency) {
		case "overdue":
			return "text-red-600 bg-red-50 border-red-200";
		case "critical":
			return "text-orange-600 bg-orange-50 border-orange-200";
		case "urgent":
			return "text-yellow-600 bg-yellow-50 border-yellow-200";
		default:
			return "text-gray-600 bg-gray-50 border-gray-200";
	}
}

// ============================================================================
// Stage Indicator Component
// ============================================================================

function StageIndicator({
	stage,
	status,
	isActive,
	progress,
}: {
	stage: WorkflowStage;
	status: StageStatus;
	isActive: boolean;
	progress: number;
}) {
	const config = STAGE_CONFIG[stage];
	const statusConfig = STATUS_CONFIG[status.status];

	return (
		<div
			className={cn(
				"relative p-3 rounded-lg border transition-all",
				isActive ? "ring-2 ring-blue-500 ring-offset-2" : "",
				statusConfig.bg,
				statusConfig.border
			)}
		>
			<div className="flex items-start gap-3">
				{/* Stage icon */}
				<div
					className={cn(
						"flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
						isActive
							? `bg-${config.color}-500 text-white`
							: `bg-${config.color}-100 text-${config.color}-600`
					)}
				>
					{config.icon}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between">
						<h4 className="font-medium text-gray-900">{config.label}</h4>
						<span
							className={cn(
								"inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
								statusConfig.bg,
								statusConfig.text
							)}
						>
							{statusConfig.icon}
							{statusConfig.label}
						</span>
					</div>

					<p className="text-xs text-gray-500 mt-0.5">{config.description}</p>

					{/* Due date */}
					{status.dueDate && !status.completed && (
						<div
							className={cn(
								"flex items-center gap-1.5 mt-2 text-xs",
								status.isOverdue && "text-red-600"
							)}
						>
							<Calendar className="h-3.5 w-3.5" />
							<span>
								{status.isOverdue ? (
									<span className="font-medium">
										Overdue by {formatDistanceToNow(status.dueDate)}
									</span>
								) : (
									<span>Due {formatDistanceToNow(status.dueDate, { addSuffix: true })}</span>
								)}
							</span>
						</div>
					)}

					{/* Assigned users */}
					{status.assignedUsers.length > 0 && (
						<div className="flex items-center gap-2 mt-2">
							<div className="flex -space-x-2">
								{status.assignedUsers.slice(0, 3).map((user, i) => (
									<div
										key={i}
										className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white"
										title={user.userName}
									>
										{user.userName.charAt(0).toUpperCase()}
									</div>
								))}
								{status.assignedUsers.length > 3 && (
									<div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
										+{status.assignedUsers.length - 3}
									</div>
								)}
							</div>
							<span className="text-xs text-gray-500">
								{status.assignedUsers.filter((u) => u.hasCompleted).length} of{" "}
								{status.assignedUsers.length} completed
							</span>
						</div>
					)}

					{/* Completed */}
					{status.completed && status.completedAt && (
						<div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
							<CheckCircle2 className="h-3.5 w-3.5" />
							<span>
								Completed {formatDistanceToNow(status.completedAt, { addSuffix: true })}
								{status.completedBy && ` by ${status.completedBy}`}
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Progress bar */}
			{status.assignedUsers.length > 1 && (
				<div className="mt-3">
					<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
						<div
							className={cn(
								"h-full transition-all",
								status.completed ? "bg-green-500" : "bg-blue-500"
							)}
							style={{
								width: `${(status.assignedUsers.filter((u) => u.hasCompleted).length / status.assignedUsers.length) * 100}%`,
							}}
						/>
					</div>
				</div>
			)}

			{/* Action required indicator */}
			{isActive && (
				<div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
			)}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ApprovalWorkflow({
	documentId,
	proposalDocumentId,
	currentUserId,
	canEdit = false,
	onStatusChange,
	className,
	compact = false,
}: ApprovalWorkflowProps) {
	const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchWorkflow = useCallback(async () => {
		try {
			setLoading(true);
			const status = await getWorkflowStatus(documentId);
			setWorkflow(status);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load workflow");
		} finally {
			setLoading(false);
		}
	}, [documentId]);

	useEffect(() => {
		fetchWorkflow();
	}, [fetchWorkflow]);

	// Calculate status for display
	const overallStatusConfig = workflow
		? STATUS_CONFIG[workflow.overallStatus]
		: STATUS_CONFIG.pending;

	// Check if current user is assigned to current stage
	const isUserAssigned = useMemo(() => {
		if (!workflow?.currentStage) return false;
		const stage = workflow.stageStatuses.find((s) => s.stage === workflow.currentStage);
		if (!stage) return false;
		return stage.assignedUsers.some((u) => u.userId === currentUserId);
	}, [workflow, currentUserId]);

	if (loading) {
		return (
			<div className={cn("flex items-center justify-center h-32", className)}>
				<div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full" />
			</div>
		);
	}

	if (error) {
		return (
			<div className={cn("p-4 text-center", className)}>
				<p className="text-red-600 text-sm">{error}</p>
				<Button variant="ghost" size="sm" onClick={fetchWorkflow} className="mt-2">
					Retry
				</Button>
			</div>
		);
	}

	if (!workflow) {
		return (
			<div className={cn("p-4 text-center", className)}>
				<p className="text-gray-500 text-sm">No workflow configured</p>
				{canEdit && (
					<Button size="sm" className="mt-3">
						Set Up Workflow
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="px-4 py-3 border-b">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-gray-900">Review Status</h3>
						<p className="text-sm text-gray-500">
							{workflow.progressPercentage}% complete
							{workflow.daysUntilDue !== null && (
								<span className="ml-2">
									{workflow.daysUntilDue < 0
										? `(${Math.abs(workflow.daysUntilDue)} days overdue)`
										: `(${workflow.daysUntilDue} days remaining)`}
								</span>
								)}
						</p>
					</div>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
							overallStatusConfig.bg,
							overallStatusConfig.text
						)}
					>
						{overallStatusConfig.icon}
						{overallStatusConfig.label}
					</span>
				</div>

				{/* Overall progress bar */}
				<div className="mt-3">
					<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
						<div
							className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
							style={{ width: `${workflow.progressPercentage}%` }}
						/>
					</div>
				</div>
			</div>

			{/* Stages */}
			<div className="p-4 space-y-4">
				{workflow.stageStatuses.map((stage, index) => (
					<div key={stage.stage}>
						{/* Connector line */}
						{index > 0 && (
							<div className="flex items-center justify-center -mt-4 mb-2">
								<div
									className={cn(
										"w-0.5 h-6",
										workflow.stageStatuses[index - 1].completed
											? "bg-green-400"
											: "bg-gray-200"
									)}
								/>
							</div>
						)}
						<StageIndicator
							stage={stage.stage}
							status={stage}
							isActive={stage.stage === workflow.currentStage}
							progress={
								stage.assignedUsers.length > 0
									? (stage.assignedUsers.filter((u) => u.hasCompleted).length /
											stage.assignedUsers.length) *
										100
									: 0
							}
						/>
					</div>
				))}
			</div>

			{/* Action buttons */}
			{workflow.isActionRequired && isUserAssigned && (
				<div className="px-4 py-3 border-t bg-gray-50">
					<div className="flex flex-wrap gap-2">
						{workflow.availableActions.map((action) => (
							<Button
								key={action.type}
								size="sm"
								variant={
									action.type === "approve"
										? "primary"
										: action.type === "reject"
										? "danger"
										: "outline"
								}
							>
								{action.label}
							</Button>
						))}
					</div>
				</div>
			)}

			{/* Edit button for admins */}
			{canEdit && !compact && (
				<div className="px-4 py-3 border-t">
					<Button variant="outline" size="sm" className="w-full">
						Edit Workflow
					</Button>
				</div>
			)}
		</div>
	);
}

export default ApprovalWorkflow;
