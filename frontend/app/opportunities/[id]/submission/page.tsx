/**
 * Submission Tracking Page - DocFusion
 *
 * Track submissions and outcomes for an opportunity.
 */

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { opportunities, proposalDocuments, documents, submissions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SubmissionClientPage } from "./SubmissionClientPage";

// ============================================================================
// Page Component
// ============================================================================

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function SubmissionPage({ params }: PageProps) {
	const { id } = await params;

	// Fetch opportunity
	const [opportunity] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, id));

	if (!opportunity) {
		notFound();
	}

	// Fetch proposal documents
	const proposalDocs = await db
		.select({
			id: proposalDocuments.id,
			documentId: proposalDocuments.documentId,
			documentType: proposalDocuments.documentType,
			status: proposalDocuments.status,
			title: documents.title,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(eq(proposalDocuments.opportunityId, id))
		.orderBy(proposalDocuments.sectionOrder);

	// Fetch existing submissions
	const existingSubmissions = await db
		.select()
		.from(submissions)
		.where(eq(submissions.opportunityId, id))
		.orderBy(desc(submissions.submittedAt));

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
							title: doc.title,
							documentType: doc.documentType as any,
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
