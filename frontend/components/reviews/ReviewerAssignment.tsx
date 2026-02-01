/**
 * ReviewerAssignment - Assign Reviewers with Conflict Checking
 *
 * Interface for assigning reviewers to a review session with role-based
 * assignments, section assignments, and automated conflict of interest checking.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
	User,
	UserPlus,
	AlertTriangle,
	CheckCircle,
	Search,
	X,
	Mail,
	ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export type ReviewerRole =
	| "lead"
	| "technical"
	| "cost"
	| "compliance"
	| "general"
	| "subject_matter_expert"
	| "capture_manager";

export interface TeamMember {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
	expertise?: string[];
}

export interface Section {
	id: string;
	name: string;
	volumeName?: string;
}

export interface ConflictCheckResult {
	hasConflict: boolean;
	conflictReasons: {
		type: string;
		description: string;
		severity: "high" | "medium" | "low";
	}[];
	recommendations: string[];
}

export interface AssignedReviewer {
	userId: string;
	userName: string;
	userEmail: string;
	role: ReviewerRole;
	assignedSections: string[];
	reviewerInstructions?: string;
	expectedCompletionDate?: string;
	conflictCheck?: ConflictCheckResult;
}

export interface ReviewerAssignmentProps {
	reviewId: string;
	reviewName: string;
	scheduledEndDate?: string;
	availableMembers: TeamMember[];
	sections?: Section[];
	assignedReviewers?: AssignedReviewer[];
	onAssign?: (reviewers: AssignedReviewer[]) => Promise<void>;
	onCheckConflicts?: (userId: string) => Promise<ConflictCheckResult>;
	onSendInvitations?: (reviewerIds: string[]) => Promise<void>;
	isLoading?: boolean;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ROLE_CONFIG: Record<ReviewerRole, { label: string; color: string }> = {
	lead: {
		label: "Review Lead",
		color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	},
	technical: {
		label: "Technical",
		color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	},
	cost: {
		label: "Cost",
		color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	},
	compliance: {
		label: "Compliance",
		color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	},
	general: {
		label: "General",
		color: "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300",
	},
	subject_matter_expert: {
		label: "SME",
		color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	},
	capture_manager: {
		label: "Capture Mgr",
		color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
	},
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewerAssignment({
	reviewName,
	scheduledEndDate,
	availableMembers,
	sections = [],
	assignedReviewers = [],
	onAssign,
	onCheckConflicts,
	onSendInvitations,
	isLoading = false,
	className,
}: ReviewerAssignmentProps) {
	const [reviewers, setReviewers] = useState<AssignedReviewer[]>(assignedReviewers);
	const [searchQuery, setSearchQuery] = useState("");
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
	const [selectedRole, setSelectedRole] = useState<ReviewerRole>("general");
	const [selectedSections, setSelectedSections] = useState<string[]>([]);
	const [instructions, setInstructions] = useState("");
	const [completionDate, setCompletionDate] = useState("");
	const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
	const [expandedReviewer, setExpandedReviewer] = useState<string | null>(null);

	const filteredMembers = useMemo(() => {
		const assignedIds = new Set(reviewers.map((r) => r.userId));
		return availableMembers.filter((member) => {
			if (assignedIds.has(member.id)) return false;
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				member.name.toLowerCase().includes(query) ||
				member.email.toLowerCase().includes(query)
			);
		});
	}, [availableMembers, reviewers, searchQuery]);

	const handleMemberSelect = useCallback(
		async (member: TeamMember) => {
			setSelectedMember(member);
			setConflictResult(null);
			if (onCheckConflicts) {
				try {
					const result = await onCheckConflicts(member.id);
					setConflictResult(result);
				} catch (error) {
					console.error("Failed to check conflicts:", error);
				}
			}
		},
		[onCheckConflicts]
	);

	const handleAddReviewer = useCallback(() => {
		if (!selectedMember) return;
		const newReviewer: AssignedReviewer = {
			userId: selectedMember.id,
			userName: selectedMember.name,
			userEmail: selectedMember.email,
			role: selectedRole,
			assignedSections: selectedSections,
			reviewerInstructions: instructions || undefined,
			expectedCompletionDate: completionDate || undefined,
			conflictCheck: conflictResult || undefined,
		};
		setReviewers((prev) => [...prev, newReviewer]);
		setSelectedMember(null);
		setSelectedRole("general");
		setSelectedSections([]);
		setInstructions("");
		setCompletionDate("");
		setConflictResult(null);
		setShowAddDialog(false);
	}, [selectedMember, selectedRole, selectedSections, instructions, completionDate, conflictResult]);

	const handleRemoveReviewer = useCallback((userId: string) => {
		setReviewers((prev) => prev.filter((r) => r.userId !== userId));
	}, []);

	const handleUpdateReviewer = useCallback(
		(userId: string, updates: Partial<AssignedReviewer>) => {
			setReviewers((prev) =>
				prev.map((r) => (r.userId === userId ? { ...r, ...updates } : r))
			);
		},
		[]
	);

	const toggleSection = useCallback((sectionId: string) => {
		setSelectedSections((prev) =>
			prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
		);
	}, []);

	const handleSave = useCallback(async () => {
		await onAssign?.(reviewers);
	}, [reviewers, onAssign]);

	const handleSendInvitations = useCallback(async () => {
		await onSendInvitations?.(reviewers.map((r) => r.userId));
	}, [reviewers, onSendInvitations]);

	const getInitials = (name: string) =>
		name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

	return (
		<div className={cn("space-y-6", className)}>
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">Assign Reviewers</h3>
					<p className="text-sm text-muted-foreground">{reviewName}</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => setShowAddDialog(true)}>
						<UserPlus className="h-4 w-4 mr-2" />
						Add Reviewer
					</Button>
					{reviewers.length > 0 && (
						<Button variant="outline" onClick={handleSendInvitations}>
							<Mail className="h-4 w-4 mr-2" />
							Send Invitations
						</Button>
					)}
				</div>
			</div>

			{reviewers.length > 0 ? (
				<div className="space-y-3">
					{reviewers.map((reviewer) => {
						const roleConfig = ROLE_CONFIG[reviewer.role];
						const hasConflict = reviewer.conflictCheck?.hasConflict;
						const isExpanded = expandedReviewer === reviewer.userId;

						return (
							<Card key={reviewer.userId} className={cn(hasConflict && "border-amber-500/50")}>
								<Collapsible open={isExpanded} onOpenChange={(open) => setExpandedReviewer(open ? reviewer.userId : null)}>
									<div className="p-4">
										<div className="flex items-center gap-4">
											<Avatar className="h-10 w-10">
												<AvatarImage src={availableMembers.find((m) => m.id === reviewer.userId)?.avatarUrl} />
												<AvatarFallback>{getInitials(reviewer.userName)}</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-medium truncate">{reviewer.userName}</span>
													<Badge className={roleConfig.color}>{roleConfig.label}</Badge>
													{hasConflict && (
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger>
																	<AlertTriangle className="h-4 w-4 text-amber-500" />
																</TooltipTrigger>
																<TooltipContent>Potential conflict</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													)}
												</div>
												<p className="text-sm text-muted-foreground truncate">{reviewer.userEmail}</p>
											</div>
											<div className="flex items-center gap-2">
												{reviewer.assignedSections.length > 0 && (
													<Badge variant="outline">{reviewer.assignedSections.length} sections</Badge>
												)}
												<CollapsibleTrigger asChild>
													<Button variant="ghost" size="icon">
														<ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
													</Button>
												</CollapsibleTrigger>
												<Button variant="ghost" size="icon" onClick={() => handleRemoveReviewer(reviewer.userId)}>
													<X className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</div>
									<CollapsibleContent>
										<div className="px-4 pb-4 pt-2 border-t space-y-4">
											{hasConflict && reviewer.conflictCheck && (
												<Alert variant="destructive">
													<AlertTriangle className="h-4 w-4" />
													<AlertDescription>
														<ul className="list-disc list-inside">
															{reviewer.conflictCheck.conflictReasons.map((r, i) => (
																<li key={i} className="text-sm">{r.description}</li>
															))}
														</ul>
													</AlertDescription>
												</Alert>
											)}
											<div className="grid grid-cols-2 gap-4">
												<div className="space-y-2">
													<Label>Role</Label>
													<Select
														value={reviewer.role}
														onValueChange={(v) => handleUpdateReviewer(reviewer.userId, { role: v as ReviewerRole })}
													>
														<SelectTrigger><SelectValue /></SelectTrigger>
														<SelectContent>
															{Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
																<SelectItem key={role} value={role}>{cfg.label}</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-2">
													<Label>Due Date</Label>
													<Input
														type="date"
														value={reviewer.expectedCompletionDate || ""}
														onChange={(e) => handleUpdateReviewer(reviewer.userId, { expectedCompletionDate: e.target.value })}
														max={scheduledEndDate}
													/>
												</div>
											</div>
											{sections.length > 0 && (
												<div className="space-y-2">
													<Label>Assigned Sections</Label>
													<div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted rounded-lg">
														{sections.map((section) => (
															<label key={section.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-background rounded">
																<Checkbox
																	checked={reviewer.assignedSections.includes(section.id)}
																	onCheckedChange={() => {
																		const current = reviewer.assignedSections;
																		const updated = current.includes(section.id)
																			? current.filter((id) => id !== section.id)
																			: [...current, section.id];
																		handleUpdateReviewer(reviewer.userId, { assignedSections: updated });
																	}}
																/>
																<span className="text-sm">{section.name}</span>
															</label>
														))}
													</div>
												</div>
											)}
											<div className="space-y-2">
												<Label>Instructions</Label>
												<Textarea
													value={reviewer.reviewerInstructions || ""}
													onChange={(e) => handleUpdateReviewer(reviewer.userId, { reviewerInstructions: e.target.value })}
													placeholder="Specific instructions..."
													rows={2}
												/>
											</div>
										</div>
									</CollapsibleContent>
								</Collapsible>
							</Card>
						);
					})}
				</div>
			) : (
				<Card>
					<CardContent className="p-8 text-center">
						<User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h4 className="font-medium mb-1">No Reviewers Assigned</h4>
						<p className="text-sm text-muted-foreground mb-4">Add reviewers to begin</p>
						<Button onClick={() => setShowAddDialog(true)}>
							<UserPlus className="h-4 w-4 mr-2" />
							Add First Reviewer
						</Button>
					</CardContent>
				</Card>
			)}

			{reviewers.length > 0 && (
				<div className="flex justify-end">
					<Button onClick={handleSave} disabled={isLoading}>
						{isLoading ? "Saving..." : "Save Assignments"}
					</Button>
				</div>
			)}

			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Add Reviewer</DialogTitle>
						<DialogDescription>Select a team member and assign their role</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search members..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
						{!selectedMember ? (
							<div className="max-h-60 overflow-y-auto space-y-2">
								{filteredMembers.map((member) => (
									<button
										key={member.id}
										onClick={() => handleMemberSelect(member)}
										className="w-full p-3 text-left rounded-lg border hover:bg-muted"
									>
										<div className="flex items-center gap-3">
											<Avatar className="h-10 w-10">
												<AvatarImage src={member.avatarUrl} />
												<AvatarFallback>{getInitials(member.name)}</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<p className="font-medium truncate">{member.name}</p>
												<p className="text-sm text-muted-foreground truncate">{member.email}</p>
											</div>
										</div>
									</button>
								))}
							</div>
						) : (
							<div className="space-y-4">
								<div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
									<Avatar className="h-10 w-10">
										<AvatarImage src={selectedMember.avatarUrl} />
										<AvatarFallback>{getInitials(selectedMember.name)}</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<p className="font-medium">{selectedMember.name}</p>
										<p className="text-sm text-muted-foreground">{selectedMember.email}</p>
									</div>
									<Button variant="ghost" size="sm" onClick={() => { setSelectedMember(null); setConflictResult(null); }}>
										Change
									</Button>
								</div>
								{conflictResult?.hasConflict && (
									<Alert variant="destructive">
										<AlertTriangle className="h-4 w-4" />
										<AlertDescription>
											<p className="font-medium mb-1">Conflict detected</p>
											<ul className="list-disc list-inside text-sm">
												{conflictResult.conflictReasons.map((r, i) => <li key={i}>{r.description}</li>)}
											</ul>
										</AlertDescription>
									</Alert>
								)}
								{conflictResult && !conflictResult.hasConflict && (
									<div className="flex items-center gap-2 text-green-600">
										<CheckCircle className="h-4 w-4" />
										No conflicts detected
									</div>
								)}
								<div className="space-y-2">
									<Label>Role</Label>
									<Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as ReviewerRole)}>
										<SelectTrigger><SelectValue /></SelectTrigger>
										<SelectContent>
											{Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
												<SelectItem key={role} value={role}>{cfg.label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								{sections.length > 0 && (
									<div className="space-y-2">
										<Label>Sections (Optional)</Label>
										<div className="max-h-32 overflow-y-auto space-y-1 p-2 border rounded-lg">
											{sections.map((section) => (
												<label key={section.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-muted rounded">
													<Checkbox checked={selectedSections.includes(section.id)} onCheckedChange={() => toggleSection(section.id)} />
													<span className="text-sm">{section.name}</span>
												</label>
											))}
										</div>
									</div>
								)}
								<div className="space-y-2">
									<Label>Due Date</Label>
									<Input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} max={scheduledEndDate} />
								</div>
								<div className="space-y-2">
									<Label>Instructions (Optional)</Label>
									<Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions..." rows={2} />
								</div>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
						<Button onClick={handleAddReviewer} disabled={!selectedMember}>Add Reviewer</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default ReviewerAssignment;
