/**
 * StageTransitionDialog Component - DocFusion Capture Pipeline
 *
 * Dialog for transitioning captures between pipeline stages.
 * Validates transitions, displays required gates, and captures
 * transition notes for audit trail.
 *
 * Accessibility: Focus management, keyboard navigation, proper dialog semantics.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	AlertTriangle,
	CheckCircle,
	ChevronRight,
	ArrowRight,
	Shield,
	Clock,
	XCircle,
	Flag,
	Info,
} from "lucide-react";
import type { CapturePipeline, PipelineStage, StageConfig, GateType } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface StageTransitionDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback to change open state */
	onOpenChange: (open: boolean) => void;
	/** Pipeline being transitioned */
	pipeline: CapturePipeline | null;
	/** Current stage */
	currentStage: PipelineStage | null;
	/** Target stage to transition to */
	targetStage: PipelineStage | null;
	/** Callback when transition is confirmed */
	onConfirm: (notes?: string) => void;
	/** Whether transition is in progress */
	isPending?: boolean;
}

// ============================================================================
// Stage Configuration
// ============================================================================

const STAGE_CONFIG: Record<PipelineStage, {
	label: string;
	color: string;
	bgColor: string;
	requiredGates: GateType[];
	description: string;
}> = {
	discovery: {
		label: "Discovery",
		color: "text-slate-600",
		bgColor: "bg-slate-100 dark:bg-slate-800",
		requiredGates: [],
		description: "Initial opportunity identification and research",
	},
	qualification: {
		label: "Qualification",
		color: "text-blue-600",
		bgColor: "bg-blue-100 dark:bg-blue-800",
		requiredGates: ["pursuit"],
		description: "Evaluating opportunity fit and go/no-go decision",
	},
	capture: {
		label: "Capture",
		color: "text-indigo-600",
		bgColor: "bg-indigo-100 dark:bg-indigo-800",
		requiredGates: ["bid_no_bid"],
		description: "Active capture activities and solution development",
	},
	proposal: {
		label: "Proposal",
		color: "text-purple-600",
		bgColor: "bg-purple-100 dark:bg-purple-800",
		requiredGates: ["proposal_ready", "pink_team", "red_team"],
		description: "Proposal development and review cycles",
	},
	submitted: {
		label: "Submitted",
		color: "text-cyan-600",
		bgColor: "bg-cyan-100 dark:bg-cyan-800",
		requiredGates: ["gold_team", "final_review"],
		description: "Proposal submitted to customer",
	},
	evaluation: {
		label: "Evaluation",
		color: "text-yellow-600",
		bgColor: "bg-yellow-100 dark:bg-yellow-800",
		requiredGates: [],
		description: "Customer evaluation in progress",
	},
	awarded: {
		label: "Awarded",
		color: "text-green-600",
		bgColor: "bg-green-100 dark:bg-green-800",
		requiredGates: [],
		description: "Contract awarded - won opportunity",
	},
	lost: {
		label: "Lost",
		color: "text-red-600",
		bgColor: "bg-red-100 dark:bg-red-800",
		requiredGates: [],
		description: "Opportunity lost to competitor",
	},
	no_bid: {
		label: "No Bid",
		color: "text-gray-600",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		requiredGates: [],
		description: "Decision not to bid on opportunity",
	},
	cancelled: {
		label: "Cancelled",
		color: "text-gray-600",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		requiredGates: [],
		description: "Opportunity cancelled by customer",
	},
};

// Valid transitions map
const VALID_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
	discovery: ["qualification", "no_bid", "cancelled"],
	qualification: ["capture", "no_bid", "cancelled"],
	capture: ["proposal", "no_bid", "cancelled"],
	proposal: ["submitted", "no_bid", "cancelled"],
	submitted: ["evaluation", "cancelled"],
	evaluation: ["awarded", "lost", "cancelled"],
	awarded: [],
	lost: [],
	no_bid: [],
	cancelled: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

