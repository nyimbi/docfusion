/**
 * GateReviewPanel Component - DocFusion Capture Pipeline
 *
 * Gate review management with checklist tracking, decision buttons,
 * and reviewer management. Supports scheduling, conducting, and
 * tracking gate reviews through the capture lifecycle.
 *
 * Accessibility: Form labels, keyboard navigation for checklists.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition } from "react";
import { cn, formatDate } from "@/lib/utils";
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
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Shield,
	Calendar,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Clock,
	Plus,
	ChevronDown,
	ChevronRight,
	Users,
	FileText,
	ThumbsUp,
	ThumbsDown,
	Loader2,
	PlayCircle,
	PauseCircle,
} from "lucide-react";
import {
	scheduleGateReview,
	updateGateReview,
	conductGateReview,
	getGateReviewChecklist,
} from "@/lib/actions/pipeline";
import type { GateReview, GateType, GateStatus, GateDecision, ChecklistItem } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface GateReviewPanelProps {
	/** List of gate reviews */
	gateReviews: GateReview[];
	/** Pipeline ID for creating new reviews */
	pipelineId: string;
	/** Callback when a gate is updated */
	onGateUpdated?: (gate: GateReview) => void;
	/** Callback when a new gate is created */
	onGateCreated?: (gate: GateReview) => void;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Gate Type Configuration
// ============================================================================

const GATE_TYPES: { value: GateType; label: string; description: string }[] = [
	{ value: "pursuit", label: "Pursuit Gate", description: "Initial decision to pursue the opportunity" },
	{ value: "bid_no_bid", label: "Bid/No-Bid", description: "Final decision to bid or not bid" },
	{ value: "capture_ready", label: "Capture Ready", description: "Readiness to move to proposal phase" },
	{ value: "proposal_ready", label: "Proposal Ready", description: "Ready to begin proposal development" },
	{ value: "pink_team", label: "Pink Team", description: "Initial proposal compliance review" },
	{ value: "red_team", label: "Red Team", description: "Full proposal evaluation as customer" },
	{ value: "gold_team", label: "Gold Team", description: "Final executive review before submission" },
	{ value: "final_review", label: "Final Review", description: "Last review before submission" },
];

const STATUS_CONFIG: Record<GateStatus, { label: string; icon: React.ReactNode; color: string }> = {
	scheduled: {
		label: "Scheduled",
		icon: <Calendar className="h-4 w-4" />,
		color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
	},
	in_progress: {
		label: "In Progress",
		icon: <PlayCircle className="h-4 w-4" />,
		color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
	},
	completed: {
		label: "Completed",
		icon: <CheckCircle className="h-4 w-4" />,
		color: "text-green-600 bg-green-100 dark:bg-green-900/30",
	},
	cancelled: {
		label: "Cancelled",
		icon: <XCircle className="h-4 w-4" />,
		color: "text-red-600 bg-red-100 dark:bg-red-900/30",
	},
};

