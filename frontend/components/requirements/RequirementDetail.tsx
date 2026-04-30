/**
 * RequirementDetail Component - DocFusion
 *
 * Slide-over panel displaying full requirement details with
 * source quote highlighting, response strategy editor, and AI analysis.
 */

"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useSession } from "next-auth/react";
import type {
	Requirement,
	RequirementUpdateInput,
	ComplianceStatus,
	RequirementPriority,
	RiskLevel,
} from "@/lib/types/opportunity";
import {
	updateRequirement,
	assignRequirement,
	transitionRequirementWorkflow,
} from "@/lib/actions/requirements";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface RequirementDetailProps {
	requirement: Requirement | null;
	open: boolean;
	onClose: () => void;
	onUpdate?: (updated: Requirement) => void;
}

export function RequirementDetail({
	requirement,
	open,
	onClose,
	onUpdate,
}: RequirementDetailProps) {
	const [editMode, setEditMode] = useState(false);
	const [formData, setFormData] = useState<RequirementUpdateInput>({});
	const [workflowReason, setWorkflowReason] = useState("");
	const [workflowError, setWorkflowError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const { data: session } = useSession();
	const currentUserId = session?.user?.id ?? session?.user?.email ?? null;
	const currentUserName = session?.user?.name ?? session?.user?.email ?? undefined;
	const workflowGateStatus = requirement
		? getWorkflowGateStatus(requirement, formData, currentUserId)
		: [];
	const panelRef = useRef<HTMLDivElement>(null);

	// Reset form when requirement changes
	useEffect(() => {
		if (requirement) {
			setFormData({
				text: requirement.text,
				category: requirement.category ?? undefined,
				priority: requirement.priority ?? undefined,
				complianceStatus: requirement.complianceStatus,
				responseStrategy: requirement.responseStrategy ?? undefined,
				notes: requirement.notes ?? undefined,
				riskLevel: requirement.riskLevel ?? undefined,
				assignedTo: requirement.assignedTo ?? undefined,
				dueDate: requirement.dueDate ? requirement.dueDate.toISOString().split("T")[0] : undefined,
				source: requirement.source ?? undefined,
				sourcePageRef: requirement.sourcePageRef ?? undefined,
			});
		}
		setEditMode(false);
		setWorkflowReason("");
		setWorkflowError(null);
	}, [requirement]);

	// Handle escape key
	useEffect(() => {
		if (!open) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onClose]);

	// Prevent body scroll when open
	useEffect(() => {
		if (open) {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}
	}, [open]);

	const handleSave = () => {
		if (!requirement) return;

		startTransition(async () => {
			try {
				const updated = await updateRequirement(requirement.id, formData);
				if (updated) {
					onUpdate?.(updated);
					setEditMode(false);
				}
			} catch (error) {
				console.error("Failed to update requirement:", error);
			}
		});
	};

	const handleWorkflowTransition = (
		action: "accept" | "reject" | "reopen"
	) => {
		if (!requirement) return;

		startTransition(async () => {
			try {
					setWorkflowError(null);
					const result = await transitionRequirementWorkflow({
						requirementId: requirement.id,
						action,
						actorId: currentUserId ?? "unknown-user",
						actorName: currentUserName,
						reason: workflowReason,
						assignedTo: formData.assignedTo ?? requirement.assignedTo ?? currentUserId ?? undefined,
						dueDate: formData.dueDate ?? requirement.dueDate ?? undefined,
					});

				if (result) {
					onUpdate?.(result.requirement);
					setWorkflowReason("");
				}
			} catch (error) {
				setWorkflowError(error instanceof Error ? error.message : "Workflow transition failed.");
			}
		});
	};

	const handleAssign = (userId: string) => {
		if (!requirement) return;

		startTransition(async () => {
			try {
				const updated = await assignRequirement(requirement.id, userId);
				if (updated) {
					onUpdate?.(updated);
					setFormData((f) => ({ ...f, assignedTo: userId }));
				}
			} catch (error) {
				console.error("Failed to assign requirement:", error);
			}
		});
	};

	if (!open) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Slide-over Panel */}
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="requirement-detail-title"
				className={cn(
					"fixed right-0 top-0 z-50 h-full w-full max-w-xl",
					"bg-[var(--background)] shadow-xl",
					"animate-in slide-in-from-right duration-300",
					"flex flex-col"
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
					<div>
						<h2
							id="requirement-detail-title"
							className="text-lg font-semibold text-[var(--foreground)]"
						>
							{requirement?.requirementId ?? "Requirement Details"}
						</h2>
						{requirement?.category && (
							<p className="text-sm text-[var(--foreground-muted)] capitalize">
								{requirement.category} Requirement
							</p>
						)}
					</div>
					<button
						onClick={onClose}
						className="p-2 rounded-lg hover:bg-[var(--background-muted)] transition-colors"
						aria-label="Close"
					>
						<CloseIcon className="h-5 w-5 text-[var(--foreground-muted)]" />
					</button>
				</div>

				{/* Content */}
				{requirement ? (
					<div className="flex-1 overflow-y-auto">
						<div className="p-6 space-y-6">
							{/* Status Bar */}
							<div className="flex items-center gap-3 flex-wrap">
								<StatusSelect
									value={formData.complianceStatus ?? requirement.complianceStatus}
									onChange={(status) => {
										setFormData((f) => ({ ...f, complianceStatus: status }));
										if (!editMode) {
											startTransition(async () => {
												const updated = await updateRequirement(requirement.id, { complianceStatus: status });
												if (updated) onUpdate?.(updated);
											});
										}
									}}
									disabled={isPending}
								/>
								{editMode ? (
									<>
										<CategorySelect
											value={formData.category ?? requirement.category}
											onChange={(category) => setFormData((f) => ({ ...f, category: category ?? undefined }))}
											disabled={isPending}
										/>
										<PrioritySelect
											value={formData.priority ?? requirement.priority}
											onChange={(priority) => setFormData((f) => ({ ...f, priority: priority ?? undefined }))}
											disabled={isPending}
										/>
									</>
								) : (
									<PriorityBadge priority={requirement.priority} />
								)}
								<RiskBadge level={requirement.riskLevel} />
							</div>

							{/* Requirement Text */}
							<Section title="Requirement">
								{editMode ? (
									<textarea
										value={formData.text ?? requirement.text}
										onChange={(e) => setFormData((f) => ({ ...f, text: e.target.value }))}
										rows={4}
										className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
									/>
								) : (
									<p className="text-[var(--foreground)] leading-relaxed">
										{requirement.text}
									</p>
								)}
							</Section>

							{/* Source Quote */}
							{(editMode || requirement.source) && (
								<Section title="Source Quote">
									{editMode ? (
										<div className="space-y-2">
											<textarea
												value={formData.source ?? requirement.source ?? ""}
												onChange={(e) => setFormData((f) => ({ ...f, source: e.target.value }))}
												rows={3}
												placeholder="Source quote or trace"
												className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
											/>
											<input
												type="text"
												value={formData.sourcePageRef ?? requirement.sourcePageRef ?? ""}
												onChange={(e) => setFormData((f) => ({ ...f, sourcePageRef: e.target.value }))}
												placeholder="Page or section reference"
												className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
											/>
										</div>
									) : (
										<div className="relative">
											<div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent-500)] rounded-full" />
											<blockquote className="pl-4 text-sm text-[var(--foreground-muted)] italic">
												"{requirement.source}"
											</blockquote>
											{requirement.sourcePageRef && (
												<p className="pl-4 mt-2 text-xs text-[var(--foreground-muted)]">
													Page: {requirement.sourcePageRef}
												</p>
											)}
										</div>
									)}
								</Section>
							)}

							{/* Response Strategy */}
							<Section title="Response Strategy">
								{editMode ? (
									<textarea
										value={formData.responseStrategy ?? ""}
										onChange={(e) => setFormData((f) => ({ ...f, responseStrategy: e.target.value }))}
										rows={4}
										placeholder="How will you address this requirement?"
										className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
									/>
								) : requirement.responseStrategy ? (
									<p className="text-[var(--foreground)] leading-relaxed">
										{requirement.responseStrategy}
									</p>
								) : (
									<p className="text-[var(--foreground-muted)] italic">
										No response strategy defined yet.
									</p>
								)}
							</Section>

							{/* Assignment */}
							<Section title="Assignment">
								<div className="flex items-center justify-between">
									<div>
										{requirement.assignedTo ? (
											<div className="flex items-center gap-2">
												<div className="h-8 w-8 rounded-full bg-[var(--accent-500)] flex items-center justify-center text-white text-sm font-medium">
													{requirement.assignedTo.charAt(0).toUpperCase()}
												</div>
												<div>
													<p className="text-sm font-medium text-[var(--foreground)]">
														{requirement.assignedTo}
													</p>
													{requirement.dueDate && (
														<p className="text-xs text-[var(--foreground-muted)]">
															Due: {formatDate(requirement.dueDate)}
														</p>
													)}
												</div>
											</div>
										) : (
											<p className="text-[var(--foreground-muted)] italic">
												Not assigned
											</p>
										)}
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => currentUserId && handleAssign(currentUserId)}
										disabled={isPending || !currentUserId}
									>
										{currentUserId && requirement.assignedTo === currentUserId ? "Reassign" : "Assign to Me"}
									</Button>
								</div>

								{/* Due Date in Edit Mode */}
								{editMode && (
									<div className="mt-3">
										<span className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
											Due Date
										</span>
										<input
											type="date"
											value={formData.dueDate?.toString().split("T")[0] ?? ""}
											onChange={(e) => setFormData((f) => ({ ...f, dueDate: e.target.value || null }))}
											className="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
											aria-label="Due Date"
										/>
									</div>
								)}
							</Section>

							{/* Workflow */}
							<Section title="Workflow">
								<div className="space-y-3">
									<div className="flex items-center gap-2 flex-wrap">
										<WorkflowBadge state={requirement.workflowState ?? "review"} />
										{requirement.projectedTaskId && (
											<span className="text-xs text-[var(--foreground-muted)]">
												Task {requirement.projectedTaskId.slice(0, 8)}
											</span>
										)}
									</div>
									{requirement.workflowReason && (
										<p className="text-sm text-[var(--foreground-muted)]">
											{requirement.workflowReason}
										</p>
									)}
									<div className="grid grid-cols-2 gap-2 text-xs">
										{workflowGateStatus.map((gate) => (
											<div
												key={gate.label}
												className={cn(
													"rounded border px-2 py-1",
													gate.ready
														? "border-green-200 text-green-700 dark:border-green-800 dark:text-green-300"
														: "border-red-200 text-red-700 dark:border-red-900 dark:text-red-300"
												)}
											>
												{gate.ready ? "Ready" : "Missing"}: {gate.label}
											</div>
										))}
									</div>
									<textarea
										value={workflowReason}
										onChange={(e) => setWorkflowReason(e.target.value)}
										rows={2}
										placeholder="Decision reason"
										className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
									/>
									{workflowError && (
										<p className="text-sm text-[var(--error-500)]">{workflowError}</p>
									)}
									<div className="flex items-center gap-2 flex-wrap">
										{(requirement.workflowState ?? "review") === "review" ? (
											<>
												<Button
													variant="primary"
													size="sm"
													onClick={() => handleWorkflowTransition("accept")}
													disabled={isPending || !workflowReason.trim() || !currentUserId}
												>
													Accept
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleWorkflowTransition("reject")}
													disabled={isPending || !workflowReason.trim() || !currentUserId}
												>
													Reject
												</Button>
											</>
										) : (
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleWorkflowTransition("reopen")}
												disabled={isPending || !workflowReason.trim() || !currentUserId}
											>
												Reopen
											</Button>
										)}
									</div>
									{requirement.workflowHistory && requirement.workflowHistory.length > 0 && (
										<div className="space-y-2">
											<p className="text-xs font-medium text-[var(--foreground-muted)]">
												History
											</p>
											{requirement.workflowHistory.slice(-3).reverse().map((entry) => (
												<div key={`${entry.action}-${entry.at.toISOString()}`} className="text-xs text-[var(--foreground-muted)]">
													<span className="font-medium text-[var(--foreground)]">
														{entry.action}
													</span>{" "}
													{entry.from} to {entry.to} by {entry.actorName ?? entry.actorId} on{" "}
													{formatDateTime(entry.at)}
												</div>
											))}
										</div>
									)}
								</div>
							</Section>

							{/* Notes */}
							<Section title="Notes">
								{editMode ? (
									<textarea
										value={formData.notes ?? ""}
										onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
										rows={3}
										placeholder="Internal notes about this requirement..."
										className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
									/>
								) : requirement.notes ? (
									<p className="text-[var(--foreground)] leading-relaxed">
										{requirement.notes}
									</p>
								) : (
									<p className="text-[var(--foreground-muted)] italic">
										No notes added yet.
									</p>
								)}
							</Section>

							{/* AI Analysis */}
							{requirement.aiAnalysis && (
								<Section title="AI Analysis">
									<div className="space-y-3 p-4 bg-[var(--background-muted)] rounded-lg">
										<div className="flex items-center justify-between">
											<span className="text-sm text-[var(--foreground-muted)]">
												Difficulty Score
											</span>
											<span className="text-sm font-medium text-[var(--foreground)]">
												{requirement.aiAnalysis.difficultyScore}/100
											</span>
										</div>

										{requirement.aiAnalysis.suggestedApproach && (
											<div>
												<p className="text-xs font-medium text-[var(--foreground-muted)] mb-1">
													Suggested Approach
												</p>
												<p className="text-sm text-[var(--foreground)]">
													{requirement.aiAnalysis.suggestedApproach}
												</p>
											</div>
										)}

										{requirement.aiAnalysis.relatedCapabilities?.length > 0 && (
											<div>
												<p className="text-xs font-medium text-[var(--foreground-muted)] mb-1">
													Related Capabilities
												</p>
												<div className="flex flex-wrap gap-1">
													{requirement.aiAnalysis.relatedCapabilities.map((cap) => (
														<span
															key={cap}
															className="px-2 py-0.5 text-xs bg-[var(--background)] text-[var(--foreground-muted)] rounded"
														>
															{cap}
														</span>
													))}
												</div>
											</div>
										)}

										{requirement.aiAnalysis.potentialRisks?.length > 0 && (
											<div>
												<p className="text-xs font-medium text-[var(--foreground-muted)] mb-1">
													Potential Risks
												</p>
												<ul className="text-sm text-[var(--foreground)] space-y-1">
													{requirement.aiAnalysis.potentialRisks.map((risk, i) => (
														<li key={i} className="flex items-start gap-2">
															<WarningIcon className="h-4 w-4 text-[var(--warning-500)] shrink-0 mt-0.5" />
															{risk}
														</li>
													))}
												</ul>
											</div>
										)}

										<p className="text-[10px] text-[var(--foreground-muted)]">
											Analyzed {formatDate(requirement.aiAnalysis.analyzedAt)}
										</p>
									</div>
								</Section>
							)}

							{/* Metadata */}
							<Section title="Metadata">
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<p className="text-[var(--foreground-muted)]">Created</p>
										<p className="text-[var(--foreground)]">
											{formatDateTime(requirement.createdAt)}
										</p>
									</div>
									<div>
										<p className="text-[var(--foreground-muted)]">Updated</p>
										<p className="text-[var(--foreground)]">
											{formatDateTime(requirement.updatedAt)}
										</p>
									</div>
									{requirement.subcategory && (
										<div>
											<p className="text-[var(--foreground-muted)]">Subcategory</p>
											<p className="text-[var(--foreground)]">{requirement.subcategory}</p>
										</div>
									)}
								</div>
							</Section>
						</div>
					</div>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-[var(--foreground-muted)]">
							Select a requirement to view details
						</p>
					</div>
				)}

				{/* Footer */}
				{requirement && (
					<div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
						{editMode ? (
							<>
								<Button
									variant="ghost"
									onClick={() => {
										setEditMode(false);
										setFormData({
											text: requirement.text,
											responseStrategy: requirement.responseStrategy ?? undefined,
											notes: requirement.notes ?? undefined,
										});
									}}
									disabled={isPending}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									onClick={handleSave}
									isLoading={isPending}
								>
									Save Changes
								</Button>
							</>
						) : (
							<>
								<Button variant="ghost" onClick={onClose}>
									Close
								</Button>
								<Button variant="outline" onClick={() => setEditMode(true)}>
									Edit
								</Button>
							</>
						)}
					</div>
				)}
			</div>
		</>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<h3 className="text-sm font-medium text-[var(--foreground)] mb-2">{title}</h3>
			{children}
		</div>
	);
}

