/**
 * Submission Tracking Page - DocFusion
 *
 * Track submissions and outcomes for an opportunity.
 */

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpportunity } from "@/lib/actions/opportunities";
import { getProposalDocuments } from "@/lib/actions/proposal-documents";
import { getSubmissionsByOpportunity } from "@/lib/actions/submissions";
import { SubmissionClientPage } from "./SubmissionClientPage";

// ============================================================================
// Page Component
// ============================================================================

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function SubmissionPage({ params }: PageProps) {
	const { id } = await params;

	const opportunity = await getOpportunity(id);
	if (!opportunity) {
		notFound();
	}

	const [proposalDocs, existingSubmissions] = await Promise.all([
		getProposalDocuments(id),
		getSubmissionsByOpportunity(id),
	]);

	return (
		<div className="min-h-screen bg-[var(--background-muted)]">
			{/* Header */}
			<header className="bg-[var(--background)] border-b border-[var(--border)]">
				<div className="max-w-6xl mx-auto px-6 py-4">
					<div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] mb-2">
						<Link
							href="/opportunities"
							className="hover:text-[var(--foreground)]"
						>
							Opportunities
						</Link>
						<span>/</span>
						<Link
							href={`/opportunities/${id}`}
							className="hover:text-[var(--foreground)]"
						>
							{opportunity.sourceId || "Details"}
						</Link>
						<span>/</span>
						<span className="text-[var(--foreground)]">Submission</span>
					</div>
					<h1 className="text-2xl font-bold text-[var(--foreground)]">
						Submission Tracking
					</h1>
					<p className="text-[var(--foreground-muted)] mt-1 line-clamp-1">
						{opportunity.title}
					</p>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-6xl mx-auto px-6 py-8">
				<Suspense
					fallback={
						<div className="flex items-center justify-center h-64">
							<div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
						</div>
					}
				>
					<SubmissionClientPage
						opportunityId={id}
						opportunityTitle={opportunity.title}
						deadline={opportunity.deadline}
						decisionStatus={opportunity.decisionStatus}
						proposalDocuments={proposalDocs.map((doc) => ({
							id: doc.id,
							documentId: doc.documentId,
							title: doc.document?.title ?? "Untitled document",
							documentType: doc.documentType,
							status: doc.status,
						}))}
						existingSubmissions={existingSubmissions.map((sub) => ({
							id: sub.id,
							opportunityId: sub.opportunityId,
							submittedAt: sub.submittedAt,
							submittedBy: sub.submittedBy,
							submissionMethod: sub.submissionMethod as any,
							confirmationNumber: sub.confirmationNumber,
							attachments: (sub.attachments || []) as any[],
							notes: sub.notes,
							status: sub.status as any,
							outcome: sub.outcome as any,
							outcomeDate: sub.outcomeDate,
							outcomeNotes: sub.outcomeNotes,
							evaluatorFeedback: sub.evaluatorFeedback,
							lessonsLearned: sub.lessonsLearned,
							contractValue: sub.contractValue,
							contractDuration: sub.contractDuration,
							createdAt: sub.createdAt,
							updatedAt: sub.updatedAt,
						}))}
					/>
				</Suspense>
			</main>
		</div>
	);
}