const DECISION_CONFIG = {
	pass: { label: "Pass", icon: <ThumbsUp className="h-4 w-4" />, color: "bg-green-500 hover:bg-green-600" },
	conditional_pass: { label: "Conditional", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-yellow-500 hover:bg-yellow-600" },
	fail: { label: "Fail", icon: <ThumbsDown className="h-4 w-4" />, color: "bg-red-500 hover:bg-red-600" },
	defer: { label: "Defer", icon: <PauseCircle className="h-4 w-4" />, color: "bg-gray-500 hover:bg-gray-600" },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getChecklistProgress(checklist: Array<{ completed: boolean }> | null): number {
	if (!checklist || checklist.length === 0) return 0;
	const completed = checklist.filter((item) => item.completed).length;
	return Math.round((completed / checklist.length) * 100);
}

function getGateQuorum(reviewerCount: number): number {
	if (reviewerCount === 0) return 0;
	return Math.min(2, reviewerCount);
}

// ============================================================================
// Gate Review Card Component
// ============================================================================

interface GateReviewCardProps {
	gate: GateReview;
	onUpdate: (gate: GateReview) => void;
	isExpanded: boolean;
	onToggle: () => void;
}

function GateReviewCard({ gate, onUpdate, isExpanded, onToggle }: GateReviewCardProps) {
	const [isPending, startTransition] = useTransition();
	const [conductDialogOpen, setConductDialogOpen] = useState(false);
	const [decision, setDecision] = useState<GateDecision["decision"] | "">("");
	const [rationale, setRationale] = useState("");
	const [conditions, setConditions] = useState<string[]>([]);
	const [newCondition, setNewCondition] = useState("");
	const [reviewerVotes, setReviewerVotes] = useState<Record<string, "approve" | "conditional" | "reject">>({});
	const [reviewerComments, setReviewerComments] = useState<Record<string, string>>({});

	const statusConfig = STATUS_CONFIG[gate.status as GateStatus] || STATUS_CONFIG.scheduled;
	const checklistProgress = getChecklistProgress(gate.checklistItems);
	const requiredChecklistComplete = (gate.checklistItems || [])
		.filter((item) => item.required)
		.every((item) => item.completed);
	const quorum = getGateQuorum(gate.reviewers?.length ?? 0);
	const voteCount = Object.keys(reviewerVotes).length;
	const needsChecklistForDecision = decision === "pass" || decision === "conditional_pass";
	const canRecordDecision = Boolean(decision) &&
		Boolean(rationale.trim()) &&
		(!needsChecklistForDecision || requiredChecklistComplete) &&
		(decision !== "conditional_pass" || conditions.length > 0) &&
		(quorum === 0 || voteCount >= quorum) &&
		!(decision === "pass" && Object.values(reviewerVotes).includes("reject"));

	// Handle checklist item toggle
	const handleChecklistToggle = useCallback(
		async (itemIndex: number) => {
			const updatedChecklist = [...(gate.checklistItems || [])];
			updatedChecklist[itemIndex] = {
				...updatedChecklist[itemIndex],
				completed: !updatedChecklist[itemIndex].completed,
			};

			startTransition(async () => {
				const result = await updateGateReview(gate.id, {
					checklistItems: updatedChecklist,
				});
				if (result.success) {
					onUpdate(result.data);
				}
			});
		},
		[gate, onUpdate]
	);

	// Handle conduct review
	const handleConductReview = useCallback(async () => {
		if (!decision) return;

		startTransition(async () => {
			const decisionData: GateDecision = {
				decision: decision as GateDecision["decision"],
				rationale,
				conditions: decision === "conditional_pass"
					? conditions.map((c) => ({ condition: c }))
					: undefined,
				reviewerVotes: gate.reviewers?.map((reviewer) => ({
					name: reviewer.name,
					vote: reviewerVotes[reviewer.name],
					comments: reviewerComments[reviewer.name],
				})).filter((vote) => vote.vote),
			};

			const result = await conductGateReview(gate.id, decisionData);
			if (result.success) {
				onUpdate(result.data);
				setConductDialogOpen(false);
				setDecision("");
				setRationale("");
				setConditions([]);
				setReviewerVotes({});
				setReviewerComments({});
			}
		});
	}, [gate.id, gate.reviewers, decision, rationale, conditions, reviewerVotes, reviewerComments, onUpdate]);

	// Add condition
	const handleAddCondition = useCallback(() => {
		if (newCondition.trim()) {
			setConditions([...conditions, newCondition.trim()]);
			setNewCondition("");
		}
	}, [newCondition, conditions]);

	return (
		<Card className={cn(gate.status === "completed" && "opacity-80")}>
			<Collapsible open={isExpanded} onOpenChange={onToggle}>
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{isExpanded ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
								<div>
									<CardTitle className="text-base flex items-center gap-2">
										<Shield className="h-4 w-4" />
										{gate.gateName}
									</CardTitle>
									<CardDescription className="flex items-center gap-3 mt-1">
										<span className="capitalize">{gate.gateType.replace(/_/g, " ")}</span>
										{gate.scheduledDate && (
											<span className="flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												{formatDate(gate.scheduledDate)}
											</span>
										)}
									</CardDescription>
								</div>
							</div>
							<div className="flex items-center gap-3">
								{gate.checklistItems && gate.checklistItems.length > 0 && gate.status !== "completed" && (
									<div className="flex items-center gap-2 text-sm">
										<Progress value={checklistProgress} className="w-16 h-2" />
										<span className="text-muted-foreground">{checklistProgress}%</span>
									</div>
								)}
								<Badge className={cn("flex items-center gap-1", statusConfig.color)}>
									{statusConfig.icon}
									{statusConfig.label}
								</Badge>
								{gate.decision && (
									<Badge
										className={cn(
											"text-white",
											DECISION_CONFIG[gate.decision as keyof typeof DECISION_CONFIG]?.color
										)}
									>
										{DECISION_CONFIG[gate.decision as keyof typeof DECISION_CONFIG]?.label}
									</Badge>
								)}
							</div>
						</div>
					</CardHeader>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<CardContent className="pt-0 space-y-4">
						{/* Checklist */}
						{gate.checklistItems && gate.checklistItems.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium flex items-center gap-2">
									<FileText className="h-4 w-4" />
									Checklist ({gate.checklistItems.filter((i) => i.completed).length}/
									{gate.checklistItems.length})
								</h4>
								<div className="space-y-2 pl-6">
									{gate.checklistItems.map((item, idx) => (
										<div key={idx} className="flex items-start gap-2">
											<Checkbox
												id={`${gate.id}-item-${idx}`}
												checked={item.completed}
												onCheckedChange={() => handleChecklistToggle(idx)}
												disabled={gate.status === "completed" || isPending}
											/>
											<label
												htmlFor={`${gate.id}-item-${idx}`}
												className={cn(
													"text-sm cursor-pointer",
													item.completed && "line-through text-muted-foreground"
												)}
											>
												{item.item}
												{item.required && (
													<span className="text-red-500 ml-1">*</span>
												)}
											</label>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Reviewers */}
						{gate.reviewers && gate.reviewers.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium flex items-center gap-2">
									<Users className="h-4 w-4" />
									Reviewers
								</h4>
								<div className="flex flex-wrap gap-2">
									{gate.reviewers.map((reviewer, idx) => (
										<Badge key={idx} variant="secondary">
											{reviewer.name}
											{reviewer.vote && (
												<span className="ml-1">
													({reviewer.vote})
												</span>
											)}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Rationale (if completed) */}
						{gate.rationale && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium">Decision Rationale</h4>
								<p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
									{gate.rationale}
								</p>
							</div>
						)}

						{/* Conditions (if conditional pass) */}
						{gate.conditions && gate.conditions.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium text-yellow-600">Conditions to Address</h4>
								<ul className="space-y-1 pl-4">
									{gate.conditions.map((condition, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
											<span>{condition.condition}</span>
											{condition.status === "met" && (
												<Badge variant="secondary" className="text-xs">Met</Badge>
											)}
										</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>

					{/* Actions */}
					{gate.status !== "completed" && gate.status !== "cancelled" && (
						<CardFooter className="flex justify-end gap-2 pt-0">
							<Dialog open={conductDialogOpen} onOpenChange={setConductDialogOpen}>
								<DialogTrigger asChild>
									<Button variant="primary" size="sm">
										<PlayCircle className="h-4 w-4 mr-2" />
										Conduct Review
									</Button>
								</DialogTrigger>
								<DialogContent className="sm:max-w-md">
									<DialogHeader>
										<DialogTitle>Conduct Gate Review</DialogTitle>
										<DialogDescription>
											Record the decision and rationale for {gate.gateName}
										</DialogDescription>
									</DialogHeader>
										<div className="space-y-4 py-4">
										{/* Decision */}
										<div className="space-y-2">
											<Label>Decision</Label>
											<div className="grid grid-cols-2 gap-2">
												{Object.entries(DECISION_CONFIG).map(([key, config]) => (
													<Button
														key={key}
														variant={decision === key ? "primary" : "outline"}
														className={cn(
															"justify-start",
															decision === key && config.color
														)}
														onClick={() => setDecision(key as GateDecision["decision"])}
													>
														{config.icon}
														<span className="ml-2">{config.label}</span>
													</Button>
												))}
											</div>
										</div>

										{needsChecklistForDecision && !requiredChecklistComplete && (
											<div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
												Complete all required checklist items before recording a pass.
											</div>
										)}

										{gate.reviewers && gate.reviewers.length > 0 && (
											<div className="space-y-3">
												<div className="flex items-center justify-between">
													<Label>Reviewer votes</Label>
													<span className="text-xs text-muted-foreground">
														{voteCount}/{quorum} quorum
													</span>
												</div>
												<div className="space-y-2">
													{gate.reviewers.map((reviewer) => (
														<div key={reviewer.name} className="rounded-md border p-3 space-y-2">
															<div className="flex items-center justify-between gap-2">
																<span className="text-sm font-medium">{reviewer.name}</span>
																<Select
																	value={reviewerVotes[reviewer.name] ?? ""}
																	onValueChange={(value) =>
																		setReviewerVotes((current) => ({
																			...current,
																			[reviewer.name]: value as "approve" | "conditional" | "reject",
																		}))
																	}
																>
																	<SelectTrigger className="w-[140px]">
																		<SelectValue placeholder="Vote" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="approve">Approve</SelectItem>
																		<SelectItem value="conditional">Conditional</SelectItem>
																		<SelectItem value="reject">Reject</SelectItem>
																	</SelectContent>
																</Select>
															</div>
															<Input
																value={reviewerComments[reviewer.name] ?? ""}
																onChange={(event) =>
																	setReviewerComments((current) => ({
																		...current,
																		[reviewer.name]: event.target.value,
																	}))
																}
																placeholder="Optional vote comment"
															/>
														</div>
													))}
												</div>
												{decision === "pass" && Object.values(reviewerVotes).includes("reject") && (
													<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
														A pass decision cannot include a reject vote.
													</div>
												)}
											</div>
										)}

										{/* Rationale */}
										<div className="space-y-2">
											<Label htmlFor="rationale">Rationale</Label>
											<Textarea
												id="rationale"
												value={rationale}
												onChange={(e) => setRationale(e.target.value)}
												placeholder="Explain the decision and key factors..."
												rows={3}
											/>
										</div>

										{/* Conditions (for conditional pass) */}
										{decision === "conditional_pass" && (
											<div className="space-y-2">
												<Label>Conditions</Label>
												<div className="flex gap-2">
													<Input
														value={newCondition}
														onChange={(e) => setNewCondition(e.target.value)}
														placeholder="Add a condition..."
														onKeyDown={(e) => e.key === "Enter" && handleAddCondition()}
													/>
													<Button
														variant="outline"
														size="icon"
														onClick={handleAddCondition}
													>
														<Plus className="h-4 w-4" />
													</Button>
												</div>
												{conditions.length > 0 && (
													<ul className="space-y-1 mt-2">
														{conditions.map((c, idx) => (
															<li key={idx} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
																{c}
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-6 w-6"
																	onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
																>
																	<XCircle className="h-3 w-3" />
																</Button>
															</li>
														))}
													</ul>
												)}
											</div>
										)}
										{decision === "conditional_pass" && conditions.length === 0 && (
											<div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
												Add at least one condition before recording a conditional pass.
											</div>
										)}
									</div>
									<DialogFooter>
										<Button variant="ghost" onClick={() => setConductDialogOpen(false)}>
											Cancel
										</Button>
										<Button
											variant="primary"
											onClick={handleConductReview}
											disabled={!canRecordDecision || isPending}
											isLoading={isPending}
										>
											Record Decision
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</CardFooter>
					)}
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function GateReviewPanel({
	gateReviews,
	pipelineId,
	onGateUpdated,
	onGateCreated,
	className,
}: GateReviewPanelProps) {
	const [isPending, startTransition] = useTransition();
	const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
	const [expandedGates, setExpandedGates] = useState<Set<string>>(new Set());
	const [newGate, setNewGate] = useState({
		gateType: "" as GateType | "",
		scheduledDate: "",
		reviewers: "",
	});

	// Toggle gate expansion
	const toggleGate = useCallback((gateId: string) => {
		setExpandedGates((prev) => {
			const next = new Set(prev);
			if (next.has(gateId)) {
				next.delete(gateId);
			} else {
				next.add(gateId);
			}
			return next;
		});
	}, []);

	// Schedule new gate
	const handleScheduleGate = useCallback(async () => {
		if (!newGate.gateType || !newGate.scheduledDate) return;

		startTransition(async () => {
			const reviewers = newGate.reviewers
				? newGate.reviewers.split(",").map((r) => r.trim()).filter(Boolean)
				: undefined;

			const result = await scheduleGateReview(
				pipelineId,
				newGate.gateType,
				new Date(newGate.scheduledDate),
				reviewers
			);

			if (result.success) {
				onGateCreated?.(result.data);
				setScheduleDialogOpen(false);
				setNewGate({ gateType: "", scheduledDate: "", reviewers: "" });
			}
		});
	}, [pipelineId, newGate, onGateCreated]);

	// Sort gates by gate number
	const sortedGates = [...gateReviews].sort((a, b) => (a.gateNumber || 0) - (b.gateNumber || 0));

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Gate Reviews
					</h3>
					<p className="text-sm text-muted-foreground">
						{gateReviews.filter((g) => g.status === "completed").length} of{" "}
						{gateReviews.length} completed
					</p>
				</div>
				<Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
					<DialogTrigger asChild>
						<Button variant="outline" size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Schedule Gate
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Schedule Gate Review</DialogTitle>
							<DialogDescription>
								Schedule a new gate review for this capture
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="gateType">Gate Type</Label>
								<Select
									value={newGate.gateType}
									onValueChange={(value) =>
										setNewGate({ ...newGate, gateType: value as GateType })
									}
								>
									<SelectTrigger id="gateType">
										<SelectValue placeholder="Select gate type" />
									</SelectTrigger>
									<SelectContent>
										{GATE_TYPES.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												<div>
													<div className="font-medium">{type.label}</div>
													<div className="text-xs text-muted-foreground">
														{type.description}
													</div>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="scheduledDate">Scheduled Date</Label>
								<Input
									id="scheduledDate"
									type="date"
									value={newGate.scheduledDate}
									onChange={(e) =>
										setNewGate({ ...newGate, scheduledDate: e.target.value })
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="reviewers">Reviewers (comma-separated)</Label>
								<Input
									id="reviewers"
									value={newGate.reviewers}
									onChange={(e) =>
										setNewGate({ ...newGate, reviewers: e.target.value })
									}
									placeholder="John Doe, Jane Smith..."
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="ghost" onClick={() => setScheduleDialogOpen(false)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={handleScheduleGate}
								disabled={!newGate.gateType || !newGate.scheduledDate || isPending}
								isLoading={isPending}
							>
								Schedule
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Gate List */}
			{sortedGates.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h4 className="font-semibold mb-2">No Gate Reviews</h4>
						<p className="text-sm text-muted-foreground mb-4">
							Schedule gate reviews to track progress through the capture lifecycle
						</p>
						<Button
							variant="outline"
							onClick={() => setScheduleDialogOpen(true)}
						>
							<Plus className="h-4 w-4 mr-2" />
							Schedule First Gate
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{sortedGates.map((gate) => (
						<GateReviewCard
							key={gate.id}
							gate={gate}
							onUpdate={(updated) => onGateUpdated?.(updated)}
							isExpanded={expandedGates.has(gate.id)}
							onToggle={() => toggleGate(gate.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export default GateReviewPanel;
