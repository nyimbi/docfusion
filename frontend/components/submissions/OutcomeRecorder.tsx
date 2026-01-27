/**
 * OutcomeRecorder Component - DocFusion
 *
 * Record the outcome of a submission (win/loss/withdrawn).
 */

"use client";

import { useState, useTransition } from "react";
import type { Submission, SubmissionOutcome } from "@/lib/types/opportunity";
import { recordOutcome } from "@/lib/actions/submissions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface OutcomeRecorderProps {
	submission: Submission;
	onOutcomeRecorded?: (submission: Submission) => void;
	onCancel?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function OutcomeRecorder({
	submission,
	onOutcomeRecorded,
	onCancel,
}: OutcomeRecorderProps) {
	const [outcome, setOutcome] = useState<SubmissionOutcome | null>(
		submission.outcome
	);
	const [outcomeNotes, setOutcomeNotes] = useState(submission.outcomeNotes || "");
	const [evaluatorFeedback, setEvaluatorFeedback] = useState(
		submission.evaluatorFeedback || ""
	);
	const [lessonsLearned, setLessonsLearned] = useState(
		submission.lessonsLearned || ""
	);
	const [contractValue, setContractValue] = useState(
		submission.contractValue?.toString() || ""
	);
	const [contractDuration, setContractDuration] = useState(
		submission.contractDuration || ""
	);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const handleSave = () => {
		if (!outcome) {
			setError("Please select an outcome");
			return;
		}

		setError(null);
		startTransition(async () => {
			try {
				const updated = await recordOutcome({
					submissionId: submission.id,
					outcome,
					outcomeNotes: outcomeNotes.trim() || undefined,
					evaluatorFeedback: evaluatorFeedback.trim() || undefined,
					lessonsLearned: lessonsLearned.trim() || undefined,
					contractValue: contractValue ? parseFloat(contractValue) : undefined,
					contractDuration: contractDuration.trim() || undefined,
				});
				onOutcomeRecorded?.(updated);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to record outcome");
			}
		});
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-lg font-semibold text-[var(--foreground)]">
					Record Outcome
				</h2>
				<p className="text-sm text-[var(--foreground-muted)]">
					Submitted on {submission.submittedAt.toLocaleDateString()}
				</p>
			</div>

			{/* Outcome Selection */}
			<div>
				<label className="block text-sm font-medium text-[var(--foreground)] mb-3">
					Outcome <span className="text-red-500">*</span>
				</label>
				<div className="grid grid-cols-2 gap-3">
					{OUTCOME_OPTIONS.map((option) => (
						<button
							key={option.value}
							onClick={() => setOutcome(option.value)}
							className={cn(
								"p-4 rounded-lg border-2 text-left transition-colors",
								outcome === option.value
									? option.selectedClass
									: "border-[var(--border)] hover:border-[var(--foreground-muted)]"
							)}
						>
							<div className="flex items-center gap-2">
								<span className="text-2xl">{option.icon}</span>
								<div>
									<p className="font-medium text-[var(--foreground)]">
										{option.label}
									</p>
									<p className="text-xs text-[var(--foreground-muted)]">
										{option.description}
									</p>
								</div>
							</div>
						</button>
					))}
				</div>
			</div>

			{/* Contract Details (for wins) */}
			{outcome === "won" && (
				<div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-4">
					<h3 className="font-medium text-green-700 dark:text-green-300">
						Contract Details
					</h3>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
								Contract Value
							</label>
							<div className="relative">
								<span className="absolute left-3 top-2 text-[var(--foreground-muted)]">
									$
								</span>
								<input
									type="number"
									value={contractValue}
									onChange={(e) => setContractValue(e.target.value)}
									placeholder="0"
									className="w-full pl-7 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-green-500 focus:border-transparent"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
								Contract Duration
							</label>
							<input
								type="text"
								value={contractDuration}
								onChange={(e) => setContractDuration(e.target.value)}
								placeholder="e.g., 12 months"
								className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-green-500 focus:border-transparent"
							/>
						</div>
					</div>
				</div>
			)}

			{/* Outcome Notes */}
			<div>
				<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
					Outcome Notes
				</label>
				<textarea
					value={outcomeNotes}
					onChange={(e) => setOutcomeNotes(e.target.value)}
					placeholder="Notes about the outcome..."
					rows={2}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
				/>
			</div>

			{/* Evaluator Feedback */}
			<div>
				<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
					Evaluator Feedback
				</label>
				<textarea
					value={evaluatorFeedback}
					onChange={(e) => setEvaluatorFeedback(e.target.value)}
					placeholder="Feedback received from the evaluators..."
					rows={3}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
				/>
			</div>

			{/* Lessons Learned */}
			<div>
				<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
					Lessons Learned
				</label>
				<textarea
					value={lessonsLearned}
					onChange={(e) => setLessonsLearned(e.target.value)}
					placeholder="What did we learn from this submission? What could we improve?"
					rows={3}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
				/>
			</div>

			{/* Error Message */}
			{error && (
				<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
					{error}
				</div>
			)}

			{/* Actions */}
			<div className="flex justify-end gap-3">
				{onCancel && (
					<Button variant="secondary" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<Button
					onClick={handleSave}
					disabled={isPending || !outcome}
					isLoading={isPending}
				>
					Save Outcome
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Constants
// ============================================================================

const OUTCOME_OPTIONS: Array<{
	value: SubmissionOutcome;
	label: string;
	description: string;
	icon: string;
	selectedClass: string;
}> = [
	{
		value: "won",
		label: "Won",
		description: "Contract awarded",
		icon: "🏆",
		selectedClass:
			"border-green-500 bg-green-50 dark:bg-green-950/30",
	},
	{
		value: "lost",
		label: "Lost",
		description: "Not selected",
		icon: "😔",
		selectedClass:
			"border-red-500 bg-red-50 dark:bg-red-950/30",
	},
	{
		value: "withdrawn",
		label: "Withdrawn",
		description: "Proposal withdrawn",
		icon: "↩️",
		selectedClass:
			"border-gray-500 bg-gray-50 dark:bg-gray-900",
	},
	{
		value: "no_award",
		label: "No Award",
		description: "RFP cancelled",
		icon: "⏸️",
		selectedClass:
			"border-amber-500 bg-amber-50 dark:bg-amber-950/30",
	},
];
