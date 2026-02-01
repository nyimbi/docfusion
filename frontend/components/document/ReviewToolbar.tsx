"use client";

/**
 * Review Toolbar Component - DocFusion
 *
 * Toolbar with buttons for approving, rejecting, or requesting changes.
 * Provides UI for submitting review decisions with optional feedback.
 */

import React, { useState, useCallback } from "react";
import type {
	ApprovalStatus,
	SubmitReviewInput,
	WorkflowAction,
} from "@/lib/types/comments-workflow";
import { submitReview } from "@/lib/actions/approvals";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	CheckCircle2,
	XCircle,
	Edit3,
	MessageSquare,
	Send,
	AlertTriangle,
	X,
	RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ReviewToolbarProps {
	documentId: string;
	/** Current user ID */
	currentUserId: string;
	/** Current approval ID the user is assigned to */
	approvalId?: string;
	/** Current status */
	currentStatus?: ApprovalStatus;
	/** Whether user is allowed to take action */
	isDisabled?: boolean;
	/** Why actions are disabled */
	disabledReason?: string;
	/** Callback after successful submission */
	onReviewSubmitted?: () => void;
	/** Optional className */
	className?: string;
	/** Compact horizontal layout */
	compact?: boolean;
}

type ReviewAction = "approve" | "reject" | "request_changes" | "approve_with_conditions";

interface ActionConfig {
	icon: React.ReactNode;
	label: string;
	variant: "primary" | "danger" | "outline";
	description: string;
	requiresNotes: boolean;
	notesPlaceholder: string;
}

// ============================================================================
// Constants
// ============================================================================

const ACTION_CONFIG: Record<ReviewAction, ActionConfig> = {
	approve: {
		icon: <CheckCircle2 className="h-4 w-4" />,
		label: "Approve",
		variant: "primary",
		description: "Document is approved and ready to proceed to the next stage.",
		requiresNotes: false,
		notesPlaceholder: "Optional feedback (e.g., 'Looks good, minor typos in section 3')",
	},
	reject: {
		icon: <XCircle className="h-4 w-4" />,
		label: "Reject",
		variant: "danger",
		description: "Document cannot proceed. Requires significant rework or resubmission.",
		requiresNotes: true,
		notesPlaceholder: "Explain why the document is being rejected...",
	},
	request_changes: {
		icon: <Edit3 className="h-4 w-4" />,
		label: "Request Changes",
		variant: "outline",
		description: "Approve once specific changes are made.",
		requiresNotes: true,
		notesPlaceholder: "Describe the changes needed...",
	},
	approve_with_conditions: {
		icon: <CheckCircle2 className="h-4 w-4" />,
		label: "Approve with Conditions",
		variant: "outline",
		description: "Approve now with minor changes to be completed.",
		requiresNotes: true,
		notesPlaceholder: "List the conditions for approval...",
	},
};

// ============================================================================
// Helper Components
// ============================================================================

function QuickResponseButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
		>
			{label}
		</button>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ReviewToolbar({
	documentId,
	currentUserId,
	approvalId,
	currentStatus,
	isDisabled = false,
	disabledReason,
	onReviewSubmitted,
	className,
	compact = false,
}: ReviewToolbarProps) {
	const [selectedAction, setSelectedAction] = useState<ReviewAction | null>(null);
	const [notes, setNotes] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	// Check if actions are available
	const canTakeAction =
		!isDisabled &&
		approvalId &&
		(currentStatus === "pending" || currentStatus === "in_review");

	// Handle action selection
	const handleSelectAction = (action: ReviewAction) => {
		setSelectedAction(action);
		setNotes("");
		setRejectionReason("");
		setShowConfirm(true);
	};

	// Handle submission
	const handleSubmit = async () => {
		if (!selectedAction || !approvalId) return;

		const config = ACTION_CONFIG[selectedAction];

		// Validate required notes
		if (config.requiresNotes && !notes.trim()) {
			return; // Could show validation error
		}

		setIsSubmitting(true);
		try {
			const status: Extract<
				ApprovalStatus,
				"approved" | "rejected" | "changes_requested"
			> =
				selectedAction === "approve" || selectedAction === "approve_with_conditions"
					? "approved"
						: selectedAction === "reject"
							? "rejected"
							: "changes_requested";

			const input: SubmitReviewInput = {
				approvalId,
				status,
				notes: notes.trim() || undefined,
				rejectionReason:
					selectedAction === "reject" ? rejectionReason.trim() || undefined : undefined,
			};

			await submitReview(input, currentUserId);

			setShowConfirm(false);
			setSelectedAction(null);
			onReviewSubmitted?.();
		} finally {
			setIsSubmitting(false);
		}
	};

	// Handle dialog close
	const handleClose = () => {
		setShowConfirm(false);
		setSelectedAction(null);
		setNotes("");
		setRejectionReason("");
	};

	// Quick response templates
	const quickResponses: Record<ReviewAction, string[]> = {
		request_changes: [
			"Please review section 3 - the timeline needs adjustment",
			"Add more details about the technical approach",
			"Check formatting and ensure it matches our style guide",
			"Update budget estimates with current rates",
		],
		reject: [
			"Does not meet the requirements",
			"Insufficient detail provided",
			"Incorrect approach for this opportunity",
			"Missing required certifications",
		],
		approve: [
			"Excellent work",
			"Ready to submit",
			"Minor typos but otherwise perfect",
			"Good to go",
		],
		approve_with_conditions: [
			"Approved pending minor revisions",
			"Good overall, please address formatting",
			"Approved once legal review is complete",
			"Conditional approval - await budget sign-off",
		],
	};

	if (!canTakeAction) {
		return (
			<div className={cn("p-4 bg-gray-50 rounded-lg", className)}>
				<div className="flex items-center gap-3">
					{currentStatus === "approved" ? (
						<>
							<CheckCircle2 className="h-5 w-5 text-green-500" />
							<span className="text-green-700 font-medium">Approved</span>
						</>
					) : currentStatus === "rejected" ? (
						<>
							<XCircle className="h-5 w-5 text-red-500" />
							<span className="text-red-700 font-medium">Rejected</span>
						</>
					) : isDisabled ? (
						<>
							<AlertTriangle className="h-5 w-5 text-orange-500" />
							<span className="text-orange-700">{disabledReason || "Not assigned to you"}</span>
						</>
					) : (
						<>
							<RefreshCw className="h-5 w-5 text-gray-500" />
							<span className="text-gray-600">Awaiting review</span>
						</>
					)}
				</div>
			</div>
		);
	}

	return (
		<>
			<div className={cn("flex flex-wrap items-center gap-2", className)}>
				{/* Primary actions */}
				<Button
					onClick={() => handleSelectAction("approve")}
					className="bg-green-600 hover:bg-green-700"
					size="sm"
				>
					<CheckCircle2 className="h-4 w-4 mr-1.5" />
					Approve
				</Button>

				<Button
					variant="outline"
					onClick={() => handleSelectAction("request_changes")}
					size="sm"
					className="border-orange-200 text-orange-700 hover:bg-orange-50"
				>
					<Edit3 className="h-4 w-4 mr-1.5" />
					Request Changes
				</Button>

				<Button
					variant="danger"
					onClick={() => handleSelectAction("reject")}
					size="sm"
				>
					<XCircle className="h-4 w-4 mr-1.5" />
					Reject
				</Button>

				{/* Secondary action - approve with conditions */}
				{!compact && (
					<Button
						variant="ghost"
						onClick={() => handleSelectAction("approve_with_conditions")}
						size="sm"
						className="text-gray-600"
					>
						Approve with Conditions
					</Button>
				)}
			</div>

			{/* Confirmation Dialog */}
			<Dialog open={showConfirm} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-lg">
					{selectedAction && (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									{ACTION_CONFIG[selectedAction].icon}
									{ACTION_CONFIG[selectedAction].label}
								</DialogTitle>
								<DialogDescription>
									{ACTION_CONFIG[selectedAction].description}
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								{/* Feedback/Notes */}
								<div>
									<label className="text-sm font-medium text-gray-700 mb-2 block">
										{ACTION_CONFIG[selectedAction].requiresNotes
											? "Feedback (required)"
											: "Feedback (optional)"}
									</label>
									<Textarea
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										placeholder={ACTION_CONFIG[selectedAction].notesPlaceholder}
										className="min-h-[100px]"
										required={ACTION_CONFIG[selectedAction].requiresNotes}
									/>
								</div>

								{/* Quick responses */}
								<div>
									<label className="text-xs font-medium text-gray-500 mb-2 block">
										Quick responses
									</label>
									<div className="flex flex-wrap gap-2">
										{quickResponses[selectedAction]?.map((response, index) => (
											<QuickResponseButton
												key={index}
												label={response}
												onClick={() => setNotes(response)}
											/>
										))}
									</div>
								</div>

								{/* Rejection reason (only for reject) */}
								{selectedAction === "reject" && (
									<div>
										<label className="text-sm font-medium text-gray-700 mb-2 block">
											Rejection Category
										</label>
										<select
											value={rejectionReason}
											onChange={(e) => setRejectionReason(e.target.value)}
											className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
										>
											<option value="">Select a reason...</option>
											<option value="Does not meet requirements">
												Does not meet requirements
											</option>
											<option value="Insufficient detail">Insufficient detail</option>
											<option value="Incorrect approach">Incorrect approach</option>
											<option value="Missing qualifications">Missing qualifications</option>
											<option value="Budget issues">Budget issues</option>
											<option value="Timeline issues">Timeline issues</option>
											<option value="Other">Other</option>
										</select>
									</div>
								)}
							</div>

							<DialogFooter>
								<Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
									Cancel
								</Button>
								<Button
									onClick={handleSubmit}
									disabled={
										isSubmitting ||
										(ACTION_CONFIG[selectedAction].requiresNotes && !notes.trim())
									}
									variant={
										selectedAction === "reject"
											? "danger"
											: ACTION_CONFIG[selectedAction].variant
									}
								>
									{isSubmitting ? (
										<>
											<div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
											Submitting...
										</>
									) : (
										<>
											<Send className="h-4 w-4 mr-1.5" />
											{ACTION_CONFIG[selectedAction].label}
										</>
									)}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

export default ReviewToolbar;
