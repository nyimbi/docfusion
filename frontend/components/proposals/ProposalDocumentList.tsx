/**
 * ProposalDocumentList Component - DocFusion
 *
 * Displays a grid of proposal documents for an opportunity with
 * status indicators, progress bars, and quick actions.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, FileCheck2, PenLine, RotateCcw, Sparkles } from "lucide-react";
import type {
	ProposalDocument,
	ProposalDocumentStatus,
	ProposalDocumentType,
	ProposalProgress,
	ResponsePackageReadinessSummary,
} from "@/lib/types/opportunity";
import {
	generateRequirementAwareProposalDraft,
	transitionProposalDocumentFinalization,
	updateProposalDocumentStatus,
	unlinkProposalDocument,
} from "@/lib/actions/proposal-documents";
import { getDocumentTypeLabel, getStatusLabel } from "@/lib/utils/proposal-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ProposalDocumentListProps {
	documents: ProposalDocument[];
	progress: ProposalProgress;
	responsePackageReadiness?: ResponsePackageReadinessSummary;
	onDocumentUpdate?: (doc: ProposalDocument) => void;
	onDocumentRemove?: (id: string) => void;
	onCreateNew?: () => void;
}

const STATUS_COLORS: Record<ProposalDocumentStatus, { bg: string; text: string; border: string }> = {
	not_started: {
		bg: "bg-gray-100 dark:bg-gray-800",
		text: "text-gray-600 dark:text-gray-400",
		border: "border-gray-200 dark:border-gray-700",
	},
	drafting: {
		bg: "bg-blue-50 dark:bg-blue-950",
		text: "text-blue-600 dark:text-blue-400",
		border: "border-blue-200 dark:border-blue-800",
	},
	in_review: {
		bg: "bg-yellow-50 dark:bg-yellow-950",
		text: "text-yellow-600 dark:text-yellow-400",
		border: "border-yellow-200 dark:border-yellow-800",
	},
	revising: {
		bg: "bg-orange-50 dark:bg-orange-950",
		text: "text-orange-600 dark:text-orange-400",
		border: "border-orange-200 dark:border-orange-800",
	},
	approved: {
		bg: "bg-green-50 dark:bg-green-950",
		text: "text-green-600 dark:text-green-400",
		border: "border-green-200 dark:border-green-800",
	},
	final: {
		bg: "bg-emerald-100 dark:bg-emerald-900",
		text: "text-emerald-700 dark:text-emerald-300",
		border: "border-emerald-300 dark:border-emerald-700",
	},
};

const DOCUMENT_TYPE_ICONS: Record<ProposalDocumentType, React.ReactNode> = {
	cover_letter: <LetterIcon className="h-5 w-5" />,
	executive_summary: <SummaryIcon className="h-5 w-5" />,
	technical_approach: <TechIcon className="h-5 w-5" />,
	management_plan: <ManageIcon className="h-5 w-5" />,
	staffing_plan: <TeamIcon className="h-5 w-5" />,
	past_performance: <HistoryIcon className="h-5 w-5" />,
	cost_proposal: <CostIcon className="h-5 w-5" />,
	quality_assurance: <QualityIcon className="h-5 w-5" />,
	risk_mitigation: <RiskIcon className="h-5 w-5" />,
	appendix: <AppendixIcon className="h-5 w-5" />,
	other: <DocumentIcon className="h-5 w-5" />,
};

export function ProposalDocumentList({
	documents,
	progress,
	responsePackageReadiness,
	onDocumentUpdate,
	onDocumentRemove,
	onCreateNew,
}: ProposalDocumentListProps) {
	const [isPending, startTransition] = useTransition();
	const [draftingDocumentId, setDraftingDocumentId] = useState<string | null>(null);
	const [finalizingDocumentId, setFinalizingDocumentId] = useState<string | null>(null);
	const [finalizationError, setFinalizationError] = useState<{
		documentId: string;
		message: string;
	} | null>(null);

	const handleStatusChange = (doc: ProposalDocument, newStatus: ProposalDocumentStatus) => {
		startTransition(async () => {
			try {
				const updated = await updateProposalDocumentStatus(doc.id, newStatus);
				onDocumentUpdate?.(updated);
			} catch (error) {
				console.error("Failed to update status:", error);
			}
		});
	};

	const handleGenerateDraft = (doc: ProposalDocument) => {
		setDraftingDocumentId(doc.id);
		startTransition(async () => {
			try {
				const result = await generateRequirementAwareProposalDraft(doc.id);
				if (result.sectionsDrafted > 0) {
					onDocumentUpdate?.({ ...doc, status: "drafting" });
				}
			} catch (error) {
				console.error("Failed to generate requirement-aware draft:", error);
			} finally {
				setDraftingDocumentId(null);
			}
		});
	};

	const handleFinalization = (
		doc: ProposalDocument,
		action: "render" | "approve" | "signoff" | "reopen"
	) => {
		setFinalizingDocumentId(doc.id);
		setFinalizationError(null);
		startTransition(async () => {
			try {
				const updated = await transitionProposalDocumentFinalization(doc.id, {
					action,
					format: "docx",
					approvalRole: finalizationApprovalRole(action),
					reason: finalizationReason(action),
				});
				onDocumentUpdate?.(updated);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Final package action could not be completed";
				if (!isExpectedFinalizationBlocker(message)) {
					console.error("Failed to update final package workflow:", error);
				}
				setFinalizationError({
					documentId: doc.id,
					message,
				});
			} finally {
				setFinalizingDocumentId(null);
			}
		});
	};

	const handleRemove = (id: string) => {
		if (!confirm("Are you sure you want to remove this document from the proposal?")) return;

		startTransition(async () => {
			try {
				await unlinkProposalDocument(id);
				onDocumentRemove?.(id);
			} catch (error) {
				console.error("Failed to remove document:", error);
			}
		});
	};

	return (
		<div className="space-y-6">
			{/* Progress Overview */}
			<Card>
				<CardContent className="py-4">
					<div className="flex items-center justify-between mb-3">
						<div>
							<p className="text-sm font-medium text-[var(--foreground)]">
								Overall Progress
							</p>
							<p className="text-xs text-[var(--foreground-muted)] mt-0.5">
								{progress.totalDocuments} documents • {progress.documentsOnTrack} on track
								{progress.documentsOverdue > 0 && (
									<span className="text-red-500 ml-2">
										{progress.documentsOverdue} overdue
									</span>
								)}
							</p>
						</div>
						<span className="text-2xl font-semibold text-[var(--foreground)]">
							{progress.completionPercentage}%
						</span>
					</div>
					<div className="h-2 bg-[var(--background-muted)] rounded-full overflow-hidden">
						<div
							className={cn(
								"h-full rounded-full transition-all duration-500",
								progress.completionPercentage >= 80
									? "bg-green-500"
									: progress.completionPercentage >= 50
									? "bg-blue-500"
									: progress.completionPercentage >= 25
									? "bg-yellow-500"
									: "bg-gray-400"
							)}
							style={{ width: `${progress.completionPercentage}%` }}
						/>
					</div>
					<div className="flex items-center gap-4 mt-3 text-xs text-[var(--foreground-muted)]">
						<StatusCount
							label="Not Started"
							count={progress.byStatus.not_started}
							color="gray"
						/>
						<StatusCount label="Drafting" count={progress.byStatus.drafting} color="blue" />
						<StatusCount label="In Review" count={progress.byStatus.in_review} color="yellow" />
						<StatusCount label="Approved" count={progress.byStatus.approved} color="green" />
						<StatusCount label="Final" count={progress.byStatus.final} color="emerald" />
					</div>
				</CardContent>
			</Card>

			{/* Document Grid */}
			{documents.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{documents.map((doc) => (
						<ProposalDocumentCard
							key={doc.id}
							document={doc}
							onStatusChange={(status) => handleStatusChange(doc, status)}
							onGenerateDraft={() => handleGenerateDraft(doc)}
							onFinalization={(action) => handleFinalization(doc, action)}
							onRemove={() => handleRemove(doc.id)}
							isPending={isPending}
							isDrafting={draftingDocumentId === doc.id}
							isFinalizing={finalizingDocumentId === doc.id}
							responsePackageReadiness={responsePackageReadiness}
							finalizationError={finalizationError?.documentId === doc.id ? finalizationError.message : null}
						/>
					))}

					{/* Add New Card */}
					{onCreateNew && (
						<button
							onClick={onCreateNew}
							className={cn(
								"flex flex-col items-center justify-center gap-3 p-6",
								"border-2 border-dashed border-[var(--border)] rounded-lg",
								"text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
								"hover:border-[var(--accent-500)] hover:bg-[var(--background-muted)]",
								"transition-all duration-200 min-h-[200px]"
							)}
						>
							<PlusIcon className="h-8 w-8" />
							<span className="text-sm font-medium">Add Document</span>
						</button>
					)}
				</div>
			) : (
				<EmptyState onCreateNew={onCreateNew} />
			)}
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ProposalDocumentCard({
	document,
	onStatusChange,
	onGenerateDraft,
	onFinalization,
	onRemove,
	isPending,
	isDrafting,
	isFinalizing,
	responsePackageReadiness,
	finalizationError,
}: {
	document: ProposalDocument;
	onStatusChange: (status: ProposalDocumentStatus) => void;
	onGenerateDraft: () => void;
	onFinalization: (action: "render" | "approve" | "signoff" | "reopen") => void;
	onRemove: () => void;
	isPending: boolean;
	isDrafting: boolean;
	isFinalizing: boolean;
	responsePackageReadiness?: ResponsePackageReadinessSummary;
	finalizationError?: string | null;
}) {
	const statusStyle = STATUS_COLORS[document.status];
	const icon = DOCUMENT_TYPE_ICONS[document.documentType];
	const isOverdue = document.dueDate && new Date(document.dueDate) < new Date();
	const daysUntilDue = document.dueDate
		? Math.ceil(
				(new Date(document.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
		  )
		: null;

	return (
		<Card
			className={cn(
				"relative overflow-hidden group",
				isOverdue && document.status !== "final" && document.status !== "approved"
					? "border-red-300 dark:border-red-800"
					: ""
			)}
		>
			{/* Status Bar */}
			<div className={cn("h-1", statusStyle.bg)} />

			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"p-2 rounded-lg",
								"bg-[var(--background-muted)] text-[var(--foreground-muted)]"
							)}
						>
							{icon}
						</div>
						<div className="min-w-0">
							<CardTitle className="text-sm truncate">
								{document.document?.title || getDocumentTypeLabel(document.documentType)}
							</CardTitle>
							<p className="text-xs text-[var(--foreground-muted)] mt-0.5">
								{getDocumentTypeLabel(document.documentType)}
							</p>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								className={cn(
									"p-1.5 rounded-lg opacity-0 group-hover:opacity-100",
									"hover:bg-[var(--background-muted)] transition-all"
								)}
							>
								<MoreIcon className="h-4 w-4 text-[var(--foreground-muted)]" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild>
								<Link href={`/documents/${document.documentId}`}>Open Document</Link>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onGenerateDraft} disabled={isPending}>
								Draft linked sections
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => onStatusChange("drafting")}>
								Mark as Drafting
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onStatusChange("in_review")}>
								Mark as In Review
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onStatusChange("approved")}>
								Mark as Approved
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onStatusChange("final")}>
								Mark as Final
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem className="text-red-600" onClick={onRemove}>
								Remove from Proposal
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>

			<CardContent className="space-y-3">
				{/* Status Badge */}
				<div className="flex items-center justify-between">
					<span
						className={cn(
							"px-2 py-0.5 text-xs font-medium rounded-full",
							statusStyle.bg,
							statusStyle.text
						)}
					>
						{getStatusLabel(document.status)}
					</span>
					{document.aiAnalysisScore !== null && (
						<span className="text-xs text-[var(--foreground-muted)]">
							AI Score:{" "}
							<span
								className={cn(
									"font-medium",
									document.aiAnalysisScore >= 80
										? "text-green-600"
										: document.aiAnalysisScore >= 60
										? "text-yellow-600"
										: "text-red-600"
								)}
							>
								{document.aiAnalysisScore}
							</span>
						</span>
					)}
				</div>

				{/* Word Count */}
				{document.document && (
					<div className="flex items-center justify-between text-xs text-[var(--foreground-muted)]">
						<span>{document.document.wordCount.toLocaleString()} words</span>
						{document.assignedTo && <span>@{document.assignedTo}</span>}
					</div>
				)}

				{/* Due Date */}
				{document.dueDate && (
					<div
						className={cn(
							"flex items-center gap-1.5 text-xs",
							isOverdue
								? "text-red-600 dark:text-red-400"
								: daysUntilDue !== null && daysUntilDue <= 3
								? "text-yellow-600 dark:text-yellow-400"
								: "text-[var(--foreground-muted)]"
						)}
					>
						<CalendarIcon className="h-3.5 w-3.5" />
						<span>
							{isOverdue
								? `Overdue by ${Math.abs(daysUntilDue!)} day${Math.abs(daysUntilDue!) !== 1 ? "s" : ""}`
								: daysUntilDue === 0
								? "Due today"
								: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`}
						</span>
					</div>
				)}

				{/* Quick Action */}
				<FinalPackagePanel
					document={document}
					isPending={isPending}
					isFinalizing={isFinalizing}
					responsePackageReadiness={responsePackageReadiness}
					errorMessage={finalizationError}
					onFinalization={onFinalization}
				/>

				<div className="grid grid-cols-2 gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onGenerateDraft}
						disabled={isPending}
						isLoading={isDrafting}
						loadingText="Drafting sections"
					>
						<Sparkles className="h-4 w-4" />
						Draft
					</Button>
					<Link
						href={`/documents/${document.documentId}`}
						className={cn(
							"flex items-center justify-center gap-2 w-full h-8 px-3",
							"text-sm font-medium rounded-md",
							"bg-[var(--background-muted)] text-[var(--foreground)]",
							"hover:bg-[var(--accent-100)] hover:text-[var(--accent-700)]",
							"dark:hover:bg-[var(--accent-900)] dark:hover:text-[var(--accent-300)]",
							"transition-colors"
						)}
					>
						<EditIcon className="h-4 w-4" />
						Edit
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}

function FinalPackagePanel({
	document,
	isPending,
	isFinalizing,
	responsePackageReadiness,
	errorMessage,
	onFinalization,
}: {
	document: ProposalDocument;
	isPending: boolean;
	isFinalizing: boolean;
	responsePackageReadiness?: ResponsePackageReadinessSummary;
	errorMessage?: string | null;
	onFinalization: (action: "render" | "approve" | "signoff" | "reopen") => void;
}) {
	const approvedForRender = document.status === "approved" || document.status === "final";
	const responseReadyForRender = responsePackageReadiness?.status === "ready_for_review";
	const renderBlockedByReadiness = Boolean(responsePackageReadiness && !responseReadyForRender);
	const hash = document.finalArtifact?.artifactHash ?? document.renderedArtifact?.artifactHash ?? null;
	const hashLabel = hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : "No artifact hash";
	const signoffLabel = document.finalSubmissionSignoff
		? `Signed by ${document.finalSubmissionSignoff.signedBy}`
		: "Awaiting signoff";

	return (
		<div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--background-muted)] p-3">
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-xs font-medium text-[var(--foreground)]">Final package</p>
					<p className="truncate text-xs text-[var(--foreground-muted)]">{hashLabel}</p>
				</div>
				<span
					className={cn(
						"shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
						document.finalSubmissionSignoff
							? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
							: document.finalArtifact
							? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
							: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
					)}
				>
					{document.finalSubmissionSignoff ? "Signed" : document.finalArtifact ? "Approved" : "Open"}
				</span>
			</div>
			<p className="truncate text-xs text-[var(--foreground-muted)]">{signoffLabel}</p>
			{!approvedForRender && (
				<p className="text-xs text-amber-600 dark:text-amber-400">
					Approve the proposal document before rendering the final package.
				</p>
			)}
			{responsePackageReadiness && !document.finalArtifact && (
				<p
					className={cn(
						"text-xs",
						responseReadyForRender
							? "text-emerald-700 dark:text-emerald-300"
							: "text-red-600 dark:text-red-400"
					)}
				>
					{responseReadinessLabel(responsePackageReadiness)}
				</p>
			)}
			{errorMessage && (
				<p
					role="alert"
					className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
				>
					Final package action blocked: {errorMessage}
				</p>
			)}
			<div className="grid grid-cols-2 gap-2">
				{!document.finalArtifact && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onFinalization("render")}
						disabled={isPending || !approvedForRender || renderBlockedByReadiness}
						isLoading={isFinalizing}
						loadingText="Rendering final package"
					>
						<FileCheck2 className="h-4 w-4" />
						{document.renderedArtifact ? "Re-render" : "Render"}
					</Button>
				)}
				{document.renderedArtifact && !document.finalArtifact && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onFinalization("approve")}
						disabled={isPending}
						isLoading={isFinalizing}
						loadingText="Approving final package"
					>
						<BadgeCheck className="h-4 w-4" />
						Approve
					</Button>
				)}
				{document.finalArtifact && !document.finalSubmissionSignoff && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onFinalization("signoff")}
						disabled={isPending}
						isLoading={isFinalizing}
						loadingText="Recording signoff"
					>
						<PenLine className="h-4 w-4" />
						Sign off
					</Button>
				)}
				{document.finalArtifact && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onFinalization("reopen")}
						disabled={isPending}
						isLoading={isFinalizing}
						loadingText="Reopening final package"
					>
						<RotateCcw className="h-4 w-4" />
						Reopen
					</Button>
				)}
			</div>
		</div>
	);
}

function responseReadinessLabel(readiness: ResponsePackageReadinessSummary): string {
	if (readiness.status === "ready_for_review") {
		return `Response readiness passed: ${formatPercent(readiness.metrics.requirementCoverage)} accepted requirement coverage, ${formatPercent(readiness.metrics.reviewGateCoverage)} review gates, ${formatPercent(readiness.metrics.draftArtifactIntegrityCoverage)} draft artifacts.`;
	}
	if (readiness.status === "missing") {
		return "Response readiness missing; draft and review the response package before final rendering.";
	}
	if (readiness.status === "unknown") {
		return "Response readiness status is unrecognized; rerun response package drafting before final rendering.";
	}
	return `Response readiness blocked: ${readiness.blockers[0] ?? "Response package is not ready."}`;
}

function formatPercent(value: number): string {
	return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function finalizationReason(action: "render" | "approve" | "signoff" | "reopen") {
	switch (action) {
		case "render":
			return "Render the approved proposal document into the final DOCX package";
		case "approve":
			return "Approve the rendered final package for submission";
		case "signoff":
			return "Record executive or legal signoff for final submission";
		case "reopen":
			return "Reopen the final package for correction before submission";
	}
}

function finalizationApprovalRole(action: "render" | "approve" | "signoff" | "reopen") {
	switch (action) {
		case "approve":
		case "reopen":
			return "proposal_manager";
		case "signoff":
			return "executive_or_legal";
		case "render":
			return undefined;
	}
}

function isExpectedFinalizationBlocker(message: string): boolean {
	return /\bauthority\b|\brequires\b|approved final artifact|response readiness|stale artifact/i.test(message);
}

function StatusCount({
	label,
	count,
	color,
}: {
	label: string;
	count: number;
	color: "gray" | "blue" | "yellow" | "green" | "emerald";
}) {
	if (count === 0) return null;

	const dotColor = {
		gray: "bg-gray-400",
		blue: "bg-blue-500",
		yellow: "bg-yellow-500",
		green: "bg-green-500",
		emerald: "bg-emerald-500",
	}[color];

	return (
		<div className="flex items-center gap-1.5">
			<div className={cn("w-2 h-2 rounded-full", dotColor)} />
			<span>
				{count} {label}
			</span>
		</div>
	);
}

function EmptyState({ onCreateNew }: { onCreateNew?: () => void }) {
	return (
		<Card>
			<CardContent className="py-16">
				<div className="text-center">
					<div className="mx-auto h-12 w-12 rounded-full bg-[var(--background-muted)] flex items-center justify-center mb-4">
						<FolderIcon className="h-6 w-6 text-[var(--foreground-muted)]" />
					</div>
					<h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
						No Proposal Documents
					</h3>
					<p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto mb-6">
						Start building your proposal by creating or linking documents for each section.
					</p>
					{onCreateNew && (
						<Button variant="primary" onClick={onCreateNew}>
							<PlusIcon className="h-4 w-4 mr-2" />
							Create First Document
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Icons
// ============================================================================

function PlusIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
		</svg>
	);
}

function MoreIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
			/>
		</svg>
	);
}

function CalendarIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	);
}

function EditIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
			/>
		</svg>
	);
}

function FolderIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
			/>
		</svg>
	);
}

// Document Type Icons
function LetterIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
			/>
		</svg>
	);
}

function SummaryIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	);
}

function TechIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
			/>
		</svg>
	);
}

function ManageIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
			/>
		</svg>
	);
}

function TeamIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
			/>
		</svg>
	);
}

function HistoryIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}

function CostIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}

function QualityIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
			/>
		</svg>
	);
}

function RiskIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}

function AppendixIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
			/>
		</svg>
	);
}

function DocumentIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	);
}