function WorkflowBadge({ state }: { state: "review" | "accepted" | "rejected" }) {
	const styles = {
		review: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	return (
		<span className={cn("px-2 py-0.5 text-xs font-medium rounded capitalize", styles[state])}>
			{state}
		</span>
	);
}

function StatusSelect({
	value,
	onChange,
	disabled,
}: {
	value: ComplianceStatus;
	onChange: (status: ComplianceStatus) => void;
	disabled: boolean;
}) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value as ComplianceStatus)}
			disabled={disabled}
			className={cn(
				"px-3 py-1.5 text-sm font-medium rounded-full border-0 cursor-pointer",
				"focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
				disabled && "opacity-50 cursor-not-allowed",
				STATUS_STYLES[value]
			)}
		>
			<option value="not_addressed">Not Addressed</option>
			<option value="partial">Partial</option>
			<option value="compliant">Compliant</option>
			<option value="non_compliant">Non-Compliant</option>
			<option value="not_applicable">N/A</option>
		</select>
	);
}

function CategorySelect({
	value,
	onChange,
	disabled,
}: {
	value: Requirement["category"];
	onChange: (category: Requirement["category"]) => void;
	disabled: boolean;
}) {
	return (
		<select
			value={value ?? ""}
			onChange={(e) => onChange((e.target.value || null) as Requirement["category"])}
			disabled={disabled}
			className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
		>
			<option value="">Category</option>
			{CATEGORY_OPTIONS.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}

function PrioritySelect({
	value,
	onChange,
	disabled,
}: {
	value: RequirementPriority | null;
	onChange: (priority: RequirementPriority | null) => void;
	disabled: boolean;
}) {
	return (
		<select
			value={value ?? ""}
			onChange={(e) => onChange((e.target.value || null) as RequirementPriority | null)}
			disabled={disabled}
			className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
		>
			<option value="">Priority</option>
			{PRIORITY_OPTIONS.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}

function PriorityBadge({ priority }: { priority: RequirementPriority | null }) {
	if (!priority) return null;

	const styles: Record<RequirementPriority, string> = {
		mandatory: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
		preferred: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		optional: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
	};

	return (
		<span className={cn("px-2 py-0.5 text-xs font-medium rounded capitalize", styles[priority])}>
			{priority}
		</span>
	);
}

function RiskBadge({ level }: { level: RiskLevel | null }) {
	if (!level) return null;

	const styles: Record<RiskLevel, string> = {
		low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
		critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	return (
		<span className={cn("px-2 py-0.5 text-xs font-medium rounded capitalize", styles[level])}>
			{level} Risk
		</span>
	);
}

// ============================================================================
// Icons
// ============================================================================

function CloseIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}

function WarningIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}

// ============================================================================
// Helpers
// ============================================================================

const STATUS_STYLES: Record<ComplianceStatus, string> = {
	not_addressed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
	partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
	compliant: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	non_compliant: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	not_applicable: "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-500",
};

const CATEGORY_OPTIONS: { value: NonNullable<Requirement["category"]>; label: string }[] = [
	{ value: "technical", label: "Technical" },
	{ value: "legal", label: "Legal" },
	{ value: "financial", label: "Financial" },
	{ value: "experience", label: "Experience" },
	{ value: "administrative", label: "Administrative" },
	{ value: "personnel", label: "Personnel" },
	{ value: "security", label: "Security" },
	{ value: "compliance", label: "Compliance" },
	{ value: "other", label: "Other" },
];

const PRIORITY_OPTIONS: { value: RequirementPriority; label: string }[] = [
	{ value: "mandatory", label: "Mandatory" },
	{ value: "preferred", label: "Preferred" },
	{ value: "optional", label: "Optional" },
];

export function getWorkflowGateStatus(
	requirement: Requirement,
	formData: RequirementUpdateInput,
	currentUserId: string | null
) {
	const assignedTo = formData.assignedTo ?? requirement.assignedTo ?? currentUserId;
	const dueDate = formData.dueDate ?? requirement.dueDate;
	const source = formData.source ?? requirement.source ?? requirement.sourcePageRef;

	return [
		{ label: "source trace", ready: Boolean(source) },
		{ label: "category", ready: Boolean(formData.category ?? requirement.category) },
		{ label: "priority", ready: Boolean(formData.priority ?? requirement.priority) },
		{ label: "owner", ready: Boolean(assignedTo) },
		{ label: "due date", ready: Boolean(dueDate) },
	];
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(date));
}

function formatDateTime(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(date));
}
