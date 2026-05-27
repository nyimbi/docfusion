/**
 * SubmissionForm Component - DocFusion
 *
 * Pre-submission checklist and form for submitting proposals.
 */

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import type {
	PreSubmissionChecklistDetail,
	PreSubmissionChecklistItem,
	SubmissionMethod,
	Submission,
	ProposalDocumentType,
} from "@/lib/types/opportunity";
import {
	createSubmission,
	getPreSubmissionChecklist,
} from "@/lib/actions/submissions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SubmissionFormProps {
	opportunityId: string;
	opportunityTitle: string;
	documents: Array<{
		id: string;
		documentId: string;
		title: string;
		documentType: ProposalDocumentType;
		status: string;
	}>;
	checklist?: PreSubmissionChecklistItem[];
	onSubmissionComplete?: (submission: Submission) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function SubmissionForm({
	opportunityId,
	opportunityTitle,
	documents,
	checklist: initialChecklist,
	onSubmissionComplete,
}: SubmissionFormProps) {
	const [checklist, setChecklist] = useState<PreSubmissionChecklistItem[]>(
		initialChecklist || []
	);
	const [selectedDocuments, setSelectedDocuments] = useState<string[]>(
		documents.map((d) => d.documentId)
	);
	const [submissionMethod, setSubmissionMethod] = useState<SubmissionMethod>("portal");
	const [confirmationNumber, setConfirmationNumber] = useState("");
	const [notes, setNotes] = useState("");
	const [submittedBy, setSubmittedBy] = useState("");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [isChecklistLoading, setIsChecklistLoading] = useState(false);

	const refreshChecklist = useCallback(async () => {
		setIsChecklistLoading(true);
		try {
			const nextChecklist = await getPreSubmissionChecklist(opportunityId);
			setChecklist(nextChecklist);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to refresh checklist");
		} finally {
			setIsChecklistLoading(false);
		}
	}, [opportunityId]);

	useEffect(() => {
		if (!initialChecklist) {
			void refreshChecklist();
		}
	}, [initialChecklist, refreshChecklist]);

	const toggleChecklistItem = (itemId: string) => {
		setChecklist((prev) =>
			prev.map((item) =>
				item.id === itemId && !item.isSystemVerified
					? {
							...item,
							isCompleted: !item.isCompleted,
							completedAt: !item.isCompleted ? new Date() : undefined,
						}
					: item
			)
		);
	};

	const toggleDocument = (documentId: string) => {
		setSelectedDocuments((prev) =>
			prev.includes(documentId)
				? prev.filter((id) => id !== documentId)
				: [...prev, documentId]
		);
	};

	const requiredItemsCompleted = checklist
		.filter((item) => item.isRequired)
		.every((item) => item.isCompleted);
	const winThemeCoverageItem = checklist.find((item) => item.id === "evidence:evaluator-win-theme-coverage");

	const handleSubmit = () => {
		if (!submittedBy.trim()) {
			setError("Please enter your name");
			return;
		}

		if (selectedDocuments.length === 0) {
			setError("Please select at least one document to submit");
			return;
		}

		if (!confirmationNumber.trim()) {
			setError("Please enter a confirmation number or receipt reference");
			return;
		}

		setError(null);
		startTransition(async () => {
			try {
				const submission = await createSubmission({
					opportunityId,
					submittedBy: submittedBy.trim(),
					submissionMethod,
					confirmationNumber: confirmationNumber.trim() || undefined,
					attachmentIds: selectedDocuments,
					notes: notes.trim() || undefined,
				});
				onSubmissionComplete?.(submission);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to create submission");
			}
		});
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-lg font-semibold text-[var(--foreground)]">
					Submit Proposal
				</h2>
				<p className="text-sm text-[var(--foreground-muted)]">
					{opportunityTitle}
				</p>
			</div>

			{/* Pre-Submission Checklist */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
				<div className="mb-3 flex items-center justify-between gap-3">
					<h3 className="font-medium text-[var(--foreground)]">
						Pre-Submission Checklist
					</h3>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void refreshChecklist()}
						disabled={isChecklistLoading || isPending}
						isLoading={isChecklistLoading}
						loadingText="Refreshing checklist"
					>
						<RefreshCw className="h-4 w-4" />
						Refresh
						</Button>
					</div>
					{winThemeCoverageItem?.details?.length ? (
						<div
							className={cn(
								"mb-3 rounded-md border p-3",
								winThemeCoverageItem.isCompleted
									? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
									: winThemeCoverageItem.isRequired
										? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
										: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
							)}
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="text-sm font-medium text-[var(--foreground)]">
									Evaluator win-theme coverage
								</p>
								<span
									className={cn(
										"rounded px-2 py-0.5 text-xs font-medium",
										winThemeCoverageItem.isCompleted
											? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
											: winThemeCoverageItem.isRequired
												? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
												: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
									)}
								>
									{winThemeCoverageItem.isCompleted ? "Covered" : winThemeCoverageItem.isRequired ? "Blocking" : "Advisory"}
								</span>
							</div>
							<p className="mt-1 text-xs text-[var(--foreground-muted)]">
								{winThemeCoverageItem.description}
							</p>
							<div className="mt-3 grid gap-2 sm:grid-cols-3">
								{winThemeCoverageItem.details.map((detail) => (
									<ChecklistDetailBadge key={`${detail.label}:${detail.value}`} detail={detail} />
								))}
							</div>
						</div>
					) : null}
					<div className="space-y-2">
						{checklist.map((item) => (
						<label
							key={item.id}
							className={cn(
								"flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--background-muted)]",
								item.isCompleted && "bg-green-50 dark:bg-green-950/20"
							)}
						>
						<input
							type="checkbox"
							checked={item.isCompleted}
							disabled={item.isSystemVerified}
							onChange={() => toggleChecklistItem(item.id)}
							className="mt-1 h-4 w-4 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
						/>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span
										className={cn(
											"text-sm font-medium",
											item.isCompleted
												? "text-green-700 dark:text-green-400"
												: "text-[var(--foreground)]"
										)}
									>
										{item.label}
									</span>
									{item.isRequired && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
											Required
										</span>
									)}
									{item.isSystemVerified && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
											System checked
										</span>
									)}
								</div>
									<p className="text-xs text-[var(--foreground-muted)]">
										{item.description}
									</p>
									{item.details?.length && item.id !== "evidence:evaluator-win-theme-coverage" ? (
										<div className="mt-2 flex flex-wrap gap-2">
											{item.details.map((detail) => (
												<ChecklistDetailBadge key={`${detail.label}:${detail.value}`} detail={detail} />
											))}
										</div>
									) : null}
								</div>
							</label>
					))}
				</div>

				{!requiredItemsCompleted && (
					<p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
						Please complete all required checklist items before submitting.
					</p>
				)}
			</div>

			{/* Documents to Include */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
				<h3 className="font-medium text-[var(--foreground)] mb-3">
					Documents to Include
				</h3>
				<div className="space-y-2">
					{documents.map((doc) => (
						<label
							key={doc.id}
							className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--background-muted)]"
						>
							<input
								type="checkbox"
								checked={selectedDocuments.includes(doc.documentId)}
								onChange={() => toggleDocument(doc.documentId)}
								className="h-4 w-4 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
							/>
							<div className="flex-1">
								<span className="text-sm font-medium text-[var(--foreground)]">
									{doc.title}
								</span>
								<span className="ml-2 text-xs text-[var(--foreground-muted)]">
									{formatDocumentType(doc.documentType)}
								</span>
							</div>
							<StatusBadge status={doc.status} />
						</label>
					))}
				</div>
			</div>

			{/* Submission Details */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 space-y-4">
				<h3 className="font-medium text-[var(--foreground)]">
					Submission Details
				</h3>

				{/* Submitted By */}
				<div>
					<span className="block text-sm font-medium text-[var(--foreground)] mb-1">
						Submitted By <span className="text-red-500">*</span>
					</span>
					<input
						type="text"
						value={submittedBy}
						onChange={(e) => setSubmittedBy(e.target.value)}
						placeholder="Your name"
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					 aria-label="Submitted By"/>
				</div>

				{/* Submission Method */}
				<div>
					<span className="block text-sm font-medium text-[var(--foreground)] mb-1">
						Submission Method
					</span>
					<select
						value={submissionMethod}
						onChange={(e) => setSubmissionMethod(e.target.value as SubmissionMethod)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					 aria-label="Submission Method">
						<option value="portal">Online Portal</option>
						<option value="email">Email</option>
						<option value="physical">Physical Mail</option>
						<option value="ftp">FTP/File Transfer</option>
						<option value="other">Other</option>
					</select>
				</div>

				{/* Confirmation Number */}
				<div>
					<span className="block text-sm font-medium text-[var(--foreground)] mb-1">
						Confirmation Number <span className="text-red-500">*</span>
					</span>
					<input
						type="text"
						value={confirmationNumber}
						onChange={(e) => setConfirmationNumber(e.target.value)}
						placeholder="Portal confirmation or tracking number"
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					 aria-label="Confirmation Number"/>
				</div>

				{/* Notes */}
				<div>
					<span className="block text-sm font-medium text-[var(--foreground)] mb-1">
						Notes
					</span>
					<textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Any additional notes about this submission..."
						rows={3}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
					 aria-label="Notes"/>
				</div>
			</div>

			{/* Error Message */}
			{error && (
				<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
					{error}
				</div>
			)}

			{/* Submit Button */}
			<div className="flex justify-end gap-3">
				<Button
					onClick={handleSubmit}
					disabled={isPending || isChecklistLoading || !requiredItemsCompleted}
					isLoading={isPending}
				>
					Record Submission
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
	const styles: Record<string, string> = {
		final: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		in_review: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		drafting: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
		not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
	};

	return (
		<span
			className={cn(
				"text-xs px-2 py-0.5 rounded-full",
				styles[status] || styles.not_started
			)}
		>
			{status.replace("_", " ")}
		</span>
	);
}

function ChecklistDetailBadge({ detail }: { detail: PreSubmissionChecklistDetail }) {
	return (
		<div
			className={cn(
				"rounded border bg-[var(--background)] px-2 py-1",
				detail.tone === "success" && "border-green-200 text-green-700 dark:border-green-900 dark:text-green-300",
				detail.tone === "warning" && "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300",
				detail.tone === "danger" && "border-red-200 text-red-700 dark:border-red-900 dark:text-red-300",
				(!detail.tone || detail.tone === "neutral") && "border-[var(--border)] text-[var(--foreground)]"
			)}
		>
			<p className="text-[10px] uppercase text-[var(--foreground-muted)]">
				{detail.label}
			</p>
			<p className="break-words text-xs font-medium">
				{detail.value}
			</p>
		</div>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function formatDocumentType(type: string): string {
	const labels: Record<string, string> = {
		technical_approach: "Technical Approach",
		management_plan: "Management Plan",
		past_performance: "Past Performance",
		cost_proposal: "Cost Proposal",
		cover_letter: "Cover Letter",
		executive_summary: "Executive Summary",
		staffing_plan: "Staffing Plan",
		quality_assurance: "Quality Assurance",
		risk_mitigation: "Risk Mitigation",
		appendix: "Appendix",
		other: "Other",
	};
	return labels[type] || type;
}