function isValidTransition(from: PipelineStage, to: PipelineStage): boolean {
	return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function getTransitionType(from: PipelineStage, to: PipelineStage): "forward" | "exit" | "invalid" {
	if (!isValidTransition(from, to)) return "invalid";
	if (["awarded", "lost", "no_bid", "cancelled"].includes(to)) return "exit";
	return "forward";
}

function getGateLabel(gate: GateType): string {
	const labels: Record<GateType, string> = {
		pursuit: "Pursuit Gate",
		bid_no_bid: "Bid/No-Bid Decision",
		capture_ready: "Capture Ready Review",
		proposal_ready: "Proposal Ready Review",
		pink_team: "Pink Team Review",
		red_team: "Red Team Review",
		gold_team: "Gold Team Review",
		final_review: "Final Review",
	};
	return labels[gate] || gate.replace(/_/g, " ");
}

// ============================================================================
// Component
// ============================================================================

export function StageTransitionDialog({
	open,
	onOpenChange,
	pipeline,
	currentStage,
	targetStage,
	onConfirm,
	isPending = false,
}: StageTransitionDialogProps) {
	const [notes, setNotes] = useState("");

	// Reset notes when dialog opens
	React.useEffect(() => {
		if (open) {
			setNotes("");
		}
	}, [open]);

	// Get stage configs
	const fromConfig = currentStage ? STAGE_CONFIG[currentStage] : null;
	const toConfig = targetStage ? STAGE_CONFIG[targetStage] : null;

	// Determine transition type
	const transitionType = useMemo(() => {
		if (!currentStage || !targetStage) return "invalid";
		return getTransitionType(currentStage, targetStage);
	}, [currentStage, targetStage]);

	// Get required gates for target stage
	const requiredGates = useMemo(() => {
		if (!targetStage) return [];
		return STAGE_CONFIG[targetStage].requiredGates;
	}, [targetStage]);

	// Handle confirm
	const handleConfirm = useCallback(() => {
		onConfirm(notes.trim() || undefined);
	}, [notes, onConfirm]);

	// Don't render if no pipeline or stages
	if (!pipeline || !currentStage || !targetStage || !fromConfig || !toConfig) {
		return null;
	}

	const isExitTransition = transitionType === "exit";
	const isInvalidTransition = transitionType === "invalid";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{isExitTransition ? (
							<>
								<Flag className="h-5 w-5 text-amber-500" />
								{toConfig.label === "Awarded" ? "Record Win" :
								 toConfig.label === "Lost" ? "Record Loss" :
								 toConfig.label === "No Bid" ? "Record No Bid Decision" :
								 "Exit Pipeline"}
							</>
						) : (
							<>
								<ArrowRight className="h-5 w-5 text-primary" />
								Move to {toConfig.label}
							</>
						)}
					</DialogTitle>
					<DialogDescription>
						{isInvalidTransition
							? "This stage transition is not allowed"
							: `Transition from ${fromConfig.label} to ${toConfig.label}`}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Transition Visualization */}
					<div className="flex items-center justify-center gap-4">
						<div className="text-center">
							<Badge className={cn("px-3 py-1.5", fromConfig.bgColor, fromConfig.color)}>
								{fromConfig.label}
							</Badge>
						</div>
						<ChevronRight className="h-5 w-5 text-muted-foreground" />
						<div className="text-center">
							<Badge
								className={cn(
									"px-3 py-1.5",
									toConfig.bgColor,
									toConfig.color,
									isInvalidTransition && "opacity-50"
								)}
							>
								{toConfig.label}
							</Badge>
						</div>
					</div>

					{/* Invalid Transition Warning */}
					{isInvalidTransition && (
						<div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
							<XCircle className="h-5 w-5 text-red-500 mt-0.5" />
							<div>
								<p className="font-medium text-red-700 dark:text-red-300">
									Invalid Transition
								</p>
								<p className="text-sm text-red-600 dark:text-red-400 mt-1">
									You cannot move directly from {fromConfig.label} to {toConfig.label}.
									Please follow the standard pipeline flow.
								</p>
							</div>
						</div>
					)}

					{/* Exit Transition Info */}
					{isExitTransition && !isInvalidTransition && (
						<div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
							<AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
							<div>
								<p className="font-medium text-amber-700 dark:text-amber-300">
									{toConfig.label === "Awarded"
										? "This will mark the opportunity as WON"
										: toConfig.label === "Lost"
											? "This will mark the opportunity as LOST"
											: toConfig.label === "No Bid"
												? "This will record a No Bid decision"
												: "This will remove the opportunity from active pipeline"}
								</p>
								<p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
									This action typically cannot be undone. Please provide a reason.
								</p>
							</div>
						</div>
					)}

					{/* Target Stage Description */}
					{!isInvalidTransition && (
						<div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
							<Info className="h-5 w-5 text-muted-foreground mt-0.5" />
							<div>
								<p className="font-medium">{toConfig.label}</p>
								<p className="text-sm text-muted-foreground mt-1">
									{toConfig.description}
								</p>
							</div>
						</div>
					)}

					{/* Required Gates */}
					{requiredGates.length > 0 && !isInvalidTransition && (
						<div className="space-y-2">
							<Label className="flex items-center gap-2">
								<Shield className="h-4 w-4" />
								Required Gates for {toConfig.label}
							</Label>
							<div className="space-y-1.5">
								{requiredGates.map((gate) => (
									<div
										key={gate}
										className="flex items-center gap-2 text-sm p-2 bg-muted rounded"
									>
										<Clock className="h-4 w-4 text-muted-foreground" />
										<span>{getGateLabel(gate)}</span>
									</div>
								))}
							</div>
							<p className="text-xs text-muted-foreground">
								These gate reviews should be completed during this stage
							</p>
						</div>
					)}

					<Separator />

					{/* Notes */}
					{!isInvalidTransition && (
						<div className="space-y-2">
							<Label htmlFor="transition-notes">
								{isExitTransition ? "Reason/Notes (required)" : "Transition Notes (optional)"}
							</Label>
							<Textarea
								id="transition-notes"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder={
									isExitTransition
										? toConfig.label === "Awarded"
											? "Describe the win, contract details, etc..."
											: toConfig.label === "Lost"
												? "Reason for loss, competitor who won, lessons learned..."
												: toConfig.label === "No Bid"
													? "Reason for no-bid decision..."
													: "Reason for this change..."
										: "Add any notes about this stage transition..."
								}
								rows={3}
							/>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					{!isInvalidTransition && (
						<Button
							variant={isExitTransition && toConfig.label !== "Awarded" ? "danger" : "primary"}
							onClick={handleConfirm}
							disabled={isPending || (isExitTransition && !notes.trim())}
							isLoading={isPending}
						>
							{toConfig.label === "Awarded" ? (
								<>
									<CheckCircle className="h-4 w-4 mr-2" />
									Record Win
								</>
							) : toConfig.label === "Lost" ? (
								<>
									<XCircle className="h-4 w-4 mr-2" />
									Record Loss
								</>
							) : (
								<>
									<ArrowRight className="h-4 w-4 mr-2" />
									Move to {toConfig.label}
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default StageTransitionDialog;
