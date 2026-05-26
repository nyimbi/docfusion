/**
 * SubmissionClientPage Component - DocFusion
 *
 * Client-side submission tracking with state management.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
	Submission,
	SubmissionAttachment,
	ProposalDocumentType,
} from "@/lib/types/opportunity";
import { SubmissionForm, OutcomeRecorder, WinLossChart } from "@/components/submissions";
import { submissionAttachmentReceiptLines } from "@/lib/submissions/attachment-receipts";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SubmissionClientPageProps {
	opportunityId: string;
	opportunityTitle: string;
	deadline: Date | null;
	decisionStatus: string;
	proposalDocuments: Array<{
		id: string;
		documentId: string;
		title: string;
		documentType: ProposalDocumentType;
		status: string;
	}>;
	existingSubmissions: Submission[];
}

// ============================================================================
// Main Component
// ============================================================================

export function SubmissionClientPage({
	opportunityId,
	opportunityTitle,
	deadline,
	decisionStatus,
	proposalDocuments,
	existingSubmissions: initialSubmissions,
}: SubmissionClientPageProps) {
	const router = useRouter();
	const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
	const [currentDecisionStatus, setCurrentDecisionStatus] = useState(decisionStatus);
	const [activeView, setActiveView] = useState<"form" | "history" | "outcome">(
		submissions.length > 0 ? "history" : "form"
	);
	const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(
		null
	);

	const latestSubmission = submissions[0];
	const hasSubmissions = submissions.length > 0;
	const canRecordOutcome = latestSubmission && !latestSubmission.outcome;

	const handleSubmissionComplete = (submission: Submission) => {
		setSubmissions((prev) => [submission, ...prev]);
		setCurrentDecisionStatus("submitted");
		setActiveView("history");
		setSelectedSubmission(null);
		router.refresh();
	};

	const handleOutcomeRecorded = (updatedSubmission: Submission) => {
		setSubmissions((prev) =>
			prev.map((s) => (s.id === updatedSubmission.id ? updatedSubmission : s))
		);
		setCurrentDecisionStatus(
			updatedSubmission.outcome === "won"
				? "won"
				: updatedSubmission.outcome === "lost"
					? "lost"
					: updatedSubmission.outcome === "withdrawn"
						? "declined"
						: "submitted"
		);
		setActiveView("history");
		setSelectedSubmission(null);
		router.refresh();
	};

	return (
		<div className="space-y-6">
			{/* Status Banner */}
			{deadline && (
				<StatusBanner
					deadline={deadline}
					decisionStatus={currentDecisionStatus}
					hasSubmissions={hasSubmissions}
				/>
			)}

			{/* Navigation Tabs */}
			<div className="flex gap-2">
				<TabButton
					active={activeView === "form"}
					onClick={() => setActiveView("form")}
					disabled={hasSubmissions && currentDecisionStatus === "submitted"}
				>
					{hasSubmissions ? "New Submission" : "Submit Proposal"}
				</TabButton>
				{hasSubmissions && (
					<TabButton
						active={activeView === "history"}
						onClick={() => setActiveView("history")}
					>
						Submission History ({submissions.length})
					</TabButton>
				)}
				{canRecordOutcome && (
					<TabButton
						active={activeView === "outcome"}
						onClick={() => {
							setSelectedSubmission(latestSubmission);
							setActiveView("outcome");
						}}
					>
						Record Outcome
					</TabButton>
				)}
			</div>

			{/* Content */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-6">
				{activeView === "form" && (
					<SubmissionForm
						opportunityId={opportunityId}
						opportunityTitle={opportunityTitle}
						documents={proposalDocuments}
						onSubmissionComplete={handleSubmissionComplete}
					/>
				)}

				{activeView === "history" && (
					<SubmissionHistory
						submissions={submissions}
						onRecordOutcome={(sub) => {
							setSelectedSubmission(sub);
							setActiveView("outcome");
						}}
					/>
				)}

				{activeView === "outcome" && selectedSubmission && (
					<OutcomeRecorder
						submission={selectedSubmission}
						onOutcomeRecorded={handleOutcomeRecorded}
						onCancel={() => {
							setActiveView("history");
							setSelectedSubmission(null);
						}}
					/>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatusBanner({
	deadline,
	decisionStatus,
	hasSubmissions,
}: {
	deadline: Date;
	decisionStatus: string;
	hasSubmissions: boolean;
}) {
	const now = new Date();
	const daysUntilDeadline = Math.ceil(
		(deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
	);
	const isPastDeadline = daysUntilDeadline < 0;

	const getStatusInfo = () => {
		if (decisionStatus === "won") {
			return {
				icon: "🏆",
				title: "Contract Won!",
				description: "Congratulations on winning this opportunity.",
				className: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
			};
		}
		if (decisionStatus === "lost") {
			return {
				icon: "📋",
				title: "Not Selected",
				description: "This opportunity was not awarded to us.",
				className: "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
			};
		}
		if (hasSubmissions && decisionStatus === "submitted") {
			return {
				icon: "⏳",
				title: "Awaiting Decision",
				description: "Proposal submitted. Waiting for evaluation results.",
				className: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
			};
		}
		if (isPastDeadline) {
			return {
				icon: "⚠️",
				title: "Deadline Passed",
				description: `Deadline was ${Math.abs(daysUntilDeadline)} day${Math.abs(daysUntilDeadline) !== 1 ? "s" : ""} ago.`,
				className: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
			};
		}
		if (daysUntilDeadline <= 3) {
			return {
				icon: "🔥",
				title: "Deadline Approaching!",
				description: `Only ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} left to submit.`,
				className: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
			};
		}
		return {
			icon: "📅",
			title: "Upcoming Deadline",
			description: `${daysUntilDeadline} days until deadline (${deadline.toLocaleDateString()}).`,
			className: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
		};
	};

	const status = getStatusInfo();

	return (
		<div className={cn("flex items-center gap-4 p-4 rounded-lg border", status.className)}>
			<span className="text-3xl">{status.icon}</span>
			<div>
				<h3 className="font-semibold text-[var(--foreground)]">{status.title}</h3>
				<p className="text-sm text-[var(--foreground-muted)]">{status.description}</p>
			</div>
		</div>
	);
}

function TabButton({
	active,
	onClick,
	disabled,
	children,
}: {
	active: boolean;
	onClick: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"px-4 py-2 text-sm font-medium rounded-lg transition-colors",
				active
					? "bg-blue-600 text-white"
					: "bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-muted)]",
				disabled && "opacity-50 cursor-not-allowed"
			)}
		>
			{children}
		</button>
	);
}

function SubmissionHistory({
	submissions,
	onRecordOutcome,
}: {
	submissions: Submission[];
	onRecordOutcome: (submission: Submission) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="font-medium text-[var(--foreground)]">Submission History</h3>

			<div className="space-y-3">
				{submissions.map((submission) => (
					<div
						key={submission.id}
						className="border border-[var(--border)] rounded-lg p-4"
					>
						<div className="flex items-start justify-between">
							<div>
								<div className="flex items-center gap-2">
									<OutcomeBadge
										status={submission.status}
										outcome={submission.outcome}
									/>
									<span className="text-sm text-[var(--foreground-muted)]">
										via {formatMethod(submission.submissionMethod)}
									</span>
								</div>
								<p className="text-sm text-[var(--foreground)] mt-1">
									Submitted by {submission.submittedBy} on{" "}
									{submission.submittedAt.toLocaleDateString()}
								</p>
								{submission.confirmationNumber && (
									<p className="text-xs text-[var(--foreground-muted)] mt-1">
										Confirmation: {submission.confirmationNumber}
									</p>
								)}
							</div>

							{!submission.outcome && (
								<button
									onClick={() => onRecordOutcome(submission)}
									className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
								>
									Record Outcome
								</button>
							)}
						</div>

						{/* Outcome Details */}
						{submission.outcome && (
							<div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2">
								{submission.contractValue && (
									<p className="text-sm">
										<span className="text-[var(--foreground-muted)]">
											Contract Value:
										</span>{" "}
										<span className="font-medium text-[var(--foreground)]">
											${submission.contractValue.toLocaleString()}
										</span>
									</p>
								)}
								{submission.evaluatorFeedback && (
									<div>
										<p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
											Evaluator Feedback
										</p>
										<p className="text-sm text-[var(--foreground)] mt-1">
											{submission.evaluatorFeedback}
										</p>
									</div>
								)}
								{submission.lessonsLearned && (
									<div>
										<p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
											Lessons Learned
										</p>
										<p className="text-sm text-[var(--foreground)] mt-1">
											{submission.lessonsLearned}
										</p>
									</div>
								)}
							</div>
						)}

						{/* Attachments */}
						{submission.attachments.length > 0 && (
							<div className="mt-3 pt-3 border-t border-[var(--border)]">
								<p className="text-xs text-[var(--foreground-muted)] mb-2">
									Attached Documents ({submission.attachments.length})
								</p>
								<div className="space-y-2">
									{submission.attachments.map((att) => (
										<SubmissionAttachmentReceipt key={att.documentId} attachment={att} />
									))}
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

function SubmissionAttachmentReceipt({ attachment }: { attachment: SubmissionAttachment }) {
	const receiptLines = submissionAttachmentReceiptLines(attachment);

	return (
		<div className="rounded border border-[var(--border)] bg-[var(--background-muted)] px-3 py-2">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium text-[var(--foreground)]">
					{attachment.documentTitle}
				</span>
				{attachment.downloadUrl && (
					<a
						href={attachment.downloadUrl}
						className="text-xs text-blue-600 hover:underline dark:text-blue-400"
					>
						Download
					</a>
				)}
			</div>
			{receiptLines.length > 0 && (
				<dl className="mt-1 grid gap-x-3 gap-y-1 text-xs text-[var(--foreground-muted)] sm:grid-cols-2">
					{receiptLines.map((line) => (
						<div key={`${attachment.documentId}-${line.label}`} className="min-w-0">
							<dt className="inline font-medium">{line.label}: </dt>
							<dd
								className={cn(
									"inline break-words",
									line.mono && "font-mono"
								)}
								title={line.title}
							>
								{line.value}
							</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	);
}

function OutcomeBadge({
	status,
	outcome,
}: {
	status: string;
	outcome: string | null;
}) {
	const getStyle = () => {
		if (outcome === "won") {
			return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
		}
		if (outcome === "lost") {
			return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
		}
		if (outcome === "withdrawn") {
			return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
		}
		if (outcome === "no_award") {
			return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
		}
		return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
	};

	const getLabel = () => {
		if (outcome) {
			return outcome.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
		}
		return status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
	};

	return (
		<span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", getStyle())}>
			{getLabel()}
		</span>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function formatMethod(method: string | null): string {
	const methods: Record<string, string> = {
		portal: "Online Portal",
		email: "Email",
		physical: "Physical Mail",
		ftp: "FTP",
		other: "Other",
	};
	return method ? methods[method] || method : "Unknown";
}
