/**
 * ApprovalWorkflow Component
 *
 * Content approval workflow with multi-stage review,
 * comments, and status tracking.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	CheckCircle,
	XCircle,
	Clock,
	AlertTriangle,
	MessageSquare,
	User,
	Users,
	Send,
	ChevronDown,
	ChevronRight,
	FileText,
	ArrowRight,
	RotateCcw,
	History,
	Flag,
	Edit,
	Eye,
	RefreshCw,
	ThumbsUp,
	ThumbsDown,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type ApprovalStatus = "draft" | "submitted" | "in_review" | "changes_requested" | "approved" | "rejected";

interface Reviewer {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
	role: string;
}

interface ReviewComment {
	id: string;
	authorId: string;
	authorName: string;
	content: string;
	createdAt: string;
	isResolved: boolean;
	lineNumber?: number;
}

interface ApprovalStage {
	id: string;
	name: string;
	order: number;
	requiredApprovers: number;
	approvers: Reviewer[];
	status: "pending" | "in_progress" | "approved" | "rejected" | "skipped";
	approvedBy: { reviewerId: string; approvedAt: string }[];
	rejectedBy?: { reviewerId: string; rejectedAt: string; reason: string };
	comments: ReviewComment[];
}

interface ContentApproval {
	id: string;
	contentBlockId: string;
	contentTitle: string;
	status: ApprovalStatus;
	currentStageId: string;
	stages: ApprovalStage[];
	submittedAt?: string;
	submittedBy?: string;
	completedAt?: string;
	deadline?: string;
	priority: "low" | "normal" | "high" | "urgent";
}

interface ApprovalWorkflowProps {
	approval: ContentApproval;
	currentUserId: string;
	onSubmit?: () => Promise<void>;
	onApprove?: (stageId: string, comment?: string) => Promise<void>;
	onReject?: (stageId: string, reason: string) => Promise<void>;
	onRequestChanges?: (stageId: string, comment: string) => Promise<void>;
	onAddComment?: (stageId: string, comment: string) => Promise<void>;
	onResolveComment?: (stageId: string, commentId: string) => Promise<void>;
	onWithdraw?: () => Promise<void>;
	onResubmit?: () => Promise<void>;
	onViewContent?: () => void;
	onEditContent?: () => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
	ApprovalStatus,
	{ label: string; color: string; bg: string; icon: typeof Clock }
> = {
	draft: {
		label: "Draft",
		color: "text-gray-600",
		bg: "bg-gray-100",
		icon: Edit,
	},
	submitted: {
		label: "Submitted",
		color: "text-blue-600",
		bg: "bg-blue-100",
		icon: Send,
	},
	in_review: {
		label: "In Review",
		color: "text-yellow-600",
		bg: "bg-yellow-100",
		icon: Eye,
	},
	changes_requested: {
		label: "Changes Requested",
		color: "text-orange-600",
		bg: "bg-orange-100",
		icon: AlertTriangle,
	},
	approved: {
		label: "Approved",
		color: "text-green-600",
		bg: "bg-green-100",
		icon: CheckCircle,
	},
	rejected: {
		label: "Rejected",
		color: "text-red-600",
		bg: "bg-red-100",
		icon: XCircle,
	},
};

const PRIORITY_CONFIG = {
	low: { label: "Low", color: "text-gray-500", bg: "bg-gray-100" },
	normal: { label: "Normal", color: "text-blue-600", bg: "bg-blue-100" },
	high: { label: "High", color: "text-orange-600", bg: "bg-orange-100" },
	urgent: { label: "Urgent", color: "text-red-600", bg: "bg-red-100" },
};

// ============================================================================
// Component
// ============================================================================

export function ApprovalWorkflow({
	approval,
	currentUserId,
	onSubmit,
	onApprove,
	onReject,
	onRequestChanges,
	onAddComment,
	onResolveComment,
	onWithdraw,
	onResubmit,
	onViewContent,
	onEditContent,
	className,
}: ApprovalWorkflowProps) {
	const [expandedStages, setExpandedStages] = useState<Set<string>>(
		new Set([approval.currentStageId])
	);
	const [commentText, setCommentText] = useState<Record<string, string>>({});
	const [rejectReason, setRejectReason] = useState("");
	const [showRejectDialog, setShowRejectDialog] = useState(false);
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const statusConfig = STATUS_CONFIG[approval.status];
	const StatusIcon = statusConfig.icon;
	const priorityConfig = PRIORITY_CONFIG[approval.priority];
	const currentStage = approval.stages.find((s) => s.id === approval.currentStageId);

	const isReviewer = currentStage?.approvers.some((a) => a.id === currentUserId) ?? false;
	const hasApproved = currentStage?.approvedBy.some((a) => a.reviewerId === currentUserId) ?? false;
	const canApprove = isReviewer && !hasApproved && approval.status === "in_review";

	const toggleStage = (stageId: string) => {
		setExpandedStages((prev) => {
			const next = new Set(prev);
			if (next.has(stageId)) {
				next.delete(stageId);
			} else {
				next.add(stageId);
			}
			return next;
		});
	};

	const handleAction = async (action: () => Promise<void>, actionName: string) => {
		setActionLoading(actionName);
		try {
			await action();
		} finally {
			setActionLoading(null);
		}
	};

	const handleApprove = async () => {
		if (!onApprove || !currentStage) return;
		const comment = commentText[currentStage.id]?.trim();
		await handleAction(() => onApprove(currentStage.id, comment), "approve");
		setCommentText((prev) => ({ ...prev, [currentStage.id]: "" }));
	};

	const handleReject = async () => {
		if (!onReject || !currentStage || !rejectReason.trim()) return;
		await handleAction(() => onReject(currentStage.id, rejectReason), "reject");
		setRejectReason("");
		setShowRejectDialog(false);
	};

	const handleRequestChanges = async () => {
		if (!onRequestChanges || !currentStage) return;
		const comment = commentText[currentStage.id]?.trim();
		if (!comment) return;
		await handleAction(() => onRequestChanges(currentStage.id, comment), "requestChanges");
		setCommentText((prev) => ({ ...prev, [currentStage.id]: "" }));
	};

	const handleAddComment = async (stageId: string) => {
		if (!onAddComment) return;
		const comment = commentText[stageId]?.trim();
		if (!comment) return;
		await handleAction(() => onAddComment(stageId, comment), `comment-${stageId}`);
		setCommentText((prev) => ({ ...prev, [stageId]: "" }));
	};

	// Calculate days until deadline
	const daysUntilDeadline = approval.deadline
		? Math.ceil((new Date(approval.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
		: null;

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="p-4 border-b">
				<div className="flex items-start justify-between mb-3">
					<div className="flex items-center gap-3">
						<div className={cn("p-2 rounded-lg", statusConfig.bg)}>
							<StatusIcon className={cn("w-6 h-6", statusConfig.color)} />
						</div>
						<div>
							<h2 className="font-semibold">{approval.contentTitle}</h2>
							<div className="flex items-center gap-2 mt-1">
								<span
									className={cn(
										"px-2 py-0.5 rounded text-xs font-medium",
										statusConfig.bg,
										statusConfig.color
									)}
								>
									{statusConfig.label}
								</span>
								<span
									className={cn(
										"px-2 py-0.5 rounded text-xs font-medium",
										priorityConfig.bg,
										priorityConfig.color
									)}
								>
									{priorityConfig.label} Priority
								</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{onViewContent && (
							<Button variant="ghost" size="sm" onClick={onViewContent}>
								<Eye className="w-4 h-4 mr-1" />
								View
							</Button>
						)}
						{approval.status === "draft" && onEditContent && (
							<Button variant="ghost" size="sm" onClick={onEditContent}>
								<Edit className="w-4 h-4 mr-1" />
								Edit
							</Button>
						)}
					</div>
				</div>

				{/* Deadline Warning */}
				{daysUntilDeadline !== null && daysUntilDeadline <= 3 && (
					<div
						className={cn(
							"p-2 rounded-lg text-sm flex items-center gap-2",
							daysUntilDeadline <= 0
								? "bg-red-100 text-red-700"
								: "bg-orange-100 text-orange-700"
						)}
					>
						<Clock className="w-4 h-4" />
						{daysUntilDeadline <= 0
							? `Deadline passed ${Math.abs(daysUntilDeadline)} days ago`
							: `${daysUntilDeadline} days until deadline`}
					</div>
				)}

				{/* Action Buttons */}
				<div className="flex items-center gap-2 mt-3">
					{approval.status === "draft" && onSubmit && (
						<Button
							variant="primary"
							onClick={() => handleAction(onSubmit, "submit")}
							disabled={actionLoading === "submit"}
						>
							{actionLoading === "submit" ? (
								<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
							) : (
								<Send className="w-4 h-4 mr-1" />
							)}
							Submit for Review
						</Button>
					)}
					{approval.status === "changes_requested" && onResubmit && (
						<Button
							variant="primary"
							onClick={() => handleAction(onResubmit, "resubmit")}
							disabled={actionLoading === "resubmit"}
						>
							{actionLoading === "resubmit" ? (
								<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
							) : (
								<RotateCcw className="w-4 h-4 mr-1" />
							)}
							Resubmit
						</Button>
					)}
					{(approval.status === "submitted" || approval.status === "in_review") && onWithdraw && (
						<Button
							variant="outline"
							onClick={() => handleAction(onWithdraw, "withdraw")}
							disabled={actionLoading === "withdraw"}
						>
							Withdraw
						</Button>
					)}
				</div>
			</div>

			{/* Progress Timeline */}
			<div className="p-4 border-b bg-gray-50">
				<h3 className="text-sm font-medium text-gray-700 mb-3">Approval Progress</h3>
				<div className="flex items-center">
					{approval.stages.map((stage, index) => (
						<React.Fragment key={stage.id}>
							<div className="flex flex-col items-center">
								<div
									className={cn(
										"w-8 h-8 rounded-full flex items-center justify-center",
										stage.status === "approved" && "bg-green-500 text-white",
										stage.status === "rejected" && "bg-red-500 text-white",
										stage.status === "in_progress" && "bg-blue-500 text-white",
										stage.status === "pending" && "bg-gray-200 text-gray-500",
										stage.status === "skipped" && "bg-gray-300 text-gray-600"
									)}
								>
									{stage.status === "approved" && <CheckCircle className="w-5 h-5" />}
									{stage.status === "rejected" && <XCircle className="w-5 h-5" />}
									{stage.status === "in_progress" && <Clock className="w-5 h-5" />}
									{stage.status === "pending" && <span className="text-sm">{index + 1}</span>}
									{stage.status === "skipped" && <span className="text-sm">-</span>}
								</div>
								<span className="text-xs text-gray-600 mt-1 text-center max-w-[80px] truncate">
									{stage.name}
								</span>
							</div>
							{index < approval.stages.length - 1 && (
								<div
									className={cn(
										"flex-1 h-0.5 mx-2",
										stage.status === "approved" ? "bg-green-500" : "bg-gray-200"
									)}
								/>
							)}
						</React.Fragment>
					))}
				</div>
			</div>

			{/* Stages Detail */}
			<div className="divide-y">
				{approval.stages.map((stage) => {
					const isExpanded = expandedStages.has(stage.id);
					const isCurrent = stage.id === approval.currentStageId;

					return (
						<div key={stage.id} className={cn(isCurrent && "bg-blue-50/50")}>
							{/* Stage Header */}
							<button
								onClick={() => toggleStage(stage.id)}
								className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
							>
								<div className="flex items-center gap-3">
									{isExpanded ? (
										<ChevronDown className="w-4 h-4 text-gray-400" />
									) : (
										<ChevronRight className="w-4 h-4 text-gray-400" />
									)}
									<StageStatusIcon status={stage.status} />
									<div className="text-left">
										<div className="flex items-center gap-2">
											<span className="font-medium text-sm">{stage.name}</span>
											{isCurrent && (
												<span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
													Current
												</span>
											)}
										</div>
										<div className="text-xs text-gray-500">
											{stage.approvedBy.length}/{stage.requiredApprovers} approvals needed
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									{stage.comments.length > 0 && (
										<span className="flex items-center gap-1 text-xs text-gray-500">
											<MessageSquare className="w-4 h-4" />
											{stage.comments.length}
										</span>
									)}
									<div className="flex -space-x-2">
										{stage.approvers.slice(0, 3).map((approver) => (
											<div
												key={approver.id}
												className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
												title={approver.name}
											>
												<span className="text-xs text-gray-600">
													{approver.name.charAt(0)}
												</span>
											</div>
										))}
										{stage.approvers.length > 3 && (
											<div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center">
												<span className="text-xs text-gray-600">
													+{stage.approvers.length - 3}
												</span>
											</div>
										)}
									</div>
								</div>
							</button>

							{/* Stage Content */}
							{isExpanded && (
								<div className="px-4 pb-4 pt-0">
									{/* Approvers List */}
									<div className="mb-4">
										<h4 className="text-xs font-medium text-gray-500 mb-2">Reviewers</h4>
										<div className="space-y-2">
											{stage.approvers.map((approver) => {
												const approved = stage.approvedBy.find(
													(a) => a.reviewerId === approver.id
												);
												return (
													<div
														key={approver.id}
														className="flex items-center justify-between p-2 bg-gray-50 rounded"
													>
														<div className="flex items-center gap-2">
															<div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
																<span className="text-sm text-gray-600">
																	{approver.name.charAt(0)}
																</span>
															</div>
															<div>
																<p className="text-sm font-medium">{approver.name}</p>
																<p className="text-xs text-gray-500">{approver.role}</p>
															</div>
														</div>
														{approved && (
															<span className="flex items-center gap-1 text-xs text-green-600">
																<CheckCircle className="w-4 h-4" />
																Approved
															</span>
														)}
													</div>
												);
											})}
										</div>
									</div>

									{/* Comments */}
									{stage.comments.length > 0 && (
										<div className="mb-4">
											<h4 className="text-xs font-medium text-gray-500 mb-2">Comments</h4>
											<div className="space-y-2">
												{stage.comments.map((comment) => (
													<div
														key={comment.id}
														className={cn(
															"p-3 rounded-lg",
															comment.isResolved ? "bg-gray-50" : "bg-white border"
														)}
													>
														<div className="flex items-start justify-between mb-1">
															<span className="text-sm font-medium">
																{comment.authorName}
															</span>
															<span className="text-xs text-gray-500">
																{new Date(comment.createdAt).toLocaleDateString()}
															</span>
														</div>
														<p
															className={cn(
																"text-sm",
																comment.isResolved && "text-gray-500 line-through"
															)}
														>
															{comment.content}
														</p>
														{!comment.isResolved && onResolveComment && (
															<button
																onClick={() => onResolveComment(stage.id, comment.id)}
																className="mt-2 text-xs text-blue-600 hover:underline"
															>
																Mark as resolved
															</button>
														)}
													</div>
												))}
											</div>
										</div>
									)}

									{/* Action Area for Current Stage */}
									{isCurrent && stage.status === "in_progress" && (
										<div className="border-t pt-4">
											{/* Add Comment */}
											<div className="mb-3">
												<textarea
													value={commentText[stage.id] ?? ""}
													onChange={(e) =>
														setCommentText((prev) => ({
															...prev,
															[stage.id]: e.target.value,
														}))
													}
													placeholder="Add a comment..."
													className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
													rows={2}
												/>
											</div>

											{/* Action Buttons */}
											{canApprove && (
												<div className="flex items-center gap-2">
													<Button
														variant="primary"
														size="sm"
														onClick={handleApprove}
														disabled={actionLoading === "approve"}
													>
														{actionLoading === "approve" ? (
															<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
														) : (
															<ThumbsUp className="w-4 h-4 mr-1" />
														)}
														Approve
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={handleRequestChanges}
														disabled={
															actionLoading === "requestChanges" ||
															!commentText[stage.id]?.trim()
														}
													>
														<AlertTriangle className="w-4 h-4 mr-1" />
														Request Changes
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setShowRejectDialog(true)}
													>
														<ThumbsDown className="w-4 h-4 mr-1 text-red-500" />
														Reject
													</Button>
												</div>
											)}
											{!canApprove && onAddComment && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleAddComment(stage.id)}
													disabled={
														actionLoading === `comment-${stage.id}` ||
														!commentText[stage.id]?.trim()
													}
												>
													<MessageSquare className="w-4 h-4 mr-1" />
													Add Comment
												</Button>
											)}
										</div>
									)}

									{/* Rejection Info */}
									{stage.rejectedBy && (
										<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
											<p className="text-sm font-medium text-red-700 mb-1">
												Rejected
											</p>
											<p className="text-sm text-red-600">{stage.rejectedBy.reason}</p>
											<p className="text-xs text-red-500 mt-1">
												{new Date(stage.rejectedBy.rejectedAt).toLocaleDateString()}
											</p>
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Reject Dialog */}
			{showRejectDialog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/50" onClick={() => setShowRejectDialog(false)}
		role="button"
		tabIndex={0}
		onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}/>
					<div className="relative bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
						<h3 className="font-semibold mb-2">Reject Content</h3>
						<p className="text-sm text-gray-500 mb-4">
							Please provide a reason for rejecting this content.
						</p>
						<textarea
							value={rejectReason}
							onChange={(e) => setRejectReason(e.target.value)}
							placeholder="Enter rejection reason..."
							className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
							rows={3}
						/>
						<div className="flex justify-end gap-2 mt-4">
							<Button variant="ghost" onClick={() => setShowRejectDialog(false)}>
								Cancel
							</Button>
							<Button
								variant="danger"
								onClick={handleReject}
								disabled={!rejectReason.trim() || actionLoading === "reject"}
							>
								{actionLoading === "reject" ? (
									<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
								) : (
									<XCircle className="w-4 h-4 mr-1" />
								)}
								Reject
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

function StageStatusIcon({ status }: { status: ApprovalStage["status"] }) {
	switch (status) {
		case "approved":
			return <CheckCircle className="w-5 h-5 text-green-500" />;
		case "rejected":
			return <XCircle className="w-5 h-5 text-red-500" />;
		case "in_progress":
			return <Clock className="w-5 h-5 text-blue-500" />;
		case "skipped":
			return <ArrowRight className="w-5 h-5 text-gray-400" />;
		default:
			return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
	}
}

// ============================================================================
// Compact Approval Status Badge
// ============================================================================

interface ApprovalStatusBadgeProps {
	status: ApprovalStatus;
	compact?: boolean;
	className?: string;
}

export function ApprovalStatusBadge({
	status,
	compact = false,
	className,
}: ApprovalStatusBadgeProps) {
	const config = STATUS_CONFIG[status];
	const Icon = config.icon;

	if (compact) {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
					config.bg,
					config.color,
					className
				)}
				title={config.label}
			>
				<Icon className="w-3 h-3" />
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
				config.bg,
				config.color,
				className
			)}
		>
			<Icon className="w-3 h-3" />
			{config.label}
		</span>
	);
}
