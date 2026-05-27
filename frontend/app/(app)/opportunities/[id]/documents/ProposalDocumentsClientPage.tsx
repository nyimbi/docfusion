/**
 * ProposalDocumentsClientPage Component - DocFusion
 *
 * Client component that handles interactive document management
 * including list, creation dialog, and state updates.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ProposalDocument, ProposalProgress, ResponsePackageReadinessSummary } from "@/lib/types/opportunity";
import { getProposalDocuments, getProposalProgress, getResponsePackageReadiness } from "@/lib/actions/proposal-documents";
import { getResponseWinThemeSeedReview } from "@/lib/actions/win-themes";
import { ProposalDocumentList } from "@/components/proposals/ProposalDocumentList";
import { CreateProposalDialog } from "@/components/proposals/CreateProposalDialog";
import { ResponseWinThemeReviewPanel } from "@/components/win-themes";
import type { ResponseWinThemeSeedReviewData } from "@/lib/types/win-themes";

interface ProposalDocumentsClientPageProps {
	opportunityId: string;
	initialDocuments: ProposalDocument[];
	initialProgress: ProposalProgress;
	initialResponsePackageReadiness: ResponsePackageReadinessSummary;
	initialWinThemeSeedReview?: ResponseWinThemeSeedReviewData;
}

export function ProposalDocumentsClientPage({
	opportunityId,
	initialDocuments,
	initialProgress,
	initialResponsePackageReadiness,
	initialWinThemeSeedReview,
}: ProposalDocumentsClientPageProps) {
	const router = useRouter();
	const [documents, setDocuments] = useState(initialDocuments);
	const [progress, setProgress] = useState(initialProgress);
	const [responsePackageReadiness, setResponsePackageReadiness] = useState(initialResponsePackageReadiness);
	const [winThemeSeedReview, setWinThemeSeedReview] = useState<ResponseWinThemeSeedReviewData>(
		initialWinThemeSeedReview ?? {
			seeds: [],
			acceptedRequirementCount: 0,
			evaluationCriteriaCount: 0,
		}
	);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	useEffect(() => {
		setDocuments(initialDocuments);
		setProgress(initialProgress);
		setResponsePackageReadiness(initialResponsePackageReadiness);
		setWinThemeSeedReview(initialWinThemeSeedReview ?? {
			seeds: [],
			acceptedRequirementCount: 0,
			evaluationCriteriaCount: 0,
		});
	}, [initialDocuments, initialProgress, initialResponsePackageReadiness, initialWinThemeSeedReview]);

	const refreshProposalState = useCallback(async () => {
		const [nextDocuments, nextProgress, nextResponseReadiness, nextSeedReview] = await Promise.all([
			getProposalDocuments(opportunityId),
			getProposalProgress(opportunityId),
			getResponsePackageReadiness(opportunityId),
			getResponseWinThemeSeedReview(opportunityId),
		]);
		setDocuments(nextDocuments);
		setProgress(nextProgress);
		setResponsePackageReadiness(nextResponseReadiness);
		if (nextSeedReview.success && nextSeedReview.data) {
			setWinThemeSeedReview(nextSeedReview.data);
		}
		router.refresh();
	}, [opportunityId, router]);

	const handleDocumentUpdate = useCallback((updated: ProposalDocument) => {
		setDocuments((prev) =>
			prev.map((doc) => (doc.id === updated.id ? updated : doc))
		);
		void refreshProposalState();
	}, [refreshProposalState]);

	const handleDocumentRemove = useCallback((id: string) => {
		setDocuments((prev) => prev.filter((doc) => doc.id !== id));
		void refreshProposalState();
	}, [refreshProposalState]);

	const handleDocumentsCreated = useCallback((newDocs: ProposalDocument[]) => {
		setDocuments((prev) => [...prev, ...newDocs]);
		setShowCreateDialog(false);
		void refreshProposalState();
	}, [refreshProposalState]);

	return (
		<div className="space-y-6">
			<ResponseWinThemeReviewPanel
				opportunityId={opportunityId}
				review={winThemeSeedReview}
				onCreated={() => {
					void refreshProposalState();
				}}
			/>

			<ProposalDocumentList
				documents={documents}
				progress={progress}
				responsePackageReadiness={responsePackageReadiness}
				onDocumentUpdate={handleDocumentUpdate}
				onDocumentRemove={handleDocumentRemove}
				onCreateNew={() => setShowCreateDialog(true)}
			/>

			<CreateProposalDialog
				opportunityId={opportunityId}
				open={showCreateDialog}
				onClose={() => setShowCreateDialog(false)}
				onCreated={handleDocumentsCreated}
			/>
		</div>
	);
}
