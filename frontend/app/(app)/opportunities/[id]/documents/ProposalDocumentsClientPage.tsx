/**
 * ProposalDocumentsClientPage Component - DocFusion
 *
 * Client component that handles interactive document management
 * including list, creation dialog, and state updates.
 */

"use client";

import { useState, useCallback } from "react";
import type { ProposalDocument, ProposalProgress } from "@/lib/types/opportunity";
import { ProposalDocumentList } from "@/components/proposals/ProposalDocumentList";
import { CreateProposalDialog } from "@/components/proposals/CreateProposalDialog";

interface ProposalDocumentsClientPageProps {
	opportunityId: string;
	initialDocuments: ProposalDocument[];
	initialProgress: ProposalProgress;
}

export function ProposalDocumentsClientPage({
	opportunityId,
	initialDocuments,
	initialProgress,
}: ProposalDocumentsClientPageProps) {
	const [documents, setDocuments] = useState(initialDocuments);
	const [progress, setProgress] = useState(initialProgress);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const handleDocumentUpdate = useCallback((updated: ProposalDocument) => {
		setDocuments((prev) =>
			prev.map((doc) => (doc.id === updated.id ? updated : doc))
		);
		// Recalculate progress (simplified - in production would refetch)
		recalculateProgress();
	}, []);

	const handleDocumentRemove = useCallback((id: string) => {
		setDocuments((prev) => prev.filter((doc) => doc.id !== id));
		recalculateProgress();
	}, []);

	const handleDocumentsCreated = useCallback((newDocs: ProposalDocument[]) => {
		setDocuments((prev) => [...prev, ...newDocs]);
		setShowCreateDialog(false);
		recalculateProgress();
	}, []);

	const recalculateProgress = useCallback(() => {
		// Simplified progress recalculation
		setProgress((prev) => {
			const docs = documents;
			const statusWeights: Record<string, number> = {
				not_started: 0,
				drafting: 20,
				in_review: 60,
				revising: 40,
				approved: 80,
				final: 100,
			};

			let totalWeight = 0;
			const byStatus: Record<string, number> = {
				not_started: 0,
				drafting: 0,
				in_review: 0,
				revising: 0,
				approved: 0,
				final: 0,
			};

			for (const doc of docs) {
				totalWeight += statusWeights[doc.status] || 0;
				byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
			}

			return {
				...prev,
				totalDocuments: docs.length,
				byStatus: byStatus as typeof prev.byStatus,
				completionPercentage: docs.length > 0 ? Math.round(totalWeight / docs.length) : 0,
			};
		});
	}, [documents]);

	return (
		<>
			<ProposalDocumentList
				documents={documents}
				progress={progress}
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
		</>
	);
}
