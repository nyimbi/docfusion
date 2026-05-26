/**
 * RequirementsClientPage Component - DocFusion
 *
 * Client component that handles interactive requirements management
 * including table, detail panel, and extraction dialog.
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import type { Requirement, RequirementStats } from "@/lib/types/opportunity";
import { reviewRfpParseConfidence } from "@/lib/actions/rfp-parser";
import { createStandardProposalSet } from "@/lib/actions/proposal-documents";
import { RequirementsTable } from "@/components/requirements/RequirementsTable";
import { RequirementDetail } from "@/components/requirements/RequirementDetail";
import { RequirementExtractor } from "./RequirementExtractor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RequirementsClientPageProps {
	opportunityId: string;
	initialRequirements: Requirement[];
	initialStats: RequirementStats;
	initialRfpDocuments: RfpParseDocumentSummary[];
}

interface RfpParseDocumentSummary {
	id: string;
	filename: string;
	parsingStatus: string;
	parsingConfidence: number | null;
	metadata: unknown;
	createdAt: string;
}

type ParseReviewState = "auto_accepted" | "needs_review" | "accepted" | "correction_requested";

export function RequirementsClientPage({
	opportunityId,
	initialRequirements,
	initialStats,
	initialRfpDocuments,
}: RequirementsClientPageProps) {
	const router = useRouter();
	const [requirements, setRequirements] = useState(initialRequirements);
	const [stats, setStats] = useState(initialStats);
	const [rfpDocuments, setRfpDocuments] = useState(initialRfpDocuments);
	const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
	const [showExtractor, setShowExtractor] = useState(false);
	const [isBuildingResponsePackage, setIsBuildingResponsePackage] = useState(false);
	const acceptedRequirementCount = requirements.filter((requirement) =>
		requirement.workflowState === "accepted"
	).length;

	const handleRequirementClick = useCallback((req: Requirement) => {
		setSelectedRequirement(req);
	}, []);

	const handleRequirementUpdate = useCallback((updated: Requirement) => {
		setRequirements((prev) =>
			prev.map((r) => (r.id === updated.id ? updated : r))
		);
		setSelectedRequirement(updated);

		// Update stats based on status change
		// This is a simplified update - in production you'd refetch stats
	}, []);

	const handleRequirementsChange = useCallback(() => {
		// Refetch stats when requirements change
		// For now, we'll handle this optimistically
	}, []);

	const handleExtracted = useCallback((newRequirements: Requirement[]) => {
		setRequirements((prev) => [...prev, ...newRequirements]);
		setStats((prev) => ({
			...prev,
			total: prev.total + newRequirements.length,
			byStatus: {
				...prev.byStatus,
				not_addressed: prev.byStatus.not_addressed + newRequirements.length,
			},
		}));
		setShowExtractor(false);
	}, []);

	const handleBuildResponsePackage = useCallback(async () => {
		setIsBuildingResponsePackage(true);
		try {
			await createStandardProposalSet(opportunityId);
			toast.success("Response package is ready");
			router.push(`/opportunities/${opportunityId}/documents`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to build response package");
		} finally {
			setIsBuildingResponsePackage(false);
		}
	}, [opportunityId, router]);

	return (
		<>
			{/* Action Bar */}
			<ParseReviewPanel
				documents={rfpDocuments}
				onReviewed={(documentId, state) => {
					setRfpDocuments((prev) => prev.map((doc) =>
						doc.id === documentId
							? {
								...doc,
								metadata: mergeParseReviewState(doc.metadata, state),
							}
							: doc
					));
				}}
			/>

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-lg font-medium text-[var(--foreground)]">
						All Requirements
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="primary"
						size="sm"
						onClick={handleBuildResponsePackage}
						disabled={acceptedRequirementCount === 0 || isBuildingResponsePackage}
						isLoading={isBuildingResponsePackage}
						loadingText="Building package"
					>
						<FileText className="h-4 w-4 mr-2" />
						{acceptedRequirementCount > 0 ? "Build Response Package" : "Accept Requirements First"}
					</Button>
					<Button variant="outline" size="sm" onClick={() => setShowExtractor(true)}>
						<UploadIcon className="h-4 w-4 mr-2" />
						Extract from RFP
					</Button>
				</div>
			</div>

			{/* Requirements Table */}
			{requirements.length > 0 ? (
				<Card>
					<CardContent className="p-0">
						<RequirementsTable
							requirements={requirements}
							onRequirementClick={handleRequirementClick}
							onRequirementsChange={handleRequirementsChange}
						/>
					</CardContent>
				</Card>
			) : (
				<EmptyState onExtract={() => setShowExtractor(true)} />
			)}

			{/* Requirement Detail Slide-over */}
			<RequirementDetail
				requirement={selectedRequirement}
				open={selectedRequirement !== null}
				onClose={() => setSelectedRequirement(null)}
				onUpdate={handleRequirementUpdate}
			/>

			{/* Requirement Extractor Dialog */}
			<RequirementExtractor
				opportunityId={opportunityId}
				open={showExtractor}
				onClose={() => setShowExtractor(false)}
				onExtracted={handleExtracted}
			/>
		</>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ParseReviewPanel({
	documents,
	onReviewed,
}: {
	documents: RfpParseDocumentSummary[];
	onReviewed: (documentId: string, state: ParseReviewState) => void;
}) {
	const reviewable = documents.filter(isActionableParseReview);
	const waitingForCompletion = documents.filter((doc) => {
		const review = getParseReview(doc);
		return review.state === "needs_review" && doc.parsingStatus !== "completed";
	});
	const otherDocuments = documents
		.filter((doc) => !isActionableParseReview(doc))
		.slice(0, Math.max(0, 5 - reviewable.length));
	const visibleDocuments = [...reviewable, ...otherDocuments];
	if (documents.length === 0) return null;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">RFP Intake And Parser Review</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{visibleDocuments.map((doc) => (
						<ParseReviewRow
							key={doc.id}
							document={doc}
							onReviewed={onReviewed}
						/>
					))}
				</div>
				{reviewable.length > 0 && (
					<p className="mt-3 text-xs text-[var(--foreground-muted)]">
						{reviewable.length} parser output{reviewable.length === 1 ? "" : "s"} need human confidence review before requirements are treated as ready.
					</p>
				)}
				{waitingForCompletion.length > 0 && (
					<p className="mt-2 text-xs text-[var(--foreground-muted)]">
						{waitingForCompletion.length} parser output{waitingForCompletion.length === 1 ? " is" : "s are"} waiting for parse completion before review actions are available.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function ParseReviewRow({
	document,
	onReviewed,
}: {
	document: RfpParseDocumentSummary;
	onReviewed: (documentId: string, state: ParseReviewState) => void;
}) {
	const [isPending, setIsPending] = useState(false);
	const review = getParseReview(document);
	const confidence = review.confidence ?? document.parsingConfidence ?? 0;
	const needsReview = review.state === "needs_review";
	const canReview = needsReview && document.parsingStatus === "completed";

	const submitReview = async (action: "accept" | "request_correction") => {
		setIsPending(true);
		try {
			const result = await reviewRfpParseConfidence({
				rfpDocumentId: document.id,
				action,
				reason: action === "accept"
					? "Human reviewer accepted parser output for requirement workflow use."
					: "Parser output requires correction before downstream requirement acceptance.",
			});
			if (result.success && result.state) {
				onReviewed(document.id, result.state);
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="flex flex-col gap-3 rounded border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<p className="truncate text-sm font-medium text-[var(--foreground)]">{document.filename}</p>
					<span className="rounded bg-[var(--background-muted)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">
						{document.parsingStatus}
					</span>
					<span className={`rounded px-2 py-0.5 text-xs ${needsReview ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
						{formatParseReviewState(review.state)}
					</span>
				</div>
				<p className="mt-1 text-xs text-[var(--foreground-muted)]">
					Confidence {Math.round(confidence)}% / gate {Math.round(review.threshold)}%
				</p>
			</div>
			{canReview && (
				<div className="flex shrink-0 items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={isPending}
						onClick={() => submitReview("request_correction")}
					>
						Request Correction
					</Button>
					<Button
						variant="primary"
						size="sm"
						disabled={isPending}
						onClick={() => submitReview("accept")}
					>
						Accept Output
					</Button>
				</div>
			)}
			{needsReview && !canReview && (
				<p className="shrink-0 text-xs text-[var(--foreground-muted)]">
					Review opens after parse completion
				</p>
			)}
		</div>
	);
}

function isActionableParseReview(document: RfpParseDocumentSummary): boolean {
	return getParseReview(document).state === "needs_review" && document.parsingStatus === "completed";
}

function getParseReview(document: RfpParseDocumentSummary): {
	state: ParseReviewState;
	confidence: number;
	threshold: number;
} {
	const metadata = isRecord(document.metadata) ? document.metadata : {};
	const review = isRecord(metadata.parseReview) ? metadata.parseReview : {};
	const confidence = typeof review.confidence === "number"
		? review.confidence
		: document.parsingConfidence ?? 0;
	const threshold = typeof review.threshold === "number" ? review.threshold : 80;
	const state = isParseReviewState(review.state)
		? review.state
		: confidence >= threshold ? "auto_accepted" : "needs_review";

	return { state, confidence, threshold };
}

function mergeParseReviewState(metadata: unknown, state: ParseReviewState): Record<string, unknown> {
	const current = isRecord(metadata) ? metadata : {};
	const review = isRecord(current.parseReview) ? current.parseReview : {};
	return {
		...current,
		parseReview: {
			...review,
			state,
		},
	};
}

function isParseReviewState(value: unknown): value is ParseReviewState {
	return value === "auto_accepted" ||
		value === "needs_review" ||
		value === "accepted" ||
		value === "correction_requested";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatParseReviewState(state: ParseReviewState): string {
	return state.replace(/_/g, " ");
}

function EmptyState({ onExtract }: { onExtract: () => void }) {
	return (
		<Card>
			<CardContent className="py-16">
				<div className="text-center">
					<div className="mx-auto h-12 w-12 rounded-full bg-[var(--background-muted)] flex items-center justify-center mb-4">
						<DocumentIcon className="h-6 w-6 text-[var(--foreground-muted)]" />
					</div>
					<h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
						No Requirements Yet
					</h3>
					<p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto mb-6">
						Extract requirements from your RFP document to start tracking compliance and managing your proposal response.
					</p>
					<Button variant="primary" onClick={onExtract}>
						<UploadIcon className="h-4 w-4 mr-2" />
						Extract from RFP
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Icons
// ============================================================================

function UploadIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
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
